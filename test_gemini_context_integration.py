import time

from app import app, get_db, build_farmer_context


def test_build_farmer_context_uses_authenticated_farmer_data_only():
    client = app.test_client()
    ts = int(time.time())
    user_a_email = f"context_user_a_{ts}@test.com"
    user_b_email = f"context_user_b_{ts}@test.com"
    password = "StrongPassword123!"

    user_a = client.post(
        '/api/auth/register',
        json={
            'name': 'Farmer A',
            'email': user_a_email,
            'password': password,
            'location': 'Warangal',
            'language': 'en',
        },
    )
    assert user_a.status_code == 200, user_a.get_json()
    user_a_id = user_a.get_json()['user']['id']

    user_b = client.post(
        '/api/auth/register',
        json={
            'name': 'Farmer B',
            'email': user_b_email,
            'password': password,
            'location': 'Hyderabad',
            'language': 'en',
        },
    )
    assert user_b.status_code == 200, user_b.get_json()
    user_b_id = user_b.get_json()['user']['id']

    login_a = client.post('/api/auth/login', json={'email': user_a_email, 'password': password})
    assert login_a.status_code == 200, login_a.get_json()

    expense_res = client.post(
        '/api/expenses',
        json={
            'date': '2026-09-20',
            'category': 'Fertilizer',
            'amount': 2500.0,
            'crop': 'Cotton',
            'field_name': 'North Field',
            'description': 'Fertilizer purchase',
        },
    )
    assert expense_res.status_code == 201, expense_res.get_json()

    income_res = client.post(
        '/api/income',
        json={
            'date': '2026-09-25',
            'crop': 'Cotton',
            'quantity': 500.0,
            'unit': 'kg',
            'selling_price': 70.0,
            'buyer_name': 'Mills Ltd',
            'notes': 'Cotton sale',
        },
    )
    assert income_res.status_code == 201, income_res.get_json()

    client.post('/api/auth/logout')
    login_b = client.post('/api/auth/login', json={'email': user_b_email, 'password': password})
    assert login_b.status_code == 200, login_b.get_json()

    other_expense = client.post(
        '/api/expenses',
        json={
            'date': '2026-09-22',
            'category': 'Seeds',
            'amount': 4000.0,
            'crop': 'Maize',
            'field_name': 'Other Field',
            'description': 'Seed purchase',
        },
    )
    assert other_expense.status_code == 201, other_expense.get_json()

    client.post('/api/auth/logout')
    client.post('/api/auth/login', json={'email': user_a_email, 'password': password})

    user_a_record = {'id': user_a_id, 'name': 'Farmer A', 'location': 'Warangal'}
    context = build_farmer_context(
        user_a_record,
        question='How much did I spend on fertilizer?',
        history=[],
    )

    assert 'expenses' in context, context
    assert context['expenses']['total_amount'] == 2500.0
    assert context['expenses']['count'] == 1
    assert context['query_scope']['target_category'] == 'fertilizer'

    user_b_record = {'id': user_b_id, 'name': 'Farmer B', 'location': 'Hyderabad'}
    other_context = build_farmer_context(
        user_b_record,
        question='How much did I spend on fertilizer?',
        history=[],
    )

    assert other_context['expenses']['total_amount'] == 0.0, other_context
    assert other_context['expenses']['count'] == 0
