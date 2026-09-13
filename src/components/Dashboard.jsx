import React, { useEffect, useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, ChevronRight, CloudSun, Leaf, Scan, Sprout } from 'lucide-react';
import { createPlant, getDashboardSummary, getPlants } from '../services/apiService';
import FarmScene from './FarmScene';

const quickTools = [
  { id: 'scanner', label: 'Scan Plant', text: 'Upload a leaf photo and check for possible problems.', icon: Scan, tone: 'bg-emerald-700' },
  { id: 'chat', label: 'Ask Farmer AI', text: 'Get simple answers about crops, leaves, and care.', icon: Bot, tone: 'bg-sky-700' },
  { id: 'plant-details', label: 'My Plant History', text: 'Review scans for a registered plant.', icon: Sprout, tone: 'bg-amber-600' },
  { id: 'weather', label: 'Farming Tips', text: 'Check weather and irrigation guidance.', icon: CloudSun, tone: 'bg-teal-700' },
];

export default function Dashboard({ setActiveTab, user, onOpenPlantDetails }) {
  const [summary, setSummary] = useState(null);
  const [plants, setPlants] = useState([]);
  const [form, setForm] = useState({ crop_name: '', field_name: '', location: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    Promise.all([getDashboardSummary(), getPlants()]).then(([summaryResponse, plantsResponse]) => {
      if (summaryResponse?.success) setSummary(summaryResponse);
      if (plantsResponse?.success) setPlants(plantsResponse.plants || []);
    }).catch(() => {});
  }, [user]);

  const registerPlant = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      const response = await createPlant(form);
      if (!response.success) throw new Error(response.error || 'Unable to register this plant.');
      setPlants((current) => [response.plant, ...current]);
      setForm({ crop_name: '', field_name: '', location: '' });
    } catch (error) {
      setFormError(error.message || 'Unable to register this plant.');
    }
  };

  const scanCount = summary?.stats?.scans_completed;

  return (
    <div className="space-y-8 pb-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#173b2a] px-6 py-8 text-white shadow-xl sm:px-10 sm:py-12">
        <FarmScene />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(11,43,28,.92)_0%,rgba(16,63,39,.72)_52%,rgba(16,63,39,.34)_100%)]" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[32px] border-emerald-400/10" />
        <div className="relative max-w-3xl space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-100"><Leaf className="h-4 w-4" /> Practical help for your next farm decision</p>
          <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-5xl">Understand your plant's health before the problem gets worse.</h1>
          <p className="max-w-xl text-base leading-relaxed text-emerald-50/80 sm:text-lg">Take a photo of a plant leaf and let Farmer AI help identify possible problems with simple next steps.</p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button onClick={() => setActiveTab('scanner')} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 text-base font-black text-[#173b2a] shadow-lg shadow-black/20 hover:bg-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-200/60"><Scan className="h-5 w-5" /> Scan My Plant <ArrowRight className="h-5 w-5" /></button>
            <button onClick={() => setActiveTab('chat')} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 text-base font-bold text-white hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-white/30"><Bot className="h-5 w-5" /> Ask Farmer AI</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickTools.map(({ id, label, text, icon: Icon, tone }) => <button key={id} onClick={() => id === 'plant-details' && plants[0] ? onOpenPlantDetails(plants[0].id) : setActiveTab(id)} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"><span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${tone}`}><Icon className="h-5 w-5" /></span><span className="mt-4 block text-base font-black text-slate-900 dark:text-white">{label}<ChevronRight className="ml-1 inline h-4 w-4 text-emerald-600 transition group-hover:translate-x-1" /></span><span className="mt-1 block text-sm leading-relaxed text-slate-500 dark:text-slate-400">{text}</span></button>)}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-emerald-600">Your farm space</p><h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">My plants</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Register a plant to keep its real scan history in one place.</p></div><Sprout className="h-7 w-7 text-emerald-600" /></div>
          {plants.length ? <div className="mt-6 space-y-3">{plants.slice(0, 3).map((plant) => <button key={plant.id} onClick={() => onOpenPlantDetails(plant.id)} className="flex min-h-16 w-full items-center justify-between rounded-xl border border-slate-200 px-4 text-left hover:border-emerald-400 dark:border-slate-700"><span><span className="block font-black text-slate-900 dark:text-white">{plant.crop_name}</span><span className="text-xs text-slate-500">{plant.field_name}</span></span><span className="text-right text-xs font-bold text-emerald-700 dark:text-emerald-400">{plant.latest_scan_date || 'No scan yet'}<ChevronRight className="ml-1 inline h-4 w-4" /></span></button>)}</div> : <form onSubmit={registerPlant} className="mt-6 space-y-3"><p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">No plant scans yet. Add a plant, then start your first scan.</p><div className="grid gap-3 sm:grid-cols-2"><input required value={form.crop_name} onChange={(e) => setForm({ ...form, crop_name: e.target.value })} placeholder="Crop name" className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" /><input required value={form.field_name} onChange={(e) => setForm({ ...form, field_name: e.target.value })} placeholder="Field or plant name" className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" /></div><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location (optional)" className="min-h-12 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" /><button className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-600">Register plant</button>{formError && <p className="text-sm font-bold text-rose-600">{formError}</p>}</form>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-[#fffaf0] p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-amber-700">Your activity</p><h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">A clear next step</h2><p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{scanCount ? `You have completed ${scanCount} plant scan${scanCount === 1 ? '' : 's'}. Open your history to review the real results.` : 'Start with one clear leaf photo. You can return here to review your scan history.'}</p><div className="mt-6 flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800"><CheckCircle2 className="h-6 w-6 text-emerald-600" /><span className="text-sm font-bold text-slate-700 dark:text-slate-200">One photo at a time. Simple guidance after every scan.</span></div><button onClick={() => setActiveTab('scanner')} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-600">Start a scan <ArrowRight className="h-4 w-4" /></button></div>
      </section>
    </div>
  );
}
