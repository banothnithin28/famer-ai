from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import sqlite3
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterator


FORMAT_VERSION = 1
_BLOB_MARKER = "__sqlite_blob_base64__"
_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class MigrationToolError(RuntimeError):
    """Raised when a migration bundle or operation fails a safety check."""


def quote_identifier(identifier: str) -> str:
    if not _IDENTIFIER.fullmatch(identifier):
        raise MigrationToolError("Unsupported database identifier.")
    return '"' + identifier + '"'


def open_sqlite_readonly(source: str | Path) -> sqlite3.Connection:
    path = Path(source).expanduser().resolve(strict=True)
    if not path.is_file():
        raise MigrationToolError("SQLite source must be a regular file.")
    connection = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    connection.execute("BEGIN")
    return connection


def _column_metadata(connection: sqlite3.Connection, table: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        f"PRAGMA table_info({quote_identifier(table)})"
    ).fetchall()
    return [
        {
            "name": row["name"],
            "type": (row["type"] or "").upper(),
            "not_null": bool(row["notnull"]),
            "default": row["dflt_value"],
            "primary_key_position": int(row["pk"]),
        }
        for row in rows
    ]


def _foreign_key_metadata(
    connection: sqlite3.Connection, table: str
) -> list[dict[str, Any]]:
    rows = connection.execute(
        f"PRAGMA foreign_key_list({quote_identifier(table)})"
    ).fetchall()
    grouped: dict[int, dict[str, Any]] = {}
    for row in rows:
        group = grouped.setdefault(
            int(row["id"]),
            {
                "table": row["table"],
                "on_update": row["on_update"],
                "on_delete": row["on_delete"],
                "match": row["match"],
                "columns": [],
            },
        )
        group["columns"].append(
            {
                "sequence": int(row["seq"]),
                "from": row["from"],
                "to": row["to"],
            }
        )
    result = list(grouped.values())
    for foreign_key in result:
        foreign_key["columns"].sort(key=lambda item: item["sequence"])
    return result


def _index_metadata(connection: sqlite3.Connection, table: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        f"PRAGMA index_list({quote_identifier(table)})"
    ).fetchall()
    indexes = []
    for row in rows:
        index_name = row["name"]
        details = connection.execute(
            f"PRAGMA index_info({quote_identifier(index_name)})"
        ).fetchall()
        indexes.append(
            {
                "name": index_name,
                "unique": bool(row["unique"]),
                "origin": row["origin"],
                "partial": bool(row["partial"]),
                "columns": [
                    detail["name"] for detail in sorted(details, key=lambda x: x["seqno"])
                ],
            }
        )
    return sorted(indexes, key=lambda item: item["name"])


