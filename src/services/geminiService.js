// Farmer AI - Gemini & Crop Health Service Layer
// All chat requests and ML disease analyses are securely routed through the Flask backend.
// The Gemini API key remains server-side only.

import { API_BASE_URL } from './apiService';

/**
 * Sends farmer questions to the backend Gemini assistant.
 * Sends the user's exact query, conversation history, and optional plant/weather context.
 */
export async function askFarmerAI(prompt, history = [], language = 'en', plantId = null, weatherLocation = null) {
  const cleanPrompt = (prompt || '').trim();
  if (!cleanPrompt) {
    throw new Error('Please type a question first.');
  }

  // Pass recent structured history without concatenating into prompt
  const cleanHistory = Array.isArray(history)
    ? history
        .slice(-8)
        .map((m) => ({
          role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
          text: (m.text || '').trim(),
        }))
        .filter((m) => m.text.length > 0)
    : [];

  try {
    const res = await fetch(`${API_BASE_URL}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message: cleanPrompt,
        history: cleanHistory,
        language: language || 'en',
        plant_id: plantId || null,
        latitude: weatherLocation?.latitude,
        longitude: weatherLocation?.longitude,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Farmer AI is temporarily unavailable. Please try again.');
    }
    if (!data.success || !data.reply) {
      throw new Error(data.error || 'Farmer AI returned an empty response. Please try again.');
    }

    return data.reply;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Unable to reach the Farmer AI service. Please verify your connection.');
  }
}

// Real Plant Disease Detection Service (Connects strictly to ML Model API)
export async function detectDiseaseFromAPI(imageFile, plantId = '') {
  if (!(imageFile instanceof File || imageFile instanceof Blob)) {
    throw new Error('Please select or upload an actual leaf image file. Demo presets have been removed.');
  }

  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif']);
  if (!allowedTypes.has(imageFile.type)) {
    throw new Error('Please upload a JPEG, PNG, WEBP, BMP, or GIF image.');
  }
  if (imageFile.size > 10 * 1024 * 1024) {
    throw new Error('Image must be 10 MB or smaller.');
  }

  const formData = new FormData();
  formData.append('leaf_image', imageFile);
  if (plantId) formData.append('plant_id', plantId);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/detect-disease`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
  } catch (_err) {
    throw new Error('Unable to reach the disease analysis service. Please check your connection and try again.');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server returned error status ${response.status}`);
  }

  return await response.json();
}

// Backward compatibility alias
export const analyzeCropImage = detectDiseaseFromAPI;
