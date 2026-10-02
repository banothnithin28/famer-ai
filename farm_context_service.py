"""
farm_context_service.py
======================
Intelligent Farm Records Context Builder for Gemini Farmer Assistant (Phase 5).

Key Responsibilities:
1. Identify the authenticated farmer and enforce strict multi-tenant isolation.
2. Analyze farmer questions and multi-turn conversational history for intents, crops, categories, and natural dates.
3. Query only relevant records for the specific intent (never dumping the entire database blindly).
4. Perform all mathematical aggregations server-side (sums, balances, durations, quantities).
5. Build structured, grounded context for Gemini without exposing passwords, tokens, API keys, or other users' data.
"""

import os
import re
import json
import sqlite3
import datetime
from datetime import timedelta

# Common crops tracked in Indian agriculture
KNOWN_CROPS = [
    'cotton', 'paddy', 'rice', 'tomato', 'chilli', 'chili', 'mirchi', 'maize', 'corn',
    'wheat', 'sugarcane', 'soybean', 'groundnut', 'peanut', 'onion', 'potato', 'turmeric',
    'ginger', 'gram', 'bengal gram', 'red gram', 'black gram', 'green gram', 'pulses',
    'mustard', 'sunflower', 'vegetable', 'mango', 'banana', 'papaya', 'guava'
]

# Common expense and work categories
KNOWN_CATEGORIES = {
    'fertilizer': ['fertilizer', 'fertiliser', 'urea', 'dap', 'mop', 'potash', 'npk', 'compost', 'manure', 'zinc'],
    'seeds': ['seed', 'seeds', 'seedling', 'sapling', 'nursery'],
    'pesticides': ['pesticide', 'pesticides', 'insecticide', 'fungicide', 'herbicide', 'weedicide', 'spray', 'neem oil'],
    'tractor': ['tractor', 'ploughing', 'plowing', 'tilling', 'rotavator', 'harrow', 'cultivator', 'tractor driver'],
    'labour': ['labour', 'labor', 'worker', 'workers', 'coolie', 'wages', 'wage', 'attendance', 'salary', 'daily wage'],
    'diesel': ['diesel', 'fuel', 'petrol'],
    'irrigation': ['irrigation', 'water', 'drip', 'sprinkler', 'borewell', 'motor', 'pump'],
    'machinery': ['machinery', 'equipment', 'harvester', 'thresher', 'sprayer', 'tools', 'repairs', 'maintenance']
}

MONTH_NAMES = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
}


def parse_date_range(query_text, reference_date=None):
    """
    Parses natural language date expressions into (start_date_str, end_date_str, label).
    Handles: today, yesterday, this week, last week, this month, last month, past 7 days, past 30 days, specific months.
    """
    if not reference_date:
        reference_date = datetime.date.today()

    text = (query_text or '').lower()

    # 1. Today
    if re.search(r'\btoday\b', text):
        d_str = reference_date.strftime('%Y-%m-%d')
        return d_str, d_str, 'today'

    # 2. Yesterday
    if re.search(r'\byesterday\b', text):
        y_date = reference_date - timedelta(days=1)
        y_str = y_date.strftime('%Y-%m-%d')
        return y_str, y_str, 'yesterday'

    # 3. This week / Past 7 days
    if re.search(r'\b(this week|past 7 days|last 7 days)\b', text):
        start_date = reference_date - timedelta(days=reference_date.weekday())
        return start_date.strftime('%Y-%m-%d'), reference_date.strftime('%Y-%m-%d'), 'this week'

    # 4. Last week
    if re.search(r'\blast week\b', text):
        end_date = reference_date - timedelta(days=reference_date.weekday() + 1)
        start_date = end_date - timedelta(days=6)
        return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'), 'last week'

    # 5. This month
    if re.search(r'\bthis month\b', text):
        start_date = reference_date.replace(day=1)
        # End of month
        next_month = start_date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
        return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'), reference_date.strftime('%B %Y')

    # 6. Last month
    if re.search(r'\blast month\b', text):
        first_of_this_month = reference_date.replace(day=1)
        last_day_of_last_month = first_of_this_month - timedelta(days=1)
        first_day_of_last_month = last_day_of_last_month.replace(day=1)
        return (first_day_of_last_month.strftime('%Y-%m-%d'),
                last_day_of_last_month.strftime('%Y-%m-%d'),
                first_day_of_last_month.strftime('%B %Y'))

    # 7. Past 30 days
    if re.search(r'\b(past 30 days|last 30 days)\b', text):
        start_date = reference_date - timedelta(days=30)
        return start_date.strftime('%Y-%m-%d'), reference_date.strftime('%Y-%m-%d'), 'past 30 days'

    # 8. This year / Last year
    if re.search(r'\bthis year\b', text):
        return f"{reference_date.year}-01-01", f"{reference_date.year}-12-31", str(reference_date.year)
    if re.search(r'\blast year\b', text):
        ly = reference_date.year - 1
        return f"{ly}-01-01", f"{ly}-12-31", str(ly)

    # 9. Explicit Month Name (e.g. "in September", "September 2026")
    for m_name, m_num in MONTH_NAMES.items():
        pattern = rf'\b{m_name}\b(?:\s+(\d{{4}}))?'
        m = re.search(pattern, text)
        if m:
            yr = int(m.group(1)) if m.group(1) else reference_date.year
            start_date = datetime.date(yr, m_num, 1)
            # Find last day
            next_m = start_date.replace(day=28) + timedelta(days=4)
            end_date = next_m - timedelta(days=next_m.day)
            return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'), start_date.strftime('%B %Y')

    return None, None, 'all time'