def inspect_sqlite(connection: sqlite3.Connection) -> dict[str, Any]:
    tables = connection.execute(
        """
        SELECT name, sql
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    ).fetchall()
    views = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name"
    ).fetchall()
    triggers = connection.execute(
        "SELECT name, tbl_name, sql FROM sqlite_master "
        "WHERE type = 'trigger' ORDER BY name"
    ).fetchall()

    table_metadata = []
    for row in tables:
        name = row["name"]
        columns = _column_metadata(connection, name)
        primary_key = [
            item["name"]
            for item in sorted(
                (column for column in columns if column["primary_key_position"]),
                key=lambda column: column["primary_key_position"],
            )
        ]
        table_metadata.append(
            {
                "name": name,
                "create_sql": row["sql"],
                "columns": columns,
                "primary_key": primary_key,
                "foreign_keys": _foreign_key_metadata(connection, name),
                "indexes": _index_metadata(connection, name),
                "row_count": int(
                    connection.execute(
                        f"SELECT COUNT(*) FROM {quote_identifier(name)}"
                    ).fetchone()[0]
                ),
            }
        )

    foreign_key_violations = sum(
        1 for _ in connection.execute("PRAGMA foreign_key_check")
    )
    integrity_result = connection.execute("PRAGMA integrity_check").fetchone()[0]
    return {
        "format_version": FORMAT_VERSION,
        "tables": table_metadata,
        "views": [row["name"] for row in views],
        "triggers": [
            {"name": row["name"], "table": row["tbl_name"], "create_sql": row["sql"]}
            for row in triggers
        ],
        "foreign_key_violations": foreign_key_violations,
        "integrity_check": integrity_result,
    }


def encode_value(value: Any) -> Any:
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {
            _BLOB_MARKER: base64.b64encode(bytes(value)).decode("ascii"),
        }
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _key_value(value: Any) -> str:
    return json.dumps(
        encode_value(value),
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def decode_value(value: Any) -> Any:
    if isinstance(value, dict) and set(value) == {_BLOB_MARKER}:
        return base64.b64decode(value[_BLOB_MARKER], validate=True)
    return value


def canonical_json_line(row: dict[str, Any]) -> str:
    return json.dumps(
        {key: encode_value(value) for key, value in row.items()},
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ) + "\n"


def read_export_manifest(export_dir: str | Path) -> tuple[Path, dict[str, Any]]:
    root = Path(export_dir).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise MigrationToolError("Export path must be a directory.")
    manifest_path = root / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise MigrationToolError("Export manifest is missing or invalid.") from None
    if not isinstance(manifest, dict) or manifest.get("format_version") != FORMAT_VERSION:
        raise MigrationToolError("Unsupported export format.")
    if manifest.get("sensitive_data") is not True:
        raise MigrationToolError("Export is not marked as sensitive data.")
    if manifest.get("foreign_key_violations") != 0:
        raise MigrationToolError("Export manifest reports foreign-key violations.")
    if manifest.get("integrity_check") != "ok":
        raise MigrationToolError("Export manifest reports an integrity failure.")
    if not isinstance(manifest.get("views"), list) or not isinstance(
        manifest.get("triggers"), list
    ):
        raise MigrationToolError("Export schema metadata is incomplete.")
    tables = manifest.get("tables")
    if not isinstance(tables, list) or not tables:
        raise MigrationToolError("Export manifest contains no tables.")
    names = [table.get("name") for table in tables if isinstance(table, dict)]
    if len(names) != len(tables) or len(names) != len(set(names)):
        raise MigrationToolError("Export manifest contains invalid table entries.")
    for name in names:
        quote_identifier(name)
    return root, manifest


def _data_file(root: Path, table: dict[str, Any]) -> Path:
    expected = Path("data") / f"{table['name']}.jsonl"
    if table.get("data_file") != expected.as_posix():
        raise MigrationToolError("Export data file mapping is invalid.")
    candidate = (root / expected).resolve(strict=True)
    if os.path.commonpath((str(root), str(candidate))) != str(root):
        raise MigrationToolError("Export data file escapes its bundle.")
    if not candidate.is_file():
        raise MigrationToolError("Export data file is missing.")
    return candidate


def iter_export_rows(root: Path, table: dict[str, Any]) -> Iterator[dict[str, Any]]:
    data_file = _data_file(root, table)
    columns = [column.get("name") for column in table.get("columns", [])]
    if not columns or any(not isinstance(name, str) for name in columns):
        raise MigrationToolError("Export column metadata is invalid.")
    expected_columns = set(columns)
    with data_file.open("r", encoding="utf-8", newline="") as stream:
        for line in stream:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                raise MigrationToolError("Export data file contains invalid JSON.") from None
            if not isinstance(row, dict) or set(row) != expected_columns:
                raise MigrationToolError("Export row does not match its column metadata.")
            yield row


def verify_export_bundle(export_dir: str | Path) -> tuple[Path, dict[str, Any]]:
    root, manifest = read_export_manifest(export_dir)
    for table in manifest["tables"]:
        data_file = _data_file(root, table)
        digest = hashlib.sha256()
        row_count = 0
        null_counts = {column["name"]: 0 for column in table["columns"]}
        for row in iter_export_rows(root, table):
            row_count += 1
            for name, value in row.items():
                if value is None:
                    null_counts[name] += 1
        with data_file.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        if row_count != table.get("row_count"):
            raise MigrationToolError("Export row count does not match its manifest.")
        if null_counts != table.get("null_counts"):
            raise MigrationToolError("Export NULL counts do not match its manifest.")
        if digest.hexdigest() != table.get("data_sha256"):
            raise MigrationToolError("Export data checksum does not match its manifest.")
    return root, manifest


def validate_export_relations(
    export_dir: str | Path, manifest: dict[str, Any]
) -> dict[str, int]:
    root = Path(export_dir).expanduser().resolve(strict=True)
    tables = {table["name"]: table for table in manifest["tables"]}
    primary_keys: dict[str, set[tuple[Any, ...]]] = {}
    for name, table in tables.items():
        columns = [column["name"] for column in table["columns"]]
        primary_key = table["primary_key"]
        if not primary_key or any(column not in columns for column in primary_key):
            raise MigrationToolError("Every exported table must have a valid primary key.")
        if any(
            index["partial"]
            or any(column is None for column in index["columns"])
            for index in table["indexes"]
        ):
            raise MigrationToolError(
                "Partial or expression indexes require manual migration review."
            )
        seen_primary: set[tuple[str, ...]] = set()
        unique_indexes = [
            tuple(index["columns"])
            for index in table["indexes"]
            if index["unique"] and index["columns"]
        ]
        unique_seen = {index: set() for index in unique_indexes}
        null_counts = {column: 0 for column in columns}
        for row in iter_export_rows(root, table):
            key = tuple(_key_value(row[column]) for column in primary_key)
            if any(value is None for value in key) or key in seen_primary:
                raise MigrationToolError("Export contains a missing or duplicate primary key.")
            seen_primary.add(key)
            for column, value in row.items():
                if value is None:
                    null_counts[column] += 1
            for index_columns, seen in unique_seen.items():
                raw_values = tuple(row[column] for column in index_columns)
                if any(value is None for value in raw_values):
                    continue
                values = tuple(_key_value(value) for value in raw_values)
                if values in seen:
                    raise MigrationToolError("Export contains a duplicate unique key.")
                seen.add(values)
        if null_counts != table["null_counts"]:
            raise MigrationToolError("Export NULL counts are inconsistent.")
        primary_keys[name] = seen_primary

    foreign_key_violations = 0
    for table in tables.values():
        for foreign_key in table["foreign_keys"]:
            parent_name = foreign_key["table"]
            if parent_name not in tables:
                raise MigrationToolError("Export foreign key references a missing table.")
            child_columns = [
                item["from"]
                for item in sorted(foreign_key["columns"], key=lambda item: item["sequence"])
            ]
            parent_columns = [
                item["to"]
                for item in sorted(foreign_key["columns"], key=lambda item: item["sequence"])
            ]
            if parent_columns != tables[parent_name]["primary_key"]:
                raise MigrationToolError(
                    "Only foreign keys to the referenced primary key are supported."
                )
            parent_keys = primary_keys[parent_name]
            for row in iter_export_rows(root, table):
                raw_values = tuple(row[column] for column in child_columns)
                if any(value is None for value in raw_values):
                    continue
                values = tuple(_key_value(value) for value in raw_values)
                if values not in parent_keys:
                    foreign_key_violations += 1
    return {
        "duplicate_primary_keys": 0,
        "duplicate_unique_keys": 0,
        "foreign_key_violations": foreign_key_violations,
    }


def model_table_names() -> set[str]:
    from database.models import Base

    return set(Base.metadata.tables)
