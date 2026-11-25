from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError, SQLAlchemyError

from database.db import DatabaseConfigurationError, create_database_engine
from database.models import Base
from migration_tools.common import (
    MigrationToolError,
    decode_value,
    model_table_names,
    validate_export_relations,
    verify_export_bundle,
)


STAGING_PROJECT_REFERENCE = "outlhivwrknmbtghsgmr"
STAGING_POOLER_HOST = "aws-1-ap-southeast-1.pooler.supabase.com"
DESTINATION_ENVIRONMENT_VARIABLE = "MIGRATION_TEST_DATABASE_URL"
DEFAULT_BATCH_SIZE = 500


def validate_destination(
    raw_url: str,
    confirmation: str | None,
) -> tuple[URL, str]:
    try:
        url = make_url(raw_url)
    except (ArgumentError, TypeError, AttributeError):
        raise MigrationToolError("Destination URL is invalid; details withheld.") from None

    if url.drivername != "postgresql+pg8000":
        raise MigrationToolError("Destination must use PostgreSQL with pg8000.")
    if not url.host or not url.database:
        raise MigrationToolError("Destination host and database are required.")

    host = url.host.lower().rstrip(".")
    username = url.username or ""
    database = url.database.lower()
    query = dict(url.query)
    sslmode = query.get("sslmode")
    if isinstance(sslmode, tuple) or sslmode != "verify-full":
        raise MigrationToolError("Destination must use sslmode=verify-full.")

    if host in {"localhost", "127.0.0.1", "::1"}:
        if database != "farmer_ai_migration_test":
            raise MigrationToolError("Local destination must be farmer_ai_migration_test.")
        expected_confirmation = f"local-test:{url.database}"
        label = f"local test database {url.database}"
    elif (
        host == STAGING_POOLER_HOST
        and url.port == 5432
        and database == "postgres"
        and username == f"postgres.{STAGING_PROJECT_REFERENCE}"
    ):
        ca_path = query.get("sslrootcert")
        if isinstance(ca_path, tuple) or not ca_path:
            raise MigrationToolError("Staging destination requires a CA certificate.")
        try:
            with Path(ca_path).expanduser().open("rb") as certificate:
                certificate.read(1)
        except OSError:
            raise MigrationToolError("Staging CA certificate is missing or unreadable.")
        if url.password is None:
            raise MigrationToolError("Staging destination credentials are incomplete.")
        expected_confirmation = f"staging:{STAGING_PROJECT_REFERENCE}"
        label = f"verified staging project {STAGING_PROJECT_REFERENCE}"
    else:
        raise MigrationToolError("Destination is not an approved test or staging endpoint.")

    if confirmation != expected_confirmation:
        raise MigrationToolError("Explicit destination confirmation does not match.")
    return url, label


def dependency_order(tables: list[dict[str, Any]]) -> list[str]:
    by_name = {table["name"]: table for table in tables}
    dependencies: dict[str, set[str]] = {name: set() for name in by_name}
    for name, table in by_name.items():
        for foreign_key in table["foreign_keys"]:
            parent = foreign_key["table"]
            if parent not in by_name:
                raise MigrationToolError("Export foreign key references a missing table.")
            dependencies[name].add(parent)

    result: list[str] = []
    ready = sorted(name for name, parents in dependencies.items() if not parents)
    while ready:
        name = ready.pop(0)
        result.append(name)
        for child in sorted(dependencies):
            if name in dependencies[child]:
                dependencies[child].remove(name)
                if not dependencies[child] and child not in result and child not in ready:
                    ready.append(child)
        ready.sort()
    if len(result) != len(by_name):
        raise MigrationToolError("Foreign-key dependency cycle requires manual import planning.")
    return result


def _qualified_table(connection: Any, table_name: str) -> str:
    preparer = connection.dialect.identifier_preparer
    return f"{preparer.quote_schema('public')}.{preparer.quote(table_name)}"


