import React, { useState, useMemo } from 'react';
import {
  Sprout,
  Calculator,
  BookOpen,
  Landmark,
  CloudSun,
  Droplets,
  Search,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldCheck,
  AlertTriangle,
  FileText,
  MapPin,
  Layers,
  ArrowRight,
  Compass,
  CheckCircle2,
  Calendar,
  HelpCircle,
  Building,
} from 'lucide-react';
import {
  CROPS_DATA,
  FERTILIZER_DATABASE,
  CROP_RDF_PER_ACRE,
  calculateFertilizers,
  GOVT_SCHEMES,
  LOCAL_RURAL_INFO,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_ARTICLES,
} from '../data/farmerToolsData';

const TOOL_TABS = [
  { id: 'advisor', label: 'Crop Advisor', icon: Sprout, emoji: '🌾' },
  { id: 'calculator', label: 'Fertilizer Calculator', icon: Calculator, emoji: '💧' },
  { id: 'fertilizers', label: 'Fertilizer Info', icon: Layers, emoji: '🌱' },
  { id: 'schemes', label: 'Govt Schemes', icon: Landmark, emoji: '🏛️' },
  { id: 'weather', label: 'Weather & Irrigation', icon: CloudSun, emoji: '🌦️' },
  { id: 'knowledge', label: 'Farming Knowledge', icon: BookOpen, emoji: '📚' },
  { id: 'local', label: 'Local Rural Info', icon: Building, emoji: '🏛️' },
];

