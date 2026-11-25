import os
import re
import sqlite3
import ssl
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy.engine import URL
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects import postgresql, sqlite

from database.db import (
    DatabaseConfigurationError,
    create_database_engine,
    create_session_factory,
    resolve_database_url,
    session_scope,
)
from database.models import Base, FarmerProfile, User
from database.models.base import FLOAT_64, INTEGER_64


PROJECT_ROOT = Path(__file__).resolve().parent
EXPECTED_TABLES = {
    "users",
    "farmer_profiles",
    "crop_recommendations",
    "plants",
    "disease_scans",
    "alerts",
    "irrigation_logs",
    "decision_scores",
    "password_reset_otps",
    "user_sessions",
    "farm_diary_entries",
    "farm_expenses",
    "farm_income",
    "tractor_jobs",
    "tractor_work_events",
    "tractor_disputes",
    "labour_jobs",
    "labour_workers",
    "labour_attendance",
    "labour_work_sessions",
    "labour_breaks",
    "labour_work_events",
    "labour_payments",
    "labour_advances",
    "labour_disputes",
    "labour_agreements",
}


def _normalized_default(value):
    if value is None:
        return None
    normalized = str(value).strip()
    while normalized.startswith("(") and normalized.endswith(")"):
        normalized = normalized[1:-1].strip()
    return normalized


def _snapshot_sqlite(connection):
    table_names = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
    }
    snapshot = {}

    for table_name in table_names:
        quoted_table = '"' + table_name.replace('"', '""') + '"'
        columns = connection.execute(
            f"PRAGMA table_info({quoted_table})"
        ).fetchall()
        column_snapshot = tuple(
            (
                row[1],
                (row[2] or "").upper(),
                bool(row[3]) if not row[5] else False,
                _normalized_default(row[4]),
                row[5],
            )
            for row in columns
        )

        foreign_keys = tuple(
            sorted(
                (
                    row[3],
                    row[2],
                    row[4],
                    (row[6] or "").upper(),
                )
                for row in connection.execute(
                    f"PRAGMA foreign_key_list({quoted_table})"
                )
            )
        )

        indexes = []
        for row in connection.execute(f"PRAGMA index_list({quoted_table})"):
            index_name = row[1]
            quoted_index = '"' + index_name.replace('"', '""') + '"'
            index_columns = tuple(
                item[2]
                for item in connection.execute(
                    f"PRAGMA index_info({quoted_index})"
                )
            )
            if index_name.startswith("sqlite_autoindex"):
                indexes.append(("UNIQUE_CONSTRAINT", index_columns))
            else:
                indexes.append(
                    (index_name, bool(row[2]), index_columns, bool(row[4]))
                )

        create_sql = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table_name,),
        ).fetchone()[0]
        snapshot[table_name] = {
            "columns": column_snapshot,
            "foreign_keys": foreign_keys,
            "indexes": tuple(sorted(indexes)),
            "autoincrement": "AUTOINCREMENT" in create_sql.upper(),
        }

    return snapshot


def _create_reference_schema(connection):
    schema_path = PROJECT_ROOT / "database" / "schema.sql"
    init_path = PROJECT_ROOT / "database" / "init_db.py"
    connection.executescript(schema_path.read_text(encoding="utf-8"))

    init_source = init_path.read_text(encoding="utf-8")
    migration_indexes = re.findall(
        r'cursor\.execute\("(CREATE INDEX IF NOT EXISTS [^"]+)"\)',
        init_source,
    )
    for statement in migration_indexes:
        connection.execute(statement)