def extract_query_entities(question, history=None):
    """
    Extracts intents, crop names, categories, date ranges, and resolves follow-ups from conversation history.
    """
    q_lower = (question or '').lower()
    
    # 1. Follow-up pronoun resolution (e.g., "What did I spend on it?" or "What about tractor work?")
    combined_context_text = q_lower
    if history and isinstance(history, list):
        recent_turns = [str(h.get('text') or h.get('content') or '').lower() for h in history[-4:] if isinstance(h, dict)]
        combined_context_text = " ".join(recent_turns) + " " + q_lower

    # 2. Extract Crop
    detected_crop = None
    for crop in KNOWN_CROPS:
        if re.search(rf'\b{re.escape(crop)}\b', q_lower):
            detected_crop = crop
            break
    if not detected_crop and re.search(r'\b(it|this crop|that crop)\b', q_lower):
        # Look back in history
        for crop in KNOWN_CROPS:
            if re.search(rf'\b{re.escape(crop)}\b', combined_context_text):
                detected_crop = crop
                break

    # 3. Extract Category
    detected_cat = None
    for cat_key, keywords in KNOWN_CATEGORIES.items():
        for kw in keywords:
            if re.search(rf'\b{re.escape(kw)}\b', q_lower):
                detected_cat = cat_key
                break
        if detected_cat:
            break

    # 4. Extract Date Range
    start_date, end_date, date_label = parse_date_range(q_lower)

    # 5. Determine Primary Intents
    intents = set()

    # Expenses / Spending
    if any(w in q_lower for w in ('spend', 'spent', 'expense', 'expenses', 'cost', 'costs', 'buy', 'bought', 'purchase', 'purchased', 'paid', 'pay', 'charge', 'money spent')):
        intents.add('expense')

    # Income / Earnings / Sales
    if any(w in q_lower for w in ('earn', 'earned', 'income', 'revenue', 'sale', 'sales', 'sold', 'receive', 'received', 'selling price')):
        intents.add('income')

    # Profit / Balance
    if any(w in q_lower for w in ('profit', 'balance', 'margin', 'net', 'net balance', 'loss', 'gain', 'how much left')):
        intents.add('profit')
        intents.add('expense')
        intents.add('income')

    # Tractor Work
    if any(w in q_lower for w in ('tractor', 'ploughing', 'plowing', 'tilling', 'rotavator', 'tractor driver', 'tractor job', 'tractor work')):
        intents.add('tractor')

    # Labour Work
    if any(w in q_lower for w in ('labour', 'labor', 'worker', 'workers', 'wage', 'wages', 'attendance', 'salary', 'daily wage', 'pending wages', 'owe')):
        intents.add('labour')

    # Bills / Receipts
    if any(w in q_lower for w in ('bill', 'bills', 'receipt', 'receipts', 'invoice', 'invoices', 'scanned', 'scan bill', 'shop', 'vendor')):
        intents.add('receipt')

    # Farm Diary / Daily Activities
    if any(w in q_lower for w in ('diary', 'activity', 'activities', 'done', 'do', 'did i', 'spray', 'sprayed', 'fertilized', 'irrigate', 'weed', 'harvest', 'planted', 'sowed')):
        intents.add('diary')

    # Plants / Plant Health / Disease Scans
    if any(w in q_lower for w in ('plant', 'plants', 'crop health', 'disease', 'diseases', 'health', 'leaf', 'leaves', 'scan', 'scans', 'better', 'getting better', 'compare')):
        intents.add('plant_health')

    # Weather / Irrigation
    if any(w in q_lower for w in ('weather', 'rain', 'temperature', 'irrigation', 'irrigate today', 'water today', 'moisture')):
        intents.add('weather')

    # If no specific intent matched but mentions general words
    if not intents:
        intents.add('general_farming')

    return {
        'intents': list(intents),
        'crop': detected_crop,
        'category': detected_cat,
        'start_date': start_date,
        'end_date': end_date,
        'date_label': date_label,
        'has_follow_up': bool(re.search(r'\b(what about|and for|how about|what did i spend on it|what did i earn from it)\b', q_lower))
    }


