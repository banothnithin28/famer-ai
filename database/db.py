"""Explicit SQLAlchemy engine and session helpers for isolated database use."""

from __future__ import annotations

import math
import os
import ssl
import sqlite3
from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine, URL, make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


_SECURE_POSTGRES_SSL_MODES = {"verify-full"}


class DatabaseConfigurationError(RuntimeError):
    """Raised when DATABASE_URL is missing or unsupported."""


def resolve_database_url(database_url: str | URL | None = None) -> URL:
    """Parse a database URL without including its contents in errors."""
    raw_url = database_url if database_url is not None else os.environ.get("DATABASE_URL")
    if not isinstance(raw_url, (str, URL)) or (
        isinstance(raw_url, str) and not raw_url.strip()
    ):
        raise DatabaseConfigurationError("DATABASE_URL is required to create a database engine.")

    try:
        url = raw_url if isinstance(raw_url, URL) else make_url(raw_url.strip())
    except (ArgumentError, TypeError, AttributeError):
        raise DatabaseConfigurationError("DATABASE_URL is not a valid SQLAlchemy URL.") from None

    backend = url.drivername.split("+", 1)[0]
    if backend in ("postgres", "postgresql"):
        if url.drivername in ("postgres", "postgresql"):
            url = url.set(drivername="postgresql+pg8000")
        elif url.drivername != "postgresql+pg8000":
            raise DatabaseConfigurationError(
                "PostgreSQL DATABASE_URL must use the pg8000 driver."
            )

        query = dict(url.query)
        sslmode = query.get("sslmode")
        if isinstance(sslmode, tuple):
            raise DatabaseConfigurationError(
                "PostgreSQL sslmode must be specified at most once."
            )
        normalized_sslmode = sslmode.strip().lower() if sslmode is not None else ""
        if not normalized_sslmode:
            normalized_sslmode = "verify-full"
        if normalized_sslmode not in _SECURE_POSTGRES_SSL_MODES:
            raise DatabaseConfigurationError(
                "PostgreSQL sslmode must be verify-full."
            )
        query["sslmode"] = normalized_sslmode
        url = url.set(query=query)
    elif backend != "sqlite":
        raise DatabaseConfigurationError(
            "DATABASE_URL must use PostgreSQL with pg8000 or SQLite."
        )

    return url


def create_database_engine(database_url: str | URL | None = None) -> Engine:
    """Create an engine on demand; this function does not open a connection."""
    url = resolve_database_url(database_url)
    backend = url.drivername.split("+", 1)[0]

    if backend in ("postgres", "postgresql"):
        query = dict(url.query)
        ca_path = query.pop("sslrootcert", None)
        if isinstance(ca_path, tuple):
            raise DatabaseConfigurationError(
                "PostgreSQL CA certificate must be specified at most once."
            )

        sslmode = query.pop("sslmode", None)
        if sslmode != "verify-full":
            raise DatabaseConfigurationError(
                "PostgreSQL sslmode must be verify-full."
            )

        timeout_values = [
            query.pop(name, None) for name in ("connect_timeout", "timeout")
        ]
        if any(isinstance(value, tuple) for value in timeout_values):
            raise DatabaseConfigurationError(
                "PostgreSQL connection timeout must be specified at most once."
            )
        configured_timeouts = [value for value in timeout_values if value is not None]
        if len(configured_timeouts) > 1:
            raise DatabaseConfigurationError(
                "PostgreSQL connection timeout must be specified at most once."
            )
        try:
            timeout = float(configured_timeouts[0]) if configured_timeouts else 10.0
        except (TypeError, ValueError):
            raise DatabaseConfigurationError(
                "PostgreSQL connection timeout must be a positive number."
            ) from None
        if not math.isfinite(timeout) or timeout <= 0:
            raise DatabaseConfigurationError(
                "PostgreSQL connection timeout must be a positive number."
            )

        try:
            ssl_context = ssl.create_default_context(
                cafile=str(ca_path) if ca_path else None
            )
            ssl_context.check_hostname = True
            ssl_context.verify_mode = ssl.CERT_REQUIRED
        except (OSError, ssl.SSLError, ValueError):
            raise DatabaseConfigurationError(
                "PostgreSQL CA certificate is invalid or unreadable."
            ) from None

        engine = create_engine(
            url.set(query=query),
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            pool_timeout=30,
            pool_recycle=300,
            connect_args={"ssl_context": ssl_context, "timeout": timeout},
        )
    elif url.database in (None, "", ":memory:"):
        engine = create_engine(
            url,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
    else:
        engine = create_engine(url, pool_pre_ping=True)

    if backend == "sqlite":

        @event.listens_for(engine, "connect")
        def _enable_sqlite_foreign_keys(
            dbapi_connection: sqlite3.Connection, _record: object
        ) -> None:
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA foreign_keys=ON")
            finally:
                cursor.close()

    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Bind a session factory to an explicitly managed engine."""
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@contextmanager
def session_scope(factory: sessionmaker[Session]) -> Generator[Session, None, None]:
    """Commit on success; roll back and close the session on failure."""
    with factory.begin() as db_session:
        yield db_session
