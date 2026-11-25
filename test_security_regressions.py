import contextlib
import io
import os
import secrets
import subprocess
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from flask import request


_PROJECT_ROOT = Path(__file__).resolve().parent
_TEMPORARY_DIRECTORY = tempfile.TemporaryDirectory(prefix="farmer-ai-security-tests-")
_TEMPORARY_ROOT = Path(_TEMPORARY_DIRECTORY.name)
os.environ["DB_PATH"] = str(_TEMPORARY_ROOT / "farmer_test.db")
os.environ["UPLOAD_FOLDER"] = str(_TEMPORARY_ROOT / "uploads")
os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)

with contextlib.redirect_stdout(io.StringIO()):
    import app as app_module

app_module.app.config["TESTING"] = True


class SecurityRegressionTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()

    def _register(self, client, name):
        email = f"security_{secrets.token_hex(8)}@example.invalid"
        response = client.post(
            "/api/auth/register",
            json={
                "name": name,
                "email": email,
                "password": secrets.token_urlsafe(18),
                "location": "Test region",
                "language": "en",
            },
        )
        self.assertEqual(response.status_code, 200)
        return response.get_json()["user"]

    def _create_labour_job(self, client, worker_name):
        response = client.post(
            "/api/labour/jobs",
            json={
                "work_date": "2026-11-20",
                "crop": "Cotton",
                "field_name": "Test field",
                "work_type": "Harvesting",
                "worker_name": worker_name,
                "payment_type": "per_day",
                "rate": 500,
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()["job"]

    def test_dashboard_requires_login_and_scopes_all_user_records(self):
        self.assertEqual(
            app_module.app.test_client().get("/api/dashboard/summary").status_code,
            401,
        )

        first_client = app_module.app.test_client()
        second_client = app_module.app.test_client()
        first_user = self._register(first_client, "First farmer")
        second_user = self._register(second_client, "Second farmer")

        connection = app_module.get_db()
        try:
            for user, marker in ((first_user, "first"), (second_user, "second")):
                connection.execute(
                    """INSERT INTO crop_recommendations
                       (user_id, soil_type, season, water_availability, previous_crop,
                        location, recommended_crop, confidence, reason)
                       VALUES (?, 'Black', 'Kharif', 'High', 'Pulse', ?, ?, 90, ?)""",
                    (user["id"], marker, marker, marker),
                )
                connection.execute(
                    """INSERT INTO decision_scores
                       (user_id, crop_name, overall_score, soil_score, weather_score,
                        water_score, crop_score)
                       VALUES (?, ?, 90, 90, 90, 90, 90)""",
                    (user["id"], marker),
                )
                connection.execute(
                    """INSERT INTO disease_scans
                       (user_id, image_name, disease_name, confidence, suggestions_json)
                       VALUES (?, ?, ?, 90, '[]')""",
                    (user["id"], marker + ".jpg", marker),
                )
            connection.commit()
        finally:
            connection.close()

        first_summary = first_client.get("/api/dashboard/summary").get_json()
        second_summary = second_client.get("/api/dashboard/summary").get_json()
        self.assertEqual(first_summary["latest_crop"]["recommended_crop"], "first")
        self.assertEqual(first_summary["latest_score"]["crop_name"], "first")
        self.assertEqual(first_summary["recent_scans"][0]["disease_name"], "first")
        self.assertEqual(first_summary["stats"]["crops_recommended"], 1)
        self.assertEqual(first_summary["stats"]["scans_completed"], 1)
        self.assertEqual(second_summary["latest_crop"]["recommended_crop"], "second")
        self.assertEqual(second_summary["latest_score"]["crop_name"], "second")
        self.assertEqual(second_summary["recent_scans"][0]["disease_name"], "second")
        self.assertEqual(second_summary["stats"]["crops_recommended"], 1)
        self.assertEqual(second_summary["stats"]["scans_completed"], 1)

    def test_labour_details_attendance_and_worker_actions_require_participation(self):
        farmer_client = app_module.app.test_client()
        farmer = self._register(farmer_client, "Job owner")
        job = self._create_labour_job(farmer_client, "Shared display name")

        impostor_client = app_module.app.test_client()
        self._register(impostor_client, "Shared display name")

        preview_response = impostor_client.get(
            f"/api/labour/jobs/{job['job_id']}"
        )
        self.assertEqual(preview_response.status_code, 200)
        preview = preview_response.get_json()["job"]
        self.assertEqual(preview["crop"], "Cotton")
        self.assertEqual(preview["rate"], 500.0)
        for private_field in (
            "farmer_id",
            "worker_phone",
            "farmer_email",
            "attendance",
            "payments",
            "advances",
            "disputes",
            "events",
            "join_token",
        ):
            self.assertNotIn(private_field, preview)

        self.assertEqual(
            impostor_client.get(
                f"/api/labour/jobs/{job['id']}/attendance"
            ).status_code,
            403,
        )
        self.assertEqual(
            impostor_client.post(f"/api/labour/jobs/{job['id']}/agree").status_code,
            403,
        )
        self.assertEqual(
            impostor_client.post(
                f"/api/labour/jobs/{job['id']}/attendance",
                json={"worker_name": "Shared display name", "status": "PRESENT"},
            ).status_code,
            403,
        )
        self.assertEqual(
            impostor_client.post(
                f"/api/labour/jobs/{job['id']}/confirm-finish"
            ).status_code,
            403,
        )
        self.assertEqual(
            impostor_client.post(
                f"/api/labour/jobs/{job['id']}/dispute",
                json={"reason": "Not authorized"},
            ).status_code,
            403,
        )
        self.assertEqual(
            impostor_client.post(
                f"/api/labour/jobs/{job['id']}/resolve-dispute"
            ).status_code,
            403,
        )

        impostor_jobs = impostor_client.get(
            "/api/labour/jobs?role=worker"
        ).get_json()["jobs"]
        self.assertEqual(impostor_jobs, [])

        worker_client = app_module.app.test_client()
        worker = self._register(worker_client, "Assigned account")
        join_response = worker_client.post(
            f"/api/labour/jobs/{job['job_id']}/join"
        )
        self.assertEqual(join_response.status_code, 200)
        self.assertEqual(join_response.get_json()["job"]["worker_id"], worker["id"])

        self.assertEqual(
            impostor_client.get(
                f"/api/labour/jobs/{job['job_id']}"
            ).status_code,
            403,
        )
        self.assertEqual(
            impostor_client.get(
                f"/api/labour/jobs/{job['id']}/attendance"
            ).status_code,
            403,
        )
        self.assertEqual(
            farmer_client.get(f"/api/labour/jobs/{job['id']}").status_code,
            200,
        )
        self.assertEqual(
            worker_client.get(f"/api/labour/jobs/{job['id']}").status_code,
            200,
        )
        self.assertEqual(
            worker_client.get(
                f"/api/labour/jobs/{job['id']}/attendance"
            ).status_code,
            200,
        )
        self.assertEqual(farmer["id"], job["farmer_id"])

    def test_labour_join_is_conditional_and_rejects_reassignment(self):
        farmer_client = app_module.app.test_client()
        self._register(farmer_client, "Concurrent job owner")
        job = self._create_labour_job(farmer_client, "Roster worker")
        worker_one = self._register(app_module.app.test_client(), "Worker one")
        worker_two = self._register(app_module.app.test_client(), "Worker two")

        barrier = threading.Barrier(2)

        def fake_current_user():
            return {
                "id": int(request.headers["X-Test-User"]),
                "name": request.headers["X-Test-Name"],
            }

        def join(client, user):
            barrier.wait(timeout=10)
            return client.post(
                f"/api/labour/jobs/{job['job_id']}/join",
                headers={
                    "X-Test-User": str(user["id"]),
                    "X-Test-Name": user["name"],
                },
            ).status_code

        clients = (app_module.app.test_client(), app_module.app.test_client())
        with patch.object(app_module, "get_current_user", side_effect=fake_current_user):
            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(join, clients, (worker_one, worker_two)))

        self.assertCountEqual(results, [200, 409])
        connection = app_module.get_db()
        try:
            saved_job = connection.execute(
                "SELECT worker_id FROM labour_jobs WHERE id = ?", (job["id"],)
            ).fetchone()
            join_events = connection.execute(
                """SELECT COUNT(*) AS count FROM labour_work_events
                   WHERE labour_job_id = ? AND event_type = 'WORKER_JOINED'""",
                (job["id"],),
            ).fetchone()["count"]
        finally:
            connection.close()
        self.assertIn(saved_job["worker_id"], (worker_one["id"], worker_two["id"]))
        self.assertEqual(join_events, 1)

        winning_worker = worker_one if saved_job["worker_id"] == worker_one["id"] else worker_two
        repeat_client = app_module.app.test_client()
        with patch.object(
            app_module,
            "get_current_user",
            return_value=winning_worker,
        ):
            repeat_response = repeat_client.post(
                f"/api/labour/jobs/{job['job_id']}/join"
            )
        self.assertEqual(repeat_response.status_code, 200)

        unavailable_job = self._create_labour_job(
            farmer_client, "Unavailable roster worker"
        )
        connection = app_module.get_db()
        try:
            connection.execute(
                "UPDATE labour_jobs SET status = 'COMPLETED' WHERE id = ?",
                (unavailable_job["id"],),
            )
            connection.commit()
        finally:
            connection.close()
        with patch.object(
            app_module,
            "get_current_user",
            return_value=worker_one,
        ):
            unavailable_response = app_module.app.test_client().post(
                f"/api/labour/jobs/{unavailable_job['job_id']}/join"
            )
        self.assertEqual(unavailable_response.status_code, 409)

    def test_labour_financial_breakdown_uses_worker_ids_not_display_names(self):
        farmer_client = app_module.app.test_client()
        farmer = self._register(farmer_client, "Financial test farmer")
        job = self._create_labour_job(farmer_client, "Same display name")

        connection = app_module.get_db()
        try:
            first_worker = connection.execute(
                """SELECT id FROM labour_workers
                   WHERE labour_job_id = ? ORDER BY id LIMIT 1""",
                (job["id"],),
            ).fetchone()
            second_worker_id = connection.execute(
                """INSERT INTO labour_workers (labour_job_id, name, role)
                   VALUES (?, 'Same display name', 'worker')""",
                (job["id"],),
            ).lastrowid
            third_worker_id = connection.execute(
                """INSERT INTO labour_workers (labour_job_id, name, role)
                   VALUES (?, 'Legacy unique name', 'worker')""",
                (job["id"],),
            ).lastrowid

            for worker_id, worker_name, date, days, hours, wage, advance, payment in (
                (
                    first_worker["id"],
                    "Same display name",
                    "2026-11-20",
                    1.0,
                    8.0,
                    100.0,
                    10.0,
                    20.0,
                ),
                (
                    second_worker_id,
                    "Same display name",
                    "2026-11-21",
                    0.5,
                    4.0,
                    60.0,
                    15.0,
                    30.0,
                ),
                (
                    None,
                    "Legacy unique name",
                    "2026-11-22",
                    0.25,
                    2.0,
                    25.0,
                    2.5,
                    5.0,
                ),
            ):
                connection.execute(
                    """INSERT INTO labour_attendance
                       (labour_job_id, worker_id, worker_name, date, status,
                        day_fraction, hours_worked, rate_applied, wage_amount, created_by)
                       VALUES (?, ?, ?, ?, 'PRESENT', ?, ?, 100, ?, ?)""",
                    (
                        job["id"],
                        worker_id,
                        worker_name,
                        date,
                        days,
                        hours,
                        wage,
                        farmer["id"],
                    ),
                )
                connection.execute(
                    """INSERT INTO labour_advances
                       (labour_job_id, worker_id, worker_name, farmer_id, amount, advance_date)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (job["id"], worker_id, worker_name, farmer["id"], advance, date),
                )
                connection.execute(
                    """INSERT INTO labour_payments
                       (labour_job_id, worker_id, worker_name, farmer_id, amount, payment_date)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (job["id"], worker_id, worker_name, farmer["id"], payment, date),
                )

            connection.execute(
                """INSERT INTO labour_attendance
                   (labour_job_id, worker_name, date, status, day_fraction,
                    hours_worked, rate_applied, wage_amount, created_by)
                   VALUES (?, 'Same display name', '2026-11-23', 'PRESENT',
                           1, 8, 100, 900, ?)""",
                (job["id"], farmer["id"]),
            )
            connection.execute(
                """INSERT INTO labour_advances
                   (labour_job_id, worker_name, farmer_id, amount, advance_date)
                   VALUES (?, 'Same display name', ?, 900, '2026-11-23')""",
                (job["id"], farmer["id"]),
            )
            connection.execute(
                """INSERT INTO labour_payments
                   (labour_job_id, worker_name, farmer_id, amount, payment_date)
                   VALUES (?, 'Same display name', ?, 900, '2026-11-23')""",
                (job["id"], farmer["id"]),
            )

            app_module.recalculate_labour_job_finances(connection, job["id"])
            connection.commit()
            worker_totals = connection.execute(
                """SELECT id, total_days, total_earned, total_advance, total_paid,
                          pending_amount
                   FROM labour_workers WHERE labour_job_id = ? ORDER BY id""",
                (job["id"],),
            ).fetchall()
        finally:
            connection.close()

        self.assertEqual(len(worker_totals), 3)
        total_fields = (
            "total_days",
            "total_earned",
            "total_advance",
            "total_paid",
            "pending_amount",
        )
        self.assertEqual(
            tuple(worker_totals[0][field] for field in total_fields),
            (1.0, 100.0, 10.0, 20.0, 70.0),
        )
        self.assertEqual(
            tuple(worker_totals[1][field] for field in total_fields),
            (0.5, 60.0, 15.0, 30.0, 15.0),
        )
        self.assertEqual(
            tuple(worker_totals[2][field] for field in total_fields),
            (0.25, 25.0, 2.5, 5.0, 17.5),
        )

    def test_revoked_sessions_cannot_write_private_recommendation_records(self):
        class Encoder:
            classes_ = ["Black", "Kharif", "High", "Pulse", "Telangana", "Wheat"]

            def transform(self, _values):
                return [0]

            def inverse_transform(self, _values):
                return ["Wheat"]

        class Model:
            def predict_proba(self, _values):
                return [[1.0]]

        fake_model_data = {
            "model": Model(),
            "encoders": {
                name: Encoder()
                for name in (
                    "soil_type",
                    "season",
                    "water_availability",
                    "previous_crop",
                    "location",
                    "target",
                )
            },
        }
        cases = (
            (
                "/api/recommend-crop",
                {"soil_type": "Black"},
                "crop_recommendations",
            ),
            (
                "/api/irrigation-advice",
                {"crop_type": "Rice"},
                "irrigation_logs",
            ),
            (
                "/api/decision-score",
                {"crop_name": "Maize"},
                "decision_scores",
            ),
        )

        for path, payload, table in cases:
            with self.subTest(path=path):
                client = app_module.app.test_client()
                user = self._register(client, "Revoked session user")
                connection = app_module.get_db()
                try:
                    before = connection.execute(
                        f"SELECT COUNT(*) AS count FROM {table} WHERE user_id = ?",
                        (user["id"],),
                    ).fetchone()["count"]
                    connection.execute(
                        "UPDATE user_sessions SET is_active = 0 WHERE user_id = ?",
                        (user["id"],),
                    )
                    connection.commit()
                finally:
                    connection.close()

                with patch.object(app_module, "crop_model_data", fake_model_data):
                    response = client.post(path, json=payload)
                self.assertEqual(response.status_code, 200)

                connection = app_module.get_db()
                try:
                    after = connection.execute(
                        f"SELECT COUNT(*) AS count FROM {table} WHERE user_id = ?",
                        (user["id"],),
                    ).fetchone()["count"]
                finally:
                    connection.close()
                self.assertEqual(after, before)

    def test_user_id_without_server_session_token_is_unauthenticated(self):
        user = self._register(self.client, "Session token user")
        with self.client.session_transaction() as cookie_session:
            cookie_session.clear()
            cookie_session["user_id"] = user["id"]

        response = self.client.get("/api/auth/me")
        self.assertEqual(response.get_json()["authenticated"], False)

    def test_secret_key_fails_closed_for_missing_or_weak_values(self):
        self.assertGreaterEqual(len(app_module.app.secret_key.encode("utf-8")), 32)
        invalid_values = (
            None,
            "",
            "short",
            "x" * 31,
            " " + ("x" * 32),
            *app_module._INSECURE_SECRET_KEY_VALUES,
            "YOUR_STRONG_RANDOM_SECRET_KEY_HERE",
        )
        for index, value in enumerate(invalid_values):
            with self.subTest(invalid_secret_index=index):
                with self.assertRaises(RuntimeError):
                    app_module._validate_secret_key(value)

        child_environment = os.environ.copy()
        child_environment.pop("SECRET_KEY", None)
        child_environment["PYTHON_DOTENV_DISABLED"] = "1"
        child_environment["DB_PATH"] = str(_TEMPORARY_ROOT / "missing-secret.db")
        child_environment["UPLOAD_FOLDER"] = str(
            _TEMPORARY_ROOT / "missing-secret-uploads"
        )
        result = subprocess.run(
            [sys.executable, "-c", "import app"],
            cwd=str(_PROJECT_ROOT),
            env=child_environment,
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SECRET_KEY must be configured", result.stderr)
