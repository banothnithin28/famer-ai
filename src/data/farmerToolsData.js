/**
 * Farmer Tools Agricultural Knowledge Base & Scientific Calculation Models
 * Documented according to ICAR / State Agricultural Universities (SAU) agronomic standards.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. CROP ADVISOR DATABASE
// ─────────────────────────────────────────────────────────────────────────────

export const CROPS_DATA = {
  paddy: {
    name: 'Paddy (Rice)',
    scientificName: 'Oryza sativa',
    emoji: '🌾',
    regions: ['Telangana', 'Andhra Pradesh', 'Punjab & Haryana', 'West Bengal', 'Tamil Nadu', 'Odisha', 'UP & Bihar'],
    seasons: ['Kharif (Monsoon)', 'Rabi (Winter)', 'Boro / Summer'],
    idealSoil: ['Clayey Loam', 'Alluvial Soil', 'Heavy Clay Soil'],
    soilPh: '5.5 – 7.0',
    tempRange: '20°C – 37°C',
    waterRequirement: '1200 – 1400 mm (High / Standing water 2–5 cm during tillering)',
    growthStages: [
      { stage: 'Nursery / Seedling', duration: '20–25 days', guidance: 'Maintain thin water layer; apply protective carbofuran/neem cake if gall midge noticed.' },
      { stage: 'Tillering & Vegetative', duration: '25–45 days after transplanting', guidance: 'Maintain 2–3 cm standing water. Top-dress first split of nitrogen (Urea).' },
      { stage: 'Panicle Initiation & Flowering', duration: '50–75 days', guidance: 'Critical water-sensitive stage. Never allow moisture stress. Watch for stem borer and blast.' },
      { stage: 'Grain Filling & Milking', duration: '75–95 days', guidance: 'Keep soil saturated. Avoid deep standing water. Prepare for water drainage 10 days before harvest.' },
      { stage: 'Maturity & Ripening', duration: '95–120 days', guidance: 'Drain water completely 7–10 days before harvesting when 80% grains turn golden straw color.' }
    ],
    commonPests: [
      { name: 'Yellow Stem Borer', signs: 'Dead heart in vegetative stage; White earhead at flowering.', management: 'Install pheromone traps (5/acre); apply Cartap hydrochloride 4G or Chlorantraniliprole 0.4G.' },
      { name: 'Brown Planthopper (BPH)', signs: 'Hopper burn (circular drying patches of plants); sooty mold.', management: 'Create alleyways (30 cm every 2 m); avoid excessive Urea; spray Pymetrozine or Dinotefuran.' },
      { name: 'Leaf Folder', signs: 'Leaves folded longitudinally; white longitudinal streaks.', management: 'Apply Chlorantraniliprole 18.5% SC or Flubendiamide.' }
    ],
    commonDiseases: [
      { name: 'Blast (Magnaporthe oryzae)', signs: 'Spindle-shaped spots with grey center and brown margin on leaves and neck.', management: 'Seed treatment with Tricyclazole 75% WP; spray Tricyclazole 0.6 g/L or Isoprothiolane.' },
      { name: 'Bacterial Leaf Blight (BLB)', signs: 'Water-soaked wavy lesions starting from leaf tips turning yellow to white.', management: 'Avoid excess nitrogen; drain standing water; spray Copper oxychloride + Streptocycline.' },
      { name: 'Sheath Blight', signs: 'Greenish-grey oval or irregular lesions on leaf sheaths near water line.', management: 'Spray Hexaconazole 5% EC or Validamycin 3% L.' }
    ],
    fertilizerGuidance: 'Standard RDF: 100-120 kg N : 50-60 kg P2O5 : 40-50 kg K2O per hectare (approx 45:24:20 kg/acre). Apply all P and 50% K as basal. Split N in 3 equal parts (basal, active tillering, panicle initiation).',
    precautions: 'Do not allow standing water during bacterial blight outbreak. Drain water before spraying systemic pesticides. Maintain field bunds to retain water efficiently.'
  },

  cotton: {
    name: 'Cotton',
    scientificName: 'Gossypium hirsutum',
    emoji: '🌸',
    regions: ['Telangana', 'Maharashtra', 'Gujarat', 'Andhra Pradesh', 'Karnataka', 'Punjab'],
    seasons: ['Kharif (June – February)'],
    idealSoil: ['Deep Black Cotton Soil (Vertisol)', 'Well-drained Medium Loam'],
    soilPh: '6.5 – 8.0',
    tempRange: '22°C – 34°C',
    waterRequirement: '700 – 900 mm (Drip irrigation highly efficient; sensitive to waterlogging)',
    growthStages: [
      { stage: 'Germination & Seedling', duration: '1–25 days', guidance: 'Protect from seedling thrips and aphids. Ensure excellent field drainage.' },
      { stage: 'Vegetative & Squaring', duration: '25–60 days', guidance: 'Square (flower bud) formation begins. Keep weed-free; top-dress first split of N.' },
      { stage: 'Flowering & Boll Formation', duration: '60–100 days', guidance: 'Peak water and nutrient demand. Watch for pink bollworm and whitefly.' },
      { stage: 'Boll Maturation & Bursting', duration: '100–160 days', guidance: 'Gradually reduce irrigation to facilitate uniform opening and clean picking.' }
    ],
    commonPests: [
      { name: 'Pink Bollworm (PBW)', signs: 'Rosette flowers; premature dropping of bolls; exit holes on bolls.', management: 'Install pheromone traps (8/acre); destroy crop residue; spray Emamectin benzoate 5% SG or Profenofos.' },
      { name: 'Whitefly & Aphids', signs: 'Curling of leaves; yellowing; honeydew secretion with black sooty mold.', management: 'Install yellow sticky traps; spray Neem oil (1500 ppm) or Flonicamid 50 WG.' }
    ],
    commonDiseases: [
      { name: 'Bacterial Blight / Angular Leaf Spot', signs: 'Angular water-soaked lesions bounded by leaf veins; black arm on stems.', management: 'Seed treatment with Streptocycline; spray Copper Oxychloride 3 g/L + Streptocycline 100 mg/L.' },
      { name: 'Grey Mildew (Dahiya)', signs: 'White powdery growth on lower leaf surface.', management: 'Spray Wettable Sulfur 3 g/L or Azoxystrobin.' }
    ],
    fertilizerGuidance: 'Standard RDF: 120-150 kg N : 60 kg P2O5 : 60 kg K2O per hectare (approx 50:24:24 kg/acre for irrigated hybrid). Split N in 3 doses (25, 50, 75 days after sowing). Apply Boron & Magnesium if deficiency appears.',
    precautions: 'Cotton is extremely vulnerable to water stagnation. Provide drainage channels. Never spray insecticides during peak honeybee pollinating hours (early morning).'
  },

  chilli: {
    name: 'Chilli',
    scientificName: 'Capsicum annuum',
    emoji: '🌶️',
    regions: ['Andhra Pradesh (Guntur)', 'Telangana (Warangal)', 'Karnataka', 'Madhya Pradesh'],
    seasons: ['Kharif', 'Rabi', 'Summer (under drip)'],
    idealSoil: ['Well-drained Black Soil', 'Sandy Loam', 'Red Loamy Soil'],
    soilPh: '6.0 – 7.5',
    tempRange: '18°C – 32°C',
    waterRequirement: '600 – 800 mm (Needs uniform moisture; avoid both flooding and severe wilting)',
    growthStages: [
      { stage: 'Nursery & Transplanting', duration: '1–40 days', guidance: 'Transplant 35-day sturdy seedlings in evening. Drench with carbendazim for damping off prevention.' },
      { stage: 'Vegetative & Branching', duration: '40–70 days', guidance: 'Pinch apical buds if desired for lateral branching. Apply NPK split.' },
      { stage: 'Flowering & Fruit Set', duration: '70–110 days', guidance: 'Critical moisture stage. Flower drop occurs if water stress happens. Spray Planofix (NAA) if required.' },
      { stage: 'Fruit Ripening & Harvesting', duration: '110–180 days', guidance: 'Multiple pickings for green chillies; allow full red color for dry spice processing.' }
    ],
    commonPests: [
      { name: 'Black Thrips & Yellow Mites', signs: 'Upward leaf curling (Thrips); Downward cupping and inverted boat shape (Mites).', management: 'Spray Diafenthiuron 50% WP or Spiromesifen 22.9% SC or Spinetoram.' },
      { name: 'Fruit Borer (Helicoverpa)', signs: 'Holes in pods; internal feeding.', management: 'Spray Chlorantraniliprole or Emamectin Benzoate.' }
    ],
    commonDiseases: [
      { name: 'Chilli Leaf Curl Virus', signs: 'Severe curling, puckering, stunting; transmitted by whiteflies.', management: 'Vector control (whitefly) using yellow sticky cards; remove infected plants immediately.' },
      { name: 'Anthracnose / Die-back (Fruit Rot)', signs: 'Sunken circular spots with black concentric rings on pods; drying of twigs from top.', management: 'Spray Azoxystrobin + Difenoconazole or Mancozeb 2.5 g/L.' }
    ],
    fertilizerGuidance: 'Standard RDF: 150 kg N : 60 kg P2O5 : 60 kg K2O per hectare (approx 60:24:24 kg/acre). Micronutrient spray (Zinc + Boron) at 45 & 60 DAT improves fruit retention.',
    precautions: 'Do not harvest when pods are wet with morning dew. Maintain strict field sanitation to minimize viral vectors.'
  },

  maize: {
    name: 'Maize (Corn)',
    scientificName: 'Zea mays',
    emoji: '🌽',
    regions: ['Telangana', 'Karnataka', 'Bihar', 'Madhya Pradesh', 'Andhra Pradesh', 'Rajasthan'],
    seasons: ['Kharif (June–July)', 'Rabi (Oct–Nov)', 'Spring'],
    idealSoil: ['Fertile Well-Drained Loam', 'Silt Loam', 'Deep Red Loam'],
    soilPh: '6.0 – 7.2',
    tempRange: '18°C – 35°C',
    waterRequirement: '500 – 650 mm (Critical at Knee-high, Tasseling, and Silking)',
    growthStages: [
      { stage: 'Germination & Knee High', duration: '1–30 days', guidance: 'Maintain weed-free conditions. Watch for early Fall Armyworm whorl feeding.' },
      { stage: 'Tasseling (Pollen shed)', duration: '35–55 days', guidance: 'Water stress at tasseling can cut yield by up to 50%. Ensure soil moisture.' },
      { stage: 'Silking & Ear Formation', duration: '55–75 days', guidance: 'Silk receptivity to pollen. Avoid overhead pesticide sprays during morning pollen shed.' },
      { stage: 'Grain Hardening & Maturity', duration: '75–105 days', guidance: 'Black layer formation on grain base indicates physiological maturity.' }
    ],
    commonPests: [
      { name: 'Fall Armyworm (FAW - Spodoptera frugiperda)', signs: 'Ragged leaves, window pane damage, sawdust-like frass deep in whorl.', management: 'Whorl application of sand + lime mix; spray Chlorantraniliprole 18.5% SC or Spinetoram 11.7% SC.' }
    ],
    commonDiseases: [
      { name: 'Turcicum Leaf Blight', signs: 'Long elliptical grey-green to brown lesions on leaves.', management: 'Spray Mancozeb 2.5 g/L or Azoxystrobin.' }
    ],
    fertilizerGuidance: 'Standard RDF: 120-150 kg N : 60 kg P2O5 : 40-50 kg K2O per hectare (approx 50:24:18 kg/acre). Split N in 3 stages: Basal, Knee-high (V6), and Tasseling.',
    precautions: 'Never allow moisture stress from 2 weeks before tasseling to 2 weeks after silking.'
  },

  groundnut: {
    name: 'Groundnut (Peanut)',
    scientificName: 'Arachis hypogaea',
    emoji: '🥜',
    regions: ['Gujarat', 'Andhra Pradesh', 'Rajasthan', 'Tamil Nadu', 'Telangana'],
    seasons: ['Kharif (Rainfed)', 'Rabi / Summer (Irrigated)'],
    idealSoil: ['Well-drained Sandy Loam', 'Light Red Sandy Soil'],
    soilPh: '6.0 – 7.0',
    tempRange: '20°C – 32°C',
    waterRequirement: '450 – 600 mm (Critical at Flowering, Pegging, and Pod development)',
    growthStages: [
      { stage: 'Germination & Early Vegetative', duration: '1–25 days', guidance: 'Seed treatment with Rhizobium culture and Trichoderma viride.' },
      { stage: 'Flowering & Pegging', duration: '25–55 days', guidance: 'Pegs enter into soil. Do not disturb soil with heavy hoeing after peg entry.' },
      { stage: 'Pod Development', duration: '55–85 days', guidance: 'Apply Gypsum (200 kg/acre) at flowering/pegging for calcium needed for shell hardening.' },
      { stage: 'Harvesting', duration: '85–110 days', guidance: 'Inner shell turns brown/black with clear seed coat coloration.' }
    ],
    commonPests: [
      { name: 'Spodoptera (Tobacco Caterpillar)', signs: 'Skeletonized leaves; nocturnal defoliation.', management: 'Spray Novaluron or Chlorpyrifos; install light traps.' }
    ],
    commonDiseases: [
      { name: 'Tikka Disease (Early & Late Leaf Spot)', signs: 'Circular brown spots with yellow halo on leaves.', management: 'Spray Carbendazim 1 g/L + Mancozeb 2 g/L or Tebuconazole.' }
    ],
    fertilizerGuidance: 'Standard RDF: 20-25 kg N : 50-60 kg P2O5 : 40-50 kg K2O + 200-400 kg Gypsum per hectare (approx 10:20:16 kg/acre). Being a legume, it fixes nitrogen biologically.',
    precautions: 'Gypsum application is mandatory for avoiding "pops" (empty shells without kernels).'
  },

  tomato: {
    name: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    emoji: '🍅',
    regions: ['Andhra Pradesh', 'Karnataka', 'Madhya Pradesh', 'Telangana', 'Maharashtra', 'Odisha'],
    seasons: ['Autumn-Winter', 'Spring-Summer', 'Kharif'],
    idealSoil: ['Rich Loam', 'Sandy Loam with organic matter'],
    soilPh: '6.0 – 7.0',
    tempRange: '18°C – 30°C',
    waterRequirement: '600 – 800 mm (Regular uniform irrigation prevents fruit cracking and blossom end rot)',
    growthStages: [
      { stage: 'Transplanting & Staking', duration: '1–30 days', guidance: 'Stake plants with bamboo sticks/twine to keep fruit off ground.' },
      { stage: 'Flowering & Fruit Set', duration: '30–65 days', guidance: 'Maintain steady moisture. Extreme heat above 35°C causes flower drop.' },
      { stage: 'Fruit Growth & Harvest', duration: '65–120 days', guidance: 'Pick at breaker stage for long distance transport; red ripe for local market.' }
    ],
    commonPests: [
      { name: 'Tuta absoluta (Tomato Pinworm)', signs: 'Blotch leaf mines; punctures and rotten fruit.', management: 'Install Tuta pheromone traps; spray Chlorantraniliprole or Cyantraniliprole.' },
      { name: 'Whitefly', signs: 'Transmits Tomato Leaf Curl Virus (ToLCV).', management: 'Yellow sticky traps; Acetamiprid or Spirotetramat.' }
    ],
    commonDiseases: [
      { name: 'Early Blight (Alternaria)', signs: 'Concentric target-board rings on older leaves.', management: 'Spray Mancozeb or Chlorothalonil 2 g/L.' },
      { name: 'Late Blight (Phytophthora)', signs: 'Water-soaked oily patches that rot rapidly under cool humid conditions.', management: 'Spray Metalaxyl-M + Mancozeb or Dimethomorph.' }
    ],
    fertilizerGuidance: 'Standard RDF: 120-150 kg N : 80-100 kg P2O5 : 80-100 kg K2O per hectare (approx 50:35:35 kg/acre). Foliar calcium nitrate prevents blossom-end rot.',
    precautions: 'Never use overhead sprinklers during evening hours as wet foliage promotes blight diseases.'
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. FERTILIZER CALCULATOR DATA & MODELS
// ─────────────────────────────────────────────────────────────────────────────

export const FERTILIZER_DATABASE = {
  urea: {
    name: 'Urea',
    formula: 'CO(NH2)2',
    npkContent: { N: 46, P: 0, K: 0 },
    bagWeightKg: 45, // Standard Indian bag size is 45 kg
    description: 'Most widely used concentrated solid nitrogenous fertilizer. Rapidly soluble in water and readily available to plants after microbial conversion to ammoniacal and nitrate forms.',
    mainNutrients: 'Nitrogen (N) - 46%',
    purpose: 'Promotes vigorous vegetative growth, lush green foliage, tillering in cereals, and chlorophyll synthesis.',
    usageTiming: 'Apply in split doses (Basal + 1st top dress + 2nd top dress). Never apply total nitrogen at once.',
    precautions: 'Do not apply on standing water or dry surface without mixing. Never mix Urea directly with superphosphates in advance. Excess urea causes succulent weak stems and attracts insect pests.'
  },
  dap: {
    name: 'DAP (Di-Ammonium Phosphate)',
    formula: '(NH4)2HPO4',
    npkContent: { N: 18, P: 46, K: 0 },
    bagWeightKg: 50,
    description: 'High-analysis phosphatic fertilizer providing both water-soluble phosphorus and starter nitrogen.',
    mainNutrients: 'Nitrogen (N) - 18%, Available Phosphate (P2O5) - 46%',
    purpose: 'Promotes rapid root establishment, early seedling vigor, tillering, and early flowering.',
    usageTiming: 'Best applied as basal dose at or before sowing/transplanting, placed below the seed zone.',
    precautions: 'Do not place seeds directly in contact with large amounts of DAP as free ammonia can inhibit germination. Always incorporate 3–5 cm deep.'
  },
  mop: {
    name: 'MOP (Muriate of Potash / Potassium Chloride)',
    formula: 'KCl',
    npkContent: { N: 0, P: 0, K: 60 },
    bagWeightKg: 50,
    description: 'Primary source of agricultural potassium. Contains 60% potash (K2O) as water-soluble potassium chloride.',
    mainNutrients: 'Potassium (K2O) - 60%',
    purpose: 'Improves drought and disease resistance, strengthens plant stems, regulates stomatal water loss, and enhances grain filling, fruit size, and starch accumulation.',
    usageTiming: 'Apply basal or in two equal splits (at sowing and at panicle/flowering initiation in sandy soils).',
    precautions: 'Avoid high doses in chloride-sensitive crops like tobacco, grapes, and potato (SOP - Potassium Sulfate is preferred for chloride-sensitive crops).'
  },
  complex_10_26_26: {
    name: 'NPK Complex 10:26:26',
    formula: 'Multi-nutrient compound',
    npkContent: { N: 10, P: 26, K: 26 },
    bagWeightKg: 50,
    description: 'Balanced compound fertilizer ideal for oilseeds, pulses, sugarcane, and root crops needing high P and K.',
    mainNutrients: 'Nitrogen (N) - 10%, Phosphate (P2O5) - 26%, Potash (K2O) - 26%',
    purpose: 'Supplies uniform proportions of phosphorus and potassium in every single granule for balanced root and grain development.',
    usageTiming: 'Primarily used as basal dressing at sowing.',
    precautions: 'Store in dry place; compound granules can absorb moisture in high humidity.'
  },
  complex_20_20_0_13: {
    name: 'Ammonium Phosphate Sulfate (20:20:0:13)',
    formula: 'NP + Sulfur compound',
    npkContent: { N: 20, P: 20, K: 0, S: 13 },
    bagWeightKg: 50,
    description: 'Highly popular in oilseeds (groundnut, mustard) and onion where sulfur is critical for oil synthesis and pungency.',
    mainNutrients: 'Nitrogen (N) - 20%, Phosphate (P2O5) - 20%, Sulfur (S) - 13%',
    purpose: 'Provides vital sulfur alongside nitrogen and phosphorus for protein and oil synthesis.',
    usageTiming: 'Basal application at sowing.',
    precautions: 'Ensure proper soil mixing; acidic soils benefit from lime supplementation when using regularly.'
  },
  ssp: {
    name: 'Single Super Phosphate (SSP)',
    formula: 'Ca(H2PO4)2 + CaSO4',
    npkContent: { N: 0, P: 16, K: 0, S: 11, Ca: 19 },
    bagWeightKg: 50,
    description: 'Traditional phosphorus source that also supplies valuable calcium and sulfur.',
    mainNutrients: 'Available P2O5 - 16%, Sulfur - 11%, Calcium - 19%',
    purpose: 'Promotes root development, pod filling in groundnut, and soil structure improvement.',
    usageTiming: 'Basal application placed in the furrow.',
    precautions: 'Avoid mixing with lime or calcium carbonate as it reduces phosphorus availability.'
  },
  zinc_sulfate: {
    name: 'Zinc Sulfate (Heptahydrate 21% / Monohydrate 33%)',
    formula: 'ZnSO4',
    npkContent: { N: 0, P: 0, K: 0, Zn: 21 },
    bagWeightKg: 25,
    description: 'Most important agricultural micronutrient in Indian soils. Prevents "Khaira" disease in paddy and white bud in maize.',
    mainNutrients: 'Zinc (Zn) - 21% / 33%, Sulfur - 10% / 15%',
    purpose: 'Enzyme activation, auxin synthesis, and prevention of interveinal chlorosis and stunting.',
    usageTiming: 'Soil application at 10–20 kg/acre every 2–3 seasons, or foliar spray (0.2%) with lime.',
    precautions: 'CRITICAL: Never mix Zinc Sulfate directly with Phosphatic fertilizers (DAP/SSP) in the same tank/mixture, as they react to form insoluble Zinc Phosphate.'
  }
};

/**
 * Standard Recommended Dose of Fertilizer (RDF) per acre (for medium fertility soil)
 * Values in kg of pure nutrient: [N, P2O5, K2O]
 */