class DatabaseFoundationTests(unittest.TestCase):
    def test_postgresql_url_uses_pg8000_and_ssl_without_connecting(self):
        url = resolve_database_url(
            "postgresql://staging-user@staging.invalid/farmer_ai_test"
        )
        self.assertEqual(url.drivername, "postgresql+pg8000")
        self.assertEqual(url.query["sslmode"], "verify-full")
        self.assertIsNone(url.password)

    def test_database_engine_accepts_sqlalchemy_url_without_rendering_it(self):
        url = URL.create(
            "postgresql+pg8000",
            username="staging-user",
            password="test-only",
            host="staging.invalid",
            database="farmer_ai_test",
            query={"sslmode": "verify-full"},
        )
        engine = create_database_engine(url)
        try:
            self.assertEqual(engine.url.password, "test-only")
            self.assertEqual(engine.dialect.driver, "pg8000")
            self.assertNotIn("sslmode", engine.url.query)
        finally:
            engine.dispose()

    def test_pg8000_engine_uses_verified_ssl_context_and_ca(self):
        ca_path = PROJECT_ROOT / "staging_connection_probe" / "supabase-ca.crt"
        url = URL.create(
            "postgresql+pg8000",
            username="staging-user",
            host="staging.invalid",
            database="farmer_ai_test",
            query={
                "sslmode": "verify-full",
                "sslrootcert": str(ca_path),
            },
        )

        with patch("database.db.create_engine") as engine_factory:
            create_database_engine(url)

        engine_url, = engine_factory.call_args.args
        connect_args = engine_factory.call_args.kwargs["connect_args"]
        ssl_context = connect_args["ssl_context"]
        self.assertEqual(engine_url.drivername, "postgresql+pg8000")
        self.assertNotIn("sslmode", engine_url.query)
        self.assertNotIn("sslrootcert", engine_url.query)
        self.assertEqual(ssl_context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(ssl_context.check_hostname)
        self.assertTrue(ssl_context.get_ca_certs())
        self.assertEqual(connect_args["timeout"], 10.0)

    def test_postgresql_ssl_mode_defaults_and_allowlist(self):
        for suffix in ("", "?sslmode=", "?sslmode=%20"):
            with self.subTest(suffix=suffix):
                url = resolve_database_url(
                    "postgresql://staging-user@staging.invalid/farmer_ai_test" + suffix
                )
                self.assertEqual(url.query["sslmode"], "verify-full")

        for sslmode in ("verify-full", "VERIFY-FULL"):
            with self.subTest(sslmode=sslmode):
                url = resolve_database_url(
                    "postgresql://staging-user@staging.invalid/farmer_ai_test"
                    f"?sslmode={sslmode}"
                )
                self.assertEqual(url.query["sslmode"], sslmode.lower())

        for sslmode in (
            "disable",
            "allow",
            "prefer",
            "require",
            "verify-ca",
            "invalid",
        ):
            with self.subTest(sslmode=sslmode):
                with self.assertRaises(DatabaseConfigurationError):
                    resolve_database_url(
                        "postgresql://staging-user@staging.invalid/farmer_ai_test"
                        f"?sslmode={sslmode}"
                    )

        with self.assertRaises(DatabaseConfigurationError):
            resolve_database_url(
                "postgresql://staging-user@staging.invalid/farmer_ai_test"
                "?sslmode=require&sslmode=verify-full"
            )

    def test_integer_and_float_types_preserve_sqlite_and_postgresql_width(self):
        self.assertEqual(INTEGER_64.compile(dialect=postgresql.dialect()), "BIGINT")
        self.assertEqual(INTEGER_64.compile(dialect=sqlite.dialect()), "INTEGER")
        self.assertEqual(FLOAT_64.compile(dialect=postgresql.dialect()), "DOUBLE PRECISION")
        self.assertEqual(FLOAT_64.compile(dialect=sqlite.dialect()), "REAL")

    def test_missing_or_unsupported_url_fails_without_echoing_url(self):
        with patch.dict(os.environ, {"DATABASE_URL": ""}):
            with self.assertRaises(DatabaseConfigurationError) as missing:
                create_database_engine()
        self.assertNotIn("DATABASE_URL=", str(missing.exception))

        with self.assertRaises(DatabaseConfigurationError) as unsupported:
            resolve_database_url("mysql://staging.invalid/farmer_ai_test")
        self.assertNotIn("staging.invalid", str(unsupported.exception))

    def test_models_match_schema_and_init_indexes_in_temporary_sqlite(self):
        self.assertEqual(set(Base.metadata.tables), EXPECTED_TABLES)

        reference = sqlite3.connect(":memory:")
        engine = None
        try:
            _create_reference_schema(reference)
            reference_snapshot = _snapshot_sqlite(reference)

            engine = create_database_engine(
                URL.create("sqlite+pysqlite", database=":memory:").render_as_string()
            )
            Base.metadata.create_all(engine)
            with engine.connect() as connection:
                model_snapshot = _snapshot_sqlite(
                    connection.connection.driver_connection
                )

            self.assertEqual(reference_snapshot, model_snapshot)
            self.assertEqual(len(model_snapshot), 26)
        finally:
            reference.close()
            if engine is not None:
                engine.dispose()

    def test_session_scope_commits_rolls_back_and_enforces_profile_fk(self):
        engine = create_database_engine(
            URL.create("sqlite+pysqlite", database=":memory:").render_as_string()
        )
        try:
            Base.metadata.create_all(engine)
            factory = create_session_factory(engine)

            with session_scope(factory) as db_session:
                user = User(
                    name="Test Farmer",
                    email="foundation-test@example.invalid",
                    password_hash="test-hash",
                )
                db_session.add(user)
                db_session.flush()
                db_session.add(FarmerProfile(user_id=user.id))

            with factory() as db_session:
                self.assertEqual(db_session.query(User).count(), 1)
                self.assertEqual(db_session.query(FarmerProfile).count(), 1)

            with self.assertRaises(RuntimeError):
                with session_scope(factory) as db_session:
                    db_session.add(
                        User(
                            name="Rolled Back",
                            email="rollback-test@example.invalid",
                            password_hash="test-hash",
                        )
                    )
                    raise RuntimeError("test rollback")

            with factory() as db_session:
                self.assertEqual(db_session.query(User).count(), 1)

            with self.assertRaises(IntegrityError):
                with session_scope(factory) as db_session:
                    db_session.add(FarmerProfile(user_id=999999))
                    db_session.flush()
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
