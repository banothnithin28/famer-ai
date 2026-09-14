import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import CropAdvisor from './components/CropAdvisor';
import AIChatbot from './components/AIChatbot';
import DiseaseScanner from './components/DiseaseScanner';
import WeatherAdvisor from './components/WeatherAdvisor';
import MarketPrices from './components/MarketPrices';
import SchemesFinder from './components/SchemesFinder';
import FertilizerCalc from './components/FertilizerCalc';
import PlantDetails from './components/PlantDetails';
import RegisterPlant from './components/RegisterPlant';
import AuthModal from './components/AuthModal';
import { getCurrentUser, logoutFarmer } from './services/apiService';
import { Sprout, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [chatPlantId, setChatPlantId] = useState(null);

  useEffect(() => {
    // Dark mode class on root html
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Check active session with Flask backend
    getCurrentUser().then((res) => {
      if (res && res.authenticated) {
        setUser(res.user);
      }
    }).catch(() => {});
  }, [darkMode]);

  const handleLogout = async () => {
    try {
      await logoutFarmer();
    } catch {}
    setUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenHistory={() => setActiveTab(selectedPlantId ? 'plant-details' : 'dashboard')}
        user={user}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Body */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 pb-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        {activeTab === 'dashboard' && (
          <Dashboard 
            setActiveTab={setActiveTab} 
            user={user} 
            onRegisterPlant={() => setActiveTab('register')}
            onOpenAuthModal={() => setAuthModalOpen(true)} 
            onOpenPlantDetails={(plantId) => {
              setSelectedPlantId(plantId);
              setActiveTab('plant-details');
            }}
          />
        )}
        {activeTab === 'register' && <RegisterPlant onBack={(nextTab = 'dashboard', plantId = null) => { if (plantId) setSelectedPlantId(plantId); setActiveTab(nextTab); }} onRegistered={() => {}} user={user} />}
        {activeTab === 'crop' && <CropAdvisor setActiveTab={setActiveTab} />}
        {activeTab === 'chat' && <AIChatbot plantId={chatPlantId} />}
        {activeTab === 'scanner' && <DiseaseScanner plantId={selectedPlantId} onAskAI={() => { setChatPlantId(selectedPlantId); setActiveTab('chat'); }} onOpenPlantDetails={(plantId) => { setSelectedPlantId(plantId); setActiveTab('plant-details'); }} />}
        {activeTab === 'plant-details' && <PlantDetails plantId={selectedPlantId} onAskAI={() => { setChatPlantId(selectedPlantId); setActiveTab('chat'); }} onBack={() => setActiveTab('dashboard')} />}
        {activeTab === 'weather' && <WeatherAdvisor />}
        {activeTab === 'market' && <MarketPrices />}
        {activeTab === 'schemes' && <SchemesFinder />}
        {activeTab === 'calculator' && <FertilizerCalc />}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-card)] mt-12 py-8 transition-colors">
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
            Made by Nithin with love for Farmers
          </p>
        </div>
      </footer>

      {/* Farmer Auth Modal (Login / Register / Forgot Password) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)}
      />

    </div>
  );
}
