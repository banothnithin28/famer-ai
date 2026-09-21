import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Upload, CheckCircle2, AlertTriangle, RotateCcw,
  Sparkles, Leaf, ShieldCheck, Activity, ArrowRight,
  Info, Loader2, Bot, ChevronRight,
} from 'lucide-react';
import { detectDiseaseFromAPI } from '../services/geminiService';
import { getPlants } from '../services/apiService';

/* ─── All existing logic helpers (unchanged) ─── */

const getSymptomsList = (res) => {
  if (!res) return [];
  if (Array.isArray(res.symptoms) && res.symptoms.length > 0) return res.symptoms;
  if (typeof res.symptoms === 'string' && res.symptoms.trim()) {
    const items = res.symptoms.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 3);
    if (items.length > 0) return items;
    return [res.symptoms.trim()];
  }
  return ['No symptom details were returned by the model.'];
};

const getActionsList = (res) => {
  if (!res) return [];
  if (Array.isArray(res.suggestions) && res.suggestions.length > 0) return res.suggestions;
  if (typeof res.recommended_action === 'string' && res.recommended_action.trim()) {
    const parts = res.recommended_action.split(/\.\s+/).map(s => s.trim().replace(/\.$/, '')).filter(s => s.length > 3);
    if (parts.length > 1) return parts;
    return [res.recommended_action.trim()];
  }
  return ['No treatment guidance was returned by the model.'];
};

const getPreventionList = (res) => {
  if (!res) return [];
  if (Array.isArray(res.prevention) && res.prevention.length > 0) return res.prevention;
  return ['No prevention guidance was returned by the model.'];
};

/* ─── Step indicator ─── */
function StepDots({ step }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.5rem' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          height: 5, borderRadius: 3,
          width: step === i ? 28 : 10,
          background: step >= i ? 'var(--primary)' : 'var(--border)',
          transition: 'all 300ms',
        }} />
      ))}
    </div>
  );
}

