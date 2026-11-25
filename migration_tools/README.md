# Farmer AI offline migration preparation

These tools are separate from Flask startup and do not change the application's
SQLite default. They do not read `.env`, initialize the app, alter the SQLite
database, or contact an external database in their default modes. The exporter
only opens the explicitly named local SQLite source in read-only mode.

## Sensitive-data warning

An export contains all database rows, including personal and authentication
data such as user records, password hashes, OTP/session data, contact details,
and financial records. Treat the export as a credential-bearing backup: store
it in an access-controlled location, encrypt it at rest, do not commit or share
it, and securely dispose of it only under the project's data-retention policy.
The exporter requires an explicit `--confirm-sensitive-export` flag before
writing any bundle. Dry-run output contains only schema-level checks and counts.

## Workspace contents

- `sqlite_export.py` opens the specified source in SQLite read-only URI mode,
  enables `query_only`, and exports explicit columns ordered by primary key.
  NULL values and BLOBs are preserved. Schema, indexes, keys, row counts,
  per-column NULL counts, and content hashes are included in the manifest.
- `postgres_import.py` prepares parent-before-child batch inserts. It refuses
  unknown destinations and non-empty tables, checks the destination schema,
  requires explicit destination confirmation, and wraps data inserts in one
  transaction. It never creates or truncates schema objects.
- `validate_migration.py` validates an export offline or compares it to an
  explicitly confirmed test/staging PostgreSQL destination in a read-only
  transaction. Reports contain only schema/check results and counts.
- `migration_config.example.json` is a non-secret reference template. Tools
  currently take explicit command-line options and do not load this file.
- `tests/` uses temporary SQLite databases with synthetic data only.

## Safe backup and export

