from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError

from database.db import create_database_engine, resolve_database_url
from database.db import DatabaseConfigurationError


PROJECT_ROOT = Path(__file__).resolve().parent
DATABASE_URL_ENV = "STAGING_DATABASE_URL"
PROJECT_REF_ENV = "FARMER_AI_STAGING_PROJECT_REF"
EXPECTED_STAGING_PROJECT_REF = "outlhivwrknnbtghsgmr"


class ConfigurationError(RuntimeError):
    pass


def _expected_project_ref() -> str:
    project_ref = os.environ.get(PROJECT_REF_ENV, "").strip().lower()
    if project_ref != EXPECTED_STAGING_PROJECT_REF:
        raise ConfigurationError(
            f"{PROJECT_REF_ENV} must match the Farmer AI staging project."
        )
    return EXPECTED_STAGING_PROJECT_REF


def _validated_ca_path(configured_path: object) -> str:
    if not isinstance(configured_path, str) or not configured_path:
        raise ConfigurationError("The staging CA certificate must be configured.")

    expected_path = PROJECT_ROOT / "staging_connection_probe" / "supabase-ca.crt"
    try:
        expected_path = expected_path.resolve(strict=True)
        actual_path = Path(configured_path).expanduser().resolve(strict=True)
        if actual_path != expected_path or not actual_path.is_file():
            raise ValueError
        with actual_path.open("rb") as certificate:
            if not certificate.read(1):
                raise ValueError
    except (OSError, RuntimeError, ValueError):
        raise ConfigurationError(
            "The staging CA certificate path is invalid or unreadable."
        ) from None

    return str(expected_path)


def _staging_url(raw_url: str) -> URL:
    try:
        url = resolve_database_url(raw_url)
    except (RuntimeError, ValueError, TypeError):
        raise ConfigurationError(
            "The configured database URL is invalid or unsupported; "
            "URL details were withheld."
        ) from None

    if url.drivername != "postgresql+pg8000" or not url.host:
        raise ConfigurationError(
            "Only a PostgreSQL URL using the pg8000 driver is allowed."
        )

    host = url.host.rstrip(".").lower()
    direct_host = f"db.{EXPECTED_STAGING_PROJECT_REF}.supabase.co"
    pooler_host = host.endswith(".pooler.supabase.com")
    pooler_user = (
        (url.username or "").lower()
        == f"postgres.{EXPECTED_STAGING_PROJECT_REF}"
    )
    if host != direct_host and not (pooler_host and pooler_user):
        raise ConfigurationError(
            "The URL endpoint does not match the Farmer AI staging project "
            "reference; no connection was attempted."
        )

    query = dict(url.query)
    query["sslmode"] = "verify-full"
    query["sslrootcert"] = _validated_ca_path(query.get("sslrootcert"))
    secure_url = url.set(query=query)
    return secure_url


def _sanitized_sqlstate(exc: BaseException) -> str:
    original = getattr(exc, "orig", exc)
    candidates = [
        getattr(original, "sqlstate", None),
        getattr(original, "pgcode", None),
    ]
    args = getattr(original, "args", ())
    if args and isinstance(args[0], dict):
        candidates.append(args[0].get("C"))

    for candidate in candidates:
        if isinstance(candidate, str) and re.fullmatch(r"[0-9A-Z]{5}", candidate):
            return candidate
    return "unavailable"


def main() -> int:
    try:
        load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=False)
        raw_url = os.environ.get(DATABASE_URL_ENV, "").strip()
        if not raw_url:
            raise ConfigurationError(
                f"Set {DATABASE_URL_ENV} in the project .env file or environment."
            )
        _expected_project_ref()
        secure_url = _staging_url(raw_url)
    except ConfigurationError as exc:
        print(f"FAIL: {exc}")
        return 2

    engine = None
    try:
        engine = create_database_engine(secure_url)
        with engine.connect() as connection:
            connection.execute(text("SET TRANSACTION READ ONLY"))
            version, database_name = connection.execute(
                text("SELECT version(), current_database()")
            ).one()
            ssl_info = connection.execute(
                text(
                    "SELECT ssl, version, cipher FROM pg_stat_ssl "
                    "WHERE pid = pg_backend_pid()"
                )
            ).one_or_none()
            connection.rollback()

        if ssl_info is None or not ssl_info[0]:
            print("FAIL: PostgreSQL did not report an SSL-protected connection.")
            return 1

        print("PASS: Connected to the configured Farmer AI staging project.")
        print("Database identity: staging project reference matched.")
        print(f"Database name: {database_name}")
        print(f"PostgreSQL version: {version}")
        print("SSL: active; certificate and hostname verification required.")
        print("No schema or data changes were performed.")
        return 0
    except (SQLAlchemyError, DatabaseConfigurationError) as exc:
        print(
            "FAIL: Connection or read-only verification failed "
            f"({type(exc).__name__}; SQLSTATE={_sanitized_sqlstate(exc)})."
        )
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
