from __future__ import annotations

import argparse
import hashlib
import os
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import SQLAlchemyError

from database.db import create_database_engine
from database.models import Base
from migration_tools.common import (
    MigrationToolError,
    canonical_json_line,
    model_table_names,
    validate_export_relations,
    verify_export_bundle,
)
from migration_tools.postgres_import import (
    DESTINATION_ENVIRONMENT_VARIABLE,
    validate_destination,
)


def _normalize_type(value: Any) -> str:
    normalized = " ".join(str(value).upper().split())
    return normalized.replace("TIMESTAMP WITHOUT TIME ZONE", "TIMESTAMP")


def _source_foreign_keys(table: dict[str, Any]) -> set[tuple[Any, ...]]:
    result = set()
    for foreign_key in table["foreign_keys"]:
        columns = sorted(foreign_key["columns"], key=lambda item: item["sequence"])
        result.add(
            (
                tuple(item["from"] for item in columns),
                foreign_key["table"],
                tuple(item["to"] for item in columns),
            )
        )
    return result


def _target_foreign_keys(inspector: Any, table_name: str) -> set[tuple[Any, ...]]:
    return {
        (
            tuple(item.get("constrained_columns") or []),
            item.get("referred_table"),
            tuple(item.get("referred_columns") or []),
        )
        for item in inspector.get_foreign_keys(table_name, schema="public")
    }


def _source_indexes(table: dict[str, Any]) -> set[tuple[tuple[str, ...], bool]]:
    result = set()
    for index in table["indexes"]:
        columns = index["columns"]
        if index["partial"] or not columns or any(column is None for column in columns):
            raise MigrationToolError(
                "Partial or expression indexes require manual migration review."
            )
        if index["origin"] != "pk":
            result.add((tuple(columns), bool(index["unique"])))
    return result


def _target_indexes(inspector: Any, table_name: str) -> set[tuple[tuple[str, ...], bool]]:
    result = set()
    for index in inspector.get_indexes(table_name, schema="public"):
        columns = index.get("column_names") or []
        if columns and all(column is not None for column in columns):
            result.add((tuple(columns), bool(index.get("unique"))))
    for constraint in inspector.get_unique_constraints(table_name, schema="public"):
        columns = constraint.get("column_names") or []
        if columns:
            result.add((tuple(columns), True))
    return result


def _duplicate_primary_key_count(
    connection: Any, table_name: str, primary_key: list[str]
) -> int:
    preparer = connection.dialect.identifier_preparer
    table = f"{preparer.quote_schema('public')}.{preparer.quote(table_name)}"
    columns = ", ".join(preparer.quote(column) for column in primary_key)
    duplicates = connection.execute(
        text(
            f"SELECT COUNT(*) FROM ("
            f"SELECT {columns} FROM {table} GROUP BY {columns} "
            "HAVING COUNT(*) > 1) AS duplicate_keys"
        )
    ).scalar_one()
    return int(duplicates)


def _foreign_key_violation_count(connection: Any, table: dict[str, Any]) -> int:
    preparer = connection.dialect.identifier_preparer
    total = 0
    child_table = (
        f"{preparer.quote_schema('public')}.{preparer.quote(table['name'])}"
    )
    for foreign_key in table["foreign_keys"]:
        columns = sorted(foreign_key["columns"], key=lambda item: item["sequence"])
        parent_name = foreign_key["table"]
        parent_table = (
            f"{preparer.quote_schema('public')}.{preparer.quote(parent_name)}"
        )
        predicates = [
            f"child.{preparer.quote(item['from'])} = "
            f"parent.{preparer.quote(item['to'])}"
            for item in columns
        ]
        non_null = " AND ".join(
            f"child.{preparer.quote(item['from'])} IS NOT NULL" for item in columns
        )
        missing_parent = (
            f"parent.{preparer.quote(columns[0]['to'])} IS NULL"
        )
        count = connection.execute(
            text(
                f"SELECT COUNT(*) FROM {child_table} AS child "
                f"LEFT JOIN {parent_table} AS parent ON {' AND '.join(predicates)} "
                f"WHERE {non_null} AND {missing_parent}"
            )
        ).scalar_one()
        total += int(count)
    return total


def validate_export(export_dir: str | Path) -> dict[str, Any]:
    root, manifest = verify_export_bundle(export_dir)
    if manifest["views"] or manifest["triggers"]:
        raise MigrationToolError("SQLite views or triggers require manual validation.")
    relation_checks = validate_export_relations(root, manifest)
    if relation_checks["foreign_key_violations"]:
        raise MigrationToolError("Export contains foreign-key violations.")
    if {table["name"] for table in manifest["tables"]} != model_table_names():
        raise MigrationToolError("Export table set does not match the application models.")
    return {
        "table_count": len(manifest["tables"]),
        "row_counts": {
            table["name"]: table["row_count"] for table in manifest["tables"]
        },
        "foreign_key_violations": relation_checks["foreign_key_violations"],
        "duplicate_primary_keys": relation_checks["duplicate_primary_keys"],
        "duplicate_unique_keys": relation_checks["duplicate_unique_keys"],
    }


