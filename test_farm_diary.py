"""
Automated Test Suite for Farmer AI Farm Diary + Expenses Module
Validates all features, validation rules, financial summaries, and strict multi-user data isolation.
"""

import os
import json
import time
import io
from app import app, get_db

def run_tests():
    print("=" * 70)
    print("      FARMER AI: FARM DIARY + EXPENSES AUTOMATED TEST SUITE")
    print("=" * 70)

    client = app.test_client()

    # Create two test users to verify multi-user isolation
    ts = int(time.time())
    user1_email = f"farmer_diary1_{ts}@test.com"
    user2_email = f"farmer_diary2_{ts}@test.com"
    password = "StrongPassword123!"

    print("\n[Setup] Registering User 1...")
    res = client.post('/api/auth/register', json={
        "name": "Ramesh Kumar",
        "email": user1_email,
        "password": password,
        "location": "Warangal, Telangana",
        "language": "en"
    })
    assert res.status_code == 200, f"Failed user 1 registration: {res.get_json()}"

    print("[Setup] Registering User 2...")
    res2 = client.post('/api/auth/register', json={
        "name": "Suresh Patel",
        "email": user2_email,
        "password": password,
        "location": "Nalgonda, Telangana",
        "language": "en"
    })
    assert res2.status_code == 200, f"Failed user 2 registration: {res2.get_json()}"

    # 1. Login as User 1
    print("\n[Test 1] Login as User 1...")
    login_res = client.post('/api/auth/login', json={"email": user1_email, "password": password})
    assert login_res.status_code == 200
    user1_info = login_res.get_json()['user']
    print(f"  -> Logged in as User 1 (ID: {user1_info['id']})")

    # 2. Test Diary Entry Creation
    print("\n[Test 2] Testing Farm Diary Entry Creation...")
    diary_payload = {
        "date": "2026-09-26",
        "crop": "Cotton",
        "field_name": "North Field",
        "activity_type": "Fertilizing",
        "description": "Applied 50kg Urea and 25kg DAP",
        "notes": "Soil moisture is adequate following light morning shower"
    }
    diary_res = client.post('/api/farm-diary', json=diary_payload)
    assert diary_res.status_code == 201, f"Failed: {diary_res.get_json()}"
    diary_data = diary_res.get_json()
    assert diary_data['success'] is True
    diary_id = diary_data['entry']['id']
    assert diary_data['entry']['crop'] == "Cotton"
    assert diary_data['entry']['activity_type'] == "Fertilizing"
    print(f"  -> Passed: Created Diary Entry #{diary_id}")

    # 2b. Test Diary Validation (Missing required fields)
    print("\n[Test 2b] Testing Diary Validation...")
    bad_diary = client.post('/api/farm-diary', json={"date": ""})
    assert bad_diary.status_code == 400
    assert "Date is required" in bad_diary.get_json()['error']
    print("  -> Passed: Rejected missing date.")

    # 3. Test Expense Creation & Validation
    print("\n[Test 3] Testing Expense Management & Validation...")
    exp_payload1 = {
        "date": "2026-09-26",
        "category": "Fertilizer",
        "amount": 2500.0,
        "crop": "Cotton",
        "field_name": "North Field",
        "description": "Purchased fertilizer bags"
    }
    exp_res1 = client.post('/api/expenses', json=exp_payload1)
    assert exp_res1.status_code == 201
    exp_id1 = exp_res1.get_json()['expense']['id']

    exp_payload2 = {
        "date": "2026-09-25",
        "category": "Tractor",
        "amount": 3000.0,
        "crop": "Cotton",
        "field_name": "North Field",
        "description": "Tractor ploughing work"
    }
    exp_res2 = client.post('/api/expenses', json=exp_payload2)
    assert exp_res2.status_code == 201
    exp_id2 = exp_res2.get_json()['expense']['id']

    # Test negative amount rejection
    bad_exp = client.post('/api/expenses', json={
        "date": "2026-09-26",
        "category": "Seeds",
        "amount": -500.0
    })
    assert bad_exp.status_code == 400
    assert "cannot be negative" in bad_exp.get_json()['error']
    print("  -> Passed: Negative expense rejected.")
    print(f"  -> Passed: Created Expenses #{exp_id1} (Rs. 2,500) and #{exp_id2} (Rs. 3,000)")

    # 4. Test Income Creation & Auto-Calculation
    print("\n[Test 4] Testing Farm Income Record & Automatic Calculation...")
    # 500 kg @ Rs. 70/kg = Rs. 35,000
    inc_payload = {
        "date": "2026-09-26",
        "crop": "Cotton",
        "quantity": 500.0,
        "unit": "kg",
        "selling_price": 70.0,
        "buyer_name": "Shri Lakshmi Ginning Mill",
        "notes": "First harvest picking sale"
    }
    inc_res = client.post('/api/income', json=inc_payload)
    assert inc_res.status_code == 201
    inc_data = inc_res.get_json()
    assert inc_data['income']['total_amount'] == 35000.0
    inc_id = inc_data['income']['id']
    print(f"  -> Passed: Created Income #{inc_id} with auto-computed total: Rs. {inc_data['income']['total_amount']}")

    # Test negative quantity rejection
    bad_inc = client.post('/api/income', json={
        "date": "2026-09-26",
        "crop": "Cotton",
        "quantity": -10,
        "selling_price": 50
    })
    assert bad_inc.status_code == 400
    assert "greater than zero" in bad_inc.get_json()['error']
    print("  -> Passed: Negative quantity rejected.")

    # 5. Test Farm Summary (Net Balance, Totals, Breakdowns)
    print("\n[Test 5] Testing Farm Summary Calculation...")
    summary_res = client.get('/api/farm-summary')
    assert summary_res.status_code == 200
    summary = summary_res.get_json()['summary']
    assert summary['total_expenses'] == 5500.0, f"Expected 5500, got {summary['total_expenses']}"
    assert summary['total_income'] == 35000.0, f"Expected 35000, got {summary['total_income']}"
    assert summary['net_balance'] == 29500.0, f"Expected 29500, got {summary['net_balance']}"
    assert summary['diary_count'] == 1
    assert summary['expense_count'] == 2
    assert summary['income_count'] == 1
    assert len(summary['expenses_by_category']) == 2
    assert len(summary['recent_activities']) == 4
    print("  -> Passed: Summary calculations exact: Expenses Rs. 5,500 | Income Rs. 35,000 | Balance Rs. 29,500")

    # 6. Test Edit and Update
    print("\n[Test 6] Testing Edit/Update on Diary, Expense, and Income...")
    update_diary = client.put(f'/api/farm-diary/{diary_id}', json={
        "date": "2026-09-26",
        "crop": "Cotton",
        "field_name": "North Field",
        "activity_type": "Fertilizing",
        "description": "Updated: Applied 60kg Urea and 30kg DAP"
    })
    assert update_diary.status_code == 200
    assert "60kg Urea" in update_diary.get_json()['entry']['description']

    update_exp = client.put(f'/api/expenses/{exp_id1}', json={
        "date": "2026-09-26",
        "category": "Fertilizer",
        "amount": 2800.0,
        "crop": "Cotton"
    })
    assert update_exp.status_code == 200
    assert update_exp.get_json()['expense']['amount'] == 2800.0

    update_inc = client.put(f'/api/income/{inc_id}', json={
        "date": "2026-09-26",
        "crop": "Cotton",
        "quantity": 600.0,
        "unit": "kg",
        "selling_price": 70.0
    })
    assert update_inc.status_code == 200
    assert update_inc.get_json()['income']['total_amount'] == 42000.0
    print("  -> Passed: Updates persisted and recomputed properly.")

    # 7. Test Filter and Search
    print("\n[Test 7] Testing Filter and Search...")
    filter_exp = client.get('/api/expenses?category=Fertilizer')
    assert filter_exp.status_code == 200
    assert len(filter_exp.get_json()['expenses']) == 1
    assert filter_exp.get_json()['expenses'][0]['category'] == 'Fertilizer'

    search_res = client.get('/api/expenses?search=tractor')
    assert search_res.status_code == 200
    assert len(search_res.get_json()['expenses']) == 1

    search_diary = client.get('/api/farm-diary?search=urea')
    assert search_diary.status_code == 200
    assert len(search_diary.get_json()['entries']) == 1
    print("  -> Passed: Category filters and keyword searches return accurate matching records.")

    # 8. Test Multi-User Data Isolation (CRITICAL SECURITY)
    print("\n[Test 8] Testing Multi-User Data Isolation & Tampering Protection...")
    # Log out User 1 and log in as User 2
    client.post('/api/auth/logout')
    login_user2 = client.post('/api/auth/login', json={"email": user2_email, "password": password})
    assert login_user2.status_code == 200

    # User 2 should have 0 records
    u2_summary = client.get('/api/farm-summary').get_json()['summary']
    assert u2_summary['total_expenses'] == 0.0
    assert u2_summary['total_income'] == 0.0
    assert u2_summary['diary_count'] == 0

    u2_diary = client.get('/api/farm-diary').get_json()['entries']
    assert len(u2_diary) == 0

    # User 2 attempts ID manipulation: editing or deleting User 1's records
    tamper_edit = client.put(f'/api/expenses/{exp_id1}', json={"amount": 999999})
    assert tamper_edit.status_code == 404, f"Security leak! User 2 edited User 1's record: {tamper_edit.status_code}"

    tamper_delete_diary = client.delete(f'/api/farm-diary/{diary_id}')
    assert tamper_delete_diary.status_code == 404, f"Security leak! User 2 deleted User 1's diary: {tamper_delete_diary.status_code}"

    tamper_delete_inc = client.delete(f'/api/income/{inc_id}')
    assert tamper_delete_inc.status_code == 404, f"Security leak! User 2 deleted User 1's income: {tamper_delete_inc.status_code}"
    print("  -> Passed: User 2 isolated with 0 records. ID tampering attempts rejected with 404.")

    # 9. Test Receipt / Media Upload
    print("\n[Test 9] Testing Multipart Photo/Receipt Upload & Security Isolation...")
    # Log back into User 1
    client.post('/api/auth/logout')
    client.post('/api/auth/login', json={"email": user1_email, "password": password})

    fake_receipt_data = io.BytesIO(b"Fake receipt image bytes content for test")
    upload_res = client.post('/api/expenses', data={
        "date": "2026-09-26",
        "category": "Pesticides",
        "amount": "1200",
        "crop": "Cotton",
        "description": "Spray for bollworm with bill receipt",
        "receipt": (fake_receipt_data, "bill_receipt.png")
    }, content_type='multipart/form-data')
    assert upload_res.status_code == 201
    uploaded_expense = upload_res.get_json()['expense']
    assert uploaded_expense['receipt_path'] is not None
    receipt_filename = uploaded_expense['receipt_path']
    print(f"  -> Uploaded receipt: {receipt_filename}")

    # User 1 can view their receipt
    view_res = client.get(f'/uploads/{receipt_filename}')
    assert view_res.status_code == 200
    print("  -> Passed: User 1 can view their uploaded receipt.")

    # Switch to User 2: User 2 must NOT be able to view User 1's receipt file!
    client.post('/api/auth/logout')
    client.post('/api/auth/login', json={"email": user2_email, "password": password})
    u2_view_res = client.get(f'/uploads/{receipt_filename}')
    assert u2_view_res.status_code == 404, f"Security leak! User 2 accessed User 1's receipt: {u2_view_res.status_code}"
    print("  -> Passed: User 2 blocked from viewing User 1's receipt file (404).")

    # 10. Test Delete Operations
    print("\n[Test 10] Testing Safe Deletion by Owner...")
    client.post('/api/auth/logout')
    client.post('/api/auth/login', json={"email": user1_email, "password": password})

    del_diary = client.delete(f'/api/farm-diary/{diary_id}')
    assert del_diary.status_code == 200

    del_exp = client.delete(f'/api/expenses/{exp_id1}')
    assert del_exp.status_code == 200

    del_inc = client.delete(f'/api/income/{inc_id}')
    assert del_inc.status_code == 200

    # Verify counts decreased
    after_summary = client.get('/api/farm-summary').get_json()['summary']
    assert after_summary['diary_count'] == 0
    assert after_summary['income_count'] == 0
    print("  -> Passed: Records deleted safely by owner.")

    print("\n" + "=" * 70)
    print("       ALL FARM DIARY + EXPENSES TESTS PASSED SUCCESSFULLY! ")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()
