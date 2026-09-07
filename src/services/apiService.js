// Farmer AI - Centralized REST API Service Layer

const API_BASE = ''; // Uses Vite proxy ('/api') or relative path

async function request(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: defaultHeaders,
      credentials: 'same-origin'
    });
  } catch (err) {
    // Fallback if accessed on another port
    response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
      ...options,
      headers: defaultHeaders,
      credentials: 'include'
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

// 1. Authentication Endpoints
export async function loginFarmer(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function registerFarmer(userData) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function forgotPassword(email, new_password, confirm_password) {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email, new_password, confirm_password })
  });
}

export async function getCurrentUser() {
  try {
    return await request('/api/auth/me', { method: 'GET' });
  } catch {
    return { authenticated: false, user: null };
  }
}

export async function logoutFarmer() {
  return request('/api/auth/logout', { method: 'POST' });
}

// 2. Dashboard Summary API
export async function getDashboardSummary() {
  return request('/api/dashboard/summary', { method: 'GET' });
}

// 3. Smart Crop Recommendation API (crop_model.pkl)
export async function recommendCrop(cropParams) {
  return request('/api/recommend-crop', {
    method: 'POST',
    body: JSON.stringify(cropParams)
  });
}

// 4. Irrigation Advisor API
export async function getIrrigationAdvice(irrigationParams) {
  return request('/api/irrigation-advice', {
    method: 'POST',
    body: JSON.stringify(irrigationParams)
  });
}

// 5. Decision Score API
export async function calculateDecisionScore(scoreParams) {
  return request('/api/decision-score', {
    method: 'POST',
    body: JSON.stringify(scoreParams)
  });
}

// 6. Multilingual Chatbot API
export async function sendChatToBackend(message, language = 'en') {
  return request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, language })
  });
}

// 7. My Plants Registry & Monitoring APIs
export async function getPlants() {
  return request('/api/plants', { method: 'GET' });
}

export async function getPlantDetails(plantId) {
  return request(`/api/plants/${plantId}`, { method: 'GET' });
}

export async function createPlant(plantData) {
  return request('/api/plants', {
    method: 'POST',
    body: JSON.stringify(plantData)
  });
}

export async function deletePlant(plantId) {
  return request(`/api/plants/${plantId}`, {
    method: 'DELETE'
  });
}