def query_farm_expenses(conn, user_id, crop=None, category=None, start_date=None, end_date=None, limit=15):
    """
    Performs server-side aggregation and record retrieval for farm expenses.
    """
    params = [user_id]
    where_clauses = ["user_id = ?"]

    if crop:
        where_clauses.append("LOWER(crop) LIKE ?")
        params.append(f"%{crop.lower()}%")

    if category:
        # Match category or keywords
        cat_terms = KNOWN_CATEGORIES.get(category, [category])
        or_conds = ["LOWER(category) LIKE ?"] * len(cat_terms)
        where_clauses.append(f"({' OR '.join(or_conds)})")
        for ct in cat_terms:
            params.append(f"%{ct.lower()}%")

    if start_date:
        where_clauses.append("date >= ?")
        params.append(start_date)
    if end_date:
        where_clauses.append("date <= ?")
        params.append(end_date)

    where_sql = " AND ".join(where_clauses)

    # 1. Total & Count
    sum_row = conn.execute(f"""
        SELECT COALESCE(SUM(amount), 0) as total_amount, COUNT(*) as count
        FROM farm_expenses
        WHERE {where_sql}
    """, params).fetchone()

    total_amount = float(sum_row['total_amount']) if sum_row else 0.0
    count = int(sum_row['count']) if sum_row else 0

    # 2. Category Breakdown
    cat_rows = conn.execute(f"""
        SELECT category, COALESCE(SUM(amount), 0) as cat_total, COUNT(*) as cat_count
        FROM farm_expenses
        WHERE {where_sql}
        GROUP BY category
        ORDER BY cat_total DESC
    """, params).fetchall()

    category_breakdown = [
        {'category': r['category'], 'total': round(float(r['cat_total']), 2), 'count': r['cat_count']}
        for r in cat_rows
    ]

    # 3. Crop Breakdown
    crop_rows = conn.execute(f"""
        SELECT COALESCE(crop, 'General') as crop_name, COALESCE(SUM(amount), 0) as crop_total, COUNT(*) as crop_count
        FROM farm_expenses
        WHERE {where_sql}
        GROUP BY crop
        ORDER BY crop_total DESC
    """, params).fetchall()

    crop_breakdown = [
        {'crop': r['crop_name'], 'total': round(float(r['crop_total']), 2), 'count': r['crop_count']}
        for r in crop_rows
    ]

    # 4. Recent Matching Records
    records = conn.execute(f"""
        SELECT id, date, category, amount, crop, field_name, vendor_name, bill_number, description, receipt_source
        FROM farm_expenses
        WHERE {where_sql}
        ORDER BY date DESC, id DESC
        LIMIT ?
    """, params + [limit]).fetchall()

    items = [
        {
            'date': r['date'],
            'category': r['category'],
            'amount': round(float(r['amount']), 2),
            'crop': r['crop'] or 'General',
            'field': r['field_name'] or '',
            'vendor': r['vendor_name'] or '',
            'bill_number': r['bill_number'] or '',
            'description': r['description'] or '',
            'source': r['receipt_source'] or 'MANUAL'
        }
        for r in records
    ]

    return {
        'total_amount': round(total_amount, 2),
        'count': count,
        'category_breakdown': category_breakdown,
        'crop_breakdown': crop_breakdown,
        'recent_expenses': items
    }


