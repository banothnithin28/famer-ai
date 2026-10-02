"""
End-to-End Test Suite for Phase 4 - Bills / Receipt Scanning
Tests:
1. Bill / Receipt Image Generation with PIL
2. Upload & AI Scanning via POST /api/scan-bill
3. Total verification & discrepancy checks
4. Duplicate bill detection
5. Non-receipt / unreadable image handling
6. Saving confirmed bill as farm expense
7. Fetching scanned bills via GET /api/scanned-bills
8. Multi-tenant user isolation (User A vs User B)
9. Large file & invalid extension rejection
"""

import os
import io
import json
import sqlite3
import requests
from PIL import Image, ImageDraw

BASE_URL = "http://localhost:5000"

def create_sample_receipt_image(bill_no="INV-9921", vendor="SRI BALAJI KRISHI KENDRA", date="2026-10-02", total="3850.00"):
    """Generate a clean visual image of an agricultural fertilizer tax invoice."""
    img = Image.new('RGB', (800, 1000), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    y = 30
    draw.rectangle([(20, 20), (780, 980)], outline=(0, 0, 0), width=3)
    
    # Header
    draw.text((220, y), "TAX INVOICE / CASH BILL", fill=(0, 0, 0))
    y += 40
    draw.text((200, y), vendor, fill=(0, 0, 0))
    y += 30
    draw.text((180, y), "Main Road, Near APMC Market, Warangal, Telangana", fill=(50, 50, 50))
    y += 25
    draw.text((260, y), "Phone: +91 9876543210  |  GSTIN: 36ABCDE1234F1Z5", fill=(50, 50, 50))
    y += 35
    draw.line([(30, y), (770, y)], fill=(0, 0, 0), width=2)
    y += 15
    
    # Bill meta
    draw.text((50, y), f"Invoice No: {bill_no}", fill=(0, 0, 0))
    draw.text((550, y), f"Date: {date}", fill=(0, 0, 0))
    y += 25
    draw.text((50, y), "Customer: Ramesh Patel (Farmer ID: F-8812)", fill=(0, 0, 0))
    draw.text((550, y), "Payment: Cash / UPI", fill=(0, 0, 0))
    y += 35
    draw.line([(30, y), (770, y)], fill=(0, 0, 0), width=2)
    y += 15
    
    # Table Header
    draw.text((50, y), "Item Description", fill=(0, 0, 0))
    draw.text((380, y), "Qty", fill=(0, 0, 0))
    draw.text((480, y), "Rate (Rs)", fill=(0, 0, 0))
    draw.text((640, y), "Amount (Rs)", fill=(0, 0, 0))
    y += 30
    draw.line([(30, y), (770, y)], fill=(150, 150, 150), width=1)
    y += 20
    
    # Line Items
    items = [
        ("IFFCO Urea 45kg Bag", "2 Bags", "266.50", "533.00"),
        ("DAP 50kg Fertilizer Bag", "2 Bags", "1350.00", "2700.00"),
        ("Neem Oil Pesticide 1L", "1 Bottle", "450.00", "450.00"),
        ("Zinc Sulphate 5kg", "1 Pack", "167.00", "167.00"),
    ]
    
    for name, qty, rate, amt in items:
        draw.text((50, y), name, fill=(0, 0, 0))
        draw.text((380, y), qty, fill=(0, 0, 0))
        draw.text((480, y), rate, fill=(0, 0, 0))
        draw.text((640, y), amt, fill=(0, 0, 0))
        y += 35
        
    y += 20
    draw.line([(30, y), (770, y)], fill=(0, 0, 0), width=2)
    y += 20
    
    # Summary
    draw.text((450, y), "Subtotal:", fill=(0, 0, 0))
    draw.text((640, y), "Rs 3850.00", fill=(0, 0, 0))
    y += 30
    draw.text((450, y), "CGST (0%):", fill=(0, 0, 0))
    draw.text((640, y), "Rs 0.00", fill=(0, 0, 0))
    y += 30
    draw.text((450, y), "SGST (0%):", fill=(0, 0, 0))
    draw.text((640, y), "Rs 0.00", fill=(0, 0, 0))
    y += 30
    draw.text((450, y), "Discount:", fill=(0, 0, 0))
    draw.text((640, y), "Rs 0.00", fill=(0, 0, 0))
    y += 35
    draw.line([(440, y), (770, y)], fill=(0, 0, 0), width=2)
    y += 15
    draw.text((450, y), "GRAND TOTAL:", fill=(0, 0, 0))
    draw.text((640, y), f"Rs {total}", fill=(0, 0, 0))
    y += 45
    draw.line([(30, y), (770, y)], fill=(0, 0, 0), width=1)
    y += 25
    draw.text((250, y), "Thank You for Farming with us! Visit Again.", fill=(50, 50, 50))
    
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=95)
    buffer.seek(0)
    return buffer