def validate_postgres_export(
    export_dir: str | Path, raw_url: str, confirmation: str
) -> dict[str, Any]:
    destination_url, destination_label = validate_destination(raw_url, confirmation)
    root, manifest = verify_export_bundle(export_dir)
    if manifest["views"] or manifest["triggers"]:
        raise MigrationToolError("SQLite views or triggers require manual validation.")
    relation_checks = validate_export_relations(root, manifest)
    if relation_checks["foreign_key_violations"]:
        raise MigrationToolError("Export contains foreign-key violations.")
    if {table["name"] for table in manifest["tables"]} != model_table_names():
        raise MigrationToolError("Export table set does not match the application models.")

    engine = create_database_engine(destination_url)
    table_results: dict[str, dict[str, bool]] = {}
    try:
        with engine.connect() as connection:
            connection.execute(text("SET TRANSACTION READ ONLY"))
            inspector = inspect(connection)
            target_names = set(inspector.get_table_names(schema="public"))
            source_names = {table["name"] for table in manifest["tables"]}
            table_count_match = target_names == source_names

            for table in manifest["tables"]:
                name = table["name"]
                result = {
                    "columns": False,
                    "types": False,
                    "primary_key": False,
                    "foreign_keys": False,
                    "indexes_and_unique_constraints": False,
                    "row_count": False,
                    "duplicate_primary_keys": False,
                    "null_counts": False,
                    "foreign_key_integrity": False,
                    "data_integrity": False,
                }
                if name not in target_names:
                    table_results[name] = result
                    continue

                actual_columns = inspector.get_columns(name, schema="public")
                actual_by_name = {column["name"]: column for column in actual_columns}
                source_columns = {column["name"] for column in table["columns"]}
                result["columns"] = set(actual_by_name) == source_columns

                model_table = Base.metadata.tables[name]
                expected_types = {
                    column.name: _normalize_type(
                        column.type.compile(dialect=postgresql.dialect())
                    )
                    for column in model_table.columns
                }
                actual_types = {
                    column_name: _normalize_type(column["type"])
                    for column_name, column in actual_by_name.items()
                }
                result["types"] = (
                    set(actual_types) == set(expected_types)
                    and actual_types == expected_types
                )

                actual_pk = inspector.get_pk_constraint(name, schema="public").get(
                    "constrained_columns", []
                )
                result["primary_key"] = list(actual_pk or []) == table["primary_key"]
                result["foreign_keys"] = (
                    _target_foreign_keys(inspector, name) == _source_foreign_keys(table)
                )
                result["indexes_and_unique_constraints"] = (
                    _target_indexes(inspector, name) == _source_indexes(table)
                )

                preparer = connection.dialect.identifier_preparer
                qualified = (
                    f"{preparer.quote_schema('public')}.{preparer.quote(name)}"
                )
                count = int(
                    connection.execute(
                        text(f"SELECT COUNT(*) FROM {qualified}")
                    ).scalar_one()
                )
                result["row_count"] = count == table["row_count"]
                result["duplicate_primary_keys"] = (
                    _duplicate_primary_key_count(
                        connection, name, table["primary_key"]
                    )
                    == 0
                )
                result["foreign_key_integrity"] = (
                    _foreign_key_violation_count(connection, table) == 0
                )

                selected_columns = [column["name"] for column in table["columns"]]
                selected = ", ".join(
                    preparer.quote(column) for column in selected_columns
                )
                ordering = ", ".join(
                    preparer.quote(column) for column in table["primary_key"]
                )
                statement = text(
                    f"SELECT {selected} FROM {qualified} ORDER BY {ordering}"
                )
                digest = hashlib.sha256()
                null_counts = {column: 0 for column in selected_columns}
                row_count = 0
                for row in connection.execute(statement).mappings():
                    record = dict(row)
                    for column, value in record.items():
                        if value is None:
                            null_counts[column] += 1
                    digest.update(canonical_json_line(record).encode("utf-8"))
                    row_count += 1
                result["null_counts"] = null_counts == table["null_counts"]
                result["data_integrity"] = (
                    row_count == table["row_count"]
                    and digest.hexdigest() == table["data_sha256"]
                )
                table_results[name] = result

            connection.rollback()
    finally:
        engine.dispose()

    return {
        "destination": destination_label,
        "table_count_match": table_count_match,
        "tables": table_results,
    }


def _print_report(report: dict[str, Any]) -> bool:
    success = True
    if "table_count" in report:
        print("TABLE_COUNT=" + str(report["table_count"]))
        for name, count in sorted(report["row_counts"].items()):
            print(f"ROWS {name}={count}")
        print("EXPORT_INTEGRITY=PASS")
        return True

    print("DESTINATION=" + report["destination"])
    print("TABLE_COUNT=" + ("PASS" if report["table_count_match"] else "FAIL"))
    success = bool(report["table_count_match"])
    for name, checks in sorted(report["tables"].items()):
        failed = [check for check, passed in checks.items() if not passed]
        if failed:
            success = False
            print(f"TABLE {name}=FAIL ({','.join(failed)})")
        else:
            print(f"TABLE {name}=PASS")
    print("VALIDATION=" + ("PASS" if success else "FAIL"))
    return success


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate an offline export; target checks are read-only."
    )
    parser.add_argument("--export-dir", required=True)
    parser.add_argument(
        "--against-postgres",
        action="store_true",
        help="Compare against the explicitly confirmed test/staging target.",
    )
    parser.add_argument("--confirm-destination")
    args = parser.parse_args(argv)
    try:
        if not args.against_postgres:
            if args.confirm_destination:
                raise MigrationToolError(
                    "--confirm-destination requires --against-postgres."
                )
            report = validate_export(args.export_dir)
        else:
            raw_url = os.environ.get(DESTINATION_ENVIRONMENT_VARIABLE)
            if not raw_url:
                raise MigrationToolError(
                    f"{DESTINATION_ENVIRONMENT_VARIABLE} is not set; no .env file is read."
                )
            report = validate_postgres_export(
                args.export_dir,
                raw_url,
                args.confirm_destination or "",
            )
        return 0 if _print_report(report) else 1
    except (MigrationToolError, OSError, ValueError, TypeError, SQLAlchemyError) as exc:
        print(
            f"ERROR: validation failed ({type(exc).__name__}); "
            "details withheld."
        )
        return 2


if __name__ == "__main__":
    sys.exit(main())
