import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import MyPlants from './components/MyPlants';
import PlantDetails from './components/PlantDetails';
import RegisterPlant from './components/RegisterPlant';
import DiseaseScanner from './components/DiseaseScanner';
import WeatherAdvisor from './components/WeatherAdvisor';
import AIChatbot from './components/AIChatbot';
import FarmerTools from './components/FarmerTools';
import AuthModal from './components/AuthModal';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import { getCurrentUser, logoutFarmer } from './services/apiService';

export default function App() {
  const [page, setPage] = useState('loading'); // 'loading' | 'landing' | 'login' | 'register' | 'app'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('farmerAiDark') === 'true';
    } catch { return false; }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [chatPlantId, setChatPlantId] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Sync page state with browser history
  const navigatePage = useCallback((newPage, pushHistory = true) => {
    setPage(newPage);
    if (pushHistory && typeof window !== 'undefined' && window.history?.pushState) {
      let path = '/';
      if (newPage === 'login') path = '/login';
      else if (newPage === 'register') path = '/register';
      else if (newPage === 'app') path = '/dashboard';
      else if (newPage === 'landing') path = '/';

      if (window.location.pathname !== path) {
        window.history.pushState({ page: newPage }, '', path);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Listen for browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/login') {
        setPage('login');
      } else if (path === '/register') {
        setPage('register');
      } else if (path === '/dashboard') {
        setPage(user ? 'app' : 'landing');
      } else {
        setPage(user ? 'app' : 'landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem('farmerAiDark', darkMode); } catch { }
  }, [darkMode]);

  // Check existing session on load
  useEffect(() => {
    getCurrentUser()
      .then((res) => {
        const path = window.location.pathname;
        if (res?.authenticated && res.user) {
          setUser(res.user);
          setPage('app');
        } else {
          setUser(null);
          if (path === '/login') {
            setPage('login');
          } else if (path === '/register') {
            setPage('register');
          } else {
            setPage('landing');
          }
        }
      })
      .catch(() => {
        setUser(null);
        setPage('landing');
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogout = async () => {
    try {
      await logoutFarmer();
    } catch (err) {
      console.warn('Logout warning:', err);
    }
    setUser(null);
    setSelectedPlantId(null);
    setActiveTab('dashboard');
    navigatePage('landing');
  };

  const handleLoginSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    setActiveTab('dashboard');
    navigatePage('app');
  };

  const handleRegisterSuccess = (newUser) => {
    setUser(newUser);
    setActiveTab('dashboard');
    navigatePage('app');
  };

  const navigateTo = (tab, plantId = null) => {
    if (plantId !== null) setSelectedPlantId(plantId);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openPlantDetails = (plantId) => {
    setSelectedPlantId(plantId);
    setActiveTab('plant-details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openScanner = (plantId = null) => {
    if (plantId) setSelectedPlantId(plantId);
    setActiveTab('scanner');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openChat = (plantId = null) => {
    if (plantId) setChatPlantId(plantId);
    setActiveTab('chat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loading state
  if (!authChecked || page === 'loading') {
    return (
      <div style={{ background: 'var(--background)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', animation: 'pulse 1.5s infinite' }}>🌱</div>
          <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Loading FarmerAI…</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Preparing your agricultural intelligence platform</p>
        </div>
      </div>
    );
  }

  // 1. Landing Page (First page farmer sees if not logged in)
  if (page === 'landing' && !user) {
    return (
      <LandingPage
        onLogin={() => navigatePage('login')}
        onSignUp={() => navigatePage('register')}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  // 2. Dedicated Login Page
  if (page === 'login' && !user) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onGoToRegister={() => navigatePage('register')}
        onBackToLanding={() => navigatePage('landing')}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  // 3. Dedicated Registration Page
  if (page === 'register' && !user) {
    return (
      <RegisterPage
        onRegisterSuccess={handleRegisterSuccess}
        onGoToLogin={() => navigatePage('login')}
        onBackToLanding={() => navigatePage('landing')}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  // 4. Fallback if unauthenticated
  if (!user) {
    return (
      <LandingPage
        onLogin={() => navigatePage('login')}
        onSignUp={() => navigatePage('register')}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text-primary)' }}>

      {/* Top Navigation (Desktop) & Bottom Bar (Mobile) — strictly 5 core tabs */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => navigateTo(tab)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        user={user}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Page Content */}
      <main className="page-content has-bottom-nav" style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem 2rem' }}>

        {/* 1. Home (🌱 Home) */}
        {activeTab === 'dashboard' && (
          <Dashboard
            user={user}
            setActiveTab={setActiveTab}
            onOpenScanner={openScanner}
          />
        )}

        {/* 2. My Plants (🌿 My Plants) */}
        {activeTab === 'plants' && (
          <MyPlants
            onOpenPlantDetails={openPlantDetails}
            onRegisterPlant={() => navigateTo('register')}
          />
        )}

        {/* 2b. Plant Details (Contextual child of My Plants) */}
        {activeTab === 'plant-details' && (
          <PlantDetails
            plantId={selectedPlantId}
            onBack={() => navigateTo('plants')}
            onAskAI={() => openChat(selectedPlantId)}
          />
        )}

        {/* 2c. Register New Plant (Child of My Plants) */}
        {activeTab === 'register' && (
          <RegisterPlant
            user={user}
            onBack={(nextTab = 'plants', plantId = null) => {
              if (plantId) setSelectedPlantId(plantId);
              navigateTo(nextTab);
            }}
            onRegistered={(newPlant) => {
              if (newPlant?.id) openPlantDetails(newPlant.id);
              else navigateTo('plants');
            }}
          />
        )}

        {/* 3. Scan Plant (🔍 Scan Plant - Most Prominent Action) */}
        {activeTab === 'scanner' && (
          <DiseaseScanner
            plantId={selectedPlantId}
            onAskAI={() => { setChatPlantId(selectedPlantId); setActiveTab('chat'); }}
            onOpenPlantDetails={openPlantDetails}
          />
        )}

        {/* 4. Weather (🌦️ Weather) */}
        {activeTab === 'weather' && (
          <WeatherAdvisor />
        )}

        {/* 5. Farmer AI (🤖 Farmer AI) */}
        {activeTab === 'chat' && (
          <AIChatbot plantId={chatPlantId} />
        )}

        {/* 6. Farmer Tools (🧰 Farmer Tools) */}
        {activeTab === 'tools' && (
          <FarmerTools onNavigateTab={(tab) => navigateTo(tab)} />
        )}

      </main>

      {/* In-app Auth Modal (fallback for any in-app prompts) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(u) => { setUser(u); setAuthModalOpen(false); }}
      />

    </div>
  );
}
