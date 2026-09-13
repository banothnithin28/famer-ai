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
  Zap,
} from 'lucide-react';
import { deleteScan, getPlantDetails } from '../services/apiService';

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

function severityColor(severity) {
  const s = (severity || '').toLowerCase();
  if (s.includes('critical')) return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700';
  if (s.includes('severe') || s.includes('high')) return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-700';
  if (s.includes('moderate')) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700';
  if (s.includes('healthy') || s.includes('low') || s.includes('mild')) return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700';
  return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
}

function scoreColor(score) {
  if (score === null || score === undefined) return 'text-slate-400';
  if (score >= 85) return 'text-emerald-500';
  if (score >= 65) return 'text-amber-500';
  return 'text-rose-500';
}

function scoreBarColor(score) {
  if (score === null || score === undefined) return 'bg-slate-300';
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 65) return 'bg-amber-500';
  return 'bg-rose-500';
}

/* ─────────────────────────── SVG Chart ─────────────────────────── */

function HealthTrendChart({ history, selectedScanId, onSelectScan }) {
  const W = 600;
  const H = 180;
  const PAD = { top: 24, right: 24, bottom: 44, left: 40 };
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

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[280px]"
        style={{ height: 'auto' }}
        aria-label="AI Prediction Confidence Over Time"
      >
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
          <filter id="dotGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
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
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left - 6}
                y={tickY + 4}
                textAnchor="end"
                fontSize="9"
                fill="#94a3b8"
                fontWeight="600"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaPath && (
          <path d={areaPath} fill="url(#chartGrad)" />
        )}

        {/* Polyline */}
        {polyline && (
          <polyline
            points={polyline}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points + labels */}
        {points.map((p) => {
          const isHealthy = (p.scan.disease_name || '').toLowerCase().includes('healthy');
          const dotColor = isHealthy ? '#10b981' : p.scan.confidence >= 60 ? '#f59e0b' : '#f43f5e';
          return (
            <g key={p.i}>
              {/* Outer glow ring */}
              <circle
                cx={p.x}
                cy={p.y}
                r={selectedScanId === p.scan.id ? 10 : 7}
                fill={dotColor}
                opacity="0.2"
              />
              {/* Inner dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={selectedScanId === p.scan.id ? 6 : 4.5}
                fill={dotColor}
                stroke={selectedScanId === p.scan.id ? '#0f172a' : 'white'}
                strokeWidth="2"
                filter="url(#dotGlow)"
                tabIndex="0"
                role="button"
                aria-label={`${formatShortDate(p.scan.created_at)}: ${p.scan.disease_name}, ${p.scan.confidence}% AI prediction confidence`}
                onClick={() => onSelectScan(p.scan)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelectScan(p.scan);
                }}
                className="cursor-pointer"
              />
              {/* Score label above dot */}
              <text
                x={p.x}
                y={p.y - 11}
                textAnchor="middle"
                fontSize="9"
                fill={dotColor}
                fontWeight="800"
              >
                {p.scan.confidence}%
              </text>
              {/* Day label below X axis */}
              <text
                x={p.x}
                y={H - PAD.bottom + 14}
                textAnchor="middle"
                fontSize="8.5"
                fill="#64748b"
                fontWeight="700"
              >
                {formatShortDate(p.scan.created_at)}
              </text>
              {/* Disease short label */}
              <text
                x={p.x}
                y={H - PAD.bottom + 26}
                textAnchor="middle"
                fontSize="7.5"
                fill="#94a3b8"
                fontWeight="500"
              >
                {(p.scan.disease_name || '').length > 14
                  ? (p.scan.disease_name || '').slice(0, 12) + '…'
                  : p.scan.disease_name || ''}
              </text>
            </g>
          );
        })}

        {/* Y axis line */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={H - PAD.bottom}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

/* ─────────────────────────── Scan Card ─────────────────────────── */

function ScanCard({ scan, index, total, selected, onToggle, onDelete }) {
  const isLast = index === total - 1;
  const isHealthy = (scan.disease_name || '').toLowerCase().includes('healthy');

  return (
    <div className="relative flex gap-4 sm:gap-5">
      {/* Timeline rail */}
      <div className="flex flex-col items-center shrink-0 w-8">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md z-10 ${
            isHealthy
              ? 'bg-emerald-500 text-white'
              : scan.confidence >= 60
              ? 'bg-amber-500 text-white'
              : 'bg-rose-500 text-white'
          }`}
        >
          {isHealthy ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 mt-1 bg-slate-200 dark:bg-slate-700 min-h-[24px]" />
        )}
      </div>

      {/* Content card */}
      <div className="flex-1 pb-6">
        {/* Day label + date */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {scan.day_label || `Scan ${total - index}`}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(scan.created_at)}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
            {/* Scan thumbnail */}
            {scan.image_url ? (
              <div className="shrink-0">
                <img
                  src={scan.image_url}
                  alt={`Scan from ${formatDate(scan.created_at)}`}
                  className="w-full sm:w-20 h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            ) : (
              <div className="shrink-0 w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-slate-400" />
              </div>
            )}

            {/* Scan details */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Disease name + severity badge */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                    Diagnosis
                  </p>
                  <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                    {healthLabel(scan)}
                  </h3>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider shrink-0 ${severityColor(
                    scan.severity
                  )}`}
                >
                  {scan.severity || 'Unknown'}
                </span>
              </div>

              {/* Confidence + health score bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span>Model confidence</span>
                  <span className={`font-black ${scoreColor(scan.confidence)}`}>
                    {scan.confidence}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(scan.confidence)}`}
                    style={{ width: `${scan.confidence}%` }}
                  />
                </div>
              </div>

              {/* Symptoms */}
              {scan.symptoms && scan.symptoms.trim() && (
                <div className="pt-1">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                    Symptoms
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {scan.symptoms}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onToggle(scan.id)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black transition-colors ${selected ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'border-slate-200 text-slate-600 hover:border-emerald-400 dark:border-slate-700 dark:text-slate-300'}`}
                >
                  <GitCompare className="h-4 w-4" />
                  {selected ? 'Selected for comparison' : 'Select to compare'}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(scan.id)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 px-3 text-xs font-black text-rose-700 hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-4 w-4" /> Delete scan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main Component ─────────────────────────── */

export default function PlantDetails({ plantId, onBack, onAskAI }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedScanIds, setSelectedScanIds] = useState([]);
  const [dateRange, setDateRange] = useState('all');
  const [selectedScan, setSelectedScan] = useState(null);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    setData(null);
    setError('');
    getPlantDetails(plantId)
      .then((result) => {
        if (!result.success) throw new Error(result.error || 'Unable to load plant history.');
        setData(result);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [plantId]);

  const toggleScan = (scanId) => {
    setSelectedScanIds((current) => {
      if (current.includes(scanId)) return current.filter((id) => id !== scanId);
      return current.length < 2 ? [...current, scanId] : [current[1], scanId];
    });
  };

  const handleDeleteScan = async (scanId) => {
    if (!window.confirm('Delete this scan and its stored photo?')) return;
    try {
      await deleteScan(scanId);
      setSelectedScanIds((current) => current.filter((id) => id !== scanId));
      const refreshed = await getPlantDetails(plantId);
      setData(refreshed);
    } catch (err) {
      setError(err.message || 'We could not delete this scan. Please try again.');
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-4 text-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 flex items-center justify-center">
            <Leaf className="w-7 h-7 text-emerald-500 animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Loading plant health history…
        </p>
      </div>
    );
  }

  /* ── Error / No plant ── */
  if (error || !data) {
    return (
      <div className="py-20 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
        </div>
        <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
          {error || 'Select a plant to view its details.'}
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </button>
      </div>
    );
  }

  const {
    plant,
    history,
    scan_count,
    current_health: current,
    previous_health: previous,
    comparison,
  } = data;

  /* Reverse history so newest is first in timeline */
  const timelineScans = [...history].reverse();
  const selectedScans = selectedScanIds
    .map((scanId) => history.find((scan) => scan.id === scanId))
    .filter(Boolean);
  const orderedSelectedScans = [...selectedScans].sort((first, second) => (
    new Date(first.created_at.replace(' ', 'T')) - new Date(second.created_at.replace(' ', 'T'))
  ));
  const latestScanTime = history.length
    ? Math.max(...history.map((scan) => new Date(scan.created_at.replace(' ', 'T')).getTime()))
    : 0;
  const rangeDays = { '7': 7, '30': 30, '90': 90 };
  const scansInRange = (days) => history.filter((scan) => {
    const scanTime = new Date(scan.created_at.replace(' ', 'T')).getTime();
    return scanTime >= latestScanTime - days * 86400000 && scanTime <= latestScanTime;
  });
  const rangeOptions = [
    { value: '7', label: '7 Days' },
    { value: '30', label: '30 Days' },
    { value: '90', label: '3 Months' },
  ].filter((option) => scansInRange(rangeDays[option.value]).length > 0);
  const filteredHistory = dateRange === 'all'
    ? history
    : scansInRange(rangeDays[dateRange]);

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-6 px-0">

      {/* ── Back Button ── */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </button>

      {/* ── Hero Header ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white p-6 sm:p-8 shadow-2xl">
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 left-1/4 w-56 h-56 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          {/* Left: identity */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-black uppercase tracking-widest">
              <Leaf className="w-4 h-4" />
              Plant Health Record
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              {plant.crop_name} Plant #{String(plant.id).padStart(2, '0')}
            </h1>
            <p className="text-sm text-emerald-100/70">
              {plant.field_name}
              {plant.location ? ` · ${plant.location}` : ''}
            </p>
            <div className="flex flex-wrap gap-3 text-xs font-bold text-emerald-200/80">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Registered {formatDate(plant.created_at).split(',')[0]}
              </span>
              <span className="flex items-center gap-1.5">
                <Microscope className="w-3.5 h-3.5" />
                {scan_count ?? history.length} scan{history.length !== 1 ? 's' : ''} recorded
              </span>
            </div>
          </div>

          {/* Right: current model confidence badge */}
          <div className="shrink-0 rounded-2xl border border-emerald-400/30 bg-white/10 backdrop-blur-sm px-5 py-4 min-w-[140px] text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-1">
              Current model confidence
            </p>
            <p className={`text-3xl font-black ${current ? scoreColor(current.confidence) : 'text-white'}`}>
              {current ? `${current.confidence}%` : '—'}
            </p>
            <p className="text-xs text-emerald-100/70 mt-1 leading-snug">
              {healthLabel(current)}
            </p>
            {onAskAI && <button type="button" onClick={onAskAI} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white/15 px-3 text-xs font-black text-white hover:bg-white/25">Ask Farmer AI About This Plant</button>}
          </div>
        </div>
      </section>

      {/* ── Factual comparison observation ── */}
      {comparison?.available && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 dark:border-sky-900/70 dark:bg-sky-950/30 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">AI observation</p>
          <p className="mt-1 text-sm font-bold text-sky-950 dark:text-sky-100">{comparison.message}</p>
          <p className="mt-2 text-xs text-sky-800/80 dark:text-sky-200/80">Confidence changes show how confident the model was. They are not a disease severity measurement.</p>
        </div>
      )}

      {/* ── Stats Cards ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Current */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
              Current model confidence
          </p>
          <p className={`text-3xl font-black ${scoreColor(current?.confidence)}`}>
            {current ? `${current.confidence}%` : '—'}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
            {healthLabel(current)}
          </p>
          {current && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(current.confidence)}`}
                style={{ width: `${current.confidence}%` }}
              />
            </div>
          )}
        </div>

        {/* Previous */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
            Previous model confidence
          </p>
          <p className={`text-3xl font-black ${scoreColor(previous?.confidence)}`}>
            {previous ? `${previous.confidence}%` : '—'}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
            {healthLabel(previous)}
          </p>
          {previous && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(previous.confidence)}`}
                style={{ width: `${previous.confidence}%` }}
              />
            </div>
          )}
        </div>

        {/* Comparison status */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
            Comparison
          </p>
          <div className="flex items-center gap-2">
            <p className={`text-3xl font-black ${history.length > 1 ? 'text-emerald-500' : 'text-slate-400'}`}>
              {history.length > 1 ? 'Ready' : '—'}
            </p>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1.5">
            {history.length > 1 ? 'Select two scans below' : 'Need ≥ 2 scans to compare'}
          </p>
        </div>
      </section>

      {/* ── Model Confidence Chart ── */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col gap-4 mb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">AI Prediction Confidence Over Time</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Scan date on the horizontal axis · AI prediction confidence (%) on the vertical axis
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter scan history by date">
            {[...rangeOptions, { value: 'all', label: 'All' }].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDateRange(option.value)}
                className={`min-h-10 rounded-xl border px-3 text-xs font-black transition-colors ${dateRange === option.value ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:border-emerald-400 dark:border-slate-700 dark:text-slate-300'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-14 text-center">
            <Zap className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
              No scans recorded yet. Scan this plant to build its scan history.
            </p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-10 text-center">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Not enough scan history in this period yet.</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Add more scans over time to see your plant&apos;s trend.</p>
          </div>
        ) : filteredHistory.length === 1 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className={`text-4xl font-black ${scoreColor(filteredHistory[0].confidence)}`}>
              {filteredHistory[0].confidence}%
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{healthLabel(filteredHistory[0])}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Add another scan to build a trend graph
            </p>
          </div>
        ) : (
          <HealthTrendChart history={filteredHistory} selectedScanId={selectedScan?.id} onSelectScan={setSelectedScan} />
        )}

        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
          AI confidence shows how confident the model was in its prediction. It does not directly represent plant health or disease severity.
        </p>

        {selectedScan && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <img src={selectedScan.image_url} alt={`Selected scan from ${formatShortDate(selectedScan.created_at)}`} className="h-20 w-20 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Selected scan</p>
                <p className="font-black text-slate-900 dark:text-white">{formatDate(selectedScan.created_at)}</p>
                <p className="text-slate-700 dark:text-slate-200">{healthLabel(selectedScan)} · <strong>{selectedScan.confidence}% AI prediction confidence</strong></p>
              </div>
              <a href={selectedScan.image_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-300 px-3 text-xs font-black text-emerald-800 hover:bg-white dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/60">Open scan image</a>
            </div>
          </div>
        )}
      </section>

      {/* ── Disease Timeline ── */}
      {history.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60">
              <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Disease Timeline</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">The stored prediction at each scan date</p>
            </div>
          </div>
          <div className="space-y-3">
            {history.map((scan, index) => {
              const previousScan = history[index - 1];
              const changed = previousScan && previousScan.disease_name !== scan.disease_name;
              return (
                <div key={scan.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{formatShortDate(scan.created_at)}</p>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{healthLabel(scan)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{scan.confidence}% AI prediction confidence</p>
                  </div>
                  {changed && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Prediction changed</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Scan History Timeline ── */}
      <section>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Scan History</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Newest scan first · {history.length} total
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-2">
            <ImageIcon className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              No scan records yet.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Go to <strong>Disease Scanner</strong>, select this plant, and scan a leaf to begin building its health history.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {timelineScans.map((scan, index) => (
              <ScanCard
                key={scan.id}
                scan={scan}
                index={index}
                total={timelineScans.length}
                selected={selectedScanIds.includes(scan.id)}
                onToggle={toggleScan}
                onDelete={handleDeleteScan}
              />
            ))}
          </div>
        )}
      </section>

      {selectedScans.length === 2 && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/70 dark:bg-emerald-950/20 p-5 sm:p-7">
          <div className="flex items-center gap-2 mb-4">
            <GitCompare className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Compare Scans</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {orderedSelectedScans.map((scan, index) => (
              <div key={scan.id} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-3 space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">{index === 0 ? 'Previous scan' : 'Current scan'}</p>
                <img src={scan.image_url} alt={`Plant scan from ${formatDate(scan.created_at)}`} className="w-full aspect-[4/3] rounded-xl object-cover bg-slate-100 dark:bg-slate-800" />
                <div className="space-y-1 text-sm">
                  <p className="font-black text-slate-900 dark:text-white">{formatDate(scan.created_at)}</p>
                  <p className="text-slate-600 dark:text-slate-300">{healthLabel(scan)}</p>
                  <p className="font-bold text-emerald-700 dark:text-emerald-300">{scan.confidence}% AI confidence</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">
            Date difference: {daysBetween(orderedSelectedScans[0].created_at, orderedSelectedScans[1].created_at)} day{daysBetween(orderedSelectedScans[0].created_at, orderedSelectedScans[1].created_at) === 1 ? '' : 's'}
          </p>
          <p className="mt-4 text-xs leading-relaxed text-emerald-950/80 dark:text-emerald-100/80">
            Visual comparison shows the two stored photos and their model results. The current system does not calculate a reliable affected-area measurement, so no visible-area graph is shown. Confidence is not disease severity.
          </p>
        </section>
      )}

    </div>
  );
}