def query_farm_income(conn, user_id, crop=None, start_date=None, end_date=None, limit=15):
    """
    Performs server-side aggregation and retrieval for farm income / crop sales.
    """
    params = [user_id]
    where_clauses = ["user_id = ?"]

    if crop:
        where_clauses.append("LOWER(crop) LIKE ?")
        params.append(f"%{crop.lower()}%")
    if start_date:
        where_clauses.append("date >= ?")
        params.append(start_date)
    if end_date:
        where_clauses.append("date <= ?")
        params.append(end_date)

    where_sql = " AND ".join(where_clauses)

    sum_row = conn.execute(f"""
        SELECT COALESCE(SUM(total_amount), 0) as total_income, 
               COALESCE(SUM(quantity), 0) as total_quantity,
               COUNT(*) as count
        FROM farm_income
        WHERE {where_sql}
    """, params).fetchone()

    total_income = float(sum_row['total_income']) if sum_row else 0.0
    total_qty = float(sum_row['total_quantity']) if sum_row else 0.0
    count = int(sum_row['count']) if sum_row else 0

    # Crop Breakdown
    crop_rows = conn.execute(f"""
        SELECT crop, COALESCE(SUM(total_amount), 0) as crop_total, 
               COALESCE(SUM(quantity), 0) as crop_qty, unit, COUNT(*) as count
        FROM farm_income
        WHERE {where_sql}
        GROUP BY crop, unit
        ORDER BY crop_total DESC
    """, params).fetchall()

    crop_breakdown = [
        {
            'crop': r['crop'],
            'total_income': round(float(r['crop_total']), 2),
            'total_quantity': round(float(r['crop_qty']), 2),
            'unit': r['unit'],
            'count': r['count']
        }
        for r in crop_rows
    ]

    records = conn.execute(f"""
        SELECT id, date, crop, quantity, unit, selling_price, total_amount, buyer_name, notes
        FROM farm_income
        WHERE {where_sql}
        ORDER BY date DESC, id DESC
        LIMIT ?
    """, params + [limit]).fetchall()

    items = [
        {
            'date': r['date'],
            'crop': r['crop'],
            'quantity': float(r['quantity']),
            'unit': r['unit'],
            'selling_price': float(r['selling_price']),
            'total_amount': round(float(r['total_amount']), 2),
            'buyer': r['buyer_name'] or '',
            'notes': r['notes'] or ''
        }
        for r in records
    ]

    return {
        'total_income': round(total_income, 2),
        'total_quantity': round(total_qty, 2),
        'count': count,
        'crop_breakdown': crop_breakdown,
        'recent_sales': items
    }


