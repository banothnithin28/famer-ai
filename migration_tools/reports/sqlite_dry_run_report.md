# Farmer AI SQLite migration dry-run report

## Summary

- Source: `database/farmer.db` (622,592 bytes).
- Access: SQLite URI `mode=ro`; `PRAGMA query_only=ON` verified.
- Integrity: **ok**.
- Tables: **26**; total rows: **1,347**.
- Views/triggers: **0/0**.
- Foreign keys: **45** definitions; **0** PRAGMA violations; **0** orphan references.
- PostgreSQL compatibility: **MATCHED_WITH_TYPE_MAPPINGS_REQUIRING_REVIEW**; schema mismatch tables: **0**.
- The 42 type mappings requiring review are SQLite `TIMESTAMP` to PostgreSQL `TIMESTAMP WITHOUT TIME ZONE`; confirm formats, timezone assumptions, and precision. They are review items, not detected schema mismatches.
- PostgreSQL readiness: **READY WITH WARNINGS**.
- No row data was exported; no external connection was attempted.

## Aggregate data checks

- Tables with data: 23; empty tables: 3.
- Tables with relationships: 26.
- Duplicate primary-key groups: 0; duplicate unique-index groups: 0.
- NULL values in model-required/primary-key columns: 0.
- Dependency cycles: none.

## Data migration readiness

- Tables with data: `crop_recommendations`, `disease_scans`, `farm_diary_entries`, `farm_expenses`, `farm_income`, `farmer_profiles`, `labour_advances`, `labour_agreements`, `labour_attendance`, `labour_breaks`, `labour_disputes`, `labour_jobs`, `labour_payments`, `labour_work_events`, `labour_work_sessions`, `labour_workers`, `password_reset_otps`, `plants`, `tractor_disputes`, `tractor_jobs`, `tractor_work_events`, `user_sessions`, `users`.
- Empty tables: `alerts`, `decision_scores`, `irrigation_logs`.
- Tables with relationships: all 26; see the dependency-aware order below.
- Special handling:
  - Authentication-sensitive: `users`, `password_reset_otps`, `user_sessions`.
  - JSON stored as text: `disease_scans`, `farm_expenses`.
  - Text date/time fields: `farm_diary_entries`, `farm_expenses`, `farm_income`, `labour_advances`, `labour_attendance`, `labour_breaks`, `labour_jobs`, `labour_payments`, `labour_work_events`, `labour_work_sessions`, `tractor_jobs`, `tractor_work_events`.
  - REAL numeric fields: `farm_expenses`, `farm_income`, `farmer_profiles`, `labour_advances`, `labour_attendance`, `labour_jobs`, `labour_payments`, `labour_workers`, `tractor_jobs`.
  - Nullable `ON DELETE SET NULL` columns: `alerts.plant_id`, `disease_scans.plant_id`, `labour_advances.worker_id`, `labour_agreements.worker_id`, `labour_jobs.expense_id`/`worker_id`, `labour_payments.worker_id`, `labour_workers.user_id`, `tractor_jobs.expense_id`/`driver_id`.
- ID conflict risk: no duplicate primary-key groups were found. Preserve source IDs; generated PostgreSQL identities must be synchronized, and the guarded importer refuses a non-empty target.
- Missing-record risk: cannot be ruled out from aggregate-only checks. No row contents were inspected or exported; reconcile the historical row-count discrepancy and validate counts/checksums only in a separately approved migration test.
- Consistency checks: SQLite integrity `ok`; zero FK violations/orphans, duplicate key groups, and required-column NULLs. No explicit AUTOINCREMENT sequence was behind its table maximum.

## Recommended migration order

1. users
2. crop_recommendations
3. decision_scores
4. farm_diary_entries
5. farm_expenses
6. farm_income
7. farmer_profiles
8. irrigation_logs
9. labour_jobs
10. labour_agreements
11. labour_disputes
12. labour_work_events
13. labour_work_sessions
14. labour_breaks
15. labour_workers
16. labour_advances
17. labour_attendance
18. labour_payments
19. password_reset_otps
20. plants
21. alerts
22. disease_scans
23. tractor_jobs
24. tractor_disputes
25. tractor_work_events
26. user_sessions

