// Farmer AI - Smart Service Layer with Gemini API + Local Intelligent Farming Engine

// Knowledge Base for instant local AI responses when API key is not provided
const FARMING_KNOWLEDGE_BASE = [
  {
    keywords: ["leaf spot", "blight", "yellow", "fungus", "spot", "black spot", "disease"],
    answer: "🌱 **Crop Health Advisor Response**:\n\nYellowing or spotted leaves often indicate fungal diseases such as **Late Blight** or **Cercospora Leaf Spot**.\n\n**Recommended Actions:**\n1. **Organic Treatment:** Spray neem oil solution (5ml/liter of water) or a liquid copper-based fungicide every 7 days.\n2. **Cultural Control:** Avoid overhead irrigation; water directly at the root zone in early morning.\n3. **Pruning:** Remove heavily infected lower leaves and safely dispose/burn them away from the field.\n4. **Nutrient Check:** Apply balanced N-P-K fertilizer to strengthen plant immunity against pathogens."
  },
  {
    keywords: ["fertilizer", "urea", "dap", "mop", "npk", "soil", "nutrient"],
    answer: "🧪 **Fertilizer & Soil Nutrition Advice**:\n\nProper soil nutrition is essential for maximum yield. For most cereal crops (Wheat, Maize, Rice):\n\n- **Basal Application:** Apply full dose of DAP (Di-ammonium Phosphate) and MOP (Muriate of Potash) during field preparation.\n- **Top Dressing:** Split Urea application into 2-3 doses (at 21 days after sowing, tillering, and panicle initiation).\n- **Organic Boost:** Add 5 tons of well-decomposed Farm Yard Manure (FYM) per acre to build soil microbial activity.\n- **Soil Test:** Test soil pH (ideal range: 6.0 - 7.5). High alkaline soils benefit from gypsum application."
  },
  {
    keywords: ["pest", "insect", "worm", "caterpillar", "borer", "aphid", "whitefly"],
    answer: "🐛 **Integrated Pest Management (IPM) Plan**:\n\nFor effective pest control without damaging crop ecosystems:\n\n1. **Yellow Sticky Traps:** Install 10-15 yellow/blue sticky traps per acre for sucking pests like whiteflies and thrips.\n2. **Biological Control:** Release *Trichogramma* parasitoids or apply *Bacillus thuringiensis* (Bt) for stem borers & caterpillars.\n3. **Botanical Spray:** 5% Neem Seed Kernel Extract (NSKE) spray works as a broad-spectrum natural repellent.\n4. **Chemical Remedy (If severe):** Spray Chlorantraniliprole 18.5% SC @ 60ml/acre for stem borers."
  },
  {
    keywords: ["water", "irrigation", "drip", "sprinkler", "drought", "rain"],
    answer: "💧 **Irrigation & Water Management Recommendation**:\n\n- **Current Weather Check:** If high rainfall is forecast in the next 24-48 hours, **defer irrigation** to avoid waterlogging and root rot.\n- **Watering Timing:** Water early morning (5:00 AM - 8:00 AM) to minimize evaporation loss.\n- **Drip Irrigation:** Enables 40-50% water savings while fertigating directly to root zones.\n- **Critical Stages:** Ensure adequate soil moisture during flowering and grain filling stages."
  },
  {
    keywords: ["price", "mandi", "market", "sell", "profit", "rate"],
    answer: "📈 **Market Selling Strategy**:\n\n- **Market Trend:** Demand for high-quality grains is trending upwards. Storing clean, dry grain (moisture < 12%) for 2-3 weeks post-harvest can fetch 10-15% higher market rates.\n- **Quality Grading:** Grade your produce into A, B, C categories before reaching the Mandi for premium pricing.\n- **Direct Buyers:** Explore Farmer Producer Organizations (FPOs) or e-NAM digital trading platforms to cut out middleman commissions."
  }
];

export async function askFarmerAI(prompt, userApiKey = "") {
  const apiKey = userApiKey || localStorage.getItem("farmer_ai_gemini_key") || "";

  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are Farmer AI, an expert agricultural scientist, agronomist, and farming advisor. Provide practical, accurate, clear, and encouraging advice for farmers. Structure your response with markdown formatting, bold points, bullet lists, and step-by-step instructions. Query: ${prompt}`
                  }
                ]
              }
            ]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      const data = await response.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer) return answer;
    } catch (err) {
      console.warn("Gemini API call failed, falling back to smart local engine:", err);
    }
  }

  // Knowledge-base response fallback when Gemini API key is not configured
  const lowerPrompt = prompt.toLowerCase();
  
  for (const item of FARMING_KNOWLEDGE_BASE) {
    if (item.keywords.some((kw) => lowerPrompt.includes(kw))) {
      return item.answer;
    }
  }

  // Default expert answer
  return `🌾 **Farmer AI General Guidance**:\n\nThank you for asking! For **"${prompt}"**:\n\n1. **Best Practice:** Maintain proper crop spacing, soil organic matter, and balanced crop rotation.\n2. **Soil Health:** Regularly add compost or green manure (Dhaincha/Sunn hemp) to enhance soil structure.\n3. **Monitoring:** Inspect crop leaves weekly for early signs of pest entry or nutrient deficiencies.\n4. **Expert Help:** Consult your local Krishi Vigyan Kendra (KVK) or agriculture officer for localized soil testing reports.`;
}

// Real Plant Disease Detection Service (Connects strictly to ML Model API)
export async function detectDiseaseFromAPI(imageFile) {
  if (!(imageFile instanceof File || imageFile instanceof Blob)) {
    throw new Error("Please select or upload an actual leaf image file. Demo presets have been removed.");
  }

  const formData = new FormData();
  formData.append('leaf_image', imageFile);

  // Call Flask API (via Vite proxy /api or direct fallback)
  let response;
  try {
    response = await fetch('/api/detect-disease', {
      method: 'POST',
      body: formData
    });
  } catch (err) {
    // Direct fallback if proxy is inactive
    response = await fetch('http://127.0.0.1:5000/api/detect-disease', {
      method: 'POST',
      body: formData
    });
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server returned error status ${response.status}`);
  }

  return await response.json();
}

// Backward compatibility alias
export const analyzeCropImage = detectDiseaseFromAPI;

