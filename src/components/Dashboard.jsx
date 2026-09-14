import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Check, ChevronRight, CloudRain, CloudSun, Droplets, Leaf, MapPin, Plus, Scan, ShieldCheck, Sprout, Sun } from 'lucide-react';
import { createPlant, getDashboardSummary, getPlants, getWeather } from '../services/apiService';

const WEATHER_LOCATION = { latitude: 17.385, longitude: 78.487 };
const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
};
const checked = (value) => {
  const date = parseDate(value);
  if (!date) return 'Not checked yet';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  return days <= 0 ? 'Checked today' : days === 1 ? 'Checked yesterday' : `Checked ${days} days ago`;
};
const status = (value) => value === 'Healthy'
  ? { label: 'Healthy', text: 'text-[#3F8F55]', bg: 'bg-[#E8F3E8]', dot: 'bg-[#3F8F55]' }
  : ['Needs Attention', 'Uncertain / Re-scan'].includes(value)
    ? { label: 'Needs Attention', text: 'text-[#B66A20]', bg: 'bg-[#FFF0D9]', dot: 'bg-[#D98B32]' }
    : { label: 'Not checked yet', text: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' };

export default function Dashboard({ setActiveTab, user, onOpenPlantDetails, onRegisterPlant }) {
  const [summary, setSummary] = useState(null);
  const [plants, setPlants] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ crop_name: '', field_name: '', location: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([getDashboardSummary(), getPlants(), getWeather(WEATHER_LOCATION.latitude, WEATHER_LOCATION.longitude)]).then(([summaryResult, plantsResult, weatherResult]) => {
      if (!active) return;
      if (summaryResult.status === 'fulfilled' && summaryResult.value?.success) setSummary(summaryResult.value);
      if (plantsResult.status === 'fulfilled' && plantsResult.value?.success) setPlants(plantsResult.value.plants || []);
      if (weatherResult.status === 'fulfilled' && weatherResult.value?.success) setWeather(weatherResult.value);
      setLoadingWeather(false);
    });
    return () => { active = false; };
  }, [user]);

  const health = useMemo(() => {
    const values = plants.map((plant) => Number(plant.latest_confidence)).filter(Number.isFinite);
    if (values.length) return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
    const fallback = Number.parseInt(summary?.stats?.diagnostic_accuracy, 10);
    return Number.isFinite(fallback) ? fallback : 0;
  }, [plants, summary]);
  const healthy = plants.filter((plant) => plant.status === 'Healthy').length;
  const attention = plants.filter((plant) => ['Needs Attention', 'Uncertain / Re-scan'].includes(plant.status)).length;
  const current = weather?.current;
  const rain = weather?.next_18_hours?.rain_probability;
  const WeatherIcon = current?.icon === 'clear' ? Sun : CloudSun;
  const attentionPlant = plants.find((plant) => ['Needs Attention', 'Uncertain / Re-scan'].includes(plant.status));
  const activities = (summary?.recent_scans || []).map((scan) => ({ label: `${scan.disease_name || 'Plant'} checked`, date: parseDate(scan.created_at)?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) || 'Recently' }));
  if (weather) activities.push({ label: 'Weather updated', date: 'Today' });
  if (!activities.length) activities.push({ label: 'Your farm is ready to monitor', date: 'Start when ready' });

  async function registerPlant(event) {
    event.preventDefault();
    setFormError('');
    try {
      const response = await createPlant(form);
      if (!response.success) throw new Error(response.error || 'Unable to add this plant.');
      setPlants((currentPlants) => [response.plant, ...currentPlants]);
      setForm({ crop_name: '', field_name: '', location: '' });
      setShowForm(false);
    } catch (error) { setFormError(error.message || 'Unable to add this plant.'); }
  }

  return <div className="farmer-home space-y-6 pb-20 lg:pb-10">
    <header className="flex items-start justify-between gap-4 px-1 pt-2"><div><div className="flex items-center gap-2"><Sprout className="h-6 w-6 text-[#2F6B3B]" /><span className="text-sm font-black uppercase tracking-[0.16em] text-[#2F6B3B]">FarmerAI</span></div><p className="mt-5 text-sm font-semibold text-slate-500">Good morning{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</p><h1 className="mt-1 text-3xl font-black tracking-tight text-[#243126] sm:text-4xl">My Farm Today</h1><p className="mt-2 text-sm text-slate-600">Here's what's happening with your farm today.</p></div><div className="hidden items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm sm:flex"><MapPin className="h-4 w-4 text-[#78A95A]" /> {user?.location || 'Telangana region'}</div></header>

    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="farmer-card p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="farmer-kicker">My farm today</p><h2 className="mt-2 text-2xl font-black text-[#243126]">Farm Health</h2><p className="mt-1 text-sm text-slate-500">Your latest plant health at a glance.</p></div><span className="rounded-full bg-[#E8F3E8] px-3 py-1.5 text-xs font-bold text-[#3F8F55]"><ShieldCheck className="mr-1 inline h-4 w-4" /> Live</span></div><div className="mt-8 grid items-center gap-7 sm:grid-cols-[170px_1fr]"><div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full" style={{ background: `conic-gradient(#3F8F55 ${health}%, #E8F3E8 0)` }}><div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white"><span className="text-4xl font-black text-[#243126]">{health || '--'}<small className="text-xl">{health ? '%' : ''}</small></span><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">overall</span></div></div><div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#E8F3E8] p-4"><span className="block text-2xl font-black text-[#3F8F55]">{healthy}</span><span className="mt-1 block text-xs font-bold text-[#2F6B3B]">Healthy Plants</span></div><div className="rounded-2xl bg-[#FFF0D9] p-4"><span className="block text-2xl font-black text-[#B66A20]">{attention}</span><span className="mt-1 block text-xs font-bold text-[#8C5A22]">Needs Attention</span></div></div><div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#E8F3E8]"><div className="h-full rounded-full bg-[#3F8F55] transition-all duration-700" style={{ width: `${health}%` }} /></div><p className="mt-2 text-xs font-semibold text-slate-500">{summary?.recent_scans?.[0] ? checked(summary.recent_scans[0].created_at) : 'Add a plant to start tracking health.'}</p></div></div></div><div className="farmer-card bg-[#EAF4F6] p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="farmer-kicker text-[#4F91A8]">Today's weather</p><h2 className="mt-3 text-4xl font-black text-[#243126]">{current ? `${Math.round(current.temperature)}°C` : '--'}</h2><p className="mt-1 text-base font-bold text-slate-600">{loadingWeather ? 'Getting local weather...' : current?.condition || 'Weather unavailable'}</p></div><WeatherIcon className="h-12 w-12 text-[#4F91A8]" /></div><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/75 p-4"><Droplets className="h-5 w-5 text-[#4F91A8]" /><p className="mt-2 text-lg font-black text-[#243126]">{current?.humidity ?? '--'}%</p><span className="text-xs font-semibold text-slate-500">Humidity</span></div><div className="rounded-2xl bg-white/75 p-4"><CloudRain className="h-5 w-5 text-[#4F91A8]" /><p className="mt-2 text-lg font-black text-[#243126]">{rain ?? '--'}%</p><span className="text-xs font-semibold text-slate-500">Rain chance</span></div></div><button onClick={() => setActiveTab('weather')} className="mt-5 inline-flex min-h-11 items-center gap-1 text-sm font-black text-[#2F6B3B]">Open weather details <ChevronRight className="h-4 w-4" /></button></div></section>

    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="farmer-card p-6 sm:p-8"><div className="flex items-end justify-between gap-3"><div><p className="farmer-kicker">My crops</p><h2 className="mt-2 text-2xl font-black text-[#243126]">Plants in your care</h2></div><div className="flex items-center gap-3"><button onClick={onRegisterPlant} className="text-sm font-black text-[#2F6B3B]"><Plus className="mr-1 inline h-4 w-4" /> Register</button><button onClick={() => plants[0] && onOpenPlantDetails(plants[0].id)} className="text-sm font-black text-[#2F6B3B]">History <ChevronRight className="inline h-4 w-4" /></button></div></div>{plants.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2">{plants.slice(0, 4).map((plant) => { const item = status(plant.status); return <button key={plant.id} onClick={() => onOpenPlantDetails(plant.id)} className="group flex min-h-[124px] items-center gap-4 rounded-2xl border border-[#E3EAE0] bg-[#FCFDF9] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#78A95A] hover:shadow-md"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8F3E8] text-[#2F6B3B]"><Leaf className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="block truncate text-base font-black text-[#243126]">{plant.crop_name}</span><span className="mt-1 block truncate text-xs text-slate-500">{plant.field_name}</span><span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-black ${item.bg} ${item.text}`}><span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} /> {item.label}</span></span><span className="text-right"><span className="block text-xl font-black text-[#243126]">{plant.latest_confidence != null ? `${Math.round(plant.latest_confidence)}%` : '--'}</span><span className="mt-1 block text-[10px] font-semibold text-slate-400">{checked(plant.latest_scan_date)}</span></span></button>; })}</div> : <div className="mt-6 rounded-2xl border border-dashed border-[#B7D0B1] bg-[#F4F8F0] p-6 text-center"><Sprout className="mx-auto h-9 w-9 text-[#78A95A]" /><p className="mt-3 font-black text-[#243126]">No plants added yet</p><p className="mt-1 text-sm text-slate-500">Add your first crop to start its history.</p><button onClick={onRegisterPlant} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2F6B3B] px-5 text-sm font-black text-white hover:bg-[#24552F]"><Plus className="h-4 w-4" /> Add Your First Plant</button></div>}</div><div className="farmer-card p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="farmer-kicker">Recent activity</p><h2 className="mt-2 text-2xl font-black text-[#243126]">Farm updates</h2></div><Activity className="h-6 w-6 text-[#78A95A]" /></div><div className="mt-6 space-y-4">{activities.slice(0, 4).map((activity, index) => <div key={`${activity.label}-${index}`} className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8F3E8] text-[#3F8F55]"><Check className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-[#243126]">{activity.label}</span><span className="mt-0.5 block text-xs text-slate-500">{activity.date}</span></span></div>)}</div></div></section>

    <section className="grid gap-5 lg:grid-cols-3"><div className="farmer-card bg-[#FFF8E8] p-6"><div className="flex items-start justify-between"><div><p className="farmer-kicker text-[#B66A20]">Farmer AI insight</p><h2 className="mt-2 text-xl font-black text-[#243126]">A helpful next step</h2></div><span className="text-2xl">🤖</span></div><p className="mt-4 text-sm leading-6 text-slate-700">{attentionPlant ? `${attentionPlant.crop_name} may need attention. Check the lower leaves and soil moisture.` : plants.length ? 'Your plants are looking steady. Keep checking soil moisture before watering.' : 'Add a plant to receive useful insights from your real farm history.'}</p><button onClick={() => setActiveTab('chat')} className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-black text-[#8C5A22]">View Insight <ArrowRight className="h-4 w-4" /></button></div><div className="farmer-card p-6"><div className="flex items-start justify-between"><div><p className="farmer-kicker text-[#B66A20]">Today's farming tip</p><h2 className="mt-2 text-xl font-black text-[#243126]">One simple thing</h2></div><span className="text-2xl">💡</span></div><p className="mt-4 text-sm leading-6 text-slate-700">Check soil moisture before your next irrigation.</p><div className="mt-5 flex items-center gap-2 text-xs font-bold text-[#3F8F55]"><Droplets className="h-4 w-4" /> Save water, grow stronger crops</div></div><div className="farmer-card flex flex-col justify-between bg-[#2F6B3B] p-6 text-white"><div><p className="farmer-kicker text-[#D7E9C7]">Check your plant</p><h2 className="mt-2 text-xl font-black">Is something wrong?</h2><p className="mt-3 text-sm leading-6 text-white/80">Take or upload a leaf photo to check your plant's health.</p></div><button onClick={() => setActiveTab('scanner')} className="mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-[#F2B84B] px-4 text-sm font-black text-[#243126] hover:bg-[#F6CA6F]"><Scan className="h-4 w-4" /> Check Plant <ArrowRight className="h-4 w-4" /></button></div></section>
  </div>;
}
