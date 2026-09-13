// Farmer AI - Smart Service Layer
// Chat and disease analysis are routed through the Flask API.

import { API_BASE_URL } from './apiService';

// Knowledge Base for instant local AI responses when server is unreachable
// Each entry has `match` function for flexible intent detection
const FARMING_KNOWLEDGE_BASE = [
  {
    match: (q) => /\b(hi|hello|hey|namaste|greetings)\b/.test(q) && q.split(/\s+/).length <= 3,
    answer: "🌾 **Namaste!** How can I assist you with your crops today? Ask me about crop diseases, fertilizers, pesticides, irrigation, or Mandi market trends."
  },
  {
    // Crop suggestion: needs "suggest/recommend/which/what/best" + "crop/crops/grow/plant/sow"
    match: (q) => /\b(suggest|recommend|which|what|best|suitable|good)\b/.test(q) && /\b(crop|crops|grow|plant|sow|cultivate|farming)\b/.test(q),
    answer: (q) => {
      const season = /\b(winter|rabi)\b/.test(q) ? "winter (Rabi)" : /\b(summer|kharif|monsoon|rainy)\b/.test(q) ? "summer (Kharif)" : null;
      const soil   = /\b(black|cotton soil|vertisol)\b/.test(q) ? "Black (Vertisol)" : /\b(red|laterite)\b/.test(q) ? "Red/Laterite" : /\b(sandy|loamy)\b/.test(q) ? "Sandy Loam" : null;

      let crops;
      if (season === "winter (Rabi)" && soil === "Black (Vertisol)") {
        crops = [
          "**Wheat** – Excellent for black cotton soil in Rabi season (Oct–Nov sowing).",
          "**Chickpea (Chana)** – Drought-tolerant legume, fixes nitrogen, high demand.",
          "**Sorghum (Rabi Jowar)** – Thrives in black soil, low water requirement.",
          "**Safflower** – Oil seed crop, ideal for dry Rabi in Telangana/Maharashtra.",
          "**Linseed (Flaxseed)** – Good for deep black soils, decent market value."
        ];
      } else if (soil === "Black (Vertisol)") {
        crops = [
          "**Cotton** – Classic black soil cash crop, high returns with proper pest management.",
          "**Soybean** – Good nitrogen fixation, excellent for black soil in Kharif.",
          "**Pigeonpea (Tur Dal)** – Deep roots suit heavy black soils, drought-tolerant.",
          "**Maize** – Fast-growing, good market demand, 3–4 month cycle.",
          "**Wheat** (Rabi) – High yield on black soil with irrigation."
        ];
      } else if (season === "winter (Rabi)") {
        crops = [
          "**Wheat** – Most common Rabi cereal crop, Oct–Nov sowing.",
          "**Chickpea** – Low water requirement, nitrogen-fixing legume.",
          "**Mustard** – Quick-growing oil seed crop with strong market.",
          "**Barley** – Tolerates cold, good for feed and malt industry.",
          "**Sunflower** – High-value oil seed for Rabi in warmer regions."
        ];
      } else {
        crops = [
          "**Maize** – Highly profitable, 3–4 month crop, good market demand.",
          "**Soybean** – Excellent nitrogen fixation, good for soil health.",
          "**Cotton** – Cash crop with high returns (requires pest management).",
          "**Turmeric** – High-value spice crop, 8–9 month duration.",
          "**Red Chilli** – Strong export demand, good income potential."
        ];
      }

      const header = `🌱 **Crop Suggestions${soil ? ` for ${soil} Soil` : ""}${season ? ` – ${season} Season` : ""}:**\n\n`;
      return header + crops.map((c, i) => `${i + 1}. ${c}`).join("\n") + "\n\nConsult your local KVK for soil-test-based recommendations.";
    }
  },
  {
    match: (q) => /\b(leaf spot|blight|yellow|yellowing|fungus|spot|black spot|disease|infection|rot|wilt)\b/.test(q),
    answer: "🌱 **Crop Health Advisor Response**:\n\nYellowing or spotted leaves often indicate fungal diseases such as **Late Blight** or **Cercospora Leaf Spot**.\n\n**Recommended Actions:**\n1. **Organic Treatment:** Spray neem oil solution (5ml/liter of water) or a liquid copper-based fungicide every 7 days.\n2. **Cultural Control:** Avoid overhead irrigation; water directly at the root zone in early morning.\n3. **Pruning:** Remove heavily infected lower leaves and safely dispose/burn them away from the field.\n4. **Nutrient Check:** Apply balanced N-P-K fertilizer to strengthen plant immunity against pathogens."
  },
  {
    match: (q) => /\b(fertilizer|urea|dap|mop|npk|nutrient|manure|compost)\b/.test(q) && !/\b(suggest|recommend|crop|grow)\b/.test(q),
    answer: "🧪 **Fertilizer & Soil Nutrition Advice**:\n\nProper soil nutrition is essential for maximum yield. For most cereal crops (Wheat, Maize, Rice):\n\n- **Basal Application:** Apply full dose of DAP (Di-ammonium Phosphate) and MOP (Muriate of Potash) during field preparation.\n- **Top Dressing:** Split Urea application into 2-3 doses (at 21 days after sowing, tillering, and panicle initiation).\n- **Organic Boost:** Add 5 tons of well-decomposed Farm Yard Manure (FYM) per acre to build soil microbial activity.\n- **Soil Test:** Test soil pH (ideal range: 6.0 - 7.5). High alkaline soils benefit from gypsum application."
  },
  {
    match: (q) => /\b(pest|insect|worm|caterpillar|borer|aphid|whitefly|thrip|mite|bug)\b/.test(q),
    answer: "🐛 **Integrated Pest Management (IPM) Plan**:\n\nFor effective pest control without damaging crop ecosystems:\n\n1. **Yellow Sticky Traps:** Install 10-15 yellow/blue sticky traps per acre for sucking pests like whiteflies and thrips.\n2. **Biological Control:** Release *Trichogramma* parasitoids or apply *Bacillus thuringiensis* (Bt) for stem borers & caterpillars.\n3. **Botanical Spray:** 5% Neem Seed Kernel Extract (NSKE) spray works as a broad-spectrum natural repellent.\n4. **Chemical Remedy (If severe):** Spray Chlorantraniliprole 18.5% SC @ 60ml/acre for stem borers."
  },
  {
    match: (q) => /\b(water|irrigation|drip|sprinkler|drought|rain|moisture)\b/.test(q),
    answer: "💧 **Irrigation & Water Management Recommendation**:\n\n- **Current Weather Check:** If high rainfall is forecast in the next 24-48 hours, **defer irrigation** to avoid waterlogging and root rot.\n- **Watering Timing:** Water early morning (5:00 AM - 8:00 AM) to minimize evaporation loss.\n- **Drip Irrigation:** Enables 40-50% water savings while fertigating directly to root zones.\n- **Critical Stages:** Ensure adequate soil moisture during flowering and grain filling stages."
  },
  {
    match: (q) => /\b(price|mandi|market|sell|profit|rate|cost|income)\b/.test(q),
    answer: "📈 **Market Selling Strategy**:\n\n- **Market Trend:** Demand for high-quality grains is trending upwards. Storing clean, dry grain (moisture < 12%) for 2-3 weeks post-harvest can fetch 10-15% higher market rates.\n- **Quality Grading:** Grade your produce into A, B, C categories before reaching the Mandi for premium pricing.\n- **Direct Buyers:** Explore Farmer Producer Organizations (FPOs) or e-NAM digital trading platforms to cut out middleman commissions."
  }
];

