import React, { useState } from 'react';
import { Sprout, Bot, Scan, Sun, Moon, Menu, X, User, LogOut, History, MoreHorizontal, Lightbulb, Plus } from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  darkMode, 
  setDarkMode, 
  onOpenHistory,
  user,
  onOpenAuthModal,
  onLogout
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryItems = [
    { id: 'dashboard', label: 'Home', icon: Sprout },
    { id: 'register', label: 'Register Plant', icon: Plus },
    { id: 'scanner', label: 'Check Plant', icon: Scan },
    { id: 'chat', label: 'Ask AI', icon: Bot },
    { id: 'plant-details', label: 'My Crops', icon: History },
  ];

  const tools = [
    { id: 'crop', label: 'Crop Advisor', icon: Sprout },
    { id: 'weather', label: 'Weather Guard', icon: Sun },
    { id: 'market', label: 'Mandi Rates', icon: MoreHorizontal },
    { id: 'schemes', label: 'Govt Schemes', icon: MoreHorizontal },
    { id: 'calculator', label: 'Fertilizer Calculator', icon: MoreHorizontal },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#E3EAE0] bg-[#F7F8F2]/95 shadow-sm backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-900/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo */}
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Sprout className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
                  Farmer<span className="text-emerald-600 dark:text-emerald-400">AI</span>
                </span>
                <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
                  Pro 2.0
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 -mt-1 hidden sm:block">
                Smart Agriculture Assistant
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => item.id === 'plant-details' && onOpenHistory ? onOpenHistory() : setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all relative ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-xs border border-emerald-200/60 dark:border-emerald-800'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <details className="relative ml-1">
              <summary className="list-none flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                <MoreHorizontal className="h-4 w-4" /> Tools
              </summary>
              <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                {tools.map((item) => <button key={item.id} onClick={() => setActiveTab(item.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-emerald-950/50"> <item.icon className="h-4 w-4 text-emerald-600" /> {item.label}</button>)}
              </div>
            </details>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Farmer Auth Button */}
            {user ? (
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold px-2.5 py-1.5 rounded-lg">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{user.name}</span>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="text-xs font-semibold px-2 py-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all"
              >
                <User className="w-3.5 h-3.5" />
                <span>Farmer Login</span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle Theme"
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-2xl border border-[#DDE9D8] bg-white/95 p-2 shadow-2xl backdrop-blur-md lg:hidden" aria-label="Farmer navigation">
        <button onClick={() => setActiveTab('dashboard')} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-black ${activeTab === 'dashboard' ? 'bg-[#E8F3E8] text-[#2F6B3B]' : 'text-slate-500'}`}><Sprout className="h-5 w-5" />Home</button>
        <button onClick={() => onOpenHistory ? onOpenHistory() : setActiveTab('dashboard')} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-black ${activeTab === 'plant-details' ? 'bg-[#E8F3E8] text-[#2F6B3B]' : 'text-slate-500'}`}><History className="h-5 w-5" />My Crops</button>
        <button onClick={() => setActiveTab('register')} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-black ${activeTab === 'register' ? 'bg-[#E8F3E8] text-[#2F6B3B]' : 'text-slate-500'}`}><Plus className="h-5 w-5" />Register</button>
        <button onClick={() => setActiveTab('scanner')} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-black ${activeTab === 'scanner' ? 'bg-[#FFF0D9] text-[#8C5A22]' : 'text-slate-500'}`}><Scan className="h-5 w-5" />Check Plant</button>
        <button onClick={() => setMobileMenuOpen((open) => !open)} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-black text-slate-500"><Menu className="h-5 w-5" />More</button>
      </nav>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'plant-details' && onOpenHistory) onOpenHistory();
                  else setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
          <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
            <p className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-400">More tools</p>
            {tools.map((item) => <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-600 hover:bg-emerald-50 dark:text-slate-300 dark:hover:bg-emerald-950/50"><item.icon className="h-5 w-5 text-emerald-600" />{item.label}</button>)}
          </div>
        </div>
      )}
    </header>
  );
}
