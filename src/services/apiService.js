// Farmer AI - Centralized REST API Service Layer

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function apiUrl(endpoint) {
  return `${API_BASE_URL}${endpoint}`;
}

async function request(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(apiUrl(endpoint), {
    ...options,
    headers,
    credentials: 'include'
  });

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

// Multi-step Forgot Password Flow
export async function requestPasswordReset(email) {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function verifyResetCode(token, email = '') {
  return request('/api/auth/verify-reset', {
    method: 'POST',
    body: JSON.stringify({ token, email })
  });
}

export async function resetPassword(new_password, confirm_password, reset_token = '', email = '') {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ new_password, confirm_password, reset_token, email })
  });
}

// Backward compatibility alias
export async function forgotPassword(email) {
  return requestPasswordReset(email);
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

export async function getWeather(latitude, longitude) {
  return request(`/api/weather?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`, { method: 'GET' });
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

export async function getPlantScans(plantId) {
  return request(`/api/plants/${plantId}/scans`, { method: 'GET' });
}

export async function getScan(scanId) {
  return request(`/api/scans/${scanId}`, { method: 'GET' });
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

export async function deleteScan(scanId) {
  return request(`/api/scans/${scanId}`, {
    method: 'DELETE'
  });
}

// 8. Farm Diary + Expenses APIs
export async function getFarmDiary(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  return request(`/api/farm-diary${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function createDiaryEntry(diaryData) {
  const isFormData = diaryData instanceof FormData;
  return request('/api/farm-diary', {
    method: 'POST',
    body: isFormData ? diaryData : JSON.stringify(diaryData)
  });
}

export async function updateDiaryEntry(entryId, diaryData) {
  const isFormData = diaryData instanceof FormData;
  return request(`/api/farm-diary/${entryId}`, {
    method: 'PUT',
    body: isFormData ? diaryData : JSON.stringify(diaryData)
  });
}

export async function deleteDiaryEntry(entryId) {
  return request(`/api/farm-diary/${entryId}`, {
    method: 'DELETE'
  });
}

export async function getExpenses(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  return request(`/api/expenses${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function createExpense(expenseData) {
  const isFormData = expenseData instanceof FormData;
  return request('/api/expenses', {
    method: 'POST',
    body: isFormData ? expenseData : JSON.stringify(expenseData)
  });
}

export async function updateExpense(expenseId, expenseData) {
  const isFormData = expenseData instanceof FormData;
  return request(`/api/expenses/${expenseId}`, {
    method: 'PUT',
    body: isFormData ? expenseData : JSON.stringify(expenseData)
  });
}

export async function deleteExpense(expenseId) {
  return request(`/api/expenses/${expenseId}`, {
    method: 'DELETE'
  });
}

export async function getIncome(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  return request(`/api/income${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function createIncome(incomeData) {
  return request('/api/income', {
    method: 'POST',
    body: JSON.stringify(incomeData)
  });
}

export async function updateIncome(incomeId, incomeData) {
  return request(`/api/income/${incomeId}`, {
    method: 'PUT',
    body: JSON.stringify(incomeData)
  });
}

export async function deleteIncome(incomeId) {
  return request(`/api/income/${incomeId}`, {
    method: 'DELETE'
  });
}

export async function getFarmSummary() {
  return request('/api/farm-summary', { method: 'GET' });
}

// 9. Tractor Work Tracker APIs (Phase 2)
export async function getTractorJobs(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  return request(`/api/tractor/jobs${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function createTractorJob(jobData) {
  return request('/api/tractor/jobs', {
    method: 'POST',
    body: JSON.stringify(jobData)
  });
}

export async function getTractorJob(identifier) {
  return request(`/api/tractor/jobs/${encodeURIComponent(identifier)}`, { method: 'GET' });
}

export async function joinTractorJob(identifier) {
  return request(`/api/tractor/jobs/${encodeURIComponent(identifier)}/join`, {
    method: 'POST'
  });
}

export async function startTractorJob(jobId) {
  return request(`/api/tractor/jobs/${jobId}/start`, {
    method: 'POST'
  });
}

export async function confirmStartTractorJob(jobId) {
  return request(`/api/tractor/jobs/${jobId}/confirm-start`, {
    method: 'POST'
  });
}

export async function pauseTractorJob(jobId, notes = '') {
  return request(`/api/tractor/jobs/${jobId}/pause`, {
    method: 'POST',
    body: JSON.stringify({ notes })
  });
}

export async function resumeTractorJob(jobId) {
  return request(`/api/tractor/jobs/${jobId}/resume`, {
    method: 'POST'
  });
}

export async function finishTractorJob(jobId) {
  return request(`/api/tractor/jobs/${jobId}/finish`, {
    method: 'POST'
  });
}

export async function confirmFinishTractorJob(jobId) {
  return request(`/api/tractor/jobs/${jobId}/confirm-finish`, {
    method: 'POST'
  });
}

export async function disputeTractorJob(jobId, reason, description = '') {
  return request(`/api/tractor/jobs/${jobId}/dispute`, {
    method: 'POST',
    body: JSON.stringify({ reason, description })
  });
}

export async function resolveDisputeTractorJob(jobId, resolution, next_status = 'RUNNING') {
  return request(`/api/tractor/jobs/${jobId}/resolve-dispute`, {
    method: 'POST',
    body: JSON.stringify({ resolution, next_status })
  });
}

export async function addTractorToExpenses(jobId) {
  return request(`/api/tractor/jobs/${jobId}/add-to-expenses`, {
    method: 'POST'
  });
}

export async function getTractorJobEvents(jobId) {
  return request(`/api/tractor/jobs/${jobId}/events`, { method: 'GET' });
}

export async function getTractorSummary() {
  return request('/api/tractor/summary', { method: 'GET' });
}


