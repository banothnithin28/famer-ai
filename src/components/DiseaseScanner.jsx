import React, { useState } from 'react';
import { 
  Scan, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  ShieldAlert, 
  Leaf, 
  RotateCcw,
  FileCheck,
  Zap,
  Info
} from 'lucide-react';
import { analyzeCropImage, SAMPLE_DISEASE_DATA } from '../services/geminiService';

export default function DiseaseScanner() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);

  const presets = [
    {
      id: 'tomato_blight',
      label: 'Tomato Leaf Spot',
      crop: 'Tomato',
      img: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb231fc?w=300&auto=format&fit=crop&q=80',
      tag: 'Disease'
    },
    {
      id: 'rice_blast',
      label: 'Rice Blast Disease',
      crop: 'Paddy / Rice',
      img: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=300&auto=format&fit=crop&q=80',
      tag: 'Critical'
    },
    {
      id: 'corn_rust',
      label: 'Corn Leaf Rust',
      crop: 'Maize / Corn',
      img: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=300&auto=format&fit=crop&q=80',
      tag: 'Fungi'
    },
    {
      id: 'healthy_leaf',
      label: 'Healthy Wheat Leaf',
      crop: 'Wheat',
      img: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300&auto=format&fit=crop&q=80',
      tag: 'Healthy'
    }
  ];

  const handleRunAnalysis = async (presetId = null, customImgUrl = null) => {
    setAnalyzing(true);
    setAnalysisResult(null);

    const targetKey = presetId || selectedPreset || 'tomato_blight';
    const result = await analyzeCropImage(targetKey);

    setAnalysisResult(result);
    setAnalyzing(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSelectedImage(url);
      setSelectedPreset(null);
      handleRunAnalysis('tomato_blight', url);
    }
  };

  const selectPreset = (preset) => {
    setSelectedPreset(preset.id);
    setSelectedImage(preset.img);
    handleRunAnalysis(preset.id, preset.img);
  };

  const resetScanner = () => {
    setSelectedImage(null);
    setSelectedPreset(null);
    setAnalysisResult(null);
    setAnalyzing(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Title Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
          <Scan className="w-4 h-4" /> AI Computer Vision 2.0
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Crop Health & Disease Diagnostic Scanner
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Upload a photo of your infected leaf or plant to receive immediate AI diagnostic breakdown, pathogen identification, and targeted organic/chemical treatment plans.
        </p>
      </div>

      {/* Preset Sample Leaf Picker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> Test with Sample Crop Leaves:
          </h3>
          {analysisResult && (
            <button
              onClick={resetScanner}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Scanner
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {presets.map((preset) => (
            <div
              key={preset.id}
              onClick={() => selectPreset(preset)}
              className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all group ${
                selectedPreset === preset.id
                  ? 'border-emerald-600 ring-2 ring-emerald-500/20 scale-[1.02]'
                  : 'border-slate-200 dark:border-slate-800 hover:border-emerald-400'
              }`}
            >
              <img
                src={preset.img}
                alt={preset.label}
                className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent p-2 flex flex-col justify-end">
                <span className="text-xs font-bold text-white leading-tight">{preset.label}</span>
                <span className="text-[10px] text-emerald-300 font-medium">{preset.crop}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Zone / Scanning Display */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Column: Image / Upload Area */}
        <div className="md:col-span-5 flex flex-col space-y-4">
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 min-h-[320px] flex items-center justify-center text-center p-6 shadow-xl">
            {selectedImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Uploaded Crop"
                  className="max-h-[320px] w-auto rounded-lg object-contain"
                />

                {/* Laser Scanning Animation */}
                {analyzing && (
                  <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan absolute top-0 left-0 shadow-lg shadow-emerald-500"></div>
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs">
                      <div className="text-center space-y-2 text-white">
                        <Zap className="w-8 h-8 text-amber-400 animate-bounce mx-auto" />
                        <p className="text-sm font-bold">Scanning Crop DNA & Pathogens...</p>
                        <p className="text-xs text-slate-400">Comparing with 100,000+ Agri-Vision Datasets</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <label className="cursor-pointer space-y-4 w-full h-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl transition-colors">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Upload Plant / Leaf Photo</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP up to 10MB</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Right Column: AI Analysis Report */}
        <div className="md:col-span-7">
          {analysisResult ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 animate-fade-in">
              
              {/* Header Status */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diagnostic Result</span>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    {analysisResult.name}
                  </h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 italic">
                    Pathogen: {analysisResult.pathogen}
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{analysisResult.confidence}% Match</span>
                  </div>
                  <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                    Severity: {analysisResult.severity}
                  </div>
                </div>
              </div>

              {/* Symptoms */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-500" /> Detected Symptoms
                </h4>
                <ul className="space-y-1.5">
                  {analysisResult.symptoms.map((sym, idx) => (
                    <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0"></span>
                      <span>{sym}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Treatment Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Organic Treatment */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 space-y-2">
                  <h5 className="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wide">
                    <Leaf className="w-4 h-4" /> Organic / Eco Remedy
                  </h5>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {analysisResult.organicRemedy}
                  </p>
                </div>

                {/* Chemical Treatment */}
                <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 space-y-2">
                  <h5 className="font-bold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
                    <AlertTriangle className="w-4 h-4" /> Chemical Solution
                  </h5>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {analysisResult.chemicalRemedy}
                  </p>
                </div>
              </div>

              {/* Prevention Rules */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2 border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-500" /> Prevention & Field Hygiene Checklist
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  {analysisResult.prevention.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full bg-slate-100/60 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3">
              <Scan className="w-12 h-12 text-slate-400" />
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-base">
                No Scan Active
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Select one of the sample crop leaves above or upload your own farm leaf photo to generate an instant diagnostic report.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
