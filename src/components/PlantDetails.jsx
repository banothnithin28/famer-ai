import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Image as ImageIcon, Leaf, TrendingDown, TrendingUp } from 'lucide-react';
import { getPlantDetails } from '../services/apiService';

function formatDate(value) {
  if (!value) return 'Unknown date';
  return new Date(value.replace(' ', 'T')).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function healthLabel(scan) {
  if (!scan) return 'No scan yet';
  if (scan.disease_name === 'Uncertain') return 'Uncertain result';
  return scan.disease_name;
}

export default function PlantDetails({ plantId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    getPlantDetails(plantId)
      .then((result) => {
        if (!result.success) throw new Error(result.error || 'Unable to load plant history.');
        setData(result);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [plantId]);

  if (loading) {
    return <div className="py-16 text-center text-sm font-semibold text-slate-500">Loading plant health history...</div>;
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-sm font-semibold text-rose-600">{error || 'Select a plant to view its details.'}</p>
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </button>
      </div>
    );
  }

  const { plant, history, current_health: current, previous_health: previous, change_over_time: change, alerts } = data;
  const changeText = change > 0 ? `+${change}` : `${change}`;
  const changePositive = change > 0;

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </button>

      <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-black uppercase tracking-wider">
              <Leaf className="w-4 h-4" /> Plant details
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">{plant.crop_name} Plant #{String(plant.id).padStart(2, '0')}</h1>
            <p className="mt-2 text-sm text-emerald-100/80">{plant.field_name} {plant.location ? `- ${plant.location}` : ''}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-white/10 px-5 py-4 min-w-[150px]">
            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-200">Current health</p>
            <p className="mt-1 text-xl font-black">{current ? `${current.health_score}/100` : 'Not scanned'}</p>
            <p className="text-xs text-emerald-100/80">{healthLabel(current)}</p>
          </div>
        </div>
      </section>

      {(alerts.declining || alerts.new_disease) && (
        <div className="space-y-2">
          {alerts.declining && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Plant health is declining.</span>
            </div>
          )}
          {alerts.new_disease && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-black text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Possible disease detected.</span>
            </div>
          )}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">Current health</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{current ? current.health_score : '--'}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{healthLabel(current)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">Previous health</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{previous ? previous.health_score : '--'}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{healthLabel(previous)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">Change over time</p>
          <p className={`mt-2 text-2xl font-black ${changePositive ? 'text-emerald-600' : change < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
            {history.length > 1 ? changeText : '--'}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Compared with the previous scan</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Health trend</h2>
            <p className="text-sm text-slate-500">Real scores from this plant's completed scans</p>
          </div>
          <Activity className="w-6 h-6 text-emerald-600" />
        </div>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm font-semibold text-slate-500 dark:border-slate-700">
            No scans recorded for this plant yet.
          </div>
        ) : (
          <div className="flex items-end gap-3 sm:gap-5 h-56 overflow-x-auto pb-7 border-b border-slate-200 dark:border-slate-800">
            {history.map((scan) => (
              <div key={scan.id} className="min-w-[58px] h-full flex flex-col items-center justify-end gap-2">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{scan.health_score}</span>
                <div className="w-10 sm:w-14 rounded-t-xl bg-emerald-500/80 min-h-[8px]" style={{ height: `${Math.max(scan.health_score, 8)}%` }} title={`${healthLabel(scan)} - ${scan.health_score}/100`} />
                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{formatDate(scan.created_at).split(',')[0]}</span>
              </div>
            ))}
          </div>
        )}
        {history.length > 1 && (
          <div className="mt-4 flex items-center gap-4 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1"><TrendingUp className="w-4 h-4 text-emerald-600" /> Improving</span>
            <span className="inline-flex items-center gap-1"><TrendingDown className="w-4 h-4 text-rose-600" /> Declining</span>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Health history</h2>
        </div>
        {history.length === 0 ? (
          <p className="rounded-2xl bg-slate-100 p-5 text-sm font-semibold text-slate-500 dark:bg-slate-900">No real scan records yet. Scan this plant to begin its history.</p>
        ) : history.map((scan, index) => (
          <article key={scan.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
              {scan.image_url ? (
                <img src={scan.image_url} alt={`Scan from ${formatDate(scan.created_at)}`} className="w-full sm:w-24 h-24 rounded-xl object-cover bg-slate-100" />
              ) : <div className="w-24 h-24 rounded-xl bg-slate-100 flex items-center justify-center"><ImageIcon className="w-6 h-6 text-slate-400" /></div>}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Scan {index + 1}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">{healthLabel(scan)}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">{scan.severity || 'Unknown'}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">{formatDate(scan.created_at)} · {scan.confidence}% confidence</p>
                {scan.symptoms && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300"><strong>Symptoms:</strong> {scan.symptoms}</p>}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
