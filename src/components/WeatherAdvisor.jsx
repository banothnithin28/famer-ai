import React, { useEffect, useState } from 'react';
import {
  AlertCircle, Calendar, Cloud, CloudRain, CloudSun, Compass, Droplets,
  RefreshCw, ShieldCheck, Sun, Thermometer, Zap,
} from 'lucide-react';
import { getWeather } from '../services/apiService';

const LOCATIONS = {
  punjab: { label: 'Central Agri Zone (Punjab/Haryana)', latitude: 30.901, longitude: 75.857 },
  deccan: { label: 'Deccan Plateau (Telangana/AP)', latitude: 17.385, longitude: 78.487 },
  gangetic: { label: 'Western Gangetic Plains (UP/Bihar)', latitude: 26.847, longitude: 80.947 },
  coastal: { label: 'Southern Coastal Belt (Tamil Nadu)', latitude: 13.083, longitude: 80.271 },
};

function weatherIcon(icon, className = 'h-6 w-6') {
  const icons = { clear: Sun, 'partly-cloudy': CloudSun, cloudy: Cloud, rain: CloudRain, thunderstorm: Zap };
  const Icon = icons[icon] || CloudSun;
  return <Icon className={className} aria-hidden="true" />;
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function irrigationAdvice(weather) {
  if (!weather) return { action: 'NOT ENOUGH DATA FOR IRRIGATION ADVICE', reason: 'Live weather data is not available right now.' };
  const rain = weather.next_18_hours?.precipitation ?? 0;
  const probability = weather.next_18_hours?.rain_probability ?? 0;
  if (rain >= 5 || probability >= 70) {
    return { action: 'DEFER IRRIGATION', reason: `${rain} mm of precipitation is expected in the next 18 hours, with a ${probability}% rain probability. Recheck conditions tomorrow.` };
  }
  return { action: 'CHECK SOIL BEFORE IRRIGATING', reason: `Only ${rain} mm of precipitation is expected in the next 18 hours. Soil moisture data is not available, so check the soil before watering.` };
}

export default function WeatherAdvisor() {
  const [selectedLocation, setSelectedLocation] = useState('deccan');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadWeather = async (locationKey = selectedLocation) => {
    const location = LOCATIONS[locationKey];
    setLoading(true);
    setError('');
    try {
      const result = await getWeather(location.latitude, location.longitude);
      if (!result.success) throw new Error(result.error || 'Weather information is temporarily unavailable.');
      setWeather(result);
      setLastUpdated(new Date());
    } catch (requestError) {
      setWeather(null);
      setError(requestError.message || 'Weather information is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather(selectedLocation);
    const refreshTimer = window.setInterval(() => loadWeather(selectedLocation), 10 * 60 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, [selectedLocation]);

  const advice = irrigationAdvice(weather);
  const current = weather?.current;
  const forecast = weather?.forecast || [];

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800 dark:border-sky-800 dark:bg-sky-950/80 dark:text-sky-300"><CloudSun className="h-4 w-4" /> Microclimate Intelligence</div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Weather & Smart Irrigation Guard</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Live local weather from {weather?.source || 'the weather service'}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Compass className="h-4 w-4 text-emerald-500" />
          <label htmlFor="weather-location" className="text-xs font-semibold text-slate-500">Location:</label>
          <select id="weather-location" value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)} className="max-w-[230px] bg-transparent text-sm font-bold text-slate-800 focus:outline-none dark:text-slate-100">{Object.entries(LOCATIONS).map(([key, location]) => <option key={key} value={key}>{location.label}</option>)}</select>
          <button type="button" onClick={() => loadWeather()} disabled={loading} title="Refresh weather" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {loading && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 text-sm font-bold text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200" role="status">Getting local weather...</div>}
      {!loading && error && <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200" role="alert"><span className="flex items-center gap-2 font-bold"><AlertCircle className="h-5 w-5" /> Weather information is temporarily unavailable.</span><span>{error}</span><button type="button" onClick={() => loadWeather()} className="min-h-11 w-fit rounded-xl bg-rose-700 px-4 font-black text-white hover:bg-rose-600">Try Again</button></div>}

      {!loading && !error && weather && <>
        <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-6 text-white shadow-xl"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20"><AlertCircle className="h-7 w-7" /></div><div className="space-y-1"><span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">AI SMART WATER ADVISORY</span><h2 className="text-2xl font-black tracking-tight">{advice.action}</h2><p className="text-sm leading-relaxed text-white/90">{advice.reason}</p></div></div></div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex justify-between text-slate-500"><span className="text-xs font-semibold">Temperature</span><Thermometer className="h-5 w-5 text-amber-500" /></div><span className="text-3xl font-extrabold text-slate-900 dark:text-white">{Math.round(current.temperature)}°C</span><p className="text-[11px] text-slate-500">Feels like {Math.round(current.feels_like)}°C</p><p className="text-[11px] font-medium text-slate-500">{current.condition}</p></div>
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex justify-between text-slate-500"><span className="text-xs font-semibold">Rain Probability</span><CloudRain className="h-5 w-5 text-sky-500" /></div><span className="text-3xl font-extrabold text-sky-600 dark:text-sky-400">{weather.next_18_hours.rain_probability}%</span><p className="text-[11px] text-slate-500">Next 18 hours</p><p className="text-[11px] font-medium text-slate-500">{weather.next_18_hours.precipitation} mm expected</p></div>
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex justify-between text-slate-500"><span className="text-xs font-semibold">Air Humidity</span><Droplets className="h-5 w-5 text-blue-500" /></div><span className="text-3xl font-extrabold text-slate-900 dark:text-white">{current.humidity}%</span><p className="text-[11px] text-slate-500">Live relative humidity</p><p className="text-[11px] font-medium text-slate-500">Wind {Math.round(current.wind_speed)} km/h</p></div>
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex justify-between text-slate-500"><span className="text-xs font-semibold">Soil Moisture</span><ShieldCheck className="h-5 w-5 text-emerald-500" /></div><span className="text-xl font-extrabold text-slate-600 dark:text-slate-300">Not available</span><p className="text-[11px] text-slate-500">No soil sensor connected</p><p className="text-[11px] font-medium text-slate-500">Air humidity is not soil moisture</p></div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Calendar className="h-5 w-5 text-emerald-500" /> 5-Day Field Weather Outlook</h3><span className="text-xs font-medium text-slate-400">High / Low °C</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-5">{forecast.map((item) => <div key={item.date} className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-center dark:border-slate-700/80 dark:bg-slate-800/60"><span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{formatDate(item.date)}</span><div className="mx-auto my-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-700">{weatherIcon(item.icon, 'h-6 w-6 text-sky-500')}</div><div className="text-sm font-extrabold text-slate-900 dark:text-white">{Math.round(item.high)}° <span className="text-xs font-medium text-slate-400">/ {Math.round(item.low)}°</span></div><p className="mt-1 text-[11px] font-medium text-slate-500">{item.condition}</p><div className="mt-3 border-t border-slate-200 pt-2 text-[11px] font-bold text-sky-600 dark:border-slate-700 dark:text-sky-400"><Droplets className="mr-1 inline h-3 w-3" />{item.rain_probability}% rain · {item.precipitation} mm</div></div>)}</div></div>
        <p className="text-right text-xs text-slate-400">Source: {weather.source} · Coordinates: {weather.location.latitude.toFixed(3)}, {weather.location.longitude.toFixed(3)} · Last updated {lastUpdated?.toLocaleTimeString()}</p>
      </>}
    </div>
  );
}