def query_tractor_work(conn, user_id, crop=None, limit=10):
    """
    Aggregates completed tractor jobs and active operations for the farmer.
    """
    params = [user_id]
    where_clauses = ["farmer_id = ?"]

    if crop:
        where_clauses.append("LOWER(crop) LIKE ?")
        params.append(f"%{crop.lower()}%")

    where_sql = " AND ".join(where_clauses)

    sum_row = conn.execute(f"""
        SELECT 
            COUNT(*) as total_jobs,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_jobs,
            COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_payment ELSE 0 END), 0) as total_cost,
            COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_duration_seconds ELSE 0 END), 0) as total_seconds
        FROM tractor_jobs
        WHERE {where_sql}
    """, params).fetchone()

    total_jobs = sum_row['total_jobs'] if sum_row else 0
    completed_jobs = sum_row['completed_jobs'] if sum_row else 0
    total_cost = float(sum_row['total_cost']) if sum_row else 0.0
    total_seconds = int(sum_row['total_seconds']) if sum_row else 0

    total_hours = round(total_seconds / 3600.0, 1)

    records = conn.execute(f"""
        SELECT job_id, work_date, crop, field_name, work_type, driver_name, rate_type, rate, 
               total_duration_seconds, total_payment, status
        FROM tractor_jobs
        WHERE {where_sql}
        ORDER BY id DESC
        LIMIT ?
    """, params + [limit]).fetchall()

    jobs = [
        {
            'job_id': r['job_id'],
            'date': r['work_date'] or '',
            'crop': r['crop'] or '',
            'field': r['field_name'] or '',
            'work_type': r['work_type'],
            'driver': r['driver_name'] or '',
            'rate_type': r['rate_type'],
            'rate': float(r['rate']),
            'duration_hours': round((r['total_duration_seconds'] or 0) / 3600.0, 1),
            'payment': round(float(r['total_payment'] or 0.0), 2),
            'status': r['status']
        }
        for r in records
    ]

    return {
        'total_jobs': total_jobs,
        'completed_jobs': completed_jobs,
        'total_cost': round(total_cost, 2),
        'total_hours': total_hours,
        'recent_jobs': jobs
    }


def query_farm_diary_activities(conn, user_id, crop=None, limit=10):
    """
    Retrieves farm diary activity logs and latest dates per activity type.
    """
    params = [user_id]
    where_clauses = ["user_id = ?"]

    if crop:
        where_clauses.append("LOWER(crop) LIKE ?")
        params.append(f"%{crop.lower()}%")

    where_sql = " AND ".join(where_clauses)

    records = conn.execute(f"""
        SELECT date, crop, field_name, activity_type, description, notes
        FROM farm_diary_entries
        WHERE {where_sql}
        ORDER BY date DESC, id DESC
        LIMIT ?
    """, params + [limit]).fetchall()

    activities = [
        {
            'date': r['date'],
            'crop': r['crop'] or '',
            'field': r['field_name'] or '',
            'activity_type': r['activity_type'],
            'description': r['description'] or '',
            'notes': r['notes'] or ''
        }
        for r in records
    ]

    # Latest dates for specific activities (e.g. fertilizing, spraying, irrigation)
    latest_by_type = {}
    type_rows = conn.execute(f"""
        SELECT activity_type, MAX(date) as latest_date
        FROM farm_diary_entries
        WHERE {where_sql}
        GROUP BY activity_type
    """, params).fetchall()

    for tr in type_rows:
        latest_by_type[tr['activity_type']] = tr['latest_date']

    return {
        'total_entries_count': len(activities),
        'recent_activities': activities,
        'latest_by_activity_type': latest_by_type
    }


def query_plant_health(conn, user_id, crop=None, plant_id=None, limit=6):
    """
    Retrieves registered plant records and disease detection scan histories.
    """
    params = [user_id]
    where_clauses = ["user_id = ?"]

    if plant_id:
        where_clauses.append("id = ?")
        params.append(plant_id)
    elif crop:
        where_clauses.append("LOWER(crop_name) LIKE ?")
        params.append(f"%{crop.lower()}%")

    plants = conn.execute(f"""
        SELECT id, crop_name, field_name, location, notes, created_at
        FROM plants
        WHERE {" AND ".join(where_clauses)}
        ORDER BY id DESC LIMIT 5
    """, params).fetchall()

    plant_list = []
    for p in plants:
        p_dict = dict(p)
        # Get recent scans for this plant
        scans = conn.execute("""
            SELECT id, disease_name, confidence, severity, symptoms, created_at
            FROM disease_scans
            WHERE plant_id = ? AND user_id = ?
            ORDER BY id DESC LIMIT 4
        """, (p['id'], user_id)).fetchall()

        p_dict['scans_count'] = len(scans)
        p_dict['scans'] = [dict(s) for s in scans]
        if scans:
            p_dict['latest_scan'] = dict(scans[0])
            if len(scans) > 1:
                p_dict['previous_scan'] = dict(scans[1])
        plant_list.append(p_dict)

    # General recent scans for user
    recent_scans = conn.execute("""
        SELECT s.id, s.disease_name, s.confidence, s.severity, s.symptoms, s.created_at, p.crop_name, p.field_name
        FROM disease_scans s
        LEFT JOIN plants p ON s.plant_id = p.id
        WHERE s.user_id = ?
        ORDER BY s.id DESC LIMIT ?
    """, (user_id, limit)).fetchall()

    return {
        'registered_plants': plant_list,
        'recent_scans': [dict(s) for s in recent_scans]
    }


