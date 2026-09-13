import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw,
  Sparkles, 
  Leaf, 
  ShieldCheck, 
  Activity,
  ArrowRight,
  Info,
  Loader2,
  Bot
} from 'lucide-react';
import { detectDiseaseFromAPI } from '../services/geminiService';
import { getPlants } from '../services/apiService';

export default function DiseaseScanner({ plantId, onAskAI, onOpenPlantDetails }) {
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];
  // Step state: 1 = Scan Your Plant, 2 = Preview, 3 = Loading, 4 = Result
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [plants, setPlants] = useState([]);
  const [selectedPlantId, setSelectedPlantId] = useState(plantId || '');

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setSelectedPlantId(plantId || '');
    getPlants().then((res) => {
      if (res?.success) setPlants(res.plants || []);
    }).catch(() => {});
  }, [plantId]);

  // STEP 1 Handlers
  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setScanError('Please upload a JPEG, PNG, WEBP, BMP, or GIF image.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setScanError('Image must be 10 MB or smaller.');
      e.target.value = '';
      return;
    }

    setScanError('');
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStep(2);
    // Reset inputs so the same photo can be re-selected if needed
    e.target.value = '';
  };

  // STEP 2 Handlers
  const handleRetake = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setScanError('');
    setStep(1);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    if (!selectedPlantId) {
      setScanError('Please select a plant so this scan can be saved to its history.');
      setStep(1);
      return;
    }
    setStep(3); // Show loading state

    try {
      const result = await detectDiseaseFromAPI(selectedFile, selectedPlantId);
      setAnalysisResult(result);
      setStep(4);
    } catch (err) {
      setScanError(err.message || 'Unable to analyze this image. Please try again.');
      setAnalysisResult(null);
      setStep(1);
    }
  };

  // STEP 4 Reset
  const handleScanAgain = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setScanError('');
    setStep(1);
  };

  // Helper functions for clean formatting
  const getSymptomsList = (res) => {
    if (!res) return [];
    if (Array.isArray(res.symptoms) && res.symptoms.length > 0) {
      return res.symptoms;
    }
    if (typeof res.symptoms === 'string' && res.symptoms.trim()) {
      const items = res.symptoms.split(/[,;]/).map((s) => s.trim()).filter((s) => s.length > 3);
      if (items.length > 0) return items;
      return [res.symptoms.trim()];
    }
    return ['No symptom details were returned by the model.'];
  };

  const getActionsList = (res) => {
    if (!res) return [];
    if (Array.isArray(res.suggestions) && res.suggestions.length > 0) {
      return res.suggestions;
    }
    if (typeof res.recommended_action === 'string' && res.recommended_action.trim()) {
      const parts = res.recommended_action
        .split(/\.\s+/)
        .map((s) => s.trim().replace(/\.$/, ''))
        .filter((s) => s.length > 3);
      if (parts.length > 1) return parts;
      return [res.recommended_action.trim()];
    }
    return ['No treatment guidance was returned by the model.'];
  };

  const getPreventionList = (res) => {
    if (!res) return [];
    if (Array.isArray(res.prevention) && res.prevention.length > 0) {
      return res.prevention;
    }
    return ['No prevention guidance was returned by the model.'];
  };

  const isLowConfidence = 
    analysisResult && 
    (analysisResult.reliable === false || 
     analysisResult.low_confidence === true || 
    (analysisResult.confidence !== undefined && analysisResult.confidence < 60));

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      
      {/* Hidden inputs for camera capture vs gallery picker */}
      <input 
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilePicked}
        className="hidden"
      />
      <input 
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFilePicked}
        className="hidden"
      />

      {/* Progress Dots / Step Bar */}
      <div className="flex items-center justify-center gap-2 pb-1">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step === i 
                ? 'w-8 bg-emerald-600 dark:bg-emerald-400' 
                : step > i 
                ? 'w-3 bg-emerald-300 dark:bg-emerald-800' 
                : 'w-3 bg-slate-200 dark:bg-slate-800'
            }`} 
          />
        ))}
      </div>

      {/* =======================================================================
          STEP 1: SCAN YOUR PLANT
          ======================================================================= */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
              <Leaf className="w-3.5 h-3.5 text-emerald-600" />
              Plant health check
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Take a photo of your plant leaf
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
              Use one clear leaf photo. Farmer AI will check it and show a possible problem with simple guidance.
            </p>
          </div>

          {scanError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
              {scanError}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <label htmlFor="plant-select" className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Scan registered plant
            </label>
            <select
              id="plant-select"
              value={selectedPlantId}
              onChange={(event) => setSelectedPlantId(event.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="">Choose a plant to track its history</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.crop_name} - {plant.field_name}
                </option>
              ))}
            </select>
            {selectedPlantId && onOpenPlantDetails && (
              <button
                type="button"
                onClick={() => onOpenPlantDetails(Number(selectedPlantId))}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 underline underline-offset-2"
              >
                View this plant's health history
              </button>
            )}
          </div>

          {/* Mobile-First Action Card */}
          <div className="bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6">
            
            {/* Visual Guide Illustration */}
            <div className="relative mx-auto w-32 h-32 sm:w-40 sm:h-40 rounded-3xl bg-gradient-to-tr from-emerald-500/10 via-emerald-500/20 to-green-500/10 border-2 border-dashed border-emerald-400/50 flex flex-col items-center justify-center p-4">
              <Leaf className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mt-2">
                Leaf in Focus
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Quick Farmer Tip
              </p>
              <ul className="mx-auto max-w-xs space-y-1 text-left text-xs text-slate-600 dark:text-slate-300">
                <li>Use a clear, well-lit photo</li>
                <li>Keep one affected leaf in the frame</li>
                <li>Avoid dark or blurry images</li>
              </ul>
            </div>

            {/* Buttons: Take Photo & Upload Photo */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full min-h-[58px] bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-3 transition-all cursor-pointer"
              >
                <Camera className="w-6 h-6" />
                <span>Take Photo</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[54px] bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 active:scale-[0.98] border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-base rounded-2xl flex items-center justify-center gap-3 transition-all cursor-pointer"
              >
                <Upload className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <span>Choose from Gallery</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          STEP 2: IMAGE PREVIEW
          ======================================================================= */}
      {step === 2 && previewUrl && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Check Your Photo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Make sure the leaf and any spots are clear before analyzing.
            </p>
          </div>

          {scanError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
              {scanError}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <label htmlFor="preview-plant-select" className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Save scan to plant
            </label>
            <select
              id="preview-plant-select"
              value={selectedPlantId}
              onChange={(event) => {
                setSelectedPlantId(event.target.value);
                setScanError('');
              }}
              className="mt-2 w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Choose a plant to continue</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.crop_name} - {plant.field_name}
                </option>
              ))}
            </select>
            {!plants.length && (
              <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                Register a plant on the dashboard before saving a scan.
              </p>
            )}
          </div>

          {/* Photo Preview Container */}
          <div className="bg-slate-900 rounded-3xl overflow-hidden border-2 border-emerald-500/40 p-2 shadow-2xl flex items-center justify-center">
            <img 
              src={previewUrl} 
              alt="Leaf Preview" 
              className="w-full max-h-[360px] sm:max-h-[420px] object-contain rounded-2xl"
            />
          </div>

          {/* Buttons: Analyze Plant & Retake */}
          <div className="space-y-3 pt-1">
            <button
              onClick={handleAnalyze}
              disabled={!selectedPlantId}
              className="w-full min-h-[58px] bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-emerald-950/25 flex items-center justify-center gap-3 transition-all cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>Analyze Plant</span>
              <ArrowRight className="w-5 h-5 ml-1" />
            </button>

            <button
              onClick={handleRetake}
              className="w-full min-h-[50px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake</span>
            </button>
          </div>
        </div>
      )}

      {/* =======================================================================
          STEP 3: LOADING STATE
          ======================================================================= */}
      {step === 3 && (
        <div className="py-12 px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-center space-y-6 animate-fade-in">
          {/* Animated Scanning Circle */}
          <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping opacity-75"></div>
            <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Analyzing your plant...
            </h2>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              AI is checking the leaf for possible problems.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              Calculating chlorophyll density, lesions, and necrosis patterns.
            </p>
          </div>
        </div>
      )}

      {/* =======================================================================
          STEP 4: RESULT CARD (OR LOW CONFIDENCE WARNING)
          ======================================================================= */}
      {step === 4 && analysisResult && (
        <div className="space-y-6 animate-fade-in">
          
          {isLowConfidence ? (
            /* ================= LOW CONFIDENCE WARNING ================= */
            <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-7 h-7 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider bg-amber-200/60 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full">
                    ⚠️ Low confidence
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    Please upload a clearer image.
                  </h3>
                  {analysisResult.confidence !== undefined && (
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 pt-1">
                      Model Confidence: <span className="text-amber-700 dark:text-amber-400 font-extrabold">{analysisResult.confidence}%</span> (Below reliable 60% threshold)
                    </p>
                  )}
                </div>
              </div>

              {previewUrl && (
                <div className="rounded-2xl overflow-hidden max-h-44 bg-slate-900 flex items-center justify-center p-1">
                  <img src={previewUrl} alt="Uploaded Leaf" className="max-h-40 w-auto object-contain rounded-xl opacity-80" />
                </div>
              )}

              <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl p-4 border border-amber-200 dark:border-amber-900/60 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  💡 Tips for a reliable result:
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
                  <li>Hold the camera steady close to the leaf</li>
                  <li>Ensure good daylight with no heavy shadows</li>
                  <li>Make sure the leaf fills most of the frame</li>
                </ul>
              </div>

              {/* [Scan Again] Button */}
              <button
                onClick={handleScanAgain}
                className="w-full min-h-[54px] bg-amber-600 hover:bg-amber-500 text-white font-black text-base rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Scan Again</span>
              </button>
            </div>
          ) : (
            /* ================= CONFIDENT DIAGNOSIS RESULT ================= */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              
              {/* Top Overview: Plant & Detected Problem */}
              <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/40 dark:to-slate-850 border-2 border-emerald-500/30 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4 border-b border-emerald-200/60 dark:border-emerald-900/60 pb-4">
                  
                  {/* Plant: */}
                  <div>
                    <span className="text-[11px] font-extrabold uppercase text-slate-400 dark:text-slate-400 tracking-wider block">
                      Plant:
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      {analysisResult.crop || 'Unknown crop'}
                    </span>
                  </div>

                  {/* Confidence: */}
                  <div className="text-right">
                    <span className="text-[11px] font-extrabold uppercase text-slate-400 dark:text-slate-400 tracking-wider block">
                      Confidence:
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-black text-xl sm:text-2xl">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 inline" />
                      {analysisResult.confidence}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  {/* Detected Problem: */}
                  <div>
                    <span className="text-[11px] font-extrabold uppercase text-slate-400 dark:text-slate-400 tracking-wider block">
                      Detected Problem:
                    </span>
                    <span className="text-lg sm:text-xl font-black text-emerald-900 dark:text-emerald-200 leading-tight block mt-0.5">
                      {analysisResult.detected || analysisResult.disease || 'No diagnosis returned'}
                    </span>
                  </div>

                  {/* Severity: */}
                  <div className="sm:text-right">
                    <span className="text-[11px] font-extrabold uppercase text-slate-400 dark:text-slate-400 tracking-wider block">
                      Severity level:
                    </span>
                    <span className={`inline-flex items-center text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mt-1 ${
                      analysisResult.severity_level === 'High' || analysisResult.risk === 'Critical' || analysisResult.severity?.includes('Critical')
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300'
                        : analysisResult.severity_level === 'Medium' || analysisResult.risk === 'High' || analysisResult.severity?.includes('Severe')
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300'
                    }`}>
                      {analysisResult.severity_level || 'Medium'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Thumbnail preview if available */}
              {previewUrl && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-400">Uploaded leaf image</h4>
                  <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700 p-2">
                    <img src={previewUrl} alt="Uploaded leaf used for diagnosis" className="w-full max-h-72 object-contain rounded-xl" />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-black text-sky-900 dark:text-sky-200">
                  <Info className="w-4 h-4" />
                  ML prediction
                </div>
                <p className="text-sm text-sky-900/80 dark:text-sky-100/80">
                  Disease name and confidence were returned by <span className="font-bold">{analysisResult.prediction_source || 'the trained disease model'}</span>.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-400">What this means</h4>
                <p className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 p-4 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {analysisResult.explanation || 'The structured disease information dataset does not contain an explanation for this result.'}
                </p>
              </div>

              {/* Symptoms: */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-500" /> Symptoms:
                </h4>
                <ul className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60 space-y-2 text-sm text-slate-800 dark:text-slate-200">
                  {getSymptomsList(analysisResult).map((sym, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                      <span>{sym}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Action: */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Recommended Action:
                </h4>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Guidance source: {analysisResult.guidance_source || 'Structured disease information dataset'}
                </p>
                <ol className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-4 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5 text-sm text-slate-900 dark:text-slate-100">
                  {getActionsList(analysisResult).map((act, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        {idx + 1}
                      </span>
                      <span className="font-medium leading-relaxed">{act}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Prevention: */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Prevention:
                </h4>
                <ul className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  {getPreventionList(analysisResult).map((prev, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">•</span>
                      <span>{prev}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                This is an AI-based prediction. For serious cases, consult a local agricultural expert.
              </div>

              {/* Action Button: [Scan Again] */}
              <div className="pt-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={handleScanAgain} className="w-full min-h-[58px] bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"><RotateCcw className="w-5 h-5" /><span>Scan Another Plant</span></button>
                  {selectedPlantId && onOpenPlantDetails && <button onClick={() => onOpenPlantDetails(Number(selectedPlantId))} className="w-full min-h-[58px] border-2 border-emerald-200 bg-emerald-50 text-emerald-800 font-extrabold text-base rounded-2xl flex items-center justify-center gap-2.5 transition-all hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><Leaf className="w-5 h-5" /><span>View Plant History</span></button>}
                  {onAskAI && <button onClick={onAskAI} className="w-full min-h-[58px] border-2 border-emerald-200 bg-emerald-50 text-emerald-800 font-extrabold text-base rounded-2xl flex items-center justify-center gap-2.5 transition-all hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><Bot className="w-5 h-5" /><span>Ask Farmer AI</span></button>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
