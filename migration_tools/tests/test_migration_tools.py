from __future__ import annotations

import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from migration_tools.common import (
    MigrationToolError,
    decode_value,
    iter_export_rows,
    validate_export_relations,
    verify_export_bundle,
)
from migration_tools.postgres_import import (
    STAGING_PROJECT_REFERENCE,
    dependency_order,
    validate_destination,
)
from migration_tools.sqlite_export import export_sqlite


class MigrationToolsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.source = self.root / "synthetic.sqlite"
        connection = sqlite3.connect(self.source)
        try:
            connection.executescript(
                """
                PRAGMA foreign_keys=ON;
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL
                );
                CREATE TABLE farms (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    area REAL,
                    metadata TEXT,
                    evidence BLOB,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
                CREATE UNIQUE INDEX uq_farms_user_area
                    ON farms(user_id, area);
                INSERT INTO users VALUES
                    (2, 'Synthetic Farmer B', 'fake-hash-b'),
                    (1, 'Synthetic Farmer A', 'fake-hash-a');
                INSERT INTO farms VALUES
                    (11, 1, 2.5, '{"crop":"fake"}', X'0001FF'),
                    (10, 1, NULL, NULL, NULL);
                """
            )
        finally:
            connection.close()
        self.expected_tables = {"users", "farms"}

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def _source_hash(self) -> str:
        return hashlib.sha256(self.source.read_bytes()).hexdigest()

    def test_dry_run_is_read_only_and_does_not_create_export(self) -> None:
        before = self._source_hash()
        output = self.root / "not-created"

        report = export_sqlite(
            self.source,
            output,
            expected_tables=self.expected_tables,
        )

        self.assertEqual(report["table_count"], 2)
        self.assertEqual(report["row_counts"], {"farms": 2, "users": 2})
        self.assertFalse(output.exists())
        self.assertEqual(self._source_hash(), before)

    def test_write_requires_sensitive_data_confirmation(self) -> None:
        output = self.root / "refused"

        with self.assertRaises(MigrationToolError):
            export_sqlite(
                self.source,
                output,
                write=True,
                expected_tables=self.expected_tables,
            )

        self.assertFalse(output.exists())

    def test_export_is_deterministic_and_preserves_nulls_and_relations(self) -> None:
        first = self.root / "export-one"
        second = self.root / "export-two"
        before = self._source_hash()
        for output in (first, second):
            export_sqlite(
                self.source,
                output,
                write=True,
                confirm_sensitive=True,
                expected_tables=self.expected_tables,
            )

        first_root, first_manifest = verify_export_bundle(first)
        second_root, second_manifest = verify_export_bundle(second)
        first_checks = validate_export_relations(first_root, first_manifest)
        second_checks = validate_export_relations(second_root, second_manifest)
        self.assertEqual(first_checks["foreign_key_violations"], 0)
        self.assertEqual(second_checks["foreign_key_violations"], 0)
        self.assertEqual(
            (first / "manifest.json").read_bytes(),
            (second / "manifest.json").read_bytes(),
        )
        self.assertEqual(
            (first / "data" / "farms.jsonl").read_bytes(),
            (second / "data" / "farms.jsonl").read_bytes(),
        )
        farms = next(item for item in first_manifest["tables"] if item["name"] == "farms")
        self.assertEqual(farms["null_counts"]["area"], 1)
        self.assertEqual(farms["null_counts"]["metadata"], 1)
        exported_rows = list(iter_export_rows(first_root, farms))
        self.assertEqual(decode_value(exported_rows[0]["evidence"]), None)
        self.assertEqual(decode_value(exported_rows[1]["evidence"]), b"\x00\x01\xff")
        self.assertEqual(self._source_hash(), before)

    def test_existing_export_destination_is_never_overwritten(self) -> None:
        output = self.root / "existing"
        output.mkdir()
        marker = output / "keep.txt"
        marker.write_text("untouched", encoding="utf-8")

        with self.assertRaises(MigrationToolError):
            export_sqlite(
                self.source,
                output,
                write=True,
                confirm_sensitive=True,
                expected_tables=self.expected_tables,
            )

        self.assertEqual(marker.read_text(encoding="utf-8"), "untouched")

    def test_bundle_tampering_is_detected(self) -> None:
        output = self.root / "export"
        export_sqlite(
            self.source,
            output,
            write=True,
            confirm_sensitive=True,
            expected_tables=self.expected_tables,
        )
        data_file = output / "data" / "farms.jsonl"
        data_file.write_text(data_file.read_text(encoding="utf-8") + "{}\n", encoding="utf-8")

        with self.assertRaises(MigrationToolError):
            verify_export_bundle(output)

    def test_import_order_places_referenced_tables_first(self) -> None:
        tables = [
            {
                "name": "child",
                "foreign_keys": [
                    {"table": "parent", "columns": [{"sequence": 0, "from": "parent_id"}]}
                ],
            },
            {"name": "parent", "foreign_keys": []},
        ]

        self.assertEqual(dependency_order(tables), ["parent", "child"])

    def test_import_order_rejects_cycles(self) -> None:
        tables = [
            {"name": "left_table", "foreign_keys": [{"table": "right_table"}]},
            {"name": "right_table", "foreign_keys": [{"table": "left_table"}]},
        ]

        with self.assertRaises(MigrationToolError):
            dependency_order(tables)

    def test_destination_guard_rejects_non_test_remote_endpoint(self) -> None:
        with self.assertRaises(MigrationToolError):
            validate_destination(
                "postgresql+pg8000://tester@example.invalid/farmer_ai",
                "local-test:farmer_ai",
            )

    def test_destination_guard_rejects_other_supabase_pooler(self) -> None:
        with self.assertRaises(MigrationToolError):
            validate_destination(
                "postgresql+pg8000://postgres."
                f"{STAGING_PROJECT_REFERENCE}@other.pooler.supabase.com/postgres"
                "?sslmode=verify-full",
                f"staging:{STAGING_PROJECT_REFERENCE}",
            )

    def test_staging_reference_is_the_confirmed_reference(self) -> None:
        self.assertEqual(STAGING_PROJECT_REFERENCE, "outlhivwrknmbtghsgmr")

    def test_destination_guard_accepts_only_named_local_test_database(self) -> None:
        url, label = validate_destination(
            "postgresql+pg8000://tester@localhost/farmer_ai_migration_test"
            "?sslmode=verify-full",
            "local-test:farmer_ai_migration_test",
        )

        self.assertEqual(url.database, "farmer_ai_migration_test")
        self.assertEqual(label, "local test database farmer_ai_migration_test")

    def test_destination_guard_rejects_other_local_database(self) -> None:
        with self.assertRaises(MigrationToolError):
            validate_destination(
                "postgresql+pg8000://tester@localhost/farmer_ai",
                "local-test:farmer_ai",
            )

    def test_manifest_contains_no_local_source_path(self) -> None:
        output = self.root / "export"
        export_sqlite(
            self.source,
            output,
            write=True,
            confirm_sensitive=True,
            expected_tables=self.expected_tables,
        )
        manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))

        self.assertEqual(manifest["source_file_name"], self.source.name)
        self.assertNotIn(str(self.root), json.dumps(manifest))


if __name__ == "__main__":
    unittest.main()