def query_scanned_bills(conn, user_id, limit=8):
    """
    Retrieves expenses generated from or linked to scanned bills / receipts.
    """
    rows = conn.execute("""
        SELECT id, date, category, amount, crop, field_name, vendor_name, vendor_phone, 
               vendor_address, bill_number, tax, discount, payment_method, receipt_source, raw_extracted_json
        FROM farm_expenses
        WHERE user_id = ? AND (
            UPPER(receipt_source) IN ('AI_SCAN', 'SCANNED', 'SCANNED_RECEIPT')
            OR bill_number IS NOT NULL
            OR raw_extracted_json IS NOT NULL
        )
        ORDER BY date DESC, id DESC
        LIMIT ?
    """, (user_id, limit)).fetchall()

    bills = []
    total_scanned = 0.0
    for r in rows:
        amount = float(r['amount'] or 0.0)
        total_scanned += amount
        b_dict = {
            'date': r['date'],
            'category': r['category'],
            'amount': round(amount, 2),
            'vendor': r['vendor_name'] or '',
            'bill_number': r['bill_number'] or '',
            'tax': float(r['tax'] or 0.0),
            'discount': float(r['discount'] or 0.0),
            'payment_method': r['payment_method'] or '',
            'crop': r['crop'] or ''
        }
        if r['raw_extracted_json']:
            try:
                extracted = json.loads(r['raw_extracted_json'])
                if extracted.get('items'):
                    b_dict['items'] = [it.get('name') for it in extracted['items'][:4] if it.get('name')]
            except Exception:
                pass
        bills.append(b_dict)

    return {
        'scanned_bills_count': len(bills),
        'total_scanned_amount': round(total_scanned, 2),
        'recent_bills': bills
    }