def _verify_target_schema(connection: Any, tables: list[dict[str, Any]]) -> None:
    inspector = inspect(connection)
    available = set(inspector.get_table_names(schema="public"))
    expected_names = {table["name"] for table in tables}
    if available != expected_names:
        raise MigrationToolError("Destination table set does not match the export schema.")

    for table in tables:
        name = table["name"]
        actual_columns = {
            column["name"]: column
            for column in inspector.get_columns(name, schema="public")
        }
        expected_columns = {column["name"] for column in table["columns"]}
        if set(actual_columns) != expected_columns:
            raise MigrationToolError("Destination columns do not match the export schema.")
        model_table = Base.metadata.tables.get(name)
        if model_table is None or set(model_table.columns.keys()) != expected_columns:
            raise MigrationToolError("Export columns do not match the application models.")
        expected_types = {
            column.name: " ".join(
                column.type.compile(dialect=postgresql.dialect()).upper().split()
            ).replace("TIMESTAMP WITHOUT TIME ZONE", "TIMESTAMP")
            for column in model_table.columns
        }
        actual_types = {
            column_name: " ".join(str(column["type"]).upper().split()).replace(
                "TIMESTAMP WITHOUT TIME ZONE", "TIMESTAMP"
            )
            for column_name, column in actual_columns.items()
        }
        if actual_types != expected_types:
            raise MigrationToolError("Destination column types do not match the application models.")

        actual_pk = inspector.get_pk_constraint(name, schema="public").get(
            "constrained_columns", []
        )
        if list(actual_pk or []) != table["primary_key"]:
            raise MigrationToolError("Destination primary key does not match the export schema.")

        source_foreign_keys = {
            (
                tuple(item["from"] for item in sorted(foreign_key["columns"], key=lambda item: item["sequence"])),
                foreign_key["table"],
                tuple(item["to"] for item in sorted(foreign_key["columns"], key=lambda item: item["sequence"])),
            )
            for foreign_key in table["foreign_keys"]
        }
        actual_foreign_keys = {
            (
                tuple(foreign_key.get("constrained_columns") or []),
                foreign_key.get("referred_table"),
                tuple(foreign_key.get("referred_columns") or []),
            )
            for foreign_key in inspector.get_foreign_keys(name, schema="public")
        }
        if actual_foreign_keys != source_foreign_keys:
            raise MigrationToolError("Destination foreign keys do not match the export schema.")

        source_indexes = {
            (tuple(index["columns"]), bool(index["unique"]))
            for index in table["indexes"]
            if index["origin"] != "pk"
        }
        actual_indexes = {
            (tuple(index.get("column_names") or []), bool(index.get("unique")))
            for index in inspector.get_indexes(name, schema="public")
            if index.get("column_names")
        }
        actual_indexes.update(
            (tuple(item.get("column_names") or []), True)
            for item in inspector.get_unique_constraints(name, schema="public")
            if item.get("column_names")
        )
        if actual_indexes != source_indexes:
            raise MigrationToolError("Destination indexes do not match the export schema.")


