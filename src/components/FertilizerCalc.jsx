import React, { useState } from 'react';
import { 
  Calculator, 
  Sprout, 
  CheckCircle2, 
  Sparkles, 
  HelpCircle, 
  DollarSign, 
  ArrowRight, 
  Award,
  Calendar,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function FertilizerCalc() {
  const [landArea, setLandArea] = useState(2); // Acres
  const [unit, setUnit] = useState('Acres');
  const [cropType, setCropType] = useState('wheat');
  const [soilType, setSoilType] = useState('normal');
  const [result, setResult] = useState(null);

  const cropPresets = {
    wheat: {
      name: 'Wheat (Cereal)',
      ureaPerAcre: 110, // kg
      dapPerAcre: 55, // kg
      mopPerAcre: 35, // kg
      avgYieldPerAcre: 22, // Quintals
      avgPricePerQuintal: 2450 // INR
    },
    rice: {
      name: 'Paddy / Rice',
      ureaPerAcre: 130,
      dapPerAcre: 65,
      mopPerAcre: 45,
      avgYieldPerAcre: 26,
      avgPricePerQuintal: 3890
    },
    corn: {
      name: 'Maize / Corn',
      ureaPerAcre: 120,
      dapPerAcre: 60,
      mopPerAcre: 40,
      avgYieldPerAcre: 28,
      avgPricePerQuintal: 2180
    },
    tomato: {
      name: 'Tomato (Vegetable)',
      ureaPerAcre: 140,
      dapPerAcre: 80,
      mopPerAcre: 60,
      avgYieldPerAcre: 120,
      avgPricePerQuintal: 1850
    },
    cotton: {
      name: 'Cotton',
      ureaPerAcre: 100,
      dapPerAcre: 50,
      mopPerAcre: 30,
      avgYieldPerAcre: 12,
      avgPricePerQuintal: 7200
    }
  };

  const handleCalculate = (e) => {
    e.preventDefault();
    const multiplier = unit === 'Hectares' ? landArea * 2.471 : landArea;
    const cropData = cropPresets[cropType];

    let soilMultiplier = 1.0;
    if (soilType === 'low_n') soilMultiplier = 1.15;
    if (soilType === 'low_p') soilMultiplier = 1.2;

    const totalUrea = Math.round(cropData.ureaPerAcre * multiplier * soilMultiplier);
    const totalDap = Math.round(cropData.dapPerAcre * multiplier * soilMultiplier);
    const totalMop = Math.round(cropData.mopPerAcre * multiplier);

    const ureaBags = (totalUrea / 45).toFixed(1); // 45kg bag
    const dapBags = (totalDap / 50).toFixed(1); // 50kg bag
    const mopBags = (totalMop / 50).toFixed(1); // 50kg bag

    const totalYield = Math.round(cropData.avgYieldPerAcre * multiplier);
    const totalRevenue = totalYield * cropData.avgPricePerQuintal;

    setResult({
      totalUrea,
      totalDap,
      totalMop,
      ureaBags,
      dapBags,
      mopBags,
      totalYield,
      totalRevenue,
      cropName: cropData.name,
      multiplier
    });

    // Trigger celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Title */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
          <Calculator className="w-4 h-4" /> AgriCalc Smart Engine
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
          Yield & N-P-K Fertilizer Calculator
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Determine exact Urea, DAP, and MOP dosage based on land acreage and estimate expected crop yield revenue.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
            <Sprout className="w-5 h-5 text-emerald-500" /> Farm Field Parameters
          </h2>

          <form onSubmit={handleCalculate} className="space-y-4">
            
            {/* Land Area */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Total Land Plot Area
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0.5"
                  max="500"
                  step="0.5"
                  value={landArea}
                  onChange={(e) => setLandArea(parseFloat(e.target.value) || 1)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold focus:outline-none focus:border-emerald-500"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm"
                >
                  <option value="Acres">Acres</option>
                  <option value="Hectares">Hectares</option>
                </select>
              </div>
            </div>

            {/* Crop Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Crop Variety
              </label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="wheat">🌾 Wheat (Cereal)</option>
                <option value="rice">🌱 Paddy / Rice</option>
                <option value="corn">🌽 Maize / Corn</option>
                <option value="tomato">🍅 Tomato (Vegetable)</option>
                <option value="cotton">☁️ Cotton</option>
              </select>
            </div>

            {/* Soil Nutrient Profile */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Soil Fertility Condition
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:border-emerald-500"
              >
                <option value="normal">Normal Fertile Soil (Balanced NPK)</option>
                <option value="low_n">Low Nitrogen Soil (+15% Urea Needed)</option>
                <option value="low_p">Low Phosphorus Soil (+20% DAP Needed)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 text-amber-300" />
              <span>Calculate Fertilizer & Yield</span>
            </button>
          </form>
        </div>

        {/* Right Column: Output Calculation Report */}
        <div className="lg:col-span-7">
          {result ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 animate-fade-in">
              
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Optimization Report for {landArea} {unit}
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {result.cropName}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                  <Award className="w-6 h-6" />
                </div>
              </div>

              {/* Fertilizer Dosage Cards */}
              <div className="grid grid-cols-3 gap-3 text-center">
                {/* Urea */}
                <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Urea (46% N)</span>
                  <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200">{result.totalUrea} kg</div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">({result.ureaBags} Bags)</span>
                </div>

                {/* DAP */}
                <div className="bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 p-4 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 uppercase">DAP (18-46-0)</span>
                  <div className="text-2xl font-black text-sky-900 dark:text-sky-200">{result.totalDap} kg</div>
                  <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">({result.dapBags} Bags)</span>
                </div>

                {/* MOP */}
                <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-4 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase">MOP (60% K)</span>
                  <div className="text-2xl font-black text-amber-900 dark:text-amber-200">{result.totalMop} kg</div>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">({result.mopBags} Bags)</span>
                </div>
              </div>

              {/* Yield & Revenue Estimator */}
              <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" /> Projected Harvest Yield & Revenue
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold">At Current Mandi Rates</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-xs text-slate-400">Estimated Total Yield</span>
                    <div className="text-2xl font-black text-amber-300">{result.totalYield} Quintals</div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Gross Estimated Revenue</span>
                    <div className="text-2xl font-black text-emerald-400">₹{result.totalRevenue.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>

              {/* Split Application Schedule */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-500" /> Recommended Dose Application Schedule
                </h4>
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg">
                    <span className="font-semibold">Basal Dose (Sowing):</span>
                    <span className="font-bold text-slate-900 dark:text-white">100% DAP + 100% MOP + 25% Urea</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg">
                    <span className="font-semibold">1st Top Dressing (21 Days):</span>
                    <span className="font-bold text-slate-900 dark:text-white">50% Urea during tillering</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg">
                    <span className="font-semibold">2nd Top Dressing (45 Days):</span>
                    <span className="font-bold text-slate-900 dark:text-white">Remaining 25% Urea before flowering</span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full bg-slate-100/60 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3">
              <Calculator className="w-12 h-12 text-slate-400" />
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-base">
                Enter Field Parameters
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Select your land plot acreage and crop type on the left to calculate exact fertilizer bags and revenue forecast.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