export const CROP_RDF_PER_ACRE = {
  paddy:     { N: 48, P: 24, K: 20, name: 'Paddy (Rice)', splits: { basalN: 0.33, tilleringN: 0.33, panicleN: 0.34 } },
  cotton:    { N: 50, P: 24, K: 24, name: 'Cotton (Hybrid)', splits: { basalN: 0.20, squaringN: 0.40, bollN: 0.40 } },
  chilli:    { N: 60, P: 24, K: 24, name: 'Chilli', splits: { basalN: 0.25, vegetativeN: 0.25, floweringN: 0.25, fruitingN: 0.25 } },
  maize:     { N: 50, P: 24, K: 18, name: 'Maize (Hybrid)', splits: { basalN: 0.25, kneeHighN: 0.50, tasselingN: 0.25 } },
  groundnut: { N: 10, P: 20, K: 16, name: 'Groundnut', splits: { basalN: 1.0 } },
  tomato:    { N: 50, P: 35, K: 35, name: 'Tomato', splits: { basalN: 0.25, vegetativeN: 0.25, floweringN: 0.25, fruitingN: 0.25 } },
  wheat:     { N: 48, P: 24, K: 16, name: 'Wheat', splits: { basalN: 0.50, crownRootN: 0.50 } },
  sugarcane: { N: 100, P: 40, K: 40, name: 'Sugarcane', splits: { basalN: 0.25, tilleringN: 0.50, grandGrowthN: 0.25 } }
};