export default function FarmerTools({ onNavigateTab }) {
  const [activeSubTab, setActiveSubTab] = useState('advisor');

  // ── 1. Crop Advisor State ──
  const [advisorCrop, setAdvisorCrop] = useState('paddy');
  const [advisorRegion, setAdvisorRegion] = useState('Telangana');
  const [advisorSoil, setAdvisorSoil] = useState('Clayey Loam');
  const [advisorSeason, setAdvisorSeason] = useState('Kharif (Monsoon)');
  const [advisorWater, setAdvisorWater] = useState('Borewell / Tube well');

  const cropInfo = CROPS_DATA[advisorCrop] || CROPS_DATA.paddy;

  // ── 2. Fertilizer Calculator State ──
  const [calcCrop, setCalcCrop] = useState('paddy');
  const [calcArea, setCalcArea] = useState('2');
  const [calcUnit, setCalcUnit] = useState('acre');
  const [calcStage, setCalcStage] = useState('all');

  const areaNum = Math.max(0.1, parseFloat(calcArea) || 1);
  const calcResult = useMemo(() => {
    return calculateFertilizers(calcCrop, areaNum, calcUnit, calcStage);
  }, [calcCrop, areaNum, calcUnit, calcStage]);

  // ── 3. Fertilizer Info State ──
  const [selectedFertilizerKey, setSelectedFertilizerKey] = useState('urea');
  const fertDetail = FERTILIZER_DATABASE[selectedFertilizerKey] || FERTILIZER_DATABASE.urea;

  // ── 4. Government Schemes Filter ──
  const [schemeSearch, setSchemeSearch] = useState('');
  const filteredSchemes = useMemo(() => {
    if (!schemeSearch.trim()) return GOVT_SCHEMES;
    const q = schemeSearch.toLowerCase();
    return GOVT_SCHEMES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.purpose.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.benefits.toLowerCase().includes(q)
    );
  }, [schemeSearch]);

  // ── 5. Farming Knowledge State ──
  const [knowledgeCategory, setKnowledgeCategory] = useState('all');
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [expandedArticleId, setExpandedArticleId] = useState(null);

  const filteredArticles = useMemo(() => {
    return KNOWLEDGE_ARTICLES.filter((article) => {
      const matchCat = knowledgeCategory === 'all' || article.category === knowledgeCategory;
      const matchSearch =
        !knowledgeSearch.trim() ||
        article.title.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
        article.summary.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
        article.content.toLowerCase().includes(knowledgeSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [knowledgeCategory, knowledgeSearch]);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: '3.5rem' }}>
      {/* ─── Header ─── */}
      <div
        style={{
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.2rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--success-bg)',
            color: 'var(--primary)',
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.35rem',
          }}
        >
          <span>🧰</span> Agricultural Toolkit
        </div>
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
            fontWeight: 900,
            color: 'var(--text-primary)',
            margin: '0 0 0.35rem 0',
          }}
        >
          Farmer Tools
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.35rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 650 }}>
            Practical advisory, scientific nutrient calculations, verified government assistance, and essential farming knowledge.
          </p>
          <button
            onClick={() => onNavigateTab && onNavigateTab('diary')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.45rem 0.95rem', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--primary)', fontSize: '0.825rem', fontWeight: 800,
              cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
            }}
          >
            <span>📒</span> Farm Diary + Expenses →
          </button>
        </div>
      </div>

      {/* ─── Sub-Tab Navigation Bar (Horizontal Scroll on Mobile) ─── */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          marginBottom: '1.75rem',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        role="tablist"
        aria-label="Farmer Tools Sections"
      >
        {TOOL_TABS.map((tab) => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                background: isActive ? 'var(--success-bg)' : 'var(--surface)',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 160ms ease',
                flexShrink: 0,
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 1: CROP ADVISOR
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'advisor' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Input Controls Card */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Sprout size={20} style={{ color: 'var(--primary)' }} />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Select Crop & Field Parameters
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              {/* Crop Select */}
              <div>
                <label className="form-label" htmlFor="advisor-crop-select">
                  Crop
                </label>
                <select
                  id="advisor-crop-select"
                  className="form-input"
                  value={advisorCrop}
                  onChange={(e) => setAdvisorCrop(e.target.value)}
                >
                  {Object.entries(CROPS_DATA).map(([key, c]) => (
                    <option key={key} value={key}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div>
                <label className="form-label" htmlFor="advisor-region-select">
                  Region / State
                </label>
                <select
                  id="advisor-region-select"
                  className="form-input"
                  value={advisorRegion}
                  onChange={(e) => setAdvisorRegion(e.target.value)}
                >
                  <option value="Telangana">Telangana (Deccan Plateau)</option>
                  <option value="Andhra Pradesh">Andhra Pradesh (Coastal & Rayalaseema)</option>
                  <option value="Karnataka">Karnataka (Southern Peninsular)</option>
                  <option value="Maharashtra">Maharashtra (Black Soil Belt)</option>
                  <option value="Punjab & Haryana">Punjab & Haryana (North Plains)</option>
                  <option value="UP & Bihar">UP & Bihar (Gangetic Basin)</option>
                  <option value="Tamil Nadu">Tamil Nadu (Southern Coast)</option>
                  <option value="Gujarat">Gujarat (Semi-arid Zone)</option>
                </select>
              </div>

              {/* Soil Type */}
              <div>
                <label className="form-label" htmlFor="advisor-soil-select">
                  Soil Type
                </label>
                <select
                  id="advisor-soil-select"
                  className="form-input"
                  value={advisorSoil}
                  onChange={(e) => setAdvisorSoil(e.target.value)}
                >
                  <option value="Clayey Loam">Clayey Loam</option>
                  <option value="Deep Black Soil">Deep Black Cotton Soil (Regur)</option>
                  <option value="Red Sandy Loam">Red Sandy Loam (Chaluka)</option>
                  <option value="Alluvial Soil">Alluvial Soil</option>
                  <option value="Sandy Soil">Light Sandy Soil</option>
                  <option value="Laterite Soil">Laterite Soil</option>
                </select>
              </div>

              {/* Season */}
              <div>
                <label className="form-label" htmlFor="advisor-season-select">
                  Season
                </label>
                <select
                  id="advisor-season-select"
                  className="form-input"
                  value={advisorSeason}
                  onChange={(e) => setAdvisorSeason(e.target.value)}
                >
                  <option value="Kharif (Monsoon)">Kharif (Monsoon, June – Oct)</option>
                  <option value="Rabi (Winter)">Rabi (Winter, Oct – Feb)</option>
                  <option value="Zaid / Summer">Zaid / Summer (Feb – May)</option>
                </select>
              </div>

              {/* Water Source */}
              <div>
                <label className="form-label" htmlFor="advisor-water-select">
                  Water Source
                </label>
                <select
                  id="advisor-water-select"
                  className="form-input"
                  value={advisorWater}
                  onChange={(e) => setAdvisorWater(e.target.value)}
                >
                  <option value="Borewell / Tube well">Borewell / Tube well</option>
                  <option value="Canal Irrigation">Canal Irrigation</option>
                  <option value="Rainfed (No assured water)">Rainfed (Dryland / Monsoonal)</option>
                  <option value="Drip / Micro-irrigation">Drip / Micro-irrigation</option>
                  <option value="Farm Pond / Tank">Farm Pond / Open Well / Tank</option>
                </select>
              </div>
            </div>
          </div>

          {/* Crop Profile Header Banner */}
          <div
            className="card"
            style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, var(--surface)) 0%, var(--surface) 100%)',
              border: '1.5px solid color-mix(in srgb, var(--primary) 30%, var(--border))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div
                style={{
                  fontSize: '2.5rem',
                  width: 60,
                  height: 60,
                  borderRadius: 16,
                  background: 'var(--surface-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {cropInfo.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.06em' }}>
                  Scientific Agronomic Profile
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                  {cropInfo.name} <span style={{ fontSize: '0.9rem', fontStyle: 'italic', fontWeight: 500, color: 'var(--text-muted)' }}>({cropInfo.scientificName})</span>
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>🌡️ Temp: <strong>{cropInfo.tempRange}</strong></span>
                  <span>🧪 Soil pH: <strong>{cropInfo.soilPh}</strong></span>
                  <span>💧 Need: <strong>{cropInfo.waterRequirement.split('(')[0]}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Growth Stages Timeline */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
              📅 Growth Stages & Physiological Needs
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cropInfo.growthStages.map((st, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-secondary)',
                    borderLeft: '4px solid var(--primary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {idx + 1}. {st.stage}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--success-bg)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}>
                      {st.duration}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {st.guidance}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pest & Disease Defense Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Common Pests */}
            <div className="card" style={{ padding: '1.25rem', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🐛</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Common Insect Pests
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cropInfo.commonPests.map((p, idx) => (
                  <div key={idx} style={{ borderBottom: idx < cropInfo.commonPests.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '0.65rem' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--danger)', margin: '0 0 0.2rem 0' }}>
                      {p.name}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem 0' }}>
                      <strong>Signs:</strong> {p.signs}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                      <strong>Control:</strong> {p.management}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Common Diseases */}
            <div className="card" style={{ padding: '1.25rem', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🦠</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Common Plant Diseases
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cropInfo.commonDiseases.map((d, idx) => (
                  <div key={idx} style={{ borderBottom: idx < cropInfo.commonDiseases.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '0.65rem' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--warning-text)', margin: '0 0 0.2rem 0' }}>
                      {d.name}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem 0' }}>
                      <strong>Signs:</strong> {d.signs}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                      <strong>Control:</strong> {d.management}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fertilizer Guidance & Precautions */}
          <div className="card" style={{ padding: '1.25rem', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              🌾 Nutrient Guidance & Field Precautions
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
              <strong>Nutrient Strategy:</strong> {cropInfo.fertilizerGuidance}
            </p>
            <div
              style={{
                background: 'var(--warning-bg)',
                border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                fontSize: '0.825rem',
                color: 'var(--warning-text)',
                lineHeight: 1.5,
              }}
            >
              <strong>⚠️ Field Precautions:</strong> {cropInfo.precautions}
            </div>
          </div>

          {/* Academic / Scientific Disclaimer */}
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Disclaimer: Advisory guidelines are compiled from ICAR and State Agricultural University agronomic recommendations. Field conditions, soil tests, and local weather variability should always be evaluated. No specific yield is guaranteed.
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 2: FERTILIZER CALCULATOR
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'calculator' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Inputs Card */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Calculator size={20} style={{ color: 'var(--primary)' }} />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Field Nutrient & Bag Requirement Calculator
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: '1rem',
              }}
            >
              {/* Crop selection */}
              <div>
                <label className="form-label" htmlFor="calc-crop-select">
                  Crop
                </label>
                <select
                  id="calc-crop-select"
                  className="form-input"
                  value={calcCrop}
                  onChange={(e) => setCalcCrop(e.target.value)}
                >
                  {Object.entries(CROP_RDF_PER_ACRE).map(([k, c]) => (
                    <option key={k} value={k}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field Area */}
              <div>
                <label className="form-label" htmlFor="calc-area-input">
                  Field Area Size
                </label>
                <input
                  id="calc-area-input"
                  type="number"
                  min="0.1"
                  step="0.5"
                  className="form-input"
                  value={calcArea}
                  onChange={(e) => setCalcArea(e.target.value)}
                  placeholder="e.g. 2"
                />
              </div>

              {/* Area Unit */}
              <div>
                <label className="form-label" htmlFor="calc-unit-select">
                  Unit of Area
                </label>
                <select
                  id="calc-unit-select"
                  className="form-input"
                  value={calcUnit}
                  onChange={(e) => setCalcUnit(e.target.value)}
                >
                  <option value="acre">Acre (acres)</option>
                  <option value="hectare">Hectare (1 ha = 2.47 acres)</option>
                </select>
              </div>

              {/* Growth stage */}
              <div>
                <label className="form-label" htmlFor="calc-stage-select">
                  Application Scope
                </label>
                <select
                  id="calc-stage-select"
                  className="form-input"
                  value={calcStage}
                  onChange={(e) => setCalcStage(e.target.value)}
                >
                  <option value="all">Full Season (All Split Doses)</option>
                  <option value="basal">Basal Dressing (At Sowing)</option>
                  <option value="vegetative">Vegetative / Tillering Top-Dress</option>
                  <option value="panicle">Panicle / Flowering Top-Dress</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Summary Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* DAP Card */}
            <div
              className="card"
              style={{
                padding: '1.25rem',
                background: 'var(--surface)',
                borderTop: '4px solid #D97706',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Phosphorus & Starter N
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'var(--warning-bg)', color: 'var(--warning-text)', padding: '0.15rem 0.5rem', borderRadius: 6 }}>
                  50 kg Bag
                </span>
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                DAP (18-46-0)
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>
                  {calcResult.recommendations.dap.kg}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  kg ({calcResult.recommendations.dap.bags} bags)
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                <strong>Timing:</strong> {calcResult.recommendations.dap.timing}
              </p>
            </div>

            {/* Urea Card */}
            <div
              className="card"
              style={{
                padding: '1.25rem',
                background: 'var(--surface)',
                borderTop: '4px solid #0284C7',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Primary Nitrogen
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'var(--info-bg)', color: 'var(--info-text)', padding: '0.15rem 0.5rem', borderRadius: 6 }}>
                  45 kg Bag
                </span>
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                Urea (46% N)
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>
                  {calcResult.recommendations.urea.kg}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  kg ({calcResult.recommendations.urea.bags} bags)
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                <strong>Timing:</strong> {calcResult.recommendations.urea.timing}
              </p>
            </div>

            {/* MOP Card */}
            <div
              className="card"
              style={{
                padding: '1.25rem',
                background: 'var(--surface)',
                borderTop: '4px solid #10B981',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Potassium / Potash
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'var(--success-bg)', color: 'var(--success-text)', padding: '0.15rem 0.5rem', borderRadius: 6 }}>
                  50 kg Bag
                </span>
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                MOP (60% K2O)
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>
                  {calcResult.recommendations.mop.kg}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  kg ({calcResult.recommendations.mop.bags} bags)
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                <strong>Timing:</strong> {calcResult.recommendations.mop.timing}
              </p>
            </div>
          </div>

          {/* Scientific Calculation Breakdown */}
          <div className="card" style={{ padding: '1.25rem', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.65rem 0' }}>
              🧮 Agronomic Nutrient Balance Breakdown
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                fontSize: '0.825rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ background: 'var(--surface-secondary)', padding: '0.65rem', borderRadius: 8 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total Pure Nitrogen (N)</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{calcResult.pureNutrientsKg.N} kg</div>
              </div>
              <div style={{ background: 'var(--surface-secondary)', padding: '0.65rem', borderRadius: 8 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total Pure Phosphate (P2O5)</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{calcResult.pureNutrientsKg.P} kg</div>
              </div>
              <div style={{ background: 'var(--surface-secondary)', padding: '0.65rem', borderRadius: 8 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total Pure Potash (K2O)</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{calcResult.pureNutrientsKg.K} kg</div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.5rem 0' }}>
              Documented Assumptions & Calculation Rules:
            </h4>
            <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {calcResult.assumptions.map((asmp, i) => (
                <li key={i}>{asmp}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 3: FERTILIZER INFORMATION
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'fertilizers' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Fertilizer Chips Selector */}
          <div className="card" style={{ padding: '1.25rem', background: 'var(--surface)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Select Fertilizer to Learn More:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {Object.entries(FERTILIZER_DATABASE).map(([k, f]) => {
                const isSelected = selectedFertilizerKey === k;
                return (
                  <button
                    key={k}
                    onClick={() => setSelectedFertilizerKey(k)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--success-bg)' : 'var(--surface-secondary)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.825rem',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Fertilizer Deep-Dive Card */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>
                  Chemical Profile: {fertDetail.formula}
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                  {fertDetail.name}
                </h2>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Main Nutrients: <strong>{fertDetail.mainNutrients}</strong>
                </div>
              </div>
              <span style={{ background: 'var(--surface-secondary)', padding: '0.35rem 0.75rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700 }}>
                Standard Bag: {fertDetail.bagWeightKg} kg
              </span>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              {fertDetail.description}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
              }}
            >
              <div style={{ background: 'var(--surface-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                  🎯 General Purpose
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {fertDetail.purpose}
                </p>
              </div>

              <div style={{ background: 'var(--surface-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                  ⏱️ Common Agricultural Use & Timing
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {fertDetail.usageTiming}
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: '1.25rem',
                background: 'var(--warning-bg)',
                border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                fontSize: '0.825rem',
                color: 'var(--warning-text)',
                lineHeight: 1.55,
              }}
            >
              <strong>⚠️ Essential Farmer Precautions:</strong> {fertDetail.precautions}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 4: GOVERNMENT SCHEMES
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'schemes' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Important Verification Notice */}
          <div
            className="card"
            style={{
              padding: '1rem 1.25rem',
              background: 'var(--info-bg)',
              border: '1.5px solid color-mix(in srgb, var(--info) 30%, var(--border))',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <Info size={20} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.825rem', color: 'var(--info-text)', lineHeight: 1.55 }}>
              <strong>Official Verification Notice:</strong> Government schemes, eligibility thresholds, and application portals are subject to periodic state and central government updates. Please verify current eligibility and guidelines directly on the official government portals linked below or at your nearest Rythu Vedika / Common Service Centre (CSC).
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search scheme name, benefits, or purpose (e.g. insurance, subsidy, credit)..."
              value={schemeSearch}
              onChange={(e) => setSchemeSearch(e.target.value)}
            />
          </div>

          {/* Schemes List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredSchemes.map((scheme) => (
              <div
                key={scheme.id}
                className="card"
                style={{
                  padding: '1.4rem',
                  background: 'var(--surface)',
                  borderLeft: '4px solid var(--primary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.04em' }}>
                      {scheme.category} • Verified {scheme.verifiedDate}
                    </span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      {scheme.name}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Authority: {scheme.authority}
                    </div>
                  </div>

                  <a
                    href={scheme.officialPortal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                  >
                    <span>{scheme.portalLabel}</span>
                    <ExternalLink size={13} />
                  </a>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                  <strong>Purpose:</strong> {scheme.purpose}
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '0.75rem',
                    background: 'var(--surface-secondary)',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>✨ Key Benefits:</strong>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{scheme.benefits}</div>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>👤 Who May Be Eligible:</strong>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{scheme.eligibility}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>📝 How to Apply:</strong>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{scheme.applicationProcess}</div>
                  </div>
                </div>
              </div>
            ))}

            {filteredSchemes.length === 0 && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Landmark size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p>No government schemes matched your search.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 5: DETAILED WEATHER & SMART IRRIGATION
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'weather' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            className="card"
            style={{
              padding: '2rem',
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--info) 12%, var(--surface)) 0%, var(--surface) 100%)',
              border: '1.5px solid color-mix(in srgb, var(--info) 35%, var(--border))',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--info-bg)',
                color: 'var(--info)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <CloudSun size={28} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              Microclimate Intelligence & Smart Irrigation
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
              Live telemetry, real precipitation probabilities, 5-day agro-meteorological forecasts, and scientific irrigation timing are integrated in your dedicated Weather portal.
            </p>
            <div>
              <button
                onClick={() => onNavigateTab && onNavigateTab('weather')}
                className="btn btn-primary btn-lg"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800 }}
              >
                <span>Open Detailed Weather & Irrigation</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {/* Quick Guide Card */}
          <div className="card" style={{ padding: '1.25rem', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              💧 Principles of Weather-Based Smart Irrigation
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem', fontSize: '0.825rem' }}>
              <div style={{ background: 'var(--surface-secondary)', padding: '0.85rem', borderRadius: 8 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Rain Forecast ≥ 5 mm or Chance ≥ 70%:</strong>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>
                  Always defer irrigation. Irrigating right before rainfall causes waterlogging, root asphyxiation, and nutrient leaching.
                </p>
              </div>
              <div style={{ background: 'var(--surface-secondary)', padding: '0.85rem', borderRadius: 8 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Dry Period / Low Rain:</strong>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>
                  Check physical soil depth (insert finger 2 inches into soil). If moisture is still felt, conserve groundwater and water later.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 6: FARMING KNOWLEDGE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'knowledge' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search farming guides (e.g. seed treatment, heat waves, IPM, nutrients)..."
              value={knowledgeSearch}
              onChange={(e) => setKnowledgeSearch(e.target.value)}
            />
          </div>

          {/* Category Chips */}
          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              paddingBottom: '0.25rem',
              scrollbarWidth: 'none',
            }}
          >
            {KNOWLEDGE_CATEGORIES.map((cat) => {
              const isSelected = knowledgeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setKnowledgeCategory(cat.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: 'var(--radius-full)',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--primary)' : 'var(--surface)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Articles List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredArticles.map((art) => {
              const isExpanded = expandedArticleId === art.id;
              return (
                <div
                  key={art.id}
                  className="card"
                  style={{
                    padding: '1.25rem',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'border-color 150ms',
                  }}
                  onClick={() => setExpandedArticleId(isExpanded ? null : art.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {art.title}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {art.readTime}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0.4rem 0 0.5rem' }}>
                    {art.summary}
                  </p>

                  {isExpanded ? (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border)',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.65,
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {art.content}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.25rem' }}>
                      <span>Read article</span>
                      <ChevronRight size={14} />
                    </div>
                  )}
                </div>
              );
            })}

            {filteredArticles.length === 0 && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <BookOpen size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p>No farming knowledge articles found for this search.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 7: MANA OORU & LOCAL RURAL INFORMATION
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'local' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Mana Ooru - Mana Badi Clarification Card */}
          <div
            className="card"
            style={{
              padding: '1.5rem',
              background: 'var(--surface)',
              borderLeft: '4px solid var(--primary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>
                  {LOCAL_RURAL_INFO.manaOoruManaBadi.state} • {LOCAL_RURAL_INFO.manaOoruManaBadi.category}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
                  {LOCAL_RURAL_INFO.manaOoruManaBadi.title}
                </h3>
              </div>
              <a
                href={LOCAL_RURAL_INFO.manaOoruManaBadi.officialPortal}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
              >
                <span>{LOCAL_RURAL_INFO.manaOoruManaBadi.portalLabel}</span>
                <ExternalLink size={13} />
              </a>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.85rem' }}>
              {LOCAL_RURAL_INFO.manaOoruManaBadi.officialContext}
            </p>

            {/* Clear farmer distinction notice */}
            <div
              style={{
                background: 'var(--warning-bg)',
                border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                fontSize: '0.825rem',
                color: 'var(--warning-text)',
                lineHeight: 1.55,
                marginBottom: '1rem',
              }}
            >
              {LOCAL_RURAL_INFO.manaOoruManaBadi.clarificationForFarmers}
            </div>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              Program Infrastructure Components:
            </h4>
            <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {LOCAL_RURAL_INFO.manaOoruManaBadi.keyComponents.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Local Agricultural Extension Centers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Rythu Vedika */}
            <div className="card" style={{ padding: '1.25rem', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>
                  {LOCAL_RURAL_INFO.rythuVedika.state} Agricultural Hub
                </span>
                <a
                  href={LOCAL_RURAL_INFO.rythuVedika.officialPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center' }}
                >
                  <ExternalLink size={14} />
                </a>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                {LOCAL_RURAL_INFO.rythuVedika.title}
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '0.75rem' }}>
                {LOCAL_RURAL_INFO.rythuVedika.officialContext}
              </p>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '0.35rem' }}>
                FARMER SERVICES:
              </div>
              <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {LOCAL_RURAL_INFO.rythuVedika.servicesForFarmers.map((svc, idx) => (
                  <li key={idx}>{svc}</li>
                ))}
              </ul>
            </div>

            {/* Rythu Bharosa Kendras */}
            <div className="card" style={{ padding: '1.25rem', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>
                  {LOCAL_RURAL_INFO.rythuBharosaKendra.state} Farm Secretariat
                </span>
                <a
                  href={LOCAL_RURAL_INFO.rythuBharosaKendra.officialPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center' }}
                >
                  <ExternalLink size={14} />
                </a>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                {LOCAL_RURAL_INFO.rythuBharosaKendra.title}
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '0.75rem' }}>
                {LOCAL_RURAL_INFO.rythuBharosaKendra.officialContext}
              </p>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '0.35rem' }}>
                FARMER SERVICES:
              </div>
              <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {LOCAL_RURAL_INFO.rythuBharosaKendra.servicesForFarmers.map((svc, idx) => (
                  <li key={idx}>{svc}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
