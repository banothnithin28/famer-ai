import React, { useState } from 'react';
import { 
  Sprout, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  Droplets, 
  Sun, 
  MapPin, 
  ArrowRight, 
  ShieldCheck, 
  RotateCcw,
  Calendar,
  Layers,
  Award
} from 'lucide-react';
import { recommendCrop } from '../services/apiService';

export default function CropAdvisor({ setActiveTab }) {
  const [soilType, setSoilType] = useState('Black');
  const [season, setSeason] = useState('Kharif');
  const [water, setWater] = useState('High');
  const [prevCrop, setPrevCrop] = useState('Pulse');
  const [location, setLocation] = useState('Telangana');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleRecommend = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await recommendCrop({
        soil_type: soilType,
        season,
        water_availability: water,
        previous_crop: prevCrop,
        location
      });

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to generate recommendation.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to Crop AI engine.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setError('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Title Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
          <Sparkles className="w-4 h-4 text-amber-500" /> Powered by crop_model.pkl
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          AI Smart Crop Recommendation Engine
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Select your local soil texture, upcoming crop season, and water conditions. Our machine learning model calculates the highest-yielding, disease-resistant crop tailored for your acreage.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Input Parameters Form */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" /> Soil & Field Conditions
            </h3>
            {result && (
              <button 
                onClick={resetForm}
                className="text-xs font-semibold text-slate-500 hover:text-emerald-600 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          <form onSubmit={handleRecommend} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-500" /> Soil Texture / Type
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white font-medium"
              >
                <option value="Black">Black Soil (Regur - High Moisture)</option>
                <option value="Red">Red Soil (Iron Rich - Well Drained)</option>
                <option value="Alluvial">Alluvial Soil (Highly Fertile Loam)</option>
                <option value="Loamy">Loamy Soil (Balanced Organic)</option>
                <option value="Sandy">Sandy Soil (High Aeration)</option>
                <option value="Clay">Clay Soil (Dense Water Retention)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Crop Season
                </label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white font-medium"
                >
                  <option value="Kharif">Kharif (Monsoon / Rainy)</option>
                  <option value="Rabi">Rabi (Winter / Dry)</option>
                  <option value="Zaid">Zaid (Summer)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-sky-500" /> Water Availability
                </label>
                <select
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white font-medium"
                >
                  <option value="High">High (Canal / Borewell)</option>
                  <option value="Medium">Medium (Seasonal Well)</option>
                  <option value="Low">Low (Rainfed / Semi-arid)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" /> Previous Crop
                </label>
                <select
                  value={prevCrop}
                  onChange={(e) => setPrevCrop(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white font-medium"
                >
                  <option value="Pulse">Pulse / Legume (N-Fixing)</option>
                  <option value="Cotton">Cotton</option>
                  <option value="Maize">Maize / Corn</option>
                  <option value="Rice">Rice / Paddy</option>
                  <option value="Wheat">Wheat</option>
                  <option value="Mustard">Mustard / Oilseed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" /> State / Region
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white font-medium"
                >
                  <option value="Telangana">Telangana</option>
                  <option value="Andhra Pradesh">Andhra Pradesh</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Punjab">Punjab</option>
                  <option value="Madhya Pradesh">Madhya Pradesh</option>
                </select>
              </div>
            </div>

            {error && (
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-emerald-950/20 transition-all text-sm mt-4"
            >
              {loading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Running ML Inference...
                </>
              ) : (
                <>
                  <Sprout className="w-4 h-4" />
                  Generate Recommended Crop
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Output Diagnostic Display */}
        <div className="lg:col-span-7">
          {result ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 animate-fade-in">
              
              {/* Highlight Banner */}
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 rounded-full bg-white/10 blur-xl"></div>
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 block mb-1">
                      Optimal Crop Recommendation
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2">
                      🌾 {result.recommended_crop}
                    </h2>
                    <p className="text-xs text-emerald-50 font-medium mt-1">
                      Best match for {soilType} soil in {season} season ({location})
                    </p>
                  </div>

                  <div className="bg-white/15 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/20 text-center shrink-0">
                    <span className="text-[11px] font-extrabold text-emerald-100 uppercase tracking-wider block">
                      ML Confidence
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center gap-1">
                      {result.confidence < 60 ? (
                        <span className="text-amber-300 text-sm">⚠️</span>
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-amber-300" />
                      )}
                      {result.confidence}%
                    </div>
                  </div>
                </div>
              </div>

              {result.confidence < 60 && (
                <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center gap-2">
                  <span className="font-bold text-sm">⚠️ Low confidence:</span>
                  <span>Model calculated {result.confidence}% probability. Actual conditions may vary; verify with local Krishi Vigyan Kendra.</span>
                </div>
              )}

              {/* Rationale Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Model Recommendation Rationale:
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                  {result.reason}
                </p>
              </div>

              {/* Agronomic Best Practices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
                  <h5 className="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wide">
                    <Droplets className="w-4 h-4 text-sky-500" /> Irrigation Requirement
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {water === 'High' 
                      ? 'Apply scheduled 3-4 acre-inch irrigation cycles during flowering & grain filling.'
                      : 'Maintain moisture with drip lines or mulch to preserve root-zone hydration.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-1">
                  <h5 className="font-bold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
                    <TrendingUp className="w-4 h-4 text-amber-500" /> Profitability Outlook
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    High market demand expected post-harvest with strong Mandi trading volume.
                  </p>
                </div>
              </div>

              {/* Next Steps CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Ready to proceed with this crop?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('calculator')}
                    className="text-xs font-bold px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
                  >
                    Calculate Fertilizers ➔
                  </button>
                  <button
                    onClick={() => setActiveTab('scanner')}
                    className="text-xs font-bold px-3.5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                  >
                    Scan Crop Health ➔
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full min-h-[380px] bg-slate-100/60 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Sprout className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                Ready for AI Crop Analysis
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Adjust your soil type, season, and water conditions on the left, then click "Generate Recommended Crop" to query the trained Random Forest model.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