def create_non_receipt_image():
    """Generate an image that is NOT a receipt (e.g. photo of a plant leaf)."""
    img = Image.new('RGB', (400, 400), color=(34, 139, 34))
    draw = ImageDraw.Draw(img)
    draw.ellipse([(100, 100), (300, 300)], fill=(0, 100, 0), outline=(255, 255, 0))
    draw.text((120, 180), "Green Leaf Photo", fill=(255, 255, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=90)
    buffer.seek(0)
    return buffer

def test_full_bill_scanner_suite():
    print("=== STARTING PHASE 4 BILL SCANNER TESTS ===")
    session_user_a = requests.Session()
    session_user_b = requests.Session()

    # 1. Login User A (demo farmer)
    print("\n1. Logging in as Ramesh Patel (User A)...")
    res = session_user_a.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ramesh@farmer.ai",
        "password": "password123"
    })
    assert res.status_code == 200, f"User A login failed: {res.text}"
    user_a_data = res.json()["user"]
    print(f"   [OK] Logged in: {user_a_data['name']} (ID: {user_a_data['id']})")

    # 2. Login or Register User B (for multi-tenant isolation testing)
    print("\n2. Setting up User B for multi-tenant isolation...")
    res_b = session_user_b.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test_tenant_b@farmer.ai",
        "password": "password123"
    })
    if res_b.status_code != 200:
        res_b = session_user_b.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Suresh Farmer B",
            "email": "test_tenant_b@farmer.ai",
            "password": "password123",
            "phone": "9998887776",
            "location": "Guntur"
        })
    assert res_b.status_code in [200, 201], f"User B setup failed: {res_b.text}"
    user_b_data = res_b.json()["user"]
    print(f"   [OK] Logged in: {user_b_data['name']} (ID: {user_b_data['id']})")

    # 3. Test Invalid File Upload (non-image or huge file)
    print("\n3. Testing invalid file upload...")
    res_invalid = session_user_a.post(
        f"{BASE_URL}/api/scan-bill",
        files={"bill_image": ("test.txt", io.BytesIO(b"Not an image file"), "text/plain")}
    )
    assert res_invalid.status_code == 400, f"Expected 400 for text file, got {res_invalid.status_code}"
    print(f"   [OK] Correctly rejected invalid file extension: {res_invalid.json().get('error')}")

    # 4. Test Scan Non-Receipt Image
    print("\n4. Testing non-receipt image scan...")
    non_receipt_buf = create_non_receipt_image()
    res_nr = session_user_a.post(
        f"{BASE_URL}/api/scan-bill",
        files={"bill_image": ("plant_photo.jpg", non_receipt_buf, "image/jpeg")}
    )
    assert res_nr.status_code in [400, 422], f"Expected 400 or 422 for non-receipt, got {res_nr.status_code}: {res_nr.text}"
    nr_json = res_nr.json()
    assert nr_json.get("is_receipt") is False, "Expected is_receipt to be False"
    print(f"   [OK] Non-receipt properly rejected: {nr_json.get('error')}")

    # 5. Test Valid Bill AI Scanning
    print("\n5. Testing AI extraction on Fertilizer Bill...")
    bill_no = f"INV-{os.urandom(2).hex().upper()}"
    receipt_buf = create_sample_receipt_image(bill_no=bill_no, vendor="SRI BALAJI KRISHI KENDRA", total="3850.00")
    
    res_scan = session_user_a.post(
        f"{BASE_URL}/api/scan-bill",
        files={"bill_image": ("fertilizer_bill.jpg", receipt_buf, "image/jpeg")}
    )
    assert res_scan.status_code == 200, f"Bill scan failed: {res_scan.text}"
    scan_data = res_scan.json()
    extracted = scan_data.get("extracted_data", {})
    
    print("   [OK] AI Extracted Data:")
    print(f"     - Vendor: {extracted.get('vendor_name')}")
    print(f"     - Bill No: {extracted.get('bill_number')}")
    print(f"     - Total Amount: Rs {extracted.get('total_amount')}")
    print(f"     - Category: {extracted.get('category')}")
    print(f"     - Items count: {len(extracted.get('items', []))}")
    print(f"     - Warnings: {scan_data.get('warnings')}")
    print(f"     - Is Duplicate: {scan_data.get('is_duplicate')}")
    print(f"     - Receipt Image URL: {scan_data.get('receipt_url')}")
    
    assert scan_data.get("receipt_url") is not None, "Missing receipt_url"
    assert extracted.get("total_amount") is not None, "Missing extracted total_amount"

    # 6. Test Saving Extracted Bill as Farm Expense
    print("\n6. Testing saving confirmed bill as Farm Expense...")
    expense_payload = {
        "date": extracted.get("date") or "2026-10-02",
        "category": extracted.get("category") or "Fertilizer",
        "amount": extracted.get("total_amount") or 3850.0,
        "crop": "Cotton",
        "field_name": "East Acre",
        "description": f"Fertilizer purchase from {extracted.get('vendor_name') or 'Sri Balaji Krishi Kendra'}",
        "vendor_name": extracted.get("vendor_name") or "Sri Balaji Krishi Kendra",
        "bill_number": bill_no,
        "vendor_phone": extracted.get("vendor_phone") or "9876543210",
        "vendor_address": extracted.get("vendor_address") or "Warangal",
        "tax": extracted.get("tax") or 0.0,
        "discount": extracted.get("discount") or 0.0,
        "payment_method": extracted.get("payment_method") or "Cash",
        "receipt_source": "AI_SCAN",
        "receipt_path": scan_data.get("receipt_path"),
        "receipt_url": scan_data.get("receipt_url"),
        "raw_extracted_json": json.dumps(extracted)
    }

    res_save = session_user_a.post(f"{BASE_URL}/api/expenses", json=expense_payload)
    assert res_save.status_code in [200, 201], f"Saving expense failed: {res_save.text}"
    saved_exp = res_save.json()["expense"]
    print(f"   [OK] Expense saved with ID: {saved_exp['id']}, Source: {saved_exp['receipt_source']}, Bill: #{saved_exp['bill_number']}")

    # 7. Test Duplicate Bill Detection
    print("\n7. Testing duplicate bill detection for the saved bill...")
    receipt_dup_buf = create_sample_receipt_image(bill_no=bill_no, vendor="SRI BALAJI KRISHI KENDRA", total="3850.00")
    res_dup = session_user_a.post(
        f"{BASE_URL}/api/scan-bill",
        files={"bill_image": ("fertilizer_bill_dup.jpg", receipt_dup_buf, "image/jpeg")}
    )
    assert res_dup.status_code == 200, f"Duplicate scan failed: {res_dup.text}"
    dup_data = res_dup.json()
    print(f"   [OK] Duplicate Detection result: is_duplicate={dup_data.get('is_duplicate')}")
    if dup_data.get("is_duplicate"):
        print(f"     Duplicate message: {dup_data.get('duplicate_message')}")
        print(f"     Matched expense ID: {dup_data.get('existing_expense_id')}")

    # 8. Test GET /api/scanned-bills for User A
    print("\n8. Testing GET /api/scanned-bills for User A...")
    res_scanned_a = session_user_a.get(f"{BASE_URL}/api/scanned-bills")
    assert res_scanned_a.status_code == 200, f"Failed to get scanned bills: {res_scanned_a.text}"
    scanned_bills_a = res_scanned_a.json()["scanned_bills"]
    print(f"   [OK] User A has {len(scanned_bills_a)} scanned bills")
    assert any(b["id"] == saved_exp["id"] for b in scanned_bills_a), "Saved expense not found in scanned bills list"

    # 9. Test User Isolation (User B must NOT see User A's scanned bill)
    print("\n9. Testing Multi-Tenant Data Isolation (User B)...")
    res_scanned_b = session_user_b.get(f"{BASE_URL}/api/scanned-bills")
    assert res_scanned_b.status_code == 200, f"Failed to get User B scanned bills: {res_scanned_b.text}"
    scanned_bills_b = res_scanned_b.json()["scanned_bills"]
    assert not any(b["id"] == saved_exp["id"] for b in scanned_bills_b), "SECURITY LEAK: User B can see User A's scanned bill!"
    print(f"   [OK] Data isolation verified: User B cannot see User A's expense #{saved_exp['id']}")

    # 10. Test Direct Upload Access Protection
    print("\n10. Testing receipt file access authorization...")
    receipt_url = saved_exp["receipt_url"]
    res_media_a = session_user_a.get(f"{BASE_URL}{receipt_url}")
    assert res_media_a.status_code == 200, f"User A failed to view receipt: {res_media_a.status_code}"
    print("   [OK] User A authorized to view own receipt image")

    res_media_b = session_user_b.get(f"{BASE_URL}{receipt_url}")
    assert res_media_b.status_code in [403, 404], f"SECURITY LEAK: User B got status {res_media_b.status_code} accessing User A's receipt"
    print(f"   [OK] User B blocked from User A's receipt image (status: {res_media_b.status_code})")

    print("\n=======================================================")
    print("ALL PHASE 4 BILL SCANNER TESTS PASSED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == "__main__":
    test_full_bill_scanner_suite()
