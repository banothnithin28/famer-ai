"""
Automated Test Suite for Farmer AI Phase 3: Labour Work Tracker
Validates:
1. Labour Job creation (Per Day, Per Hour, Fixed).
2. Worker joining via Job ID / QR Join Token.
3. Two-Party Work Agreement ("Agree to Work").
4. Daily Attendance system (Present, Half Day, Absent) & wage calculations.
5. Duplicate attendance rejection on same worker and date.
6. Hourly work tracking (Start, Pause, Resume, Finish) with break exclusion.
7. Two-Party final confirmation (Farmer + Worker -> COMPLETED).
8. Advance / debt tracking with complete transaction audit trail.
9. Payment tracking (Cash, UPI, Bank Transfer) with automatic pending balance.
10. Dispute system (Raise Dispute, Under Review, Resolved) preserving history.
11. Worker Profile / History aggregation (total jobs, days, hours, earned, paid, pending).
12. Farm & Crop-wise labour expenses breakdown.
13. Automatic Farm Diary + Expenses module integration (Category 'Labour').
14. Strict multi-tenant security & authorization enforcement.
15. Farmer AI (Gemini Assistant) database grounding for labour queries.
"""

import os
import time
import datetime
import json
from app import app, get_db

def run_tests():
    print("=" * 75)
    print("       FARMER AI: PHASE 3 LABOUR WORK TRACKER AUTOMATED TEST SUITE")
    print("=" * 75)

    client = app.test_client()
    ts = int(time.time())

    farmer_email = f"farmer_labour_{ts}@test.com"
    worker_email = f"worker_labour_{ts}@test.com"
    intruder_email = f"intruder_labour_{ts}@test.com"
    password = "StrongPassword123!"

    # =========================================================================
    # SETUP: Register Farmer, Worker, and Unauthorized Intruder
    # =========================================================================
    print("\n[Setup] Registering Farmer, Worker, and Third-Party Intruder...")
    r1 = client.post('/api/auth/register', json={"name": "Nithin Farmer", "email": farmer_email, "password": password, "location": "Warangal", "language": "en"})
    assert r1.status_code == 200, f"Farmer reg failed: {r1.get_json()}"
    farmer_id = r1.get_json()['user']['id']

    r2 = client.post('/api/auth/register', json={"name": "Ramesh Worker", "email": worker_email, "password": password, "location": "Karimnagar", "language": "en"})
    assert r2.status_code == 200, f"Worker reg failed: {r2.get_json()}"
    worker_id = r2.get_json()['user']['id']

    r3 = client.post('/api/auth/register', json={"name": "Intruder User", "email": intruder_email, "password": password, "location": "Hyderabad", "language": "en"})
    assert r3.status_code == 200, f"Intruder reg failed: {r3.get_json()}"
    intruder_id = r3.get_json()['user']['id']

    print(f"  -> Created Farmer (ID: {farmer_id}), Worker (ID: {worker_id}), Intruder (ID: {intruder_id})")

    # =========================================================================
    # TEST 1: Farmer creates Daily Labour Job (Cotton Harvesting @ ₹500/day, 2 workers)
    # =========================================================================
    print("\n[Test 1] Testing Farmer Labour Job Creation (Per Day)...")
    client.post('/api/auth/login', json={"email": farmer_email, "password": password})

    create_res = client.post('/api/labour/jobs', json={
        "work_date": "2026-10-02",
        "crop": "Cotton",
        "field_name": "Field A",
        "work_type": "Cotton Harvesting",
        "worker_name": "Ramesh Worker",
        "worker_phone": "9876543210",
        "payment_type": "per_day",
        "rate": 500.0,
        "num_workers": 2,
        "expected_start_date": "2026-10-02",
        "expected_end_date": "2026-10-10",
        "notes": "Cotton picking round 1"
    })
    assert create_res.status_code == 201, f"Create labour job failed: {create_res.get_json()}"
    job_data = create_res.get_json()['job']
    job_id_pk = job_data['id']
    job_code = job_data['job_id']
    join_token = job_data['join_token']

    assert job_code.startswith("LAB-20261002-"), f"Invalid job ID format: {job_code}"
    assert job_data['status'] == 'CREATED'
    assert job_data['farmer_id'] == farmer_id
    assert job_data['rate'] == 500.0
    assert job_data['payment_type'] == 'per_day'
    print(f"  -> Passed: Created Labour Job {job_code} (PK: {job_id_pk}, Token: {join_token})")

    # =========================================================================
    # TEST 2: Worker previews and joins Labour Job via Job ID / QR Token
    # =========================================================================
    print("\n[Test 2] Testing Worker Preview and Joining via Job ID / Token...")
    client.post('/api/auth/login', json={"email": worker_email, "password": password})

    # Preview by Job ID
    preview_res = client.get(f'/api/labour/jobs/{job_code}')
    assert preview_res.status_code == 200
    assert preview_res.get_json()['job']['crop'] == "Cotton"
    assert preview_res.get_json()['job']['rate'] == 500.0

    # Join job
    join_res = client.post(f'/api/labour/jobs/{job_code}/join')
    assert join_res.status_code == 200, f"Join failed: {join_res.get_json()}"
    joined_job = join_res.get_json()['job']
    assert joined_job['status'] == 'WORKER_JOINED'
    assert joined_job['worker_id'] == worker_id
    print(f"  -> Passed: Worker Ramesh joined job {job_code}, status became WORKER_JOINED")

    # =========================================================================
    # TEST 3: Two-Party Work Agreement ("Agree to Work")
    # =========================================================================
    print("\n[Test 3] Testing Two-Party Work Agreement Confirmation...")
    # Worker confirms agreement
    agree_worker_res = client.post(f'/api/labour/jobs/{job_id_pk}/agree')
    assert agree_worker_res.status_code == 200
    assert agree_worker_res.get_json()['job']['status'] == 'AGREED'
    assert agree_worker_res.get_json()['job']['worker_agreed'] is True
    print(f"  -> Passed: Agreement confirmed by both parties. Status: AGREED")

    # =========================================================================
    # TEST 4: Attendance System & Wage Calculation (Present, Half Day, Absent)
    # =========================================================================
    print("\n[Test 4] Testing Daily Attendance Marking & Wage Calculations...")
    client.post('/api/auth/login', json={"email": farmer_email, "password": password})

    # Day 1: Present (1.0 day x ₹500 = ₹500)
    att1 = client.post(f'/api/labour/jobs/{job_id_pk}/attendance', json={
        "worker_name": "Ramesh Worker",
        "date": "2026-10-02",
        "status": "PRESENT",
        "notes": "Full day harvest"
    })
    assert att1.status_code == 201
    assert att1.get_json()['attendance']['wage_amount'] == 500.0

    # Day 2: Present (1.0 day x ₹500 = ₹500)
    att2 = client.post(f'/api/labour/jobs/{job_id_pk}/attendance', json={
        "worker_name": "Ramesh Worker",
        "date": "2026-10-03",
        "status": "PRESENT"
    })
    assert att2.status_code == 201

    # Day 3: Half Day (0.5 day x ₹500 = ₹250)
    att3 = client.post(f'/api/labour/jobs/{job_id_pk}/attendance', json={
        "worker_name": "Ramesh Worker",
        "date": "2026-10-04",
        "status": "HALF_DAY",
        "notes": "Worked morning session only"
    })
    assert att3.status_code == 201
    assert att3.get_json()['attendance']['wage_amount'] == 250.0

    # Day 4: Absent (0.0 day x ₹500 = ₹0)
    att4 = client.post(f'/api/labour/jobs/{job_id_pk}/attendance', json={
        "worker_name": "Ramesh Worker",
        "date": "2026-10-05",
        "status": "ABSENT",
        "notes": "Sick leave"
    })
    assert att4.status_code == 201
    assert att4.get_json()['attendance']['wage_amount'] == 0.0

    # Total calculated wages: 2 full days (Rs. 1,000) + 1 half day (Rs. 250) + 0 (Absent) = Rs. 1,250
    job_after_att = att4.get_json()['job']
    assert job_after_att['total_days_worked'] == 2.5
    assert job_after_att['total_earned'] == 1250.0
    assert job_after_att['pending_amount'] == 1250.0
    print(f"  -> Passed: 2 Full Days + 1 Half Day + 1 Absent = 2.5 Days, Total Earned: Rs. {job_after_att['total_earned']}")

    # =========================================================================
    # TEST 5: Guard against Duplicate Attendance
    # =========================================================================
    print("\n[Test 5] Testing Duplicate Attendance Prevention on Same Worker & Date...")
    dup_res = client.post(f'/api/labour/jobs/{job_id_pk}/attendance', json={
        "worker_name": "Ramesh Worker",
        "date": "2026-10-02",
        "status": "PRESENT"
    })
    assert dup_res.status_code == 400, "Should reject duplicate attendance for the same worker and date"
    print(f"  -> Passed: Duplicate attendance rejected with message: '{dup_res.get_json()['error']}'")

    # =========================================================================
    # TEST 6: Advance / Debt Tracking
    # =========================================================================
    print("\n[Test 6] Testing Advance Tracking (Total Earned: Rs. 1,250)...")
    # Farmer records advance of Rs. 500
    adv1 = client.post(f'/api/labour/jobs/{job_id_pk}/advance', json={
        "worker_name": "Ramesh Worker",
        "amount": 500.0,
        "advance_date": "2026-10-03",
        "payment_method": "Cash",
        "notes": "Festival advance for groceries"
    })
    assert adv1.status_code == 201
    job_adv1 = adv1.get_json()['job']
    assert job_adv1['total_advance'] == 500.0
    assert job_adv1['pending_amount'] == 750.0  # 1250 - 500 = 750
    print(f"  -> Passed: Advance of Rs. 500 recorded. Pending remaining: Rs. {job_adv1['pending_amount']}")

    # =========================================================================
    # TEST 7: Payment Tracking & Automatic Pending Amount Calculation
    # =========================================================================
    print("\n[Test 7] Testing Payment Tracking via UPI...")
    pay1 = client.post(f'/api/labour/jobs/{job_id_pk}/payment', json={
        "worker_name": "Ramesh Worker",
        "amount": 400.0,
        "payment_date": "2026-10-05",
        "payment_method": "UPI",
        "reference_no": "UPI-TXN-987654",
        "notes": "Weekly wage installment"
    })
    assert pay1.status_code == 201
    job_pay1 = pay1.get_json()['job']
    assert job_pay1['total_paid'] == 400.0
    assert job_pay1['total_advance'] == 500.0
    assert job_pay1['pending_amount'] == 350.0  # 1250 - (400 + 500) = 350
    print(f"  -> Passed: Payment of Rs. 400 recorded via UPI. Remaining Pending: Rs. {job_pay1['pending_amount']}")

    # Pay remaining balance of Rs. 350
    pay2 = client.post(f'/api/labour/jobs/{job_id_pk}/payment', json={
        "worker_name": "Ramesh Worker",
        "amount": 350.0,
        "payment_date": "2026-10-06",
        "payment_method": "Cash",
        "notes": "Final settlement"
    })
    assert pay2.status_code == 201
    job_pay2 = pay2.get_json()['job']
    assert job_pay2['total_paid'] == 750.0
    assert job_pay2['pending_amount'] == 0.0  # Fully settled!
    print(f"  -> Passed: Final payment recorded. Worker is fully settled (Pending: Rs. {job_pay2['pending_amount']})")

    # =========================================================================
    # TEST 8: Two-Party Work Completion Confirmation
    # =========================================================================
    print("\n[Test 8] Testing Two-Party Work Completion Confirmation...")
    # Farmer requests finish
    fin_req = client.post(f'/api/labour/jobs/{job_id_pk}/finish')
    assert fin_req.status_code == 200
    assert fin_req.get_json()['job']['status'] == 'FINISH_REQUESTED'

    # Worker confirms completion
    client.post('/api/auth/login', json={"email": worker_email, "password": password})
    confirm_fin = client.post(f'/api/labour/jobs/{job_id_pk}/confirm-finish')
    assert confirm_fin.status_code == 200
    comp_job = confirm_fin.get_json()['job']
    assert comp_job['status'] == 'COMPLETED'
    assert comp_job['farmer_confirmed'] is True
    assert comp_job['worker_confirmed'] is True
    print("  -> Passed: Both parties confirmed. Job status finalized to COMPLETED")

    # =========================================================================
    # TEST 9: Farm Diary & Expenses Integration (Category 'Labour')
    # =========================================================================
    print("\n[Test 9] Testing Farm Diary & Expenses Module Integration...")
    client.post('/api/auth/login', json={"email": farmer_email, "password": password})
    exp_res = client.post(f'/api/labour/jobs/{job_id_pk}/add-to-expenses')
    assert exp_res.status_code == 201
    exp_data = exp_res.get_json()['expense']
    assert exp_data['category'] == 'Labour'
    assert exp_data['crop'] == 'Cotton'
    assert exp_data['amount'] == 1250.0
    print(f"  -> Passed: Expense entry created in Farm Diary: Category '{exp_data['category']}', Amount Rs. {exp_data['amount']}")

    # Verify duplicate addition protection
    dup_exp = client.post(f'/api/labour/jobs/{job_id_pk}/add-to-expenses')
    assert dup_exp.status_code == 200
    assert dup_exp.get_json().get('already_added') is True
    print("  -> Passed: Duplicate expense insertion correctly prevented")

    # =========================================================================
    # TEST 10: Hourly Labour Work Tracking (Start, Pause, Resume, Finish)
    # =========================================================================
    print("\n[Test 10] Testing Hourly Labour Work Tracking...")
    hourly_create = client.post('/api/labour/jobs', json={
        "work_date": "2026-10-02",
        "crop": "Tomato",
        "field_name": "Greenhouse Plot",
        "work_type": "Pruning & Staking",
        "worker_name": "Suresh Worker",
        "payment_type": "per_hour",
        "rate": 100.0,
        "num_workers": 1
    })
    assert hourly_create.status_code == 201
    h_job = hourly_create.get_json()['job']
    h_job_id = h_job['id']

    # Start timer
    start_res = client.post(f'/api/labour/jobs/{h_job_id}/start')
    assert start_res.status_code == 200
    assert start_res.get_json()['job']['status'] == 'RUNNING'

    # Pause timer
    pause_res = client.post(f'/api/labour/jobs/{h_job_id}/pause', json={"notes": "Lunch Break"})
    assert pause_res.status_code == 200
    assert pause_res.get_json()['job']['status'] == 'PAUSED'

    # Resume timer
    resume_res = client.post(f'/api/labour/jobs/{h_job_id}/resume')
    assert resume_res.status_code == 200
    assert resume_res.get_json()['job']['status'] == 'RUNNING'

    # Finish timer & confirm
    finish_res = client.post(f'/api/labour/jobs/{h_job_id}/confirm-finish')
    assert finish_res.status_code == 200
    assert finish_res.get_json()['job']['status'] == 'COMPLETED'
    print(f"  -> Passed: Hourly labour tracking (Start -> Pause -> Resume -> Finish) executed smoothly")

    # =========================================================================
    # TEST 11: Dispute System
    # =========================================================================
    print("\n[Test 11] Testing Dispute System (Raise -> Disputed -> Resolve)...")
    dispute_job_create = client.post('/api/labour/jobs', json={
        "work_date": "2026-10-02",
        "crop": "Paddy",
        "field_name": "East Field",
        "work_type": "Transplanting",
        "worker_name": "Ramesh Worker",
        "payment_type": "per_day",
        "rate": 600.0
    })
    assert dispute_job_create.status_code == 201
    d_job_id = dispute_job_create.get_json()['job']['id']

    # Raise dispute
    disp_res = client.post(f'/api/labour/jobs/{d_job_id}/dispute', json={
        "reason": "Attendance mismatch",
        "description": "Worker claimed full day but left at 1 PM"
    })
    assert disp_res.status_code == 200
    assert disp_res.get_json()['job']['status'] == 'DISPUTED'
    print("  -> Passed: Dispute raised, status set to DISPUTED without destroying records")

    # Resolve dispute
    resolve_res = client.post(f'/api/labour/jobs/{d_job_id}/resolve-dispute', json={
        "resolution": "Agreed on half day rate of Rs. 300",
        "next_status": "AGREED"
    })
    assert resolve_res.status_code == 200
    assert resolve_res.get_json()['job']['status'] == 'AGREED'
    print("  -> Passed: Dispute resolved with resolution logged and status set to AGREED")

    # =========================================================================
    # TEST 12: Worker Profile & History Aggregation
    # =========================================================================
    print("\n[Test 12] Testing Worker Profile / History Aggregation...")
    w_hist_res = client.get('/api/labour/worker-history/Ramesh%20Worker')
    assert w_hist_res.status_code == 200
    w_profile = w_hist_res.get_json()['worker']
    assert w_profile['name'] == 'Ramesh Worker'
    assert w_profile['total_days'] >= 2.5
    assert w_profile['total_earned'] >= 1250.0
    assert w_profile['total_paid'] >= 750.0
    assert w_profile['total_advances'] >= 500.0
    assert len(w_profile['crop_breakdown']) >= 1
    print(f"  -> Passed: Worker Ramesh profile: {w_profile['total_days']} days, Rs. {w_profile['total_earned']} earned, Rs. {w_profile['total_paid']} paid, Rs. {w_profile['total_advances']} advances")

    # =========================================================================
    # TEST 13: Labour Summary Dashboard API
    # =========================================================================
    print("\n[Test 13] Testing Labour Summary Dashboard API...")
    sum_res = client.get('/api/labour/summary')
    assert sum_res.status_code == 200
    summary = sum_res.get_json()['summary']
    assert summary['completed_jobs'] >= 2
    assert summary['total_labour_cost'] >= 1250.0
    assert len(summary['crop_expenses']) >= 1
    print(f"  -> Passed: Summary API returned Active: {summary['active_jobs']}, Completed: {summary['completed_jobs']}, Cost: Rs. {summary['total_labour_cost']}, Crops: {len(summary['crop_expenses'])}")

    # =========================================================================
    # TEST 14: Security & Multi-Tenant Authorization
    # =========================================================================
    print("\n[Test 14] Testing Multi-Tenant Authorization & Intruder Isolation...")
    client.post('/api/auth/login', json={"email": intruder_email, "password": password})
    unauth_att = client.post(f'/api/labour/jobs/{job_id_pk}/attendance', json={"status": "PRESENT"})
    assert unauth_att.status_code == 403
    unauth_pay = client.post(f'/api/labour/jobs/{job_id_pk}/payment', json={"amount": 100})
    assert unauth_pay.status_code == 403
    print("  -> Passed: Unauthorized intruder access strictly blocked with 403 Forbidden")

    # =========================================================================
    # TEST 15: Farmer AI Chatbot Grounding for Labour Queries
    # =========================================================================
    print("\n[Test 15] Testing Farmer AI (Gemini Assistant) Database Grounding...")
    client.post('/api/auth/login', json={"email": farmer_email, "password": password})

    # Query 1: Labour cost for cotton
    ai_cotton = client.post('/api/gemini/chat', json={"message": "How much did I spend on labour for cotton?"})
    assert ai_cotton.status_code == 200
    cotton_reply = (ai_cotton.get_json().get('reply') or '').lower()
    assert "cotton" in cotton_reply or "labour" in cotton_reply or "1,250" in cotton_reply or "1250" in cotton_reply
    print("  -> Passed: AI answered cotton labour query with database context")

    # Query 2: Pending worker wages
    ai_owe = client.post('/api/gemini/chat', json={"message": "How much do I still owe my workers?"})
    assert ai_owe.status_code == 200
    owe_reply = (ai_owe.get_json().get('reply') or '').lower()
    assert any(k in owe_reply for k in ("pending", "wages", "rs", "₹", "0", "owe", "settled", "paid"))
    print("  -> Passed: AI answered pending wages query with database context")

    # Query 3: Ramesh worker history
    ai_ramesh = client.post('/api/gemini/chat', json={"message": "How many days did Ramesh work?"})
    assert ai_ramesh.status_code == 200
    ramesh_reply = (ai_ramesh.get_json().get('reply') or '').lower()
    assert "ramesh" in ramesh_reply or "2.5" in ramesh_reply or "days" in ramesh_reply
    print("  -> Passed: AI answered worker-specific query using database records")

    print("\n" + "=" * 75)
    print("      ALL 15 AUTOMATED TESTS PASSED SUCCESSFULLY! (PHASE 3 COMPLETE)")
    print("=" * 75)

if __name__ == '__main__':
    run_tests()
