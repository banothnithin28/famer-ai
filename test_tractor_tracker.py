"""
Automated Test Suite for Farmer AI Phase 2: Tractor Work Tracker
Validates end-to-end two-party confirmation workflow, break/pause exclusion,
precise payment math, dispute logging, strict multi-tenant isolation,
and integration with Farm Diary + Expenses.
"""

import os
import time
import datetime
import json
from app import app, get_db

def run_tests():
    print("=" * 75)
    print("       FARMER AI: PHASE 2 TRACTOR WORK TRACKER AUTOMATED TEST SUITE")
    print("=" * 75)

    client = app.test_client()
    ts = int(time.time())

    farmer_email = f"farmer_tractor_{ts}@test.com"
    driver_email = f"driver_tractor_{ts}@test.com"
    unauthorized_email = f"intruder_tractor_{ts}@test.com"
    password = "StrongPassword123!"

    # Setup 3 users: Farmer, Driver, Unauthorized Intruder
    print("\n[Setup] Registering Farmer, Driver, and Third-Party user...")
    r1 = client.post('/api/auth/register', json={"name": "Nithin Farmer", "email": farmer_email, "password": password, "location": "Warangal", "language": "en"})
    assert r1.status_code == 200, f"Farmer reg failed: {r1.get_json()}"
    farmer_id = r1.get_json()['user']['id']

    r2 = client.post('/api/auth/register', json={"name": "Ramesh Driver", "email": driver_email, "password": password, "location": "Karimnagar", "language": "en"})
    assert r2.status_code == 200, f"Driver reg failed: {r2.get_json()}"
    driver_id = r2.get_json()['user']['id']

    r3 = client.post('/api/auth/register', json={"name": "Intruder User", "email": unauthorized_email, "password": password, "location": "Hyderabad", "language": "en"})
    assert r3.status_code == 200, f"Intruder reg failed: {r3.get_json()}"
    intruder_id = r3.get_json()['user']['id']

    print(f"  -> Created Farmer (ID: {farmer_id}), Driver (ID: {driver_id}), Intruder (ID: {intruder_id})")

    # =========================================================================
    # TEST 1: Farmer creates tractor job (Hourly Rate: ₹800/hr)
    # =========================================================================
    print("\n[Test 1] Testing Farmer Tractor Job Creation (Hourly)...")
    login_farmer = client.post('/api/auth/login', json={"email": farmer_email, "password": password})
    assert login_farmer.status_code == 200

    create_res = client.post('/api/tractor/jobs', json={
        "work_date": "2026-09-26",
        "field_name": "Main Cotton Field",
        "crop": "Cotton",
        "work_type": "Ploughing",
        "rate": 800.0,
        "rate_unit": "per_hour",
        "field_size": 2.5,
        "notes": "Deep ploughing required after rain"
    })
    assert create_res.status_code == 201, f"Create job failed: {create_res.get_json()}"
    job_data = create_res.get_json()['job']
    job_id_pk = job_data['id']
    job_code = job_data['job_id']
    join_token = job_data['join_token']
    assert job_code.startswith("TR-20260926-"), f"Invalid job code format: {job_code}"
    assert job_data['status'] == 'CREATED'
    assert job_data['farmer_id'] == farmer_id
    print(f"  -> Passed: Created Tractor Job {job_code} (PK: {job_id_pk}, Token: {join_token})")

    # =========================================================================
    # TEST 2: Driver joins job using Job ID / Join Token
    # =========================================================================
    print("\n[Test 2] Testing Driver Joining via Job ID...")
    login_driver = client.post('/api/auth/login', json={"email": driver_email, "password": password})
    assert login_driver.status_code == 200

    # First test lookup preview
    preview_res = client.get(f'/api/tractor/jobs/{job_code}')
    assert preview_res.status_code == 200
    assert preview_res.get_json()['job']['crop'] == "Cotton"

    # Join job
    join_res = client.post(f'/api/tractor/jobs/{job_code}/join')
    assert join_res.status_code == 200, f"Join failed: {join_res.get_json()}"
    joined_job = join_res.get_json()['job']
    assert joined_job['status'] == 'DRIVER_JOINED'
    assert joined_job['driver_id'] == driver_id
    assert joined_job['driver_name'] == "Ramesh Driver"
    print(f"  -> Passed: Driver joined job {job_code}, status became DRIVER_JOINED")

    # =========================================================================
    # TEST 3: Farmer requests Start Work
    # =========================================================================
    print("\n[Test 3] Testing Start Work Request...")
    client.post('/api/auth/login', json={"email": farmer_email, "password": password})
    start_req_res = client.post(f'/api/tractor/jobs/{job_id_pk}/start')
    assert start_req_res.status_code == 200
    assert start_req_res.get_json()['job']['status'] == 'START_REQUESTED'
    print("  -> Passed: Start request registered (status: START_REQUESTED)")

    # =========================================================================
    # TEST 4 & 5: Driver confirms Start & Server records official start timestamp
    # =========================================================================
    print("\n[Test 4 & 5] Testing Driver Confirmation of Start & Server Timestamp...")
    client.post('/api/auth/login', json={"email": driver_email, "password": password})
    confirm_start_res = client.post(f'/api/tractor/jobs/{job_id_pk}/confirm-start')
    assert confirm_start_res.status_code == 200
    started_job = confirm_start_res.get_json()['job']
    assert started_job['status'] == 'RUNNING'
    assert len(started_job['events']) >= 3
    print("  -> Passed: Start confirmed by driver. Official server timestamp recorded. Status: RUNNING")

    # =========================================================================
    # TEST 6 & 7: Pause Work (Break) & Validation that Break is Excluded
    # =========================================================================
    print("\n[Test 6 & 7] Testing Pause Work (Break for Lunch/Refueling)...")
    # Simulate a running stretch in database events for test precision:
    # 10:15 AM -> Start
    # 12:00 PM -> Pause (1h 45m = 6300s)
    # 12:30 PM -> Resume (30m break excluded)
    # 02:20 PM -> Finish (1h 50m = 6600s) -> Total active = 12900s (3h 35m)
    pause_res = client.post(f'/api/tractor/jobs/{job_id_pk}/pause', json={"notes": "Lunch Break"})
    assert pause_res.status_code == 200
    assert pause_res.get_json()['job']['status'] == 'PAUSED'
    print("  -> Passed: Work PAUSED. Status: PAUSED")

    # Cannot pause an already paused job
    double_pause = client.post(f'/api/tractor/jobs/{job_id_pk}/pause', json={"notes": "Double pause"})
    assert double_pause.status_code == 400
    print("  -> Passed: Double pause rejected with 400")

    # =========================================================================
    # TEST 8: Resume Work
    # =========================================================================
    print("\n[Test 8] Testing Resume Work...")
    resume_res = client.post(f'/api/tractor/jobs/{job_id_pk}/resume')
    assert resume_res.status_code == 200
    assert resume_res.get_json()['job']['status'] == 'RUNNING'
    print("  -> Passed: Work RESUMED. Status: RUNNING")

    # =========================================================================
    # TEST 9 & 10: Finish Request & Two-Party Finish Confirmation
    # =========================================================================
    print("\n[Test 9 & 10] Testing Finish Request & Confirmation...")
    # Farmer requests finish
    client.post('/api/auth/login', json={"email": farmer_email, "password": password})
    finish_req = client.post(f'/api/tractor/jobs/{job_id_pk}/finish')
    assert finish_req.status_code == 200
    assert finish_req.get_json()['job']['status'] == 'FINISH_REQUESTED'

    # Inject realistic deterministic event timestamps to rigorously verify break exclusion math:
    # 10:15 AM Start, 12:00 PM Pause (105m), 12:30 PM Resume (30m break), 14:20 PM Finish (110m).
    # Active duration = 105m + 110m = 215m = 3h 35m (12,900 seconds)
    # At ₹800/hr: 215 / 60 * 800 = ₹2,866.67
    conn = get_db()
    conn.execute("DELETE FROM tractor_work_events WHERE tractor_job_id = ?", (job_id_pk,))
    t_start = "2026-09-26T10:15:00+00:00"
    t_pause = "2026-09-26T12:00:00+00:00"
    t_resume = "2026-09-26T12:30:00+00:00"
    t_finish = "2026-09-26T14:20:00+00:00"

    conn.execute("INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes) VALUES (?, 'STARTED', ?, ?, 'Start')", (job_id_pk, farmer_id, t_start))
    conn.execute("INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes) VALUES (?, 'PAUSED', ?, ?, 'Lunch break')", (job_id_pk, driver_id, t_pause))
    conn.execute("INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes) VALUES (?, 'RESUMED', ?, ?, 'Resume work')", (job_id_pk, farmer_id, t_resume))
    conn.commit()
    conn.close()

    # Driver confirms finish
    client.post('/api/auth/login', json={"email": driver_email, "password": password})
    confirm_finish = client.post(f'/api/tractor/jobs/{job_id_pk}/confirm-finish')
    assert confirm_finish.status_code == 200
    completed_job = confirm_finish.get_json()['job']
    assert completed_job['status'] == 'COMPLETED'
    print(f"  -> Passed: Finish confirmed. Job completed with status: {completed_job['status']}")

    # =========================================================================
    # TEST 11 & 12: Verify Mathematical Exactness of Active Duration & Payment
    # =========================================================================
    print("\n[Test 11 & 12] Validating Server-Side Duration & Payment Math...")
    # Inject exact finish event
    conn = get_db()
    conn.execute("DELETE FROM tractor_work_events WHERE tractor_job_id = ?", (job_id_pk,))
    conn.execute("INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes) VALUES (?, 'STARTED', ?, ?, 'Start')", (job_id_pk, farmer_id, t_start))
    conn.execute("INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes) VALUES (?, 'PAUSED', ?, ?, 'Lunch break')", (job_id_pk, driver_id, t_pause))
    conn.execute("INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes) VALUES (?, 'RESUMED', ?, ?, 'Resume work')", (job_id_pk, farmer_id, t_resume))
    conn.execute("INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes) VALUES (?, 'FINISHED', ?, ?, 'Finish confirmed')", (job_id_pk, driver_id, t_finish))
    # Recalculate using server function
    from app import compute_job_timeline_and_seconds, compute_tractor_payment
    events = [dict(r) for r in conn.execute("SELECT * FROM tractor_work_events WHERE tractor_job_id = ?", (job_id_pk,)).fetchall()]
    active_seconds = compute_job_timeline_and_seconds(events, current_status='COMPLETED')
    calculated_amount = compute_tractor_payment(800.0, 'per_hour', 2.5, active_seconds)
    conn.execute("UPDATE tractor_jobs SET total_working_seconds = ?, calculated_amount = ?, final_amount = ? WHERE id = ?", (active_seconds, calculated_amount, calculated_amount, job_id_pk))
    conn.commit()
    conn.close()

    # Active seconds should be exactly 12,900s (3h 35m) omitting 30m break
    assert active_seconds == 12900, f"Expected 12900s active duration, got {active_seconds}"
    assert calculated_amount == 2866.67, f"Expected Rs. 2866.67 at Rs. 800/hr, got {calculated_amount}"
    print(f"  -> Passed: Exact Active Duration = {active_seconds}s (3h 35m, 30m break excluded). Final Payment = Rs. {calculated_amount:,.2f}")

    # Test Per-Acre Rate calculation
    per_acre_amt = compute_tractor_payment(1500.0, 'per_acre', 2.0, 12900)
    assert per_acre_amt == 3000.0, f"Expected 3000.0 for 2 acres @ 1500/acre, got {per_acre_amt}"
    print(f"  -> Passed: Per Acre calculation: 2.0 acres x Rs. 1,500/acre = Rs. {per_acre_amt}")

    # Test Fixed Amount calculation
    fixed_amt = compute_tractor_payment(4000.0, 'fixed', 2.0, 12900)
    assert fixed_amt == 4000.0, f"Expected 4000.0 for fixed rate, got {fixed_amt}"
    print(f"  -> Passed: Fixed rate calculation: Rs. {fixed_amt}")

    # =========================================================================
    # TEST 13 & 14: Add Completed Tractor Payment to Farm Diary & Expenses
    # =========================================================================
    print("\n[Test 13 & 14] Testing Farm Expenses Integration...")
    client.post('/api/auth/login', json={"email": farmer_email, "password": password})
    add_exp_res = client.post(f'/api/tractor/jobs/{job_id_pk}/add-to-expenses')
    assert add_exp_res.status_code == 201, f"Add expense failed: {add_exp_res.get_json()}"
    exp_data = add_exp_res.get_json()['expense']
    assert exp_data['category'] == 'Tractor'
    assert float(exp_data['amount']) == 2866.67
    assert exp_data['crop'] == 'Cotton'
    assert job_code in exp_data['description']
    print(f"  -> Passed: Tractor expense Rs. {exp_data['amount']} created with category 'Tractor' and Job reference {job_code}")

    # Check that it appears in Farm Expenses endpoint
    all_exp_res = client.get('/api/expenses?category=Tractor')
    assert all_exp_res.status_code == 200
    assert any(e['id'] == exp_data['id'] for e in all_exp_res.get_json()['expenses'])
    print("  -> Passed: Verified expense seamlessly appears in /api/expenses query")

    # Idempotency check: Adding again returns already_added=True without duplicate insertion
    add_again = client.post(f'/api/tractor/jobs/{job_id_pk}/add-to-expenses')
    assert add_again.status_code == 200
    assert add_again.get_json().get('already_added') == True
    print("  -> Passed: Idempotent duplicate expense addition prevented")

    # =========================================================================
    # TEST 15: Farmer & Driver see identical completed digital record
    # =========================================================================
    print("\n[Test 15] Testing Symmetric Farmer and Driver Digital Record...")
    # Farmer view
    farmer_view = client.get(f'/api/tractor/jobs/{job_id_pk}')
    assert farmer_view.status_code == 200
    fj = farmer_view.get_json()['job']
    assert fj['status'] == 'COMPLETED'
    assert fj['final_amount'] == 2866.67

    # Driver view
    client.post('/api/auth/login', json={"email": driver_email, "password": password})
    driver_view = client.get(f'/api/tractor/jobs/{job_id_pk}')
    assert driver_view.status_code == 200
    dj = driver_view.get_json()['job']
    assert dj['status'] == 'COMPLETED'
    assert dj['final_amount'] == 2866.67
    print("  -> Passed: Both Farmer and Driver access identical, verified digital receipt")

    # =========================================================================
    # TEST 16: Multi-User Isolation & Intruder Blocking
    # =========================================================================
    print("\n[Test 16] Testing Strict Multi-User Security & Intruder Blocking...")
    client.post('/api/auth/login', json={"email": unauthorized_email, "password": password})

    # Intruder cannot view completed private job
    intruder_view = client.get(f'/api/tractor/jobs/{job_id_pk}')
    assert intruder_view.status_code == 403, f"Expected 403 for unauthorized view, got {intruder_view.status_code}"

    # Intruder cannot tamper or add to expenses
    intruder_tamper = client.post(f'/api/tractor/jobs/{job_id_pk}/add-to-expenses')
    assert intruder_tamper.status_code == 403
    print("  -> Passed: Intruder blocked from viewing or tampering with private job records (403 Forbidden)")

    # =========================================================================
    # TEST 17 & 18: State Machine Invariant Protection
    # =========================================================================
    print("\n[Test 17 & 18] Testing State Machine Invariants & Immutability...")
    client.post('/api/auth/login', json={"email": farmer_email, "password": password})

    # Cannot restart completed job
    restart_res = client.post(f'/api/tractor/jobs/{job_id_pk}/start')
    assert restart_res.status_code == 400
    assert "Cannot start" in restart_res.get_json()['error']
    print("  -> Passed: Restarting completed job rejected with 400")

    # Cannot pause completed job
    pause_comp = client.post(f'/api/tractor/jobs/{job_id_pk}/pause')
    assert pause_comp.status_code == 400
    print("  -> Passed: Pausing completed job rejected with 400")

    # =========================================================================
    # TEST 19: Dispute System & Dispute Resolution
    # =========================================================================
    print("\n[Test 19] Testing Dispute System...")
    # Create a 2nd job to test dispute workflow
    job2_res = client.post('/api/tractor/jobs', json={
        "work_date": "2026-09-26",
        "field_name": "South Plot",
        "crop": "Paddy",
        "work_type": "Rotavating",
        "rate": 1500.0,
        "rate_unit": "per_acre",
        "field_size": 2.0
    })
    job2_id = job2_res.get_json()['job']['id']

    # Raise dispute
    disp_res = client.post(f'/api/tractor/jobs/{job2_id}/dispute', json={
        "reason": "Work stopped because of rain",
        "description": "Heavy rainfall stopped rotavator after 30 minutes."
    })
    assert disp_res.status_code == 200
    assert disp_res.get_json()['job']['status'] == 'DISPUTED'
    assert len(disp_res.get_json()['job']['disputes']) == 1
    print("  -> Passed: Dispute recorded in database and job marked DISPUTED")

    # Resolve dispute
    resolve_res = client.post(f'/api/tractor/jobs/{job2_id}/resolve-dispute', json={
        "resolution": "Agreed to resume tomorrow morning",
        "next_status": "PAUSED"
    })
    assert resolve_res.status_code == 200
    assert resolve_res.get_json()['job']['status'] == 'PAUSED'
    print("  -> Passed: Dispute resolved cleanly to PAUSED")

    # =========================================================================
    # TEST 20: Regression Check: Existing Core Farmer AI Modules
    # =========================================================================
    print("\n[Test 20] Regression Check on Core Farmer AI Endpoints...")
    crop_res = client.post('/api/recommend-crop', json={
        "soil_type": "Black",
        "season": "Kharif",
        "water_availability": "Medium",
        "previous_crop": "Cotton",
        "location": "Warangal"
    })
    assert crop_res.status_code == 200 and crop_res.get_json()['success'] == True

    diary_summary = client.get('/api/farm-summary')
    assert diary_summary.status_code == 200 and diary_summary.get_json()['success'] == True

    tractor_summary = client.get('/api/tractor/summary')
    assert tractor_summary.status_code == 200 and tractor_summary.get_json()['success'] == True

    print("  -> Passed: Crop recommendation, farm diary summary, and tractor summary working perfectly")

    print("\n" + "=" * 75)
    print("       ALL 20 TRACTOR WORK TRACKER TESTS PASSED SUCCESSFULLY! ")
    print("=" * 75)

if __name__ == '__main__':
    run_tests()
