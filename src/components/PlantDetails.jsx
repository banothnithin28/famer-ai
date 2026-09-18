import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Leaf,
  Microscope,
  Trash2,
  GitCompare,
  Sparkles,
  Camera,
  Bot,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MapPin,
  Tag
} from 'lucide-react';
import { deleteScan, getPlantDetails } from '../services/apiService';

/* ─────────────────────────── Crop Emojis ─────────────────────────── */
const CROP_EMOJIS = {
  tomato: '🍅', rice: '🌾', chilli: '🌶️', cotton: '🌸',
  maize: '🌽', groundnut: '🥜', wheat: '🌾', sugarcane: '🎋',
  soybean: '🫘', banana: '🍌', mango: '🥭', turmeric: '🟡',
  potato: '🥔', onion: '🧅', garlic: '🧄', cabbage: '🥬',
};

function getCropEmoji(name = '') {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(CROP_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return '🌿';
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function formatDate(value) {
  if (!value) return 'Unknown date';
  return new Date(value.replace(' ', 'T')).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(value) {
  if (!value) return 'Unknown date';
  return new Date(value.replace(' ', 'T')).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysBetween(firstValue, secondValue) {
  const first = new Date(firstValue.replace(' ', 'T'));
  const second = new Date(secondValue.replace(' ', 'T'));
  return Math.max(0, Math.round(Math.abs(second - first) / 86400000));
}

function healthLabel(scan) {
  if (!scan) return 'No scan yet';
  const d = scan.disease_name || '';
  if (d === 'Uncertain') return 'Uncertain result';
  return d;
}

function getStatusBadge(scan) {
  if (!scan) {
    return {
      label: 'Not Checked',
      className: 'badge-muted',
      color: 'var(--text-muted)'
    };
  }
  const isHealthy = (scan.disease_name || '').toLowerCase().includes('healthy');
  if (isHealthy) {
    return {
      label: 'Healthy',
      className: 'badge-healthy',
      color: 'var(--success)'
    };
  }
  const sev = (scan.severity || '').toLowerCase();
  if (sev.includes('critical') || sev.includes('severe') || sev.includes('high')) {
    return {
      label: scan.severity || 'Critical',
      className: 'badge-critical',
      color: 'var(--danger)'
    };
  }
  return {
    label: scan.severity || 'Attention',
    className: 'badge-attention',
    color: 'var(--warning)'
  };
}

/* ─────────────────────────── SVG Health Chart ─────────────────────────── */

function HealthTrendChart({ history, selectedScanId, onSelectScan }) {
  const W = 640;
  const H = 200;
  const PAD = { top: 28, right: 28, bottom: 48, left: 42 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const scores = history.map((s) => s.confidence);
  const scanTimes = history.map((scan) => new Date(scan.created_at.replace(' ', 'T')).getTime());
  const firstScanTime = Math.min(...scanTimes);
  const lastScanTime = Math.max(...scanTimes);
  const timeRange = lastScanTime - firstScanTime || 1;
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const scoreRange = maxScore - minScore || 10;

  const points = history.map((scan, i) => {
    const x = history.length === 1
      ? PAD.left + chartW / 2
      : PAD.left + ((scanTimes[i] - firstScanTime) / timeRange) * chartW;
    const y = PAD.top + chartH - ((scan.confidence - minScore) / scoreRange) * chartH;
    return { x, y, scan, i };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `M${points[0].x},${H - PAD.bottom} ` +
        points.map((p) => `L${p.x},${p.y}`).join(' ') +
        ` L${points[points.length - 1].x},${H - PAD.bottom} Z`
      : '';

  const yTicks = [25, 50, 75, 100];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[320px]"
        style={{ height: 'auto' }}
        aria-label="AI Prediction Confidence Over Time"
      >
        <defs>
          <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y-axis grid + labels */}
        {yTicks.map((tick) => {
          const tickY = PAD.top + chartH - ((tick - minScore) / scoreRange) * chartH;
          if (tickY < PAD.top || tickY > H - PAD.bottom + 4) return null;
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={tickY}
                x2={W - PAD.right}
                y2={tickY}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={tickY + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted)"
                fontWeight="600"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Shaded Area */}
        {areaPath && (
          <path
            d={areaPath}
            fill="url(#chartAreaGrad)"
          />
        )}

        {/* Polyline */}
        {points.length > 1 && (
          <polyline
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline}
          />
        )}

        {/* Interactive Dots */}
        {points.map((p) => {
          const isSelected = selectedScanId === p.scan.id;
          const isHealthy = (p.scan.disease_name || '').toLowerCase().includes('healthy');
          const dotColor = isHealthy ? 'var(--success)' : (p.scan.confidence >= 70 ? 'var(--warning)' : 'var(--danger)');

          return (
            <g key={p.scan.id} style={{ cursor: 'pointer' }} onClick={() => onSelectScan(p.scan)}>
              {/* Outer ring */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isSelected ? 11 : 7}
                fill={dotColor}
                opacity={isSelected ? 0.35 : 0.15}
              />
              {/* Core dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isSelected ? 6 : 4.5}
                fill={dotColor}
                stroke="var(--surface)"
                strokeWidth="2"
              />
              {/* Value label */}
              <text
                x={p.x}
                y={p.y - 12}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-primary)"
                fontWeight="700"
              >
                {p.scan.confidence}%
              </text>
              {/* Date label */}
              <text
                x={p.x}
                y={H - PAD.bottom + 16}
                textAnchor="middle"
                fontSize="9.5"
                fill="var(--text-muted)"
                fontWeight="600"
              >
                {formatShortDate(p.scan.created_at)}
              </text>
            </g>
          );
        })}

        {/* X Axis line */}
        <line
          x1={PAD.left}
          y1={H - PAD.bottom}
          x2={W - PAD.right}
          y2={H - PAD.bottom}
          stroke="var(--border)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

/* ─────────────────────────── Scan Item Component ─────────────────────────── */

function ScanHistoryItem({ scan, index, total, isSelected, onToggleSelect, onDelete }) {
  const isHealthy = (scan.disease_name || '').toLowerCase().includes('healthy');
  const badge = getStatusBadge(scan);

  return (
    <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
      {/* Step line and node */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px', flexShrink: 0 }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isHealthy ? 'var(--success-bg)' : (badge.className === 'badge-critical' ? 'var(--danger-bg)' : 'var(--warning-bg)'),
            color: isHealthy ? 'var(--success-text)' : (badge.className === 'badge-critical' ? 'var(--danger-text)' : 'var(--warning-text)'),
            border: `1.5px solid ${isHealthy ? 'var(--success)' : (badge.className === 'badge-critical' ? 'var(--danger)' : 'var(--warning)')}`,
            fontWeight: 800,
            fontSize: '0.8rem',
            zIndex: 2,
          }}
        >
          {isHealthy ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        </div>
        {index < total - 1 && (
          <div
            style={{
              width: '2px',
              flex: 1,
              background: 'var(--border)',
              margin: '6px 0',
              minHeight: '28px',
            }}
          />
        )}
      </div>

      {/* Content Card */}
      <div className="card" style={{ flex: 1, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary)' }}>
                Scan #{total - index}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={13} /> {formatDate(scan.created_at)}
              </span>
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {healthLabel(scan)}
            </h4>
          </div>

          <span className={`badge ${badge.className}`}>
            <span className="badge-dot" />
            {scan.severity || badge.label}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Photo */}
          {scan.image_url ? (
            <div style={{ position: 'relative', width: '96px', height: '96px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
              <img
                src={scan.image_url}
                alt={`Scan ${formatShortDate(scan.created_at)}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ width: '96px', height: '96px', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
              <ImageIcon size={28} />
            </div>
          )}

          {/* Details */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Model Confidence</span>
                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{scan.confidence}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${scan.confidence}%`,
                    background: isHealthy ? 'var(--success)' : 'var(--primary)'
                  }}
                />
              </div>
            </div>

            {scan.symptoms && scan.symptoms.trim() && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0.4rem 0' }}>
                <strong>Observed:</strong> {scan.symptoms}
              </p>
            )}

            {scan.recommendation && scan.recommendation.trim() && (
              <p style={{ fontSize: '0.8rem', color: 'var(--forest)', background: 'var(--success-bg)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', margin: '0.4rem 0' }}>
                💡 <strong>Advice:</strong> {scan.recommendation}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onToggleSelect(scan.id)}
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem' }}
              >
                <GitCompare size={14} />
                {isSelected ? 'Selected to Compare' : 'Compare Scan'}
              </button>

              <button
                type="button"
                onClick={() => onDelete(scan.id)}
                className="btn btn-sm btn-ghost"
                style={{ color: 'var(--danger)', fontSize: '0.78rem' }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main PlantDetails Component ─────────────────────────── */

export default function PlantDetails({ plantId, onBack, onAskAI, onOpenScanner }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedScanIds, setSelectedScanIds] = useState([]);
  const [dateRange, setDateRange] = useState('all');
  const [inspectedScan, setInspectedScan] = useState(null);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    setData(null);
    setError('');
    getPlantDetails(plantId)
      .then((result) => {
        if (!result.success) throw new Error(result.error || 'Unable to load plant record.');
        setData(result);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [plantId]);

  const toggleScanSelection = (scanId) => {
    setSelectedScanIds((current) => {
      if (current.includes(scanId)) return current.filter((id) => id !== scanId);
      return current.length < 2 ? [...current, scanId] : [current[1], scanId];
    });
  };

  const handleDeleteScan = async (scanId) => {
    if (!window.confirm('Are you sure you want to delete this scan and image?')) return;
    try {
      await deleteScan(scanId);
      setSelectedScanIds((curr) => curr.filter((id) => id !== scanId));
      if (inspectedScan?.id === scanId) setInspectedScan(null);
      const refreshed = await getPlantDetails(plantId);
      setData(refreshed);
    } catch (err) {
      setError(err.message || 'Could not delete scan. Please try again.');
    }
  };

  /* ── Loading State ── */
  if (loading) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--primary)', marginBottom: '1.25rem' }}>
          <Leaf size={32} className="pulse-dot" />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Loading Plant Journey...</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Retrieving scans, health timeline, and AI observations</p>
      </div>
    );
  }

  /* ── Error State ── */
  if (error || !data) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--danger-bg)', color: 'var(--danger)', marginBottom: '1rem' }}>
          <AlertTriangle size={28} />
        </div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Plant Not Found</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          {error || 'Unable to load details for this plant.'}
        </p>
        <button onClick={onBack} className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to My Plants
        </button>
      </div>
    );
  }

  const {
    plant,
    history = [],
    scan_count,
    current_health: current,
    previous_health: previous,
    comparison,
  } = data;

  const cropEmoji = getCropEmoji(plant.crop_name || '');
  const latestScan = history.length > 0 ? history[history.length - 1] : null;
  const badge = getStatusBadge(current || latestScan);

  /* Timeline scans newest first */
  const timelineScans = [...history].reverse();

  /* Date filtering for graph */
  const latestScanTime = history.length
    ? Math.max(...history.map((scan) => new Date(scan.created_at.replace(' ', 'T')).getTime()))
    : 0;

  const scansInRange = (days) => history.filter((scan) => {
    const scanTime = new Date(scan.created_at.replace(' ', 'T')).getTime();
    return scanTime >= latestScanTime - days * 86400000 && scanTime <= latestScanTime;
  });

  const rangeOptions = [
    { value: '7', label: '7 Days' },
    { value: '30', label: '30 Days' },
    { value: '90', label: '3 Months' },
  ].filter((opt) => scansInRange(opt.value === '7' ? 7 : (opt.value === '30' ? 30 : 90)).length > 0);

  const filteredHistory = dateRange === 'all'
    ? history
    : scansInRange(dateRange === '7' ? 7 : (dateRange === '30' ? 30 : 90));

  /* Comparison selection */
  const selectedScans = selectedScanIds
    .map((id) => history.find((s) => s.id === id))
    .filter(Boolean)
    .sort((a, b) => new Date(a.created_at.replace(' ', 'T')) - new Date(b.created_at.replace(' ', 'T')));

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* ── Top Bar / Breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onBack}
          className="btn btn-ghost"
          style={{ paddingLeft: 0, fontWeight: 700 }}
        >
          <ArrowLeft size={16} /> Back to My Plants
        </button>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {onAskAI && (
            <button
              type="button"
              onClick={onAskAI}
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 700 }}
            >
              <Bot size={15} /> Ask AI About This Plant
            </button>
          )}
        </div>
      </div>

      {/* ── Plant Hero Card ── */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Plant Icon / Avatar */}
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--surface-subtle)',
              border: '2px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              flexShrink: 0,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {cropEmoji}
          </div>

          {/* Plant Title & Metadata */}
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              <span className="kicker">Plant Record #{plant.id}</span>
              <span className={`badge ${badge.className}`}>
                <span className="badge-dot" />
                {badge.label}
              </span>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
              {plant.crop_name}
            </h1>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={14} color="var(--primary)" />
                {plant.field_name || 'Main Field'}{plant.location ? ` (${plant.location})` : ''}
              </span>

              {plant.variety && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Tag size={14} color="var(--primary)" />
                  {plant.variety}
                </span>
              )}

              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CalendarDays size={14} color="var(--primary)" />
                Registered {formatShortDate(plant.created_at)}
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Microscope size={14} color="var(--primary)" />
                {history.length} Scan{history.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        {/* Info Grid (Soil, Irrigation, Notes) */}
        {(plant.soil_type || plant.irrigation || plant.notes) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
              marginTop: '1.25rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            {plant.soil_type && (
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Soil Type
                </span>
                <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '0.85rem' }}>{plant.soil_type}</p>
              </div>
            )}
            {plant.irrigation && (
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Irrigation
                </span>
                <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '0.85rem' }}>{plant.irrigation}</p>
              </div>
            )}
            {plant.planting_date && (
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Planted On
                </span>
                <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '0.85rem' }}>{formatShortDate(plant.planting_date)}</p>
              </div>
            )}
            {plant.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Notes
                </span>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{plant.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Latest AI Health Analysis Card ── */}
      {latestScan && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            marginBottom: '1.5rem',
            borderLeft: `5px solid ${badge.color}`,
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Latest AI Health Diagnosis</h3>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Clock size={13} /> {formatDate(latestScan.created_at)}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
                Status & Condition
              </p>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
                {healthLabel(latestScan)}
              </h4>
              <span className={`badge ${badge.className}`}>
                <span className="badge-dot" />
                Severity: {latestScan.severity || 'Normal'}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>AI Model Confidence</span>
                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{latestScan.confidence}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${latestScan.confidence}%`,
                    background: badge.color,
                  }}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
                Model confidence reflects predictive certainty on scanned leaves.
              </p>
            </div>
          </div>

          {comparison?.available && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--info-bg)',
                color: 'var(--info-text)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <TrendingUp size={16} style={{ flexShrink: 0 }} />
              <div>
                <strong>Trend observation:</strong> {comparison.message}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Health Trend Chart Section ── */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.2rem 0' }}>
              Prediction Confidence Over Time
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
              Chronological trajectory of AI diagnostic confidence across scan dates
            </p>
          </div>

          {rangeOptions.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {[{ value: 'all', label: 'All' }, ...rangeOptions].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDateRange(opt.value)}
                  className={`btn btn-sm ${dateRange === opt.value ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minHeight: '32px', padding: '0 0.75rem', fontSize: '0.75rem' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <Camera size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>No Scans Yet</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1rem' }}>
              Scan this plant with your camera to begin recording health assessments and tracking trends over time.
            </p>
            {onOpenScanner && (
              <button type="button" onClick={onOpenScanner} className="btn btn-primary btn-sm">
                <Camera size={14} /> Run First Scan
              </button>
            )}
          </div>
        ) : filteredHistory.length === 1 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '0.35rem' }}>
              {filteredHistory[0].confidence}%
            </div>
            <p style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>{healthLabel(filteredHistory[0])}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              1 scan recorded on {formatShortDate(filteredHistory[0].created_at)}. Run more scans over time to see the trend line.
            </p>
          </div>
        ) : (
          <HealthTrendChart
            history={filteredHistory}
            selectedScanId={inspectedScan?.id}
            onSelectScan={setInspectedScan}
          />
        )}

        {inspectedScan && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {inspectedScan.image_url && (
              <img
                src={inspectedScan.image_url}
                alt="Selected Scan"
                style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
              />
            )}
            <div style={{ flex: 1, minWidth: '180px' }}>
              <span className="kicker">Selected Data Point</span>
              <p style={{ fontWeight: 800, margin: '0.1rem 0', fontSize: '0.9rem' }}>
                {healthLabel(inspectedScan)} · {inspectedScan.confidence}% confidence
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                {formatDate(inspectedScan.created_at)}
              </p>
            </div>
            {inspectedScan.image_url && (
              <a
                href={inspectedScan.image_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <ExternalLink size={13} /> View Photo
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Scan Comparison Section (Active when 2 selected) ── */}
      {selectedScans.length === 2 && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--surface)', border: '2px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <GitCompare size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              Comparing 2 Scans ({daysBetween(selectedScans[0].created_at, selectedScans[1].created_at)} Days Apart)
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {selectedScans.map((scan, idx) => (
              <div key={scan.id} style={{ background: 'var(--surface-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span className="kicker">{idx === 0 ? 'Earlier Scan' : 'Later Scan'}</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0.6rem' }}>
                  {formatDate(scan.created_at)}
                </p>
                {scan.image_url && (
                  <img
                    src={scan.image_url}
                    alt={`Scan ${idx + 1}`}
                    style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}
                  />
                )}
                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.25rem' }}>{healthLabel(scan)}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, margin: 0 }}>
                  Confidence: {scan.confidence}%
                </p>
                {scan.symptoms && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.4rem 0 0' }}>
                    {scan.symptoms}
                  </p>
                )}
              </div>
            ))}
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', marginBottom: 0 }}>
            Visual comparison helps you verify if leaf spots, discoloration, or wilt symptoms improved after treatment.
          </p>
        </div>
      )}

      {/* ── Scan Journey Timeline ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.2rem 0' }}>
              Plant Health Journey
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Chronological log of inspections & photos ({history.length} scans)
            </p>
          </div>

          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="btn btn-primary btn-sm"
            >
              <Camera size={14} /> New Scan
            </button>
          )}
        </div>

        {timelineScans.length === 0 ? (
          <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <Leaf size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ fontWeight: 800, margin: '0 0 0.35rem' }}>No Scans Recorded</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Take a leaf photo in the Check Plant scanner to add the first scan to this plant&apos;s timeline.
            </p>
          </div>
        ) : (
          <div>
            {timelineScans.map((scan, idx) => (
              <ScanHistoryItem
                key={scan.id}
                scan={scan}
                index={idx}
                total={timelineScans.length}
                isSelected={selectedScanIds.includes(scan.id)}
                onToggleSelect={toggleScanSelection}
                onDelete={handleDeleteScan}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