## Table inventory

### `alerts`

- Rows: 0; columns: 7.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `empty_without_sequence_entry`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `plant_id` INTEGER [NOT NULL=False; PK position=0]; `status` TEXT [NOT NULL=True; PK position=0]; `message` TEXT [NOT NULL=True; PK position=0]; `read` INTEGER [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `plants`: plant_id→plants.id (orphan count 0); `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: none.

### `crop_recommendations`

- Rows: 21; columns: 11.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `soil_type` TEXT [NOT NULL=True; PK position=0]; `season` TEXT [NOT NULL=True; PK position=0]; `water_availability` TEXT [NOT NULL=True; PK position=0]; `previous_crop` TEXT [NOT NULL=True; PK position=0]; `location` TEXT [NOT NULL=True; PK position=0]; `recommended_crop` TEXT [NOT NULL=True; PK position=0]; `confidence` INTEGER [NOT NULL=True; PK position=0]; `reason` TEXT [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: none.

### `decision_scores`

- Rows: 0; columns: 9.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `empty_without_sequence_entry`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `crop_name` TEXT [NOT NULL=True; PK position=0]; `overall_score` INTEGER [NOT NULL=True; PK position=0]; `soil_score` INTEGER [NOT NULL=True; PK position=0]; `weather_score` INTEGER [NOT NULL=True; PK position=0]; `water_score` INTEGER [NOT NULL=True; PK position=0]; `crop_score` INTEGER [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: none.

### `disease_scans`

- Rows: 6; columns: 10.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `plant_id` INTEGER [NOT NULL=False; PK position=0]; `image_name` TEXT [NOT NULL=True; PK position=0]; `disease_name` TEXT [NOT NULL=True; PK position=0]; `confidence` INTEGER [NOT NULL=True; PK position=0]; `severity` TEXT [NOT NULL=True; PK position=0]; `symptoms` TEXT [NOT NULL=False; PK position=0]; `suggestions_json` TEXT [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `plants`: plant_id→plants.id (orphan count 0); `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: none.

### `farm_diary_entries`

- Rows: 3; columns: 11.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `date` TEXT [NOT NULL=True; PK position=0]; `crop` TEXT [NOT NULL=False; PK position=0]; `field_name` TEXT [NOT NULL=False; PK position=0]; `activity_type` TEXT [NOT NULL=True; PK position=0]; `description` TEXT [NOT NULL=False; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `photo_path` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `updated_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_farm_diary_user_act` (user_id, activity_type); unique=False; partial=False; `idx_farm_diary_user_crop` (user_id, crop); unique=False; partial=False; `idx_farm_diary_user_date` (user_id, date); unique=False; partial=False.

### `farm_expenses`

- Rows: 66; columns: 21.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `date` TEXT [NOT NULL=True; PK position=0]; `category` TEXT [NOT NULL=True; PK position=0]; `amount` REAL [NOT NULL=True; PK position=0]; `crop` TEXT [NOT NULL=False; PK position=0]; `field_name` TEXT [NOT NULL=False; PK position=0]; `description` TEXT [NOT NULL=False; PK position=0]; `receipt_path` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `updated_at` TIMESTAMP [NOT NULL=False; PK position=0]; `bill_number` TEXT [NOT NULL=False; PK position=0]; `vendor_name` TEXT [NOT NULL=False; PK position=0]; `vendor_phone` TEXT [NOT NULL=False; PK position=0]; `vendor_address` TEXT [NOT NULL=False; PK position=0]; `receipt_source` TEXT [NOT NULL=False; PK position=0]; `raw_extracted_json` TEXT [NOT NULL=False; PK position=0]; `tax` REAL [NOT NULL=False; PK position=0]; `discount` REAL [NOT NULL=False; PK position=0]; `payment_method` TEXT [NOT NULL=False; PK position=0]; `scanned_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_farm_expenses_user_bill` (user_id, bill_number); unique=False; partial=False; `idx_farm_expenses_user_cat` (user_id, category); unique=False; partial=False; `idx_farm_expenses_user_crop` (user_id, crop); unique=False; partial=False; `idx_farm_expenses_user_date` (user_id, date); unique=False; partial=False; `idx_farm_expenses_user_source` (user_id, receipt_source); unique=False; partial=False.

### `farm_income`

- Rows: 8; columns: 12.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `date` TEXT [NOT NULL=True; PK position=0]; `crop` TEXT [NOT NULL=True; PK position=0]; `quantity` REAL [NOT NULL=True; PK position=0]; `unit` TEXT [NOT NULL=True; PK position=0]; `selling_price` REAL [NOT NULL=True; PK position=0]; `total_amount` REAL [NOT NULL=True; PK position=0]; `buyer_name` TEXT [NOT NULL=False; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `updated_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_farm_income_user_crop` (user_id, crop); unique=False; partial=False; `idx_farm_income_user_date` (user_id, date); unique=False; partial=False.

### `farmer_profiles`

- Rows: 120; columns: 4.
- Primary key: user_id.
- Auto-increment: `non-generated foreign-key primary key`; sequence: `not applicable`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `user_id` INTEGER [NOT NULL=False; PK position=1]; `farm_size_acres` REAL [NOT NULL=False; PK position=0]; `soil_type` TEXT [NOT NULL=False; PK position=0]; `primary_crop` TEXT [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: none.

### `irrigation_logs`

- Rows: 0; columns: 8.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `empty_without_sequence_entry`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `crop_type` TEXT [NOT NULL=True; PK position=0]; `moisture_pct` INTEGER [NOT NULL=True; PK position=0]; `weather_condition` TEXT [NOT NULL=True; PK position=0]; `water_req` TEXT [NOT NULL=True; PK position=0]; `suggestion` TEXT [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: none.

### `labour_advances`

- Rows: 11; columns: 11.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `labour_job_id` INTEGER [NOT NULL=True; PK position=0]; `worker_id` INTEGER [NOT NULL=False; PK position=0]; `worker_name` TEXT [NOT NULL=True; PK position=0]; `farmer_id` INTEGER [NOT NULL=True; PK position=0]; `amount` REAL [NOT NULL=True; PK position=0]; `advance_date` TEXT [NOT NULL=True; PK position=0]; `payment_method` TEXT [NOT NULL=True; PK position=0]; `reference_no` TEXT [NOT NULL=False; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: farmer_id→users.id (orphan count 0); `labour_workers`: worker_id→labour_workers.id (orphan count 0); `labour_jobs`: labour_job_id→labour_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_labour_advances_farmer` (farmer_id); unique=False; partial=False; `idx_labour_advances_job` (labour_job_id); unique=False; partial=False.

### `labour_agreements`

- Rows: 34; columns: 9.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `labour_job_id` INTEGER [NOT NULL=True; PK position=0]; `farmer_id` INTEGER [NOT NULL=True; PK position=0]; `worker_id` INTEGER [NOT NULL=False; PK position=0]; `terms_summary` TEXT [NOT NULL=True; PK position=0]; `farmer_agreed_at` TIMESTAMP [NOT NULL=False; PK position=0]; `worker_agreed_at` TIMESTAMP [NOT NULL=False; PK position=0]; `status` TEXT [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: worker_id→users.id (orphan count 0); `users`: farmer_id→users.id (orphan count 0); `labour_jobs`: labour_job_id→labour_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_labour_agreements_job` (labour_job_id); unique=False; partial=False.

### `labour_attendance`

- Rows: 48; columns: 13.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `labour_job_id` INTEGER [NOT NULL=True; PK position=0]; `worker_id` INTEGER [NOT NULL=False; PK position=0]; `worker_name` TEXT [NOT NULL=True; PK position=0]; `date` TEXT [NOT NULL=True; PK position=0]; `status` TEXT [NOT NULL=True; PK position=0]; `day_fraction` REAL [NOT NULL=True; PK position=0]; `hours_worked` REAL [NOT NULL=False; PK position=0]; `rate_applied` REAL [NOT NULL=True; PK position=0]; `wage_amount` REAL [NOT NULL=True; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `created_by` INTEGER [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: created_by→users.id (orphan count 0); `labour_workers`: worker_id→labour_workers.id (orphan count 0); `labour_jobs`: labour_job_id→labour_jobs.id (orphan count 0).
- Unique constraints: `idx_labour_attendance_unique` (labour_job_id, worker_name, date); duplicate groups 0.
- Indexes: `idx_labour_attendance_date` (date); unique=False; partial=False; `idx_labour_attendance_unique` (labour_job_id, worker_name, date); unique=True; partial=False.

### `labour_breaks`

- Rows: 10; columns: 8.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `labour_job_id` INTEGER [NOT NULL=True; PK position=0]; `session_id` INTEGER [NOT NULL=False; PK position=0]; `start_time` TEXT [NOT NULL=True; PK position=0]; `end_time` TEXT [NOT NULL=False; PK position=0]; `duration_seconds` INTEGER [NOT NULL=False; PK position=0]; `reason` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `labour_work_sessions`: session_id→labour_work_sessions.id (orphan count 0); `labour_jobs`: labour_job_id→labour_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: none.

### `labour_disputes`

- Rows: 10; columns: 10.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `labour_job_id` INTEGER [NOT NULL=True; PK position=0]; `raised_by` INTEGER [NOT NULL=True; PK position=0]; `reason` TEXT [NOT NULL=True; PK position=0]; `description` TEXT [NOT NULL=False; PK position=0]; `evidence_text` TEXT [NOT NULL=False; PK position=0]; `status` TEXT [NOT NULL=True; PK position=0]; `resolution` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `resolved_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: raised_by→users.id (orphan count 0); `labour_jobs`: labour_job_id→labour_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_labour_disputes_job` (labour_job_id, status); unique=False; partial=False.

### `labour_jobs`

- Rows: 34; columns: 31.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `job_id` TEXT [NOT NULL=True; PK position=0]; `join_token` TEXT [NOT NULL=True; PK position=0]; `farmer_id` INTEGER [NOT NULL=True; PK position=0]; `worker_id` INTEGER [NOT NULL=False; PK position=0]; `worker_name` TEXT [NOT NULL=True; PK position=0]; `worker_phone` TEXT [NOT NULL=False; PK position=0]; `work_type` TEXT [NOT NULL=True; PK position=0]; `crop` TEXT [NOT NULL=True; PK position=0]; `field_name` TEXT [NOT NULL=True; PK position=0]; `work_date` TEXT [NOT NULL=True; PK position=0]; `expected_start_date` TEXT [NOT NULL=False; PK position=0]; `expected_end_date` TEXT [NOT NULL=False; PK position=0]; `payment_type` TEXT [NOT NULL=True; PK position=0]; `rate` REAL [NOT NULL=True; PK position=0]; `num_workers` INTEGER [NOT NULL=True; PK position=0]; `status` TEXT [NOT NULL=True; PK position=0]; `farmer_agreed` INTEGER [NOT NULL=True; PK position=0]; `worker_agreed` INTEGER [NOT NULL=True; PK position=0]; `farmer_confirmed` INTEGER [NOT NULL=True; PK position=0]; `worker_confirmed` INTEGER [NOT NULL=True; PK position=0]; `total_working_seconds` INTEGER [NOT NULL=True; PK position=0]; `total_days_worked` REAL [NOT NULL=True; PK position=0]; `total_earned` REAL [NOT NULL=True; PK position=0]; `total_paid` REAL [NOT NULL=True; PK position=0]; `total_advance` REAL [NOT NULL=True; PK position=0]; `pending_amount` REAL [NOT NULL=True; PK position=0]; `expense_id` INTEGER [NOT NULL=False; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `updated_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `farm_expenses`: expense_id→farm_expenses.id (orphan count 0); `users`: worker_id→users.id (orphan count 0); `users`: farmer_id→users.id (orphan count 0).
- Unique constraints: `sqlite_autoindex_labour_jobs_1` (job_id); duplicate groups 0; `sqlite_autoindex_labour_jobs_2` (join_token); duplicate groups 0.
- Indexes: `idx_labour_jobs_date` (work_date); unique=False; partial=False; `idx_labour_jobs_farmer` (farmer_id, status); unique=False; partial=False; `idx_labour_jobs_job_id` (job_id); unique=False; partial=False; `idx_labour_jobs_join_token` (join_token); unique=False; partial=False; `idx_labour_jobs_worker` (worker_id, status); unique=False; partial=False; `sqlite_autoindex_labour_jobs_1` (job_id); unique=True; partial=False; `sqlite_autoindex_labour_jobs_2` (join_token); unique=True; partial=False.

### `labour_payments`

- Rows: 22; columns: 11.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `labour_job_id` INTEGER [NOT NULL=True; PK position=0]; `worker_id` INTEGER [NOT NULL=False; PK position=0]; `worker_name` TEXT [NOT NULL=True; PK position=0]; `farmer_id` INTEGER [NOT NULL=True; PK position=0]; `amount` REAL [NOT NULL=True; PK position=0]; `payment_date` TEXT [NOT NULL=True; PK position=0]; `payment_method` TEXT [NOT NULL=True; PK position=0]; `reference_no` TEXT [NOT NULL=False; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: farmer_id→users.id (orphan count 0); `labour_workers`: worker_id→labour_workers.id (orphan count 0); `labour_jobs`: labour_job_id→labour_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_labour_payments_farmer` (farmer_id); unique=False; partial=False; `idx_labour_payments_job` (labour_job_id); unique=False; partial=False.

### `labour_work_events`

- Rows: 224; columns: 7.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `labour_job_id` INTEGER [NOT NULL=True; PK position=0]; `event_type` TEXT [NOT NULL=True; PK position=0]; `performed_by` INTEGER [NOT NULL=True; PK position=0]; `server_timestamp` TEXT [NOT NULL=True; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: performed_by→users.id (orphan count 0); `labour_jobs`: labour_job_id→labour_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_labour_events_job` (labour_job_id, id); unique=False; partial=False; `idx_labour_events_type` (event_type); unique=False; partial=False.

### `labour_work_sessions`

- Rows: 10; columns: 8.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `labour_job_id` INTEGER [NOT NULL=True; PK position=0]; `session_type` TEXT [NOT NULL=True; PK position=0]; `start_time` TEXT [NOT NULL=True; PK position=0]; `end_time` TEXT [NOT NULL=False; PK position=0]; `duration_seconds` INTEGER [NOT NULL=False; PK position=0]; `status` TEXT [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `labour_jobs`: labour_job_id→labour_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: none.

### `labour_workers`

- Rows: 34; columns: 14.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `labour_job_id` INTEGER [NOT NULL=True; PK position=0]; `user_id` INTEGER [NOT NULL=False; PK position=0]; `name` TEXT [NOT NULL=True; PK position=0]; `phone` TEXT [NOT NULL=False; PK position=0]; `role` TEXT [NOT NULL=False; PK position=0]; `total_days` REAL [NOT NULL=False; PK position=0]; `total_hours` REAL [NOT NULL=False; PK position=0]; `total_earned` REAL [NOT NULL=False; PK position=0]; `total_paid` REAL [NOT NULL=False; PK position=0]; `total_advance` REAL [NOT NULL=False; PK position=0]; `pending_amount` REAL [NOT NULL=False; PK position=0]; `status` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0); `labour_jobs`: labour_job_id→labour_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_labour_workers_job` (labour_job_id); unique=False; partial=False.

### `password_reset_otps`

- Rows: 24; columns: 12.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `email` TEXT [NOT NULL=True; PK position=0]; `otp_hash` TEXT [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `expires_at` TIMESTAMP [NOT NULL=True; PK position=0]; `verification_attempts` INTEGER [NOT NULL=True; PK position=0]; `max_attempts` INTEGER [NOT NULL=True; PK position=0]; `is_used` INTEGER [NOT NULL=True; PK position=0]; `used_at` TIMESTAMP [NOT NULL=False; PK position=0]; `reset_token_hash` TEXT [NOT NULL=False; PK position=0]; `reset_token_expires_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_password_reset_otps_email` (email, is_used); unique=False; partial=False; `idx_password_reset_otps_user` (user_id, is_used); unique=False; partial=False.

### `plants`

- Rows: 4; columns: 7.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `crop_name` TEXT [NOT NULL=True; PK position=0]; `field_name` TEXT [NOT NULL=True; PK position=0]; `location` TEXT [NOT NULL=True; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: none.
- Indexes: none.

### `tractor_disputes`

- Rows: 10; columns: 9.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `tractor_job_id` INTEGER [NOT NULL=True; PK position=0]; `raised_by` INTEGER [NOT NULL=True; PK position=0]; `reason` TEXT [NOT NULL=True; PK position=0]; `description` TEXT [NOT NULL=False; PK position=0]; `status` TEXT [NOT NULL=True; PK position=0]; `resolution` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `resolved_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: raised_by→users.id (orphan count 0); `tractor_jobs`: tractor_job_id→tractor_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_tractor_disputes_job` (tractor_job_id, status); unique=False; partial=False.

### `tractor_jobs`

- Rows: 28; columns: 23.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `job_id` TEXT [NOT NULL=True; PK position=0]; `join_token` TEXT [NOT NULL=True; PK position=0]; `farmer_id` INTEGER [NOT NULL=True; PK position=0]; `driver_id` INTEGER [NOT NULL=False; PK position=0]; `driver_name` TEXT [NOT NULL=False; PK position=0]; `driver_phone` TEXT [NOT NULL=False; PK position=0]; `tractor_number` TEXT [NOT NULL=False; PK position=0]; `crop` TEXT [NOT NULL=True; PK position=0]; `field_name` TEXT [NOT NULL=True; PK position=0]; `work_type` TEXT [NOT NULL=True; PK position=0]; `work_date` TEXT [NOT NULL=True; PK position=0]; `field_size` REAL [NOT NULL=False; PK position=0]; `rate` REAL [NOT NULL=True; PK position=0]; `rate_unit` TEXT [NOT NULL=True; PK position=0]; `status` TEXT [NOT NULL=True; PK position=0]; `total_working_seconds` INTEGER [NOT NULL=True; PK position=0]; `calculated_amount` REAL [NOT NULL=True; PK position=0]; `final_amount` REAL [NOT NULL=True; PK position=0]; `expense_id` INTEGER [NOT NULL=False; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `updated_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `farm_expenses`: expense_id→farm_expenses.id (orphan count 0); `users`: driver_id→users.id (orphan count 0); `users`: farmer_id→users.id (orphan count 0).
- Unique constraints: `sqlite_autoindex_tractor_jobs_1` (job_id); duplicate groups 0; `sqlite_autoindex_tractor_jobs_2` (join_token); duplicate groups 0.
- Indexes: `idx_tractor_jobs_date` (work_date); unique=False; partial=False; `idx_tractor_jobs_driver` (driver_id, status); unique=False; partial=False; `idx_tractor_jobs_farmer` (farmer_id, status); unique=False; partial=False; `idx_tractor_jobs_job_id` (job_id); unique=False; partial=False; `idx_tractor_jobs_join_token` (join_token); unique=False; partial=False; `sqlite_autoindex_tractor_jobs_1` (job_id); unique=True; partial=False; `sqlite_autoindex_tractor_jobs_2` (join_token); unique=True; partial=False.

### `tractor_work_events`

- Rows: 84; columns: 7.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `tractor_job_id` INTEGER [NOT NULL=True; PK position=0]; `event_type` TEXT [NOT NULL=True; PK position=0]; `performed_by` INTEGER [NOT NULL=True; PK position=0]; `server_timestamp` TEXT [NOT NULL=True; PK position=0]; `notes` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: performed_by→users.id (orphan count 0); `tractor_jobs`: tractor_job_id→tractor_jobs.id (orphan count 0).
- Unique constraints: none.
- Indexes: `idx_tractor_events_job` (tractor_job_id, id); unique=False; partial=False; `idx_tractor_events_type` (event_type); unique=False; partial=False.

### `user_sessions`

- Rows: 416; columns: 10.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `user_id` INTEGER [NOT NULL=True; PK position=0]; `session_token_hash` TEXT [NOT NULL=True; PK position=0]; `ip_address` TEXT [NOT NULL=False; PK position=0]; `user_agent` TEXT [NOT NULL=False; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `expires_at` TIMESTAMP [NOT NULL=True; PK position=0]; `last_activity_at` TIMESTAMP [NOT NULL=False; PK position=0]; `is_active` INTEGER [NOT NULL=True; PK position=0]; `revoked_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: `users`: user_id→users.id (orphan count 0).
- Unique constraints: `sqlite_autoindex_user_sessions_1` (session_token_hash); duplicate groups 0.
- Indexes: `idx_user_sessions_lookup` (session_token_hash, is_active); unique=False; partial=False; `idx_user_sessions_user` (user_id, is_active); unique=False; partial=False; `sqlite_autoindex_user_sessions_1` (session_token_hash); unique=True; partial=False.

### `users`

- Rows: 120; columns: 8.
- Primary key: id.
- Auto-increment: `explicit_sqlite_autoincrement`; sequence: `sequence_ahead_or_equal_to_max`.
- Duplicate PK groups: 0.
- Important-column NULL counts: `{}`.
- Columns: `id` INTEGER [NOT NULL=False; PK position=1]; `name` TEXT [NOT NULL=True; PK position=0]; `email` TEXT [NOT NULL=True; PK position=0]; `password_hash` TEXT [NOT NULL=True; PK position=0]; `location` TEXT [NOT NULL=True; PK position=0]; `language` TEXT [NOT NULL=True; PK position=0]; `created_at` TIMESTAMP [NOT NULL=False; PK position=0]; `last_login_at` TIMESTAMP [NOT NULL=False; PK position=0].
- Foreign keys: none.
- Unique constraints: `sqlite_autoindex_users_1` (email); duplicate groups 0.
- Indexes: `sqlite_autoindex_users_1` (email); unique=True; partial=False.

## Migration risks

- **MEDIUM — Historical count reconciliation:** A prior inventory recorded 1,291 rows; reconcile that figure with this current inventory before exporting.
- **MEDIUM — Date/time representation:** Text dates and timestamps require format, timezone, precision, and ordering checks in a disposable PostgreSQL fixture.
- **MEDIUM — JSON and boolean conventions:** JSON fields remain text and boolean-like values remain integers in the existing model; validate semantics before changing types.
- **MEDIUM — Sensitive records:** The source contains authentication and personal/farm records; protect any separately approved future backup/export.
- **LOW — Identity sequence synchronization:** Preserve IDs and synchronize PostgreSQL identity sequences during any future approved import.
- **LOW — SQLite-specific application SQL:** Parameterized qmark SQL, lastrowid, IntegrityError, PRAGMA, strftime, datetime(), and ALTER TABLE need deliberate PostgreSQL adaptation.

## Readiness decision

**READY WITH WARNINGS.** No structural blocker was found, but historical row-count reconciliation and staging fixture tests remain required.

## Exact next safe step

Review this report and reconcile the earlier 1,291-row note with the current aggregate counts. Do not export or import until the discrepancy and compatibility warnings are explained; then seek separate approval for a disposable staging-only test.

## Safety validation

- Source opened read-only; query-only verified; traced SQL limited to SELECT/PRAGMA/transaction control.
- Source file hash, size, and modification time unchanged: **True**.
- No application/model/migration files were changed; no `.env` was read.
- No real records or credentials were exported; no PostgreSQL/Supabase/Render connection was attempted.
- Report content is schema metadata and aggregate counts only.