Before any future migration, stop the application and make a separately named,
verified backup of `database\farmer.db`; never overwrite the live file. A
SQLite online backup (for example, Python's `sqlite3.Connection.backup`) is
preferred; write it to a new timestamped destination and verify it before
proceeding. If using a filesystem copy instead, stop all writers and account
for any SQLite WAL sidecar files so the backup is consistent. Keep an
additional independent backup according to the project's backup policy.

From the project root, inspect the live database without exporting rows:

```powershell
python -m migration_tools.sqlite_export --source database\farmer.db
```

The command is a dry run unless `--write` is specified; `--dry-run` may also be
given explicitly. To create a bundle,
first review the sensitive-data warning and storage destination, then run:

```powershell
python -m migration_tools.sqlite_export `
  --source database\farmer.db `
  --write `
  --confirm-sensitive-export
```

Exports are created under `migration_tools\exports\` and that directory is
git-ignored. Existing export directories are never overwritten. The source
database is opened read-only; the export command does not invoke `app.py` or
`database/init_db.py`.

## Offline validation

Run the isolated tests from the project root:

```powershell
python -m unittest discover -s migration_tools\tests -v
```

Validate a bundle without a PostgreSQL connection:

```powershell
python -m migration_tools.validate_migration --export-dir migration_tools\exports\<bundle>
```

Offline checks include bundle hashes, row and NULL counts, primary-key
uniqueness, unique-index values, and exported foreign-key relationships. Output
does not contain row values.

## Future PostgreSQL import and comparison

No import or PostgreSQL comparison is performed as part of this preparation.
The importer accepts only a clearly named local test database or the exact
verified Supabase staging pooler identity. It rejects production/unknown
endpoints, requires `sslmode=verify-full`, and requires the staging CA
certificate. It reads a destination URL only from
`MIGRATION_TEST_DATABASE_URL`; it never loads `.env` or accepts a URL on the
command line. Supply that variable through an approved secret manager or
secure process environment, not a checked-in file or shell history.

The future offline import plan can be reviewed without a target connection:

```powershell
python -m migration_tools.postgres_import --export-dir migration_tools\exports\<bundle>
```

An actual import requires both `--apply` and an exact confirmation token:
`local-test:farmer_ai_migration_test` or
`staging:outlhivwrknmbtghsgmr`. This is a
separate, data-writing operation and must not be run without explicit migration
approval. It refuses a non-empty destination; it never resets, truncates, or
deletes data. Inserts are transactional and roll back on failure. PostgreSQL
sequence synchronization occurs after inserts; as with PostgreSQL sequences
generally, sequence advancement itself is not transactional, so a failed run
may leave harmless gaps even when its inserted rows roll back.

For a future read-only comparison:

```powershell
python -m migration_tools.validate_migration `
  --export-dir migration_tools\exports\<bundle> `
  --against-postgres `
  --confirm-destination staging:outlhivwrknmbtghsgmr
```

Validation checks application table/column/type shape against the existing
SQLAlchemy metadata, primary and foreign keys, indexes and unique constraints,
row counts, duplicate primary keys, NULL counts, foreign-key integrity, and
per-table content hashes. PostgreSQL comparison is read-only and requires the
same explicit staging/test destination checks.

## Existing SQLite compatibility audit

The backend has not been refactored by this task. The reviewed implementation
continues to use direct SQLite operations in `app.py`,
`farm_context_service.py`, and `database/init_db.py`:

- `sqlite3.connect` is used by the app database helper and a service fallback.
- SQL uses SQLite `?` placeholders throughout; preserve parameterization when
  moving statements to SQLAlchemy bound parameters.
- `cursor.lastrowid` is used after inserts; PostgreSQL code should use
  SQLAlchemy inserted primary keys or `RETURNING`.
- `sqlite3.IntegrityError` is caught in application flows; translate those
  handlers to SQLAlchemy's integrity exceptions while preserving behavior.
- `PRAGMA table_info` is used for schema inspection. `database/init_db.py`
  conditionally adds columns with `ALTER TABLE`; it must not be used as a
  PostgreSQL migration runner.
- No `sqlite_master` reference was found in the reviewed backend files.
- SQL uses `strftime('%s', 'now')` and `datetime(created_at)` for elapsed-time
  and chronological queries; replace those with PostgreSQL-compatible
  timestamp expressions or typed SQLAlchemy datetime operations.
- Most transaction management is manual. PostgreSQL integration should use
  explicit SQLAlchemy transaction scopes and preserve current rollback/error
  behavior.

The existing models provide a starting type map: generated integer IDs use
PostgreSQL `BIGSERIAL`/big integer identity semantics, SQLite `REAL` maps to
`DOUBLE PRECISION`, JSON-named fields remain text, and boolean-like fields
remain integer values. PostgreSQL's strict types and constraints require
reviewing existing text timestamps, nullability, unique indexes, and FK
behavior against `Base.metadata` and the schema-only migration. Preserve the
current session-based authentication and user/participant scoping; do not
weaken it while replacing direct queries. This audit is a preparation report,
not an application refactor.

## Recommended migration sequence

1. Reconcile the current database inventory (the prior read-only audit found
   1,347 rows across 26 tables; older notes mention a different count).
2. Freeze writes, make and verify independent SQLite and uploaded-file backups,
   then create and review a sensitive-data export.
3. Finish the app's SQLAlchemy conversion and test both database backends
   without changing the SQLite default.
4. Provision an empty disposable staging/test schema from the existing
   migration foundation; confirm project identity, SSL, types, indexes, FKs,
   and transaction behavior.
5. Run the guarded importer only after explicit approval, then run validation
   and application-level access/authentication checks against that disposable
   target.
6. Reconcile all row counts and critical records, review logs and backups, and
   obtain a separate cutover approval. No production cutover is part of this
   workspace.

## Not yet completed / remaining risks

- No live database was contacted, no production settings were used, and no
  migration or application database integration was performed.
- The PostgreSQL importer has not been executed against any server.
- Partial or expression indexes and dependency cycles are intentionally
  rejected for manual planning; detected SQLite views/triggers are recorded
  but must be migrated and validated manually before import. Review any future
  schema changes before export.
- Timestamp representation, floating-point normalization, and PostgreSQL
  constraint/index reflection must be verified against a disposable staging
  clone before treating comparison results as a final migration sign-off.
- Uploaded files stored outside SQLite require a separate inventory and backup.
- The application still uses direct SQLite operations; the tools do not
  refactor application routes or switch its default database.
- Before a real migration, reconcile the observed live row count with prior
  inventory, take and verify backups, confirm the staging identity and schema,
  test the import on an empty disposable target, review data-scoping/security
  behavior, validate critical records, and obtain explicit approval.
