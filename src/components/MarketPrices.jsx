import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Search, 
  Filter, 
  Sparkles, 
  Building2, 
  ArrowUpRight, 
  Info,
  Calendar,
  CheckCircle2
} from 'lucide-react';

export default function MarketPrices() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const mandiCrops = [
    {
      id: 1,
      crop: 'Wheat (Sharbati)',
      category: 'Cereals',
      mandi: 'Indore APMC Mandi',
      price: 2450,
      unit: 'Quintal (100 kg)',
      change: '+4.2%',
      trend: 'up',
      high: 2520,
      low: 2380,
      aiAdvice: 'STRONG BUY / HOLD. Demand from flour mills is up 8%. Expected to hit ₹2,550 in 10 days.'
    },
    {
      id: 2,
      crop: 'Paddy / Basmati Rice',
      category: 'Cereals',
      mandi: 'Karnal Grain Market',
      price: 3890,
      unit: 'Quintal (100 kg)',
      change: '+1.8%',
      trend: 'up',
      high: 3950,
      low: 3750,
      aiAdvice: 'FAVORABLE TIME TO SELL. Export demand is peak. Sell 60% of stock now.'
    },
    {
      id: 3,
      crop: 'Tomato (Hybrid)',
      category: 'Vegetables',
      mandi: 'Kolar APMC Mandi',
      price: 1850,
      unit: 'Quintal (100 kg)',
      change: '-6.5%',
      trend: 'down',
      high: 2100,
      low: 1780,
      aiAdvice: 'PRICE DROP ALERT. Fresh harvest arrivals from neighboring states increased supply.'
    },
    {
      id: 4,
      crop: 'Onion (Red Nashik)',
      category: 'Vegetables',
      mandi: 'Lasalgaon Mandi',
      price: 2600,
      unit: 'Quintal (100 kg)',
      change: '+5.0%',
      trend: 'up',
      high: 2750,
      low: 2400,
      aiAdvice: 'STABLE GROWTH. Dry cold-storage stock fetches 10% premium.'
    },
    {
      id: 5,
      crop: 'Cotton (Long Staple)',
      category: 'Commercial',
      mandi: 'Rajkot Cotton Yard',
      price: 7200,
      unit: 'Quintal (100 kg)',
      change: '0.0%',
      trend: 'stable',
      high: 7350,
      low: 7100,
      aiAdvice: 'HOLD STOCK. Global textile demand expected to rebound post harvest.'
    },
    {
      id: 6,
      crop: 'Soybean (Yellow)',
      category: 'Oilseeds',
      mandi: 'Latur Grain Market',
      price: 4650,
      unit: 'Quintal (100 kg)',
      change: '+2.4%',
      trend: 'up',
      high: 4780,
      low: 4500,
      aiAdvice: 'GOOD MARKET RATE. Oil mill procurement is steady.'
    },
    {
      id: 7,
      crop: 'Potato (Jyoti)',
      category: 'Vegetables',
      mandi: 'Agra APMC Yard',
      price: 1420,
      unit: 'Quintal (100 kg)',
      change: '-1.5%',
      trend: 'down',
      high: 1550,
      low: 1380,
      aiAdvice: 'STORAGE ADVISED. Hold in cold storage for 4 weeks.'
    },
    {
      id: 8,
      crop: 'Maize / Yellow Corn',
      category: 'Cereals',
      mandi: 'Davangere Mandi',
      price: 2180,
      unit: 'Quintal (100 kg)',
      change: '+3.1%',
      trend: 'up',
      high: 2240,
      low: 2050,
      aiAdvice: 'HIGH POULTRY DEMAND. Rates firming up consistently.'
    }
  ];

  const categories = ['All', 'Cereals', 'Vegetables', 'Commercial', 'Oilseeds'];

  const filteredCrops = mandiCrops.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.crop.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.mandi.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800">
            <TrendingUp className="w-4 h-4" /> Live Mandi Rates
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Real-Time Crop Market Tracker
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Track daily APMC Mandi rates, high/low price boundaries, and AI selling advisories.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <span>Last Updated: Today 09:30 AM</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search crop or Mandi name..."
            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-none">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Crop Market Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCrops.map((item) => {
          const isUp = item.trend === 'up';
          const isDown = item.trend === 'down';

          return (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:shadow-lg hover:border-amber-400 transition-all space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {item.category} • {item.mandi}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {item.crop}
                  </h3>
                </div>

                {/* Trend Badge */}
                <div
                  className={`flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full border ${
                    isUp
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : isDown
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200'
                  }`}
                >
                  {isUp && <TrendingUp className="w-3.5 h-3.5" />}
                  {isDown && <TrendingDown className="w-3.5 h-3.5" />}
                  {!isUp && !isDown && <Minus className="w-3.5 h-3.5" />}
                  <span>{item.change}</span>
                </div>
              </div>

              {/* Price Numbers */}
              <div className="flex items-baseline justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Current Market Rate</span>
                  <div className="text-3xl font-black text-slate-900 dark:text-white">
                    ₹{item.price.toLocaleString('en-IN')}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {item.unit}</span>
                  </div>
                </div>

                <div className="text-right text-xs space-y-0.5">
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold">High: ₹{item.high}</div>
                  <div className="text-rose-500 font-medium">Low: ₹{item.low}</div>
                </div>
              </div>

              {/* AI Selling Recommendation */}
              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>AI SELLING ADVISORY</span>
                </div>
                <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.aiAdvice}
                </p>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