/**
 * Calculate fertilizer requirements using standard agronomic stoichiometry:
 * 1. P2O5 requirement satisfied by DAP (46% P2O5, which also provides 18% N)
 * 2. Remaining N requirement satisfied by Urea (46% N)
 * 3. K2O requirement satisfied by MOP (60% K2O)
 */
export function calculateFertilizers(cropKey, areaNum, unit = 'acre', stage = 'all') {
  const rdf = CROP_RDF_PER_ACRE[cropKey] || CROP_RDF_PER_ACRE.paddy;
  const acres = unit === 'hectare' ? areaNum * 2.47105 : areaNum;

  // Total pure nutrient needed for this field area
  const totalPureN = rdf.N * acres;
  const totalPureP = rdf.P * acres;
  const totalPureK = rdf.K * acres;

  // 1. DAP Calculation
  // DAP contains 46% P2O5
  const dapKg = Math.round(totalPureP / 0.46);
  const dapBags = (dapKg / 50).toFixed(1);

  // Nitrogen contributed by DAP (18% of DAP kg)
  const nFromDap = dapKg * 0.18;

  // 2. Urea Calculation
  // Remaining Nitrogen needed = Total N - N provided by DAP
  const remainingN = Math.max(0, totalPureN - nFromDap);
  const ureaKg = Math.round(remainingN / 0.46);
  const ureaBags = (ureaKg / 45).toFixed(1); // Standard Indian Urea bag = 45 kg

  // 3. MOP Calculation
  // MOP contains 60% K2O
  const mopKg = Math.round(totalPureK / 0.60);
  const mopBags = (mopKg / 50).toFixed(1);

  return {
    cropName: rdf.name,
    area: areaNum,
    unit,
    acres: acres.toFixed(2),
    pureNutrientsKg: {
      N: Math.round(totalPureN),
      P: Math.round(totalPureP),
      K: Math.round(totalPureK)
    },
    recommendations: {
      dap: {
        kg: dapKg,
        bags: dapBags,
        bagWeight: 50,
        timing: '100% as basal dose at sowing / transplanting'
      },
      urea: {
        kg: ureaKg,
        bags: ureaBags,
        bagWeight: 45,
        timing: 'Split across vegetative growth stages (never apply all at once)'
      },
      mop: {
        kg: mopKg,
        bags: mopBags,
        bagWeight: 50,
        timing: 'Apply as basal, or split between basal and flowering in light soils'
      }
    },
    assumptions: [
      'Calculations based on State Agricultural University (SAU) Recommended Dose of Fertilizer (RDF) for medium fertility soils.',
      'DAP (18-46-0) supplies all required Phosphorus and partially fulfills Nitrogen.',
      'Remaining Nitrogen is supplied through Urea (46% N) packed in 45 kg standard bags.',
      'Potassium is supplied through Muriate of Potash (MOP, 60% K2O) packed in 50 kg bags.',
      'Soil Health Card testing is strongly recommended to adjust dosages for specific field organic carbon and nutrient levels.'
    ]
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INDIAN GOVERNMENT AGRICULTURAL SCHEMES
// ─────────────────────────────────────────────────────────────────────────────

export const GOVT_SCHEMES = [
  {
    id: 'pm-kisan',
    name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    category: 'Income Support',
    authority: 'Ministry of Agriculture and Farmers Welfare, Govt. of India',
    purpose: 'To provide direct income support to all landholding farmer families across India to meet agricultural inputs and domestic needs.',
    benefits: '₹6,000 per year distributed in 3 equal installments of ₹2,000 directly into the farmer’s Aadhaar-seeded bank account.',
    eligibility: 'Small and marginal landholder farmer families with cultivable land in their names. Certain institutional landholders, high tax payers, and constitutional post holders are excluded.',
    applicationProcess: 'Enroll via official PM-KISAN portal (Farmer Corner) or visit the nearest Common Service Centre (CSC) or local Agriculture Revenue Officer. Requires Aadhaar, Land ownership document (Pattadar Passbook / Pahani), and active bank account details.',
    officialPortal: 'https://pmkisan.gov.in',
    portalLabel: 'pmkisan.gov.in',
    verifiedDate: '2026'
  },
  {
    id: 'pmfby',
    name: 'PMFBY (Pradhan Mantri Fasal Bima Yojana)',
    category: 'Crop Insurance',
    authority: 'Ministry of Agriculture and Farmers Welfare, Govt. of India',
    purpose: 'Comprehensive crop insurance coverage against non-preventable natural risks (drought, flood, cyclone, hailstorm, pest & disease outbreak).',
    benefits: 'Very low premium for farmers: Maximum 2% of sum insured for Kharif crops, 1.5% for Rabi crops, and 5% for annual commercial/horticultural crops. The remainder is subsidized by Central and State Governments.',
    eligibility: 'All farmers growing notified crops in notified areas, including sharecroppers and tenant farmers.',
    applicationProcess: 'Apply online on the National Crop Insurance Portal (PMFBY portal), through bank branches (mandatory for loanee farmers unless opted out), or CSC centers before the state cut-off deadline.',
    officialPortal: 'https://pmfby.gov.in',
    portalLabel: 'pmfby.gov.in',
    verifiedDate: '2026'
  },
  {
    id: 'soil-health-card',
    name: 'Soil Health Card Scheme',
    category: 'Soil Testing & Advisory',
    authority: 'Department of Agriculture & Farmers Welfare, Govt. of India',
    purpose: 'To evaluate the nutrient status of farmer fields and provide crop-wise tailored fertilizer recommendations to prevent soil degradation and reduce input costs.',
    benefits: 'Free testing of 12 critical parameters (N, P, K, S, Zn, Fe, Cu, Mn, Bo, pH, EC, OC) and customized dosage recommendations every 2 years.',
    eligibility: 'All farmers holding agricultural land in India.',
    applicationProcess: 'Soil samples are collected by local Agriculture Extension Officers (AEO) or Village Agriculture Assistants. Card can be downloaded from the official portal using State, District, Mandal/Village, and Farmer name.',
    officialPortal: 'https://soilhealth.dac.gov.in',
    portalLabel: 'soilhealth.dac.gov.in',
    verifiedDate: '2026'
  },
  {
    id: 'kcc',
    name: 'Kisan Credit Card (KCC) Scheme',
    category: 'Low-Interest Farm Credit',
    authority: 'Reserve Bank of India (RBI) & NABARD',
    purpose: 'To ensure timely institutional credit at concessional interest rates for purchasing seeds, fertilizers, pesticides, diesel, and paying farm labor.',
    benefits: 'Short-term credit limit up to ₹3 Lakhs at an effective 4% interest rate (7% nominal rate minus 3% prompt repayment incentive). Collateral-free loan up to ₹1.6 Lakhs.',
    eligibility: 'All individual farmers, joint borrowers, tenant farmers, oral lessees, and Self Help Groups (SHGs) of farmers.',
    applicationProcess: 'Submit a 1-page simplified KCC form at any commercial bank, Regional Rural Bank (RRB), or Cooperative Bank along with land revenue documents (Pahani/Adangal) and Aadhaar.',
    officialPortal: 'https://www.myscheme.gov.in/schemes/kcc',
    portalLabel: 'myscheme.gov.in/schemes/kcc',
    verifiedDate: '2026'
  },
  {
    id: 'pmksy',
    name: 'PMKSY - Per Drop More Crop (Micro-Irrigation)',
    category: 'Irrigation & Water Conservation',
    authority: 'Department of Agriculture & Farmers Welfare & State Horticulture Depts.',
    purpose: 'Promoting precision water management through Drip and Sprinkler irrigation systems to improve water efficiency and crop yields.',
    benefits: 'Government subsidy of 55% for small and marginal farmers, and 45% for other farmers (with several state governments providing up to 70%–90% total subsidy).',
    eligibility: 'Farmers with assured irrigation source (borewell, open well, farm pond) and clear land title.',
    applicationProcess: 'Apply through the State Horticulture or Agriculture portal (e.g., TSMIP in Telangana, APMIP in Andhra Pradesh) with water source certificate, soil test report, and land documents.',
    officialPortal: 'https://pmksy.gov.in',
    portalLabel: 'pmksy.gov.in',
    verifiedDate: '2026'
  },
  {
    id: 'smam',
    name: 'SMAM (Sub-Mission on Agricultural Mechanization)',
    category: 'Farm Machinery Subsidy',
    authority: 'Ministry of Agriculture and Farmers Welfare',
    purpose: 'Promoting agricultural mechanization to reduce labor drudgery and enhance farming efficiency, especially among smallholder farmers.',
    benefits: '40% to 50% subsidy on tractors, power tillers, rotavators, seed drills, harvesters, and drones, or support for setting up Custom Hiring Centers (CHCs).',
    eligibility: 'Individual farmers, Farmer Producer Organizations (FPOs), and rural youth cooperatives.',
    applicationProcess: 'Register on the Central Mechanization Portal (agrimachinery.nic.in) or state agriculture engineering department with Aadhaar and land details.',
    officialPortal: 'https://agrimachinery.nic.in',
    portalLabel: 'agrimachinery.nic.in',
    verifiedDate: '2026'
  },
  {
    id: 'enam',
    name: 'e-NAM (National Agriculture Market)',
    category: 'Crop Marketing & Fair Prices',
    authority: 'Small Farmers Agribusiness Consortium (SFAC)',
    purpose: 'Pan-India electronic trading portal integrating existing APMC mandis to create a unified national market for agricultural commodities.',
    benefits: 'Transparent electronic price discovery, online bidding, assaying (quality testing) at mandi, and direct online bank payments without middleman exploitation.',
    eligibility: 'All farmers bringing harvest produce to any e-NAM enabled APMC Mandi.',
    applicationProcess: 'Register free on the e-NAM portal or at the gate entry of the local participating APMC Mandi with bank details, Aadhaar, and mobile number.',
    officialPortal: 'https://enam.gov.in',
    portalLabel: 'enam.gov.in',
    verifiedDate: '2026'
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. MANA OORU - MANA BADI & LOCAL RURAL INFORMATION
// ─────────────────────────────────────────────────────────────────────────────

export const LOCAL_RURAL_INFO = {
  manaOoruManaBadi: {
    title: 'Mana Ooru - Mana Badi (Our Village - Our School)',
    state: 'Telangana',
    category: 'Rural Infrastructure & Education Program',
    officialContext: 'Mana Ooru - Mana Badi is the flagship government initiative of Telangana designed to comprehensively modernize and upgrade physical infrastructure, digital classrooms, water sanitation, and learning facilities in all rural government schools across villages.',
    clarificationForFarmers: 'NOTE FOR FARMERS: While titled "Mana Ooru" (Our Village), this specific program is focused on public education and village school infrastructure. For agricultural services, input distribution, and farmer meetings, farmers utilize the "Rythu Vedika" centers located in every agricultural cluster.',
    keyComponents: [
      'Electrification and clean drinking water systems in rural schools',
      'Construction of modern sanitation blocks with running water',
      'Dual desks and clean classroom furniture for village children',
      'Digital interactive smartboards and computer laboratories',
      'Green chalkboard installations, school painting, and compound wall repairs'
    ],
    officialPortal: 'https://schooledu.telangana.gov.in',
    portalLabel: 'schooledu.telangana.gov.in'
  },
  rythuVedika: {
    title: 'Rythu Vedika (Telangana Agricultural Hubs)',
    state: 'Telangana',
    category: 'Village Farmer Resource Center',
    officialContext: 'State-wide network of dedicated farmer consultation centers constructed in every Agriculture Extension Officer (AEO) cluster (covering 5,000 acres each) across rural Telangana.',
    servicesForFarmers: [
      'Interactive farmer-scientist training sessions and crop advisory',
      'Direct contact with local Agriculture Extension Officers (AEO)',
      'Video conferencing facilities with agricultural scientists from PJTSAU university',
      'Soil health card distribution and subsidized seed demonstration plots',
      'Collective discussions on price discovery, crop planning, and market linkages'
    ],
    officialPortal: 'https://agri.telangana.gov.in',
    portalLabel: 'agri.telangana.gov.in'
  },
  rythuBharosaKendra: {
    title: 'Rythu Bharosa Kendras - RBKs (Andhra Pradesh)',
    state: 'Andhra Pradesh',
    category: 'Village Agriculture Secretariat',
    officialContext: 'One-stop village-level agricultural service centers in rural Andhra Pradesh offering end-to-end farm services directly inside the village.',
    servicesForFarmers: [
      'Supply of certified quality seeds, fertilizers, and pesticides with government guarantee',
      'Soil testing and crop advisory services through Village Agriculture Assistants (VAA)',
      'Custom Hiring Centers for agricultural machinery and implements',
      'Crop booking (e-Crop) for zero-premium crop insurance and minimum support price (MSP) procurement',
      'Banking correspondence and veterinary assistance for livestock farmers'
    ],
    officialPortal: 'https://apagrisnet.gov.in',
    portalLabel: 'apagrisnet.gov.in'
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. FARMING KNOWLEDGE ARTICLES
// ─────────────────────────────────────────────────────────────────────────────

export const KNOWLEDGE_CATEGORIES = [
  { id: 'all', label: 'All Topics', icon: '📚' },
  { id: 'crop_care', label: 'Crop Care', icon: '🌱' },
  { id: 'irrigation', label: 'Irrigation', icon: '💧' },
  { id: 'soil', label: 'Soil Management', icon: '🌾' },
  { id: 'pests', label: 'Pest Management', icon: '🐛' },
  { id: 'disease', label: 'Disease Management', icon: '🦠' },
  { id: 'weather', label: 'Weather & Climate', icon: '🌤️' },
  { id: 'growth', label: 'Plant Growth', icon: '🌿' }
];

export const KNOWLEDGE_ARTICLES = [
  {
    id: 'k1',
    category: 'crop_care',
    title: 'Seed Treatment Techniques Before Sowing',
    summary: 'Simple seed treatment using bio-fungicides saves up to 30% seedlings from soil-borne damping off and collar rot.',
    readTime: '3 min read',
    content: `Treating seeds before sowing is the cheapest and most effective crop protection practice.
1. Bio-fungicide Treatment: Mix Trichoderma viride or Pseudomonas fluorescens at 8–10 g per kg of seed with rice starch/jaggery water. Dry in shade for 30 minutes before sowing.
2. Nitrogen Fixing Bacteria: For legumes (groundnut, soybean, red gram), treat with Rhizobium culture (20 g/kg seed).
3. Chemical Treatment: For high-disease pressure soils, use Carbendazim or Thiram at 2 g/kg seed. Always apply bio-agents 24 hours AFTER any chemical treatment, never together.`
  },
  {
    id: 'k2',
    category: 'irrigation',
    title: 'Critical Irrigation Stages for Major Field Crops',
    summary: 'Watering at specific physiological growth stages gives maximum yield even with limited borewell water.',
    readTime: '4 min read',
    content: `If water supply is scarce, irrigate strictly during these sensitive stages:
• Paddy: Active Tillering (20–35 DAT) and Panicle Initiation / Flowering.
• Cotton: Squaring (35–45 DAS) and Early Boll development (70–90 DAS).
• Maize: Knee-high stage (30 DAS) and Tasseling / Silking (50–65 DAS).
• Groundnut: Flowering / Peg penetration into soil (30–50 DAS) and Pod filling.
• Wheat: Crown Root Initiation - CRI (21 DAS) and Flowering.`
  },
  {
    id: 'k3',
    category: 'soil',
    title: 'Rejuvenating Soil Organic Carbon with Green Manuring',
    summary: 'Growing Sunnhemp or Dhaincha and incorporating it adds up to 15 tonnes of organic biomass and 40 kg N per acre.',
    readTime: '3 min read',
    content: `Indian soils often contain less than 0.5% Organic Carbon due to high summer heat and intensive chemical fertilizer use.
• Sowing Dhaincha (Sesbania) or Sunnhemp (Crotalaria) at 15–20 kg/acre with pre-monsoon showers in May/June.
• Incorporate with a rotavator into the soil at 45–50 days (before flowering when stalks are succulent and rich in nitrogen).
• Benefits: Improves water retention in sandy soils, opens heavy clay soils, and reduces synthetic Urea requirements by 20–25%.`
  },
  {
    id: 'k4',
    category: 'pests',
    title: 'Integrated Pest Management (IPM): Cultural & Biological Control',
    summary: 'Reduce pesticide expenses by combining pheromone traps, border crops, and beneficial insects.',
    readTime: '4 min read',
    content: `IPM minimizes chemical pesticide toxicity while protecting crop yield:
1. Pheromone Traps: Install 5–8 traps per acre for Yellow Stem Borer (Paddy), Pink Bollworm (Cotton), or Fall Armyworm (Maize) for early pest monitoring.
2. Yellow & Blue Sticky Traps: Install 10 yellow traps (for whiteflies, aphids) and 10 blue traps (for thrips) per acre at crop canopy height.
3. Trap & Border Crops: Plant Marigold borders around tomato to attract fruit borer moths; plant Maize/Castor around cotton as refuge and barrier crops.
4. Neem Formulations: Spray 1500 ppm Azadirachtin (Neem oil) at first sign of sucking pest nymphs to disrupt feeding without killing predatory ladybird beetles.`
  },
  {
    id: 'k5',
    category: 'disease',
    title: 'Identifying Early Fungal vs. Bacterial Plant Diseases',
    summary: 'How to distinguish between fungal leaf spots and bacterial blight to select the right spray.',
    readTime: '3 min read',
    content: `Choosing the wrong medicine wastes money and harms plants.
• Fungal Infections: Usually exhibit concentric rings (target-like), powdery white/yellow/brown growth, or spindle shapes with clear margins (e.g., Blast, Tikka, Rust). Controlled by fungicides like Mancozeb, Hexaconazole, Azoxystrobin.
• Bacterial Infections: Lesions look water-soaked, translucent when held to light, and follow leaf veins with wavy, irregular margins (e.g., Bacterial Blight). When an infected cut stem is dipped in water, cloudy bacterial ooze emerges. Controlled by Copper Oxychloride + Streptocycline.`
  },
  {
    id: 'k6',
    category: 'weather',
    title: 'Protecting Crops from Extreme Heat Waves & Frost',
    summary: 'Protective agricultural techniques against sudden temperature anomalies during critical reproductive stages.',
    readTime: '3 min read',
    content: `Temperature spikes above 38°C cause flower abortion and pollen sterility in vegetables and pulses:
1. Micro-irrigation: Light, frequent irrigations during peak heat hours cool down the microclimate canopy temperature by 2°C–3°C.
2. Anti-transpirant / Potassium Spray: Foliar spray of Potassium Nitrate (13-0-45) at 5 g/L or Kaolin clay spray helps plants regulate stomata and resist moisture shock.
3. Windbreaks: Planting tall fodder sorghums or Sesbania along western field borders shields delicate horticultural crops from scorching winds (Loo).`
  },
  {
    id: 'k7',
    category: 'growth',
    title: 'Understanding Plant Nutrition: Primary vs. Micro-nutrients',
    summary: 'Deficiency symptom locations on the plant reveal which nutrient is lacking.',
    readTime: '4 min read',
    content: `Look at WHERE the yellowing or chlorosis appears on the plant:
• Lower (Older) Leaves First: Indicates MOBILE nutrients like Nitrogen (uniform yellowing), Phosphorus (purple-reddish margins), Potassium (firing or scorch on leaf tips and margins), and Magnesium (interveinal yellowing). The plant moves these from older tissues to new growth.
• Upper (Younger) Leaves First: Indicates IMMOBILE nutrients like Iron (young leaves turn completely yellow-white while veins stay green), Sulfur (young leaves turn pale yellow), Boron (brittle distorted buds), and Calcium (blossom end rot in fruits).`
  }
];
