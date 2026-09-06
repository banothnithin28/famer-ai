import React, { useState } from 'react';
import { 
  CloudSun, 
  Droplets, 
  Wind, 
  Thermometer, 
  Sun, 
  CloudRain, 
  CheckCircle2, 
  AlertCircle, 
  Calendar,
  Compass,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

export default function WeatherAdvisor() {
  const [selectedCity, setSelectedCity] = useState('Central Agricultural Hub');

  const currentWeather = {
    temp: 28,
    feelsLike: 30,
    humidity: 72,
    windSpeed: '14 km/h',
    windDir: 'SW',
    soilMoisture: '64% (Optimal)',
    soilTemp: '24°C @ 10cm depth',
    uvIndex: '6 (Moderate)',
    rainProbability: 85,
    condition: 'Thunderstorms Expected',
    irrigationAdvice: {
      action: 'DEFER IRRIGATION TODAY',
      status: 'warning',
      reason: 'Heavy rainfall (18-25mm) is projected within the next 18 hours. Irrigation today will lead to waterlogging, fertilizer leaching, and root rot risk.'
    }
  };

  const fiveDayForecast = [
    { day: 'Today', tempHigh: 28, tempLow: 21, rain: 85, condition: 'Heavy Rain', icon: CloudRain, color: 'text-sky-500' },
    { day: 'Tomorrow', tempHigh: 26, tempLow: 20, rain: 60, condition: 'Scattered Showers', icon: CloudRain, color: 'text-blue-400' },
    { day: 'Thu', tempHigh: 29, tempLow: 22, rain: 20, condition: 'Partly Cloudy', icon: CloudSun, color: 'text-amber-500' },
    { day: 'Fri', tempHigh: 31, tempLow: 23, rain: 10, condition: 'Sunny & Clear', icon: Sun, color: 'text-amber-400' },
    { day: 'Sat', tempHigh: 32, tempLow: 24, rain: 5, condition: 'Clear Sky', icon: Sun, color: 'text-amber-400' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800">
            <CloudSun className="w-4 h-4" /> Microclimate Intelligence
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Weather & Smart Irrigation Guard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Real-time field weather parameters combined with predictive AI irrigation advice.
          </p>
        </div>

        {/* Location selector */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 flex items-center gap-2 shadow-xs">
          <Compass className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold text-slate-500">Region:</span>
          <select 
            value={selectedCity} 
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-transparent font-bold text-sm text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
          >
            <option value="Central Agricultural Hub">Central Agri Zone (Punjab/Haryana)</option>
            <option value="Deccan Plateau Zone">Deccan Plateau (Telangana/AP)</option>
            <option value="Western Gangetic Plains">Western Gangetic Plains (UP/Bihar)</option>
            <option value="Southern Coastal Belt">Southern Coastal Belt (Tamil Nadu)</option>
          </select>
        </div>
      </div>

      {/* AI Irrigation Recommendation Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-6 shadow-xl border border-amber-400/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <AlertCircle className="w-7 h-7 text-amber-200 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-amber-100 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                AI SMART WATER ADVISORY
              </span>
              <span className="text-xs text-amber-100 font-medium">• Action Required</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">{currentWeather.irrigationAdvice.action}</h2>
            <p className="text-sm text-amber-50/90 leading-relaxed font-normal">
              {currentWeather.irrigationAdvice.reason}
            </p>
          </div>
        </div>
      </div>

      {/* Current Conditions Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Temperature */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Temperature</span>
            <Thermometer className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{currentWeather.temp}°C</span>
            <span className="text-xs text-slate-400">Feels {currentWeather.feelsLike}°C</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">{currentWeather.condition}</p>
        </div>

        {/* Rain Probability */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Rain Probability</span>
            <CloudRain className="w-5 h-5 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-sky-600 dark:text-sky-400">{currentWeather.rainProbability}%</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">18-25mm expected</p>
        </div>

        {/* Humidity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Air Humidity</span>
            <Droplets className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{currentWeather.humidity}%</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">High fungal spore risk</p>
        </div>

        {/* Soil Moisture */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Soil Moisture</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{currentWeather.soilMoisture}</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">{currentWeather.soilTemp}</p>
        </div>

      </div>

      {/* 5-Day Agricultural Forecast */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" /> 5-Day Field Weather Outlook
          </h3>
          <span className="text-xs font-medium text-slate-400">High / Low °C</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {fiveDayForecast.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 text-center space-y-3 hover:border-emerald-400 transition-all"
              >
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  {item.day}
                </span>

                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 mx-auto flex items-center justify-center shadow-xs">
                  <Icon className={`w-6 h-6 ${item.color}`} />
                </div>

                <div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {item.tempHigh}° <span className="text-xs font-medium text-slate-400">/ {item.tempLow}°</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">{item.condition}</p>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center justify-center gap-1">
                  <Droplets className="w-3 h-3" /> {item.rain}% Rain
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