def build_farmer_context(user, plant_id=None, latitude=None, longitude=None, question=None, history=None, get_db_fn=None, fetch_weather_fn=None):
    """
    Main Context Builder for Gemini Farmer Assistant (Phase 5).
    Identifies the authenticated user, extracts question intents, queries scoped database records,
    and returns a structured, calculated context object.
    """
    if not user:
        return {}

    user_id = user['id']
    entities = extract_query_entities(question, history)
    intents = set(entities['intents'])
    crop = entities['crop']
    category = entities['category']
    start_date = entities['start_date']
    end_date = entities['end_date']
    date_label = entities['date_label']

    context = {
        'farmer': {
            'name': user.get('name', 'Farmer'),
            'location': user.get('location', 'Telangana')
        },
        'query_scope': {
            'target_crop': crop,
            'target_category': category,
            'date_filter_label': date_label,
            'start_date': start_date,
            'end_date': end_date
        }
    }

    # Open DB connection
    conn = get_db_fn() if get_db_fn else sqlite3.connect('database/farmer.db')
    conn.row_factory = sqlite3.Row

    try:
        # Profile Info
        profile = conn.execute(
            "SELECT farm_size_acres, soil_type, primary_crop FROM farmer_profiles WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        if profile:
            if profile['farm_size_acres']:
                context['farmer']['farm_size_acres'] = profile['farm_size_acres']
            if profile['soil_type']:
                context['farmer']['soil_type'] = profile['soil_type']
            if profile['primary_crop']:
                context['farmer']['primary_crop'] = profile['primary_crop']

        # Registered Crops
        user_plants = conn.execute(
            "SELECT id, crop_name, field_name, location FROM plants WHERE user_id = ? LIMIT 6",
            (user_id,)
        ).fetchall()
        if user_plants:
            context['registered_crops'] = [p['crop_name'] for p in user_plants]

        # 1. Expense Data (Included for 'expense', 'profit', or general overview)
        if 'expense' in intents or 'profit' in intents or 'general_farming' in intents:
            context['expenses'] = query_farm_expenses(
                conn, user_id, crop=crop, category=category, start_date=start_date, end_date=end_date
            )

        # 2. Income Data (Included for 'income', 'profit', or general overview)
        if 'income' in intents or 'profit' in intents or 'general_farming' in intents:
            context['income'] = query_farm_income(
                conn, user_id, crop=crop, start_date=start_date, end_date=end_date
            )

        # 3. Profit / Net Balance Calculation (Server-Side)
        if 'profit' in intents or ('expense' in intents and 'income' in intents) or crop:
            exp_total = context.get('expenses', {}).get('total_amount', 0.0)
            inc_total = context.get('income', {}).get('total_income', 0.0)
            net_balance = round(inc_total - exp_total, 2)
            context['financial_balance'] = {
                'total_recorded_income': inc_total,
                'total_recorded_expenses': exp_total,
                'net_recorded_balance': net_balance,
                'is_profitable': net_balance >= 0,
                'crop_filter': crop or 'All farm records',
                'period_label': date_label,
                'note': 'Calculated strictly from farmer recorded expenses and crop sales.'
            }

        # 4. Tractor Work Tracker Data
        if 'tractor' in intents or category == 'tractor':
            context['tractor_work'] = query_tractor_work(conn, user_id, crop=crop)

        # 5. Labour Work Tracker Data
        if 'labour' in intents or category == 'labour':
            try:
                labour_fin = conn.execute("""
                    SELECT COALESCE(SUM(total_earned), 0) as total_labour_cost,
                           COALESCE(SUM(total_paid), 0) as total_paid,
                           COALESCE(SUM(total_advance), 0) as total_advances,
                           COALESCE(SUM(pending_amount), 0) as total_pending_wages,
                           COUNT(*) as jobs_count
                    FROM labour_jobs WHERE farmer_id = ?
                """, (user_id,)).fetchone()

                workers = conn.execute("""
                    SELECT worker_name, 
                           COUNT(DISTINCT labour_job_id) as total_jobs,
                           COALESCE(SUM(day_fraction), 0) as total_days_worked,
                           COALESCE(SUM(wage_amount), 0) as total_earned
                    FROM labour_attendance a
                    JOIN labour_jobs j ON a.labour_job_id = j.id
                    WHERE j.farmer_id = ?
                    GROUP BY worker_name LIMIT 5
                """, (user_id,)).fetchall()

                context['labour_work'] = {
                    'total_labour_cost': round(float(labour_fin['total_labour_cost']), 2) if labour_fin else 0.0,
                    'total_paid': round(float(labour_fin['total_paid']), 2) if labour_fin else 0.0,
                    'total_pending_wages': round(float(labour_fin['total_pending_wages']), 2) if labour_fin else 0.0,
                    'total_advances': round(float(labour_fin['total_advances']), 2) if labour_fin else 0.0,
                    'active_workers': [dict(w) for w in workers]
                }
            except Exception:
                pass

        # 6. Scanned Bills & Receipts Data
        if 'receipt' in intents or 'expense' in intents:
            context['scanned_bills'] = query_scanned_bills(conn, user_id)

        # 7. Farm Diary & Activities Data
        if 'diary' in intents or 'general_farming' in intents:
            context['farm_diary'] = query_farm_diary_activities(conn, user_id, crop=crop)

        # 8. Plant Health & Disease Scans Data
        if 'plant_health' in intents or plant_id:
            context['plant_health'] = query_plant_health(conn, user_id, crop=crop, plant_id=plant_id)

    finally:
        if not get_db_fn:
            conn.close()

    # 9. Live Weather & Smart Irrigation
    if latitude is not None and longitude is not None and ('weather' in intents or 'general_farming' in intents):
        if fetch_weather_fn:
            try:
                weather = fetch_weather_fn(float(latitude), float(longitude))
                if weather and weather.get('current'):
                    curr = weather['current']
                    context['live_weather'] = {
                        'temperature': f"{curr.get('temperature')}°C",
                        'humidity': f"{curr.get('humidity')}%",
                        'condition': curr.get('condition'),
                        'rain': f"{curr.get('rain', 0)} mm"
                    }
            except Exception:
                pass

    return context