export default function DiseaseScanner({ plantId, onAskAI, onOpenPlantDetails }) {
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];

  const [step, setStep]                   = useState(1);
  const [selectedFile, setSelectedFile]   = useState(null);
  const [previewUrl, setPreviewUrl]       = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [scanError, setScanError]         = useState('');
  const [plants, setPlants]               = useState([]);
  const [selectedPlantId, setSelectedPlantId] = useState(plantId || '');

  const cameraInputRef = useRef(null);
  const fileInputRef   = useRef(null);

  useEffect(() => {
    setSelectedPlantId(plantId || '');
    getPlants().then(res => { if (res?.success) setPlants(res.plants || []); }).catch(() => {});
  }, [plantId]);

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
    e.target.value = '';
  };

  const handleRetake = () => {
    setSelectedFile(null); setPreviewUrl(null);
    setAnalysisResult(null); setScanError('');
    setStep(1);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setStep(3);
    try {
      const result = await detectDiseaseFromAPI(selectedFile, selectedPlantId || null);
      setAnalysisResult(result);
      setStep(4);
    } catch (err) {
      setScanError(err.message || 'Unable to analyze this image. Please try again.');
      setAnalysisResult(null);
      setStep(1);
    }
  };

  const handleScanAgain = () => {
    setSelectedFile(null); setPreviewUrl(null);
    setAnalysisResult(null); setScanError('');
    setStep(1);
  };

  const isLowConfidence = analysisResult && (
    analysisResult.reliable === false ||
    analysisResult.low_confidence === true ||
    (analysisResult.confidence !== undefined && analysisResult.confidence < 60)
  );

  /* ─── Severity helpers ─── */
  const getSeverityStyle = (r) => {
    const s = (r?.severity_level || r?.risk || r?.severity || '').toLowerCase();
    if (s.includes('critical') || s.includes('high') || s.includes('severe'))
      return { bg: 'var(--danger-bg)', color: 'var(--danger-text)', label: 'High' };
    if (s.includes('moderate') || s.includes('medium'))
      return { bg: 'var(--warning-bg)', color: 'var(--warning-text)', label: 'Medium' };
    return { bg: 'var(--success-bg)', color: 'var(--success-text)', label: 'Low' };
  };

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }} className="animate-fade-in">
      {/* Hidden inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFilePicked} style={{ display: 'none' }} />
      <input ref={fileInputRef}   type="file" accept="image/*" onChange={handleFilePicked} style={{ display: 'none' }} />

      <StepDots step={step} />

      {/* ═══════════════ STEP 1: UPLOAD ═══════════════ */}
      {step === 1 && (
        <div className="animate-fade-in">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div className="kicker" style={{ marginBottom: '0.5rem' }}>Plant Scanner</div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
              Check Your Plant
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>
              Take a clear photo of your plant's leaves.<br />
              Farmer AI will check for possible problems.
            </p>
          </div>

          {/* Error */}
          {scanError && (
            <div className="alert alert-danger" style={{ marginBottom: '1rem' }} role="alert">
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              {scanError}
            </div>
          )}

          {/* Plant selector */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="plant-select-step1">Save scan to plant</label>
            <select
              id="plant-select-step1"
              value={selectedPlantId}
              onChange={e => setSelectedPlantId(e.target.value)}
              className="form-input"
            >
              <option value="">Choose a plant to track its history</option>
              {plants.map(p => (
                <option key={p.id} value={p.id}>{p.crop_name} — {p.field_name}</option>
              ))}
            </select>
            {selectedPlantId && onOpenPlantDetails && (
              <button
                type="button"
                onClick={() => onOpenPlantDetails(Number(selectedPlantId))}
                style={{ marginTop: '0.5rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                View health history <ChevronRight size={12} />
              </button>
            )}
          </div>

          {/* Upload zone */}
          <div className="upload-zone" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', lineHeight: 1 }}>🍃</div>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Upload a leaf photo
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '1.5rem' }}>
              Use a clear, well-lit photo • Keep the leaf in focus<br />
              JPEG, PNG, WEBP — max 10 MB
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => cameraInputRef.current?.click()}
                id="take-photo-btn"
              >
                <Camera size={18} />
                Take Photo
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                id="upload-photo-btn"
              >
                <Upload size={16} />
                Upload Photo
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              📸 Tips for best results
            </div>
            {['Use natural daylight, avoid heavy shadows', 'Focus on one affected leaf', 'Make the leaf fill most of the frame'].map(tip => (
              <div key={tip} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.25rem 0' }}>
                <span style={{ color: 'var(--success)', fontWeight: 800 }}>✓</span>
                {tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 2: PREVIEW ═══════════════ */}
      {step === 2 && previewUrl && (
        <div className="animate-fade-in">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Check Your Photo
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
              Make sure the leaf is clear before analyzing.
            </p>
          </div>

          {scanError && (
            <div className="alert alert-danger" style={{ marginBottom: '1rem' }} role="alert">
              <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {scanError}
            </div>
          )}

          {/* Plant picker */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="plant-select-step2">Save scan to plant</label>
            <select
              id="plant-select-step2"
              value={selectedPlantId}
              onChange={e => { setSelectedPlantId(e.target.value); setScanError(''); }}
              className="form-input"
            >
              <option value="">Choose a plant to continue</option>
              {plants.map(p => (
                <option key={p.id} value={p.id}>{p.crop_name} — {p.field_name}</option>
              ))}
            </select>
            {!plants.length && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--warning-text)', fontWeight: 600 }}>
                Register a plant first to save this scan to its history.
              </p>
            )}
          </div>

          {/* Image preview */}
          <div style={{
            background: '#0D1711', borderRadius: 'var(--radius-xl)',
            overflow: 'hidden', marginBottom: '1rem',
            border: '2px solid color-mix(in srgb, var(--primary) 30%, transparent)',
          }}>
            <img src={previewUrl} alt="Leaf preview" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', display: 'block' }} />
          </div>

          {/* Buttons */}
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleAnalyze}
              disabled={!selectedPlantId}
              id="analyze-btn"
              style={{ width: '100%' }}
            >
              <Sparkles size={18} />
              Analyze Plant
              <ArrowRight size={16} />
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleRetake}
              id="retake-btn"
              style={{ width: '100%' }}
            >
              <RotateCcw size={16} />
              Retake Photo
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 3: LOADING ═══════════════ */}
      {step === 3 && (
        <div className="card animate-fade-in" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 1.5rem' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid color-mix(in srgb, var(--primary) 20%, transparent)',
              animation: 'ping 1.5s ease-out infinite',
            }} />
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--success-bg)',
              border: '2px solid var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Loader2 size={32} style={{ color: 'var(--primary)', animation: 'spin-slow 1s linear infinite' }} />
            </div>
          </div>
          <style>{`@keyframes ping { 0%{transform:scale(1);opacity:.7} 75%,100%{transform:scale(1.3);opacity:0} }`}</style>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>Analyzing your plant…</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.5rem' }}>
            AI is checking the leaf for possible problems.
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Scanning chlorophyll patterns, lesions, necrosis…
          </p>
        </div>
      )}

      {/* ═══════════════ STEP 4: RESULT ═══════════════ */}
      {step === 4 && analysisResult && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {isLowConfidence ? (
            /* ── Low Confidence ── */
            <div className="card" style={{
              padding: '1.75rem', border: '2px solid color-mix(in srgb, var(--warning) 40%, transparent)',
              background: 'var(--warning-bg)',
            }}>
              <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'color-mix(in srgb, var(--warning) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={22} style={{ color: 'var(--warning)' }} />
                </div>
                <div>
                  <span className="badge badge-attention">⚠️ Low Confidence</span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
                    Please upload a clearer image
                  </h3>
                  {analysisResult.confidence !== undefined && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Confidence: <strong style={{ color: 'var(--warning)' }}>{analysisResult.confidence}%</strong> — below the 60% reliable threshold
                    </p>
                  )}
                </div>
              </div>

              {previewUrl && (
                <div style={{ borderRadius: 12, overflow: 'hidden', maxHeight: 180, background: '#0D1711', marginBottom: '1rem' }}>
                  <img src={previewUrl} alt="Uploaded leaf" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', opacity: 0.8 }} />
                </div>
              )}

              <div className="card" style={{ padding: '0.875rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>💡 Tips for better results:</div>
                {['Hold camera steady, close to the leaf', 'Use good daylight with no heavy shadows', 'Make the leaf fill most of the frame'].map(tip => (
                  <div key={tip} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.2rem 0', display: 'flex', gap: '0.4rem' }}>
                    <span style={{ color: 'var(--primary)' }}>•</span> {tip}
                  </div>
                ))}
              </div>

              <button className="btn btn-primary" onClick={handleScanAgain} style={{ width: '100%' }} id="retry-scan-btn">
                <RotateCcw size={16} /> Scan Again
              </button>
            </div>
          ) : (
            /* ── Full Result ── */
            <>
              {/* Summary Header */}
              <div className="card" style={{
                padding: '1.5rem',
                background: 'var(--success-bg)',
                border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid color-mix(in srgb, var(--border) 60%, transparent)' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Plant</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)' }}>{analysisResult.crop || 'Unknown crop'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Confidence</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle2 size={18} /> {analysisResult.confidence}%
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Detected</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {analysisResult.detected || analysisResult.disease || 'No diagnosis returned'}
                    </div>
                  </div>
                  {(() => { const sv = getSeverityStyle(analysisResult); return (
                    <span style={{ background: sv.bg, color: sv.color, padding: '0.3rem 0.75rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {sv.label}
                    </span>
                  );})()}
                </div>
              </div>

              {/* Preview thumbnail */}
              {previewUrl && (
                <div className="card" style={{ padding: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>UPLOADED LEAF</div>
                  <img src={previewUrl} alt="Uploaded leaf" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12 }} />
                </div>
              )}

              {/* AI note */}
              <div className="card" style={{ padding: '0.875rem', background: 'var(--info-bg)', border: '1px solid color-mix(in srgb, var(--info) 20%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.82rem', color: 'var(--info)', marginBottom: '0.375rem' }}>
                  <Info size={14} /> ML Prediction
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  Results from <strong>{analysisResult.prediction_source || 'trained disease model'}</strong>. This is a possible AI prediction, not a confirmed diagnosis.
                </p>
              </div>

              {/* Explanation */}
              {analysisResult.explanation && (
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>What this means</div>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>{analysisResult.explanation}</p>
                </div>
              )}

              {/* Symptoms */}
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  <Activity size={14} style={{ color: 'var(--primary)' }} /> Symptoms
                </div>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {getSymptomsList(analysisResult).map((s, i) => (
                    <li key={i} style={{ display: 'flex', gap: '0.625rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Actions */}
              <div className="card" style={{ padding: '1rem', background: 'var(--success-bg)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '0.75rem' }}>
                  <CheckCircle2 size={14} /> Recommended Actions
                </div>
                {analysisResult.guidance_source && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Source: {analysisResult.guidance_source}
                  </p>
                )}
                <ol style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {getActionsList(analysisResult).map((a, i) => (
                    <li key={i} style={{ display: 'flex', gap: '0.625rem', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      {a}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Prevention */}
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  <ShieldCheck size={14} style={{ color: 'var(--primary)' }} /> Prevention
                </div>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {getPreventionList(analysisResult).map((p, i) => (
                    <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 800, flexShrink: 0 }}>•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="alert alert-warning" style={{ fontSize: '0.8rem' }}>
                <span>⚠️</span>
                This is an AI-based prediction, not a confirmed diagnosis. For serious crop loss, consult a local agricultural expert.
              </div>

              {/* Action buttons */}
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <button className="btn btn-primary btn-lg" onClick={handleScanAgain} id="scan-again-btn" style={{ width: '100%' }}>
                  <RotateCcw size={18} /> Scan Another Plant
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {selectedPlantId && onOpenPlantDetails && (
                    <button className="btn btn-secondary" onClick={() => onOpenPlantDetails(Number(selectedPlantId))} id="view-history-btn">
                      <Leaf size={16} /> Health History
                    </button>
                  )}
                  {onAskAI && (
                    <button className="btn btn-secondary" onClick={() => onAskAI(Number(selectedPlantId))} id="ask-ai-from-scan-btn">
                      <Bot size={16} /> Ask Farmer AI
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
