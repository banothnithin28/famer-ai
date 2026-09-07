import React, { useState, useEffect } from 'react';
import { 
  Sprout, 
  Bot, 
  Scan, 
  CloudSun, 
  TrendingUp, 
  FileText, 
  Calculator, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Droplets, 
  Thermometer, 
  Sun,
  Award,
  User
} from 'lucide-react';
import { getDashboardSummary } from '../services/apiService';

export default function Dashboard({ setActiveTab, user, onOpenAuthModal }) {
  const [summaryData, setSummaryData] = useState(null);

  useEffect(() => {
    getDashboardSummary().then((res) => {
      if (res && res.success) setSummaryData(res);
    }).catch(() => {});
  }, [user]);

  const quickStats = [
    { 
      label: "Diagnostic Confidence", 
      value: summaryData?.stats?.diagnostic_accuracy || "98.4%", 
      icon: ShieldCheck, 
      color: "text-emerald-500" 
    },
    { 
      label: "Crop Scans Completed", 
      value: summaryData?.stats?.scans_completed !== undefined ? `${summaryData.stats.scans_completed}` : "3", 
      icon: Scan, 
      color: "text-blue-500" 
    },
    { 
      label: "Real-time Mandi Markets", 
      value: summaryData?.stats?.active_markets || "2,400+", 
      icon: TrendingUp, 
      color: "text-amber-500" 
    },
    { 
      label: "Crops Evaluated", 
      value: summaryData?.stats?.crops_recommended !== undefined ? `${summaryData.stats.crops_recommended}` : "18+", 
      icon: Sprout, 
      color: "text-purple-500" 
    }
  ];

  const featureCards = [
    {
      id: 'crop',
      title: 'Smart Crop Recommendation',
      desc: 'Predict high-yielding crops tailored for your soil texture, season, and rainfall using crop_model.pkl.',
      icon: Sprout,
      color: 'from-emerald-600 to-green-700',
      badge: 'ML Engine'
    },
    {
      id: 'scanner',
      title: 'Crop Disease Scanner',
      desc: 'Upload leaf or plant photos for instant AI disease identification & treatment remedies.',
      icon: Scan,
      color: 'from-teal-500 to-emerald-600',
      badge: 'Vision AI'
    },
    {
      id: 'weather',
      title: 'Weather & Irrigation Guard',
      desc: 'Local weather forecasts paired with smart AI irrigation timing recommendations.',
      icon: CloudSun,
      color: 'from-sky-500 to-blue-600',
      badge: 'Smart Water'
    },
    {
      id: 'market',
      title: 'Live Mandi Price Tracker',
      desc: 'Track daily crop price trends, market highs/lows, and AI selling advisories.',
      icon: TrendingUp,
      color: 'from-amber-500 to-orange-600',
      badge: 'Market Pulse'
    },
    {
      id: 'schemes',
      title: 'Govt Schemes & Subsidies',
      desc: 'Find PM-KISAN, crop insurance, and solar pump subsidies with instant eligibility checks.',
      icon: FileText,
      color: 'from-indigo-500 to-purple-600',
      badge: 'Financial Aid'
    },
    {
      id: 'calculator',
      title: 'Yield & Fertilizer Calc',
      desc: 'Calculate exact Urea, DAP, and MOP requirements per acre to maximize crop yield.',
      icon: Calculator,
      color: 'from-lime-600 to-emerald-700',
      badge: 'AgriCalc'
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white p-8 md:p-12 shadow-2xl">
        {/* Decorative Background Accents */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>
                {user ? `🌾 Welcome back, Farmer ${user.name} (${user.location})!` : "Next-Gen Smart Agriculture Engine"}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Empowering Farmers with <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-green-200 to-amber-200">Artificial Intelligence</span>
            </h1>

            <p className="text-emerald-100/90 text-base md:text-lg max-w-2xl font-normal leading-relaxed">
              Make smarter agricultural decisions with{' '}
              <span className="font-semibold text-emerald-300 bg-emerald-800/50 px-2 py-0.5 rounded-md border border-emerald-500/30">AI crop recommendations</span>,{' '}
              <span className="font-semibold text-teal-300 bg-teal-800/50 px-2 py-0.5 rounded-md border border-teal-500/30">instant leaf disease diagnosis</span>,{' '}
              <span className="font-semibold text-sky-300 bg-sky-800/50 px-2 py-0.5 rounded-md border border-sky-500/30">live weather alerts</span>, and{' '}
              <span className="font-semibold text-amber-300 bg-amber-800/50 px-2 py-0.5 rounded-md border border-amber-500/30">precision irrigation</span>.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setActiveTab('crop')}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm"
              >
                <Sprout className="w-4 h-4" />
                <span>Crop Recommendation</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTab('scanner')}
                className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-emerald-500/30 text-emerald-200 font-semibold px-4 py-3 rounded-xl backdrop-blur-md hover:text-white transition-all text-sm"
              >
                <Scan className="w-4 h-4 text-teal-400" />
                <span>Scan Disease</span>
              </button>

              <button
                onClick={() => setActiveTab('chat')}
                className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-emerald-500/30 text-emerald-200 font-semibold px-4 py-3 rounded-xl backdrop-blur-md hover:text-white transition-all text-sm"
              >
                <Bot className="w-4 h-4 text-emerald-400" />
                <span>Ask AI</span>
              </button>
            </div>
          </div>

          {/* Quick AI Tip Card */}
          <div className="lg:col-span-5">
            <div className="bg-slate-800/70 border border-emerald-500/30 backdrop-blur-md rounded-2xl p-6 text-slate-100 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-sm tracking-wide text-amber-300">DAILY AGRONOMIST ADVISORY</span>
                </div>
                <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  Updated Today
                </span>
              </div>

              <div className="space-y-2 border-l-2 border-emerald-500 pl-4 py-1">
                <h3 className="font-bold text-base text-white">Wheat & Cereal Crop Sowing Season</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  "Ensure seed treatment with *Trichoderma viride* @ 4g/kg seed prior to sowing to shield roots from collar rot and wilt pathogens."
                </p>
              </div>

              <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5 text-amber-400" /> 28°C</span>
                  <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-sky-400" /> 68% Hum</span>
                </div>
                <button 
                  onClick={() => setActiveTab('weather')} 
                  className="text-emerald-300 hover:text-emerald-200 font-semibold underline underline-offset-2"
                >
                  View Irrigation Plan →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{stat.label}</span>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Feature Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Smart Agricultural Tools
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select a module to start leveraging AI for your farm.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => setActiveTab(card.id)}
                className="group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:shadow-xl hover:border-emerald-500/40 transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {card.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-2">
                    {card.title}
                  </h3>

                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                    {card.desc}
                  </p>
                </div>

                <div className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                  <span>Open Tool</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
