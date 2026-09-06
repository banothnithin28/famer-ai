import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import AIChatbot from './components/AIChatbot';
import DiseaseScanner from './components/DiseaseScanner';
import WeatherAdvisor from './components/WeatherAdvisor';
import MarketPrices from './components/MarketPrices';
import SchemesFinder from './components/SchemesFinder';
import FertilizerCalc from './components/FertilizerCalc';
import ApiKeyModal from './components/ApiKeyModal';
import { Sprout, Heart, Github, Globe } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  useEffect(() => {
    // Load stored key
    const saved = localStorage.getItem('farmer_ai_gemini_key');
    if (saved) setApiKey(saved);

    // Dark mode class on root html
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('farmer_ai_gemini_key', key);
    } else {
      localStorage.removeItem('farmer_ai_gemini_key');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenApiKeyModal={() => setApiKeyModalOpen(true)}
        apiKey={apiKey}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
        {activeTab === 'chat' && <AIChatbot apiKey={apiKey} />}
        {activeTab === 'scanner' && <DiseaseScanner />}
        {activeTab === 'weather' && <WeatherAdvisor />}
        {activeTab === 'market' && <MarketPrices />}
        {activeTab === 'schemes' && <SchemesFinder />}
        {activeTab === 'calculator' && <FertilizerCalc />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-12 py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Sprout className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg text-slate-900 dark:text-white">
              Farmer<span className="text-emerald-600">AI</span>
            </span>
            <span className="text-xs text-slate-400 border-l border-slate-300 dark:border-slate-700 pl-2 ml-1">
              Smart Agriculture & Crop Intelligence Platform
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-right flex items-center gap-1">
            Built with <Heart className="w-3.5 h-3.5 text-rose-500 inline fill-rose-500" /> for Farmers & Agriculture Worldwide
          </p>
        </div>
      </footer>

      {/* Gemini API Key Configuration Modal */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveKey={handleSaveApiKey}
      />

    </div>
  );
}
