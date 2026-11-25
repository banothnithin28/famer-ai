from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from migration_tools.common import (
    MigrationToolError,
    canonical_json_line,
    inspect_sqlite,
    model_table_names,
    open_sqlite_readonly,
    quote_identifier,
)


WORKSPACE = Path(__file__).resolve().parent
EXPORT_ROOT = WORKSPACE / "exports"


def export_sqlite(
    source: str | Path,
    output_dir: str | Path | None = None,
    *,
    write: bool = False,
    confirm_sensitive: bool = False,
    expected_tables: set[str] | None = None,
) -> dict[str, Any]:
    if write and not confirm_sensitive:
        raise MigrationToolError(
            "Writing an export requires explicit sensitive-data confirmation."
        )

    source_path = Path(source).expanduser().resolve(strict=True)
    connection = open_sqlite_readonly(source_path)
    try:
        snapshot = inspect_sqlite(connection)
        table_names = {table["name"] for table in snapshot["tables"]}
        if expected_tables is not None and table_names != expected_tables:
            raise MigrationToolError("SQLite table set does not match the expected schema.")
        if write and snapshot["foreign_key_violations"]:
            raise MigrationToolError("Foreign-key violations prevent export.")
        if write and snapshot["integrity_check"] != "ok":
            raise MigrationToolError("SQLite integrity check prevents export.")

        if not write:
            return {
                "table_count": len(snapshot["tables"]),
                "row_counts": {
                    table["name"]: table["row_count"] for table in snapshot["tables"]
                },
                "foreign_key_violations": snapshot["foreign_key_violations"],
                "integrity_check": snapshot["integrity_check"],
                "view_count": len(snapshot["views"]),
                "trigger_count": len(snapshot["triggers"]),
            }

        if output_dir is None:
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            output_path = EXPORT_ROOT / f"sqlite-export-{stamp}"
        else:
            output_path = Path(output_dir).expanduser().resolve()
        if output_path.exists():
            raise MigrationToolError("Export destination already exists; refusing to overwrite.")
        if output_path == source_path:
            raise MigrationToolError("Export destination cannot be the SQLite source.")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = Path(
            tempfile.mkdtemp(prefix=".migration-export-", dir=output_path.parent)
        )
        completed = False
        try:
            data_dir = temporary_path / "data"
            data_dir.mkdir()
            manifest_tables = []
            for table in snapshot["tables"]:
                name = table["name"]
                columns = [column["name"] for column in table["columns"]]
                primary_key = table["primary_key"]
                order_by = primary_key or columns
                selected = ", ".join(quote_identifier(column) for column in columns)
                ordering = ", ".join(quote_identifier(column) for column in order_by)
                query = (
                    f"SELECT {selected} FROM {quote_identifier(name)} "
                    f"ORDER BY {ordering}"
                )
                data_file = data_dir / f"{name}.jsonl"
                digest = hashlib.sha256()
                null_counts = {column: 0 for column in columns}
                row_count = 0
                with data_file.open("w", encoding="utf-8", newline="\n") as stream:
                    for row in connection.execute(query):
                        record = {column: row[column] for column in columns}
                        for column, value in record.items():
                            if value is None:
                                null_counts[column] += 1
                        line = canonical_json_line(record)
                        stream.write(line)
                        digest.update(line.encode("utf-8"))
                        row_count += 1
                if row_count != table["row_count"]:
                    raise MigrationToolError("SQLite row count changed during export.")

                manifest_tables.append(
                    {
                        **table,
                        "order_by": order_by,
                        "data_file": f"data/{name}.jsonl",
                        "data_sha256": digest.hexdigest(),
                        "null_counts": null_counts,
                    }
                )

            manifest = {
                "format_version": snapshot["format_version"],
                "source_file_name": source_path.name,
                "sensitive_data": True,
                "views": snapshot["views"],
                "triggers": snapshot["triggers"],
                "foreign_key_violations": snapshot["foreign_key_violations"],
                "integrity_check": snapshot["integrity_check"],
                "tables": manifest_tables,
            }
            manifest_file = temporary_path / "manifest.json"
            manifest_file.write_text(
                json.dumps(
                    manifest,
                    ensure_ascii=False,
                    allow_nan=False,
                    indent=2,
                    sort_keys=True,
                )
                + "\n",
                encoding="utf-8",
            )
            os.rename(temporary_path, output_path)
            completed = True
        finally:
            if not completed:
                shutil.rmtree(temporary_path)

        return {
            "table_count": len(manifest_tables),
            "row_counts": {
                table["name"]: table["row_count"] for table in manifest_tables
            },
            "foreign_key_violations": snapshot["foreign_key_violations"],
            "integrity_check": snapshot["integrity_check"],
            "view_count": len(snapshot["views"]),
            "trigger_count": len(snapshot["triggers"]),
            "output_dir": str(output_path),
        }
    finally:
        connection.close()


def _under_export_root(path: Path) -> bool:
    try:
        root = os.path.normcase(str(EXPORT_ROOT.resolve()))
        candidate = os.path.normcase(str(path))
        return candidate != root and os.path.commonpath((root, candidate)) == root
    except ValueError:
        return False


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Read-only SQLite export preparation for Farmer AI."
    )
    parser.add_argument("--source", required=True, help="SQLite source file path.")
    parser.add_argument("--output", help="New directory under migration_tools/exports.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        dest="write",
        action="store_false",
        help="Inspect schema and row counts without exporting data (default).",
    )
    mode.add_argument(
        "--write",
        dest="write",
        action="store_true",
        help="Write an export bundle. Dry-run is the default.",
    )
    parser.set_defaults(write=False)
    parser.add_argument(
        "--confirm-sensitive-export",
        action="store_true",
        help="Confirm that the bundle will contain personal and authentication data.",
    )
    args = parser.parse_args(argv)

    if args.write:
        print(
            "WARNING: the export contains personal and authentication data, "
            "including password/reset/session hashes and contact details. "
            "Protect the bundle and do not commit or share it."
        )
    if args.output:
        output = Path(args.output).expanduser().resolve()
        if not _under_export_root(output):
            print("ERROR: export output must be under migration_tools/exports.")
            return 2
    else:
        output = None

    try:
        result = export_sqlite(
            args.source,
            output,
            write=args.write,
            confirm_sensitive=args.confirm_sensitive_export,
            expected_tables=model_table_names(),
        )
        print("MODE=" + ("EXPORT" if args.write else "DRY_RUN"))
        print("TABLE_COUNT=" + str(result["table_count"]))
        for name, count in sorted(result["row_counts"].items()):
            print(f"ROWS {name}={count}")
        print("FOREIGN_KEY_VIOLATIONS=" + str(result["foreign_key_violations"]))
        print("INTEGRITY_CHECK=" + str(result["integrity_check"]))
        print("VIEW_COUNT=" + str(result["view_count"]))
        print("TRIGGER_COUNT=" + str(result["trigger_count"]))
        if result.get("output_dir"):
            print("EXPORT_DIRECTORY=" + result["output_dir"])
        return 0
    except (MigrationToolError, OSError, sqlite3.Error, ValueError, TypeError) as exc:
        print(f"ERROR: export failed ({type(exc).__name__}); details withheld.")
        return 2


if __name__ == "__main__":
    sys.exit(main())