export async function askFarmerAI(prompt, history = [], language = 'en', plantId = null, weatherLocation = null) {
  // Build a context string from recent conversation (last 6 turns max)
  const recentHistory = history.slice(-6);
  const contextPrompt = recentHistory.length > 1
    ? recentHistory.map(m => `${m.role === 'user' ? 'Farmer' : 'AI'}: ${m.text}`).join('\n') + `\nFarmer: ${prompt}`
    : prompt;

  // ── Step 1: Try Flask /api/chat (uses server-side Gemini key) ──────────────
  try {
    const res = await fetch(`${API_BASE_URL}/api/gemini/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: contextPrompt,
        language,
        plant_id: plantId,
        latitude: weatherLocation?.latitude,
        longitude: weatherLocation?.longitude
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'The Farmer AI service is unavailable.');
    }
    if (!data.success || !data.reply) {
      throw new Error('The Farmer AI service returned an invalid response.');
    }
    return data.reply;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Unable to reach the Farmer AI service.');
  }
}


// Knowledge Base for instant local AI responses when server is unreachable

// Real Plant Disease Detection Service (Connects strictly to ML Model API)
export async function detectDiseaseFromAPI(imageFile, plantId = '') {
  if (!(imageFile instanceof File || imageFile instanceof Blob)) {
    throw new Error("Please select or upload an actual leaf image file. Demo presets have been removed.");
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

  // Call Flask API (via Vite proxy /api or direct fallback)
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/detect-disease`, {
      method: 'POST',
      body: formData
    });
  } catch (err) {
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