def import_export(
    export_dir: str | Path,
    raw_url: str,
    confirmation: str,
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
    expected_tables: set[str] | None = None,
) -> dict[str, Any]:
    if batch_size < 1:
        raise MigrationToolError("Batch size must be a positive integer.")
    url, destination_label = validate_destination(raw_url, confirmation)
    root, manifest = verify_export_bundle(export_dir)
    if manifest["views"] or manifest["triggers"]:
        raise MigrationToolError("SQLite views or triggers require manual migration.")
    if expected_tables is not None and {
        table["name"] for table in manifest["tables"]
    } != expected_tables:
        raise MigrationToolError("Export table set does not match the expected schema.")
    relation_report = validate_export_relations(root, manifest)
    if relation_report["foreign_key_violations"]:
        raise MigrationToolError("Export contains foreign-key violations.")

    engine = create_database_engine(url)
    inserted: dict[str, int] = {}
    try:
        with engine.begin() as connection:
            _verify_target_schema(connection, manifest["tables"])
            for table in manifest["tables"]:
                count = connection.execute(
                    text(f"SELECT COUNT(*) FROM {_qualified_table(connection, table['name'])}")
                ).scalar_one()
                if count:
                    raise MigrationToolError(
                        "Destination is not empty; no import was performed."
                    )

            by_name = {table["name"]: table for table in manifest["tables"]}
            preparer = connection.dialect.identifier_preparer
            for table_name in dependency_order(manifest["tables"]):
                table = by_name[table_name]
                column_names = [column["name"] for column in table["columns"]]
                quoted_columns = ", ".join(
                    preparer.quote(column) for column in column_names
                )
                bind_columns = ", ".join(f":{column}" for column in column_names)
                statement = text(
                    f"INSERT INTO {_qualified_table(connection, table_name)} "
                    f"({quoted_columns}) VALUES ({bind_columns})"
                )
                data_path = root / table["data_file"]
                batch: list[dict[str, Any]] = []
                count = 0
                with data_path.open("r", encoding="utf-8") as stream:
                    for line in stream:
                        row = json.loads(line)
                        batch.append(
                            {name: decode_value(value) for name, value in row.items()}
                        )
                        if len(batch) >= batch_size:
                            connection.execute(statement, batch)
                            count += len(batch)
                            batch.clear()
                    if batch:
                        connection.execute(statement, batch)
                        count += len(batch)
                if count != table["row_count"]:
                    raise MigrationToolError("Imported row count did not match the export.")
                inserted[table_name] = count

            for table in manifest["tables"]:
                primary_key = table["primary_key"]
                if len(primary_key) != 1 or primary_key[0] != "id":
                    continue
                quoted_id = preparer.quote("id")
                qualified = _qualified_table(connection, table["name"])
                maximum = connection.execute(
                    text(f"SELECT MAX({quoted_id}) FROM {qualified}")
                ).scalar_one()
                if maximum is None:
                    continue
                sequence_name = connection.execute(
                    text("SELECT pg_get_serial_sequence(:table_name, :column_name)"),
                    {
                        "table_name": f"public.{table['name']}",
                        "column_name": "id",
                    },
                ).scalar_one_or_none()
                if not sequence_name:
                    raise MigrationToolError(
                        "An ID sequence was not found for an imported table."
                    )
                connection.execute(
                    text(
                        "SELECT setval(CAST(:sequence_name AS regclass), "
                        ":last_id, true)"
                    ),
                    {"sequence_name": sequence_name, "last_id": maximum},
                )
    finally:
        engine.dispose()
    return {
        "destination": destination_label,
        "row_counts": inserted,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Guarded PostgreSQL import preparation; dry-run is the default."
    )
    parser.add_argument("--export-dir", required=True)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform a transactionally guarded import into an approved empty test target.",
    )
    parser.add_argument(
        "--confirm-destination",
        help="Use local-test:<database> or staging:<verified-project-reference>.",
    )
    args = parser.parse_args(argv)
    try:
        root, manifest = verify_export_bundle(args.export_dir)
        relations = validate_export_relations(root, manifest)
        if relations["foreign_key_violations"]:
            raise MigrationToolError("Export contains foreign-key violations.")
        if manifest["views"] or manifest["triggers"]:
            raise MigrationToolError("SQLite views or triggers require manual migration.")
        if {table["name"] for table in manifest["tables"]} != model_table_names():
            raise MigrationToolError("Export table set does not match the application models.")
        if not args.apply:
            print("MODE=DRY_RUN (no PostgreSQL connection made)")
            print("TABLE_COUNT=" + str(len(manifest["tables"])))
            for table in manifest["tables"]:
                print(f"ROWS {table['name']}={table['row_count']}")
            print("IMPORT_ORDER=" + ",".join(dependency_order(manifest["tables"])))
            return 0

        raw_url = os.environ.get(DESTINATION_ENVIRONMENT_VARIABLE)
        if not raw_url:
            raise MigrationToolError(
                f"{DESTINATION_ENVIRONMENT_VARIABLE} is not set; no .env file is read."
            )
        result = import_export(
            args.export_dir,
            raw_url,
            args.confirm_destination or "",
            batch_size=args.batch_size,
            expected_tables=model_table_names(),
        )
        print("IMPORT=SUCCESS")
        print("DESTINATION=" + result["destination"])
        for name, count in sorted(result["row_counts"].items()):
            print(f"ROWS {name}={count}")
        return 0
    except (
        MigrationToolError,
        DatabaseConfigurationError,
        SQLAlchemyError,
        OSError,
        ValueError,
        TypeError,
    ) as exc:
        print(f"ERROR: import preparation failed ({type(exc).__name__}); details withheld.")
        return 2


if __name__ == "__main__":
    sys.exit(main())
