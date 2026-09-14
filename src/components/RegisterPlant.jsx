import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Leaf, MapPin, Sprout } from 'lucide-react';
import { createPlant } from '../services/apiService';

const cropOptions = ['Tomato', 'Rice', 'Chilli', 'Cotton', 'Maize', 'Groundnut', 'Other'];
const soilOptions = ['Sandy', 'Clay', 'Loamy', 'Black Soil', 'Red Soil', 'Other'];
const irrigationOptions = ['Drip', 'Sprinkler', 'Flood', 'Manual', 'Rain-fed'];

export default function RegisterPlant({ onBack, onRegistered, user }) {
  const [form, setForm] = useState({ plantName: '', cropType: '', variety: '', plantingDate: '', fieldName: '', soilType: '', irrigationType: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState(null);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const notes = [
      form.variety && `Variety: ${form.variety}`,
      form.plantingDate && `Planting date: ${form.plantingDate}`,
      form.soilType && `Soil type: ${form.soilType}`,
      form.irrigationType && `Irrigation: ${form.irrigationType}`,
      form.notes && `Notes: ${form.notes}`,
    ].filter(Boolean).join('\n');

    try {
      const result = await createPlant({
        crop_name: form.plantName.trim() || form.cropType,
        field_name: form.fieldName.trim(),
        location: user?.location || '',
        notes,
      });
      if (!result.success) throw new Error(result.error || 'Unable to register this plant.');
      setRegistered(result.plant);
      onRegistered?.(result.plant);
    } catch (requestError) {
      setError(requestError.message || 'Unable to register this plant.');
    } finally {
      setSaving(false);
    }
  }

  if (registered) {
    return <div className="mx-auto max-w-xl pb-16"><button onClick={onBack} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-black text-[var(--accent-primary)]"><ArrowLeft className="h-4 w-4" /> Back to My Farm</button><section className="farmer-card p-7 text-center sm:p-10"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]"><CheckCircle2 className="h-9 w-9" /></div><p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-[var(--success)]">Plant registered successfully</p><h1 className="mt-2 text-3xl font-black text-[var(--text-primary)]">{registered.crop_name}</h1><p className="mt-3 text-sm text-[var(--text-secondary)]">Your plant has been added to Farmer AI monitoring.</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={onBack} className="min-h-12 rounded-xl bg-[var(--accent-primary)] px-4 text-sm font-black text-white">View Plant</button><button onClick={() => onBack('scanner', registered.id)} className="min-h-12 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 text-sm font-black text-[var(--text-primary)]">Start Health Check</button></div></section></div>;
  }

  return <div className="mx-auto max-w-3xl pb-16"><button onClick={onBack} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-black text-[var(--accent-primary)]"><ArrowLeft className="h-4 w-4" /> Back to My Farm</button><div className="mb-7"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--success-bg)] text-[var(--accent-primary)]"><Sprout className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent-primary)]">New plant record</p><h1 className="mt-1 text-3xl font-black text-[var(--text-primary)]">Register Your Plant</h1></div></div><p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)]">Add a plant to start monitoring its health. It takes less than a minute.</p></div><form onSubmit={handleSubmit} className="farmer-card space-y-6 p-6 sm:p-8"><section><div className="mb-4 flex items-center gap-2"><Leaf className="h-5 w-5 text-[var(--leaf)]" /><h2 className="text-lg font-black text-[var(--text-primary)]">Plant information</h2></div><div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="form-label">Plant name</span><input required value={form.plantName} onChange={(event) => update('plantName', event.target.value)} placeholder="My Tomato Plant" className="form-input" /></label><label><span className="form-label">Crop type</span><select required value={form.cropType} onChange={(event) => update('cropType', event.target.value)} className="form-input"><option value="">Choose crop</option>{cropOptions.map((crop) => <option key={crop}>{crop}</option>)}</select></label><label><span className="form-label">Variety <em>(optional)</em></span><input value={form.variety} onChange={(event) => update('variety', event.target.value)} placeholder="Local variety" className="form-input" /></label><label><span className="form-label">Planting date <em>(optional)</em></span><input type="date" value={form.plantingDate} onChange={(event) => update('plantingDate', event.target.value)} className="form-input" /></label><label><span className="form-label">Location / field name</span><input required value={form.fieldName} onChange={(event) => update('fieldName', event.target.value)} placeholder="Backyard Field" className="form-input" /></label></div></section><section className="border-t border-[var(--border-color)] pt-6"><div className="mb-4 flex items-center gap-2"><MapPin className="h-5 w-5 text-[var(--leaf)]" /><h2 className="text-lg font-black text-[var(--text-primary)]">Farm information</h2></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="form-label">Soil type <em>(optional)</em></span><select value={form.soilType} onChange={(event) => update('soilType', event.target.value)} className="form-input"><option value="">Choose soil</option>{soilOptions.map((soil) => <option key={soil}>{soil}</option>)}</select></label><label><span className="form-label">Irrigation type <em>(optional)</em></span><select value={form.irrigationType} onChange={(event) => update('irrigationType', event.target.value)} className="form-input"><option value="">Choose irrigation</option>{irrigationOptions.map((irrigation) => <option key={irrigation}>{irrigation}</option>)}</select></label><label className="sm:col-span-2"><span className="form-label">Notes <em>(optional)</em></span><textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Anything Farmer AI should know about this plant?" rows="4" className="form-input resize-y" /></label></div></section><div className="rounded-2xl bg-[var(--bg-secondary)] p-4 text-xs leading-5 text-[var(--text-secondary)]">Plant photos are added during the existing Check Plant health scan, where they are saved to this plant's history.</div>{error && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-bg)] p-3 text-sm font-bold text-[var(--danger)]" role="alert">{error}</p>}<button disabled={saving} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 text-base font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"><Sprout className="h-5 w-5" />{saving ? 'Registering...' : 'Register Plant'}</button></form></div>;
}
