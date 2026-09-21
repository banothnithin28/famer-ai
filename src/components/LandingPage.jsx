import React from 'react';
import {
  Leaf,
  Camera,
  CloudSun,
  Bot,
  ArrowRight,
  CheckCircle2,
  Lock,
  ChevronRight,
  Sun,
  Moon,
  Sprout,
} from 'lucide-react';
import FarmScene from './FarmScene';

export default function LandingPage({ onLogin, onSignUp, darkMode, setDarkMode }) {
  const previewCards = [
    {
      id: 'plant-health',
      icon: Sprout,
      emoji: '🌱',
      title: 'Plant Health Tracking',
      desc: "Monitor plant condition over time with regular photos and health history logs.",
      accent: 'var(--primary)',
      badge: 'Continuous Tracking',
    },
    {
      id: 'ai-detection',
      icon: Camera,
      emoji: '🔍',
      title: 'AI Disease Detection',
      desc: 'Analyze leaf photos with trained AI models to detect crop diseases early.',
      accent: '#2e7d32',
      badge: 'ML Diagnostic',
    },
    {
      id: 'weather-intel',
      icon: CloudSun,
      emoji: '🌦️',
      title: 'Weather Intelligence',
      desc: 'Hyper-local temperature, rain probability, and smart irrigation advice.',
      accent: '#0284c7',
      badge: 'Hyper-local Forecast',
    },
    {
      id: 'farmer-assistant',
      icon: Bot,
      emoji: '🤖',
      title: 'Farmer AI Assistant',
      desc: 'Get easy-to-understand explanations and remedies in English, Telugu, or Hindi.',
      accent: '#7c3aed',
      badge: 'Multilingual Advice',
    },
  ];

  return (
    <div
      className="landing-page"
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── Top Landing Header ─── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
          padding: '0.85rem 1.25rem',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Brand Logo & Name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
            }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2e7d32, #4E8B52)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(46, 125, 50, 0.25)',
                color: '#fff',
              }}
            >
              <Leaf size={22} />
            </span>
            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: '1.2rem',
                  letterSpacing: '-0.02em',
                  color: 'var(--forest)',
                  lineHeight: 1.15,
                }}
              >
                Farmer<span style={{ color: 'var(--primary)' }}>AI</span>
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.01em',
                }}
              >
                Smart Agriculture & Crop Intelligence
              </div>
            </div>
          </div>

          {/* Nav Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
              id="landing-dark-mode-toggle"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: darkMode ? 'var(--warning)' : 'var(--text-muted)',
                transition: 'all 180ms ease',
              }}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Login button */}
            <button
              onClick={onLogin}
              id="landing-header-login-btn"
              style={{
                padding: '0.55rem 1.15rem',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 180ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
            >
              Login
            </button>

            {/* Sign Up button */}
            <button
              onClick={onSignUp}
              id="landing-header-signup-btn"
              className="btn btn-primary"
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                borderRadius: 10,
                boxShadow: '0 4px 14px rgba(78, 139, 82, 0.28)',
              }}
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section with 3D Agricultural Background ─── */}
      <section
        id="landing-hero"
        style={{
          position: 'relative',
          minHeight: '84vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '4rem 1.25rem 3.5rem',
        }}
      >
        {/* 3D Agricultural Landscape Scene */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <FarmScene />
        </div>

        {/* Soft Contrast Overlay for Crisp Readability */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: darkMode
              ? 'linear-gradient(180deg, rgba(13, 23, 17, 0.82) 0%, rgba(13, 23, 17, 0.88) 55%, rgba(13, 23, 17, 0.96) 100%)'
              : 'linear-gradient(180deg, rgba(245, 243, 234, 0.84) 0%, rgba(245, 243, 234, 0.90) 55%, rgba(245, 243, 234, 0.98) 100%)',
            backdropFilter: 'blur(2px)',
          }}
        />

        {/* Hero Content Box */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            maxWidth: 820,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          {/* Pill Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 1rem',
              borderRadius: 9999,
              background: 'var(--success-bg)',
              border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
              color: 'var(--success-text)',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span>🌱</span>
            <span>Smart Agriculture & Crop Intelligence Platform</span>
          </div>

          {/* Main Heading */}
          <h1
            style={{
              fontSize: 'clamp(2rem, 4.8vw, 3.4rem)',
              fontWeight: 900,
              lineHeight: 1.18,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              marginBottom: '1.25rem',
            }}
          >
            Smarter Farming Starts With{' '}
            <span
              style={{
                color: 'var(--primary)',
                position: 'relative',
                display: 'inline-block',
              }}
            >
              Better Plant Intelligence
            </span>
          </h1>

          {/* Supporting Text */}
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.18rem)',
              lineHeight: 1.65,
              color: 'var(--text-secondary)',
              maxWidth: 680,
              margin: '0 auto 2.25rem',
              fontWeight: 450,
            }}
          >
            FarmerAI helps farmers monitor plant health, detect possible crop problems,
            understand weather conditions, and make better day-to-day farming decisions using AI.
          </p>

          {/* CTA Buttons */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              marginBottom: '2.5rem',
            }}
          >
            <button
              onClick={onLogin}
              id="hero-login-btn"
              className="btn btn-primary"
              style={{
                padding: '0.875rem 2.2rem',
                fontSize: '1.05rem',
                fontWeight: 750,
                borderRadius: 12,
                boxShadow: '0 6px 20px rgba(78, 139, 82, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                minWidth: 160,
                justifyContent: 'center',
              }}
            >
              Login <ArrowRight size={18} />
            </button>

            <button
              onClick={onSignUp}
              id="hero-signup-btn"
              style={{
                padding: '0.875rem 2.2rem',
                fontSize: '1.05rem',
                fontWeight: 750,
                borderRadius: 12,
                border: '2px solid var(--primary)',
                background: 'var(--surface)',
                color: 'var(--primary)',
                cursor: 'pointer',
                minWidth: 160,
                transition: 'all 180ms ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--success-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface)';
              }}
            >
              Create Account
            </button>
          </div>

          {/* Farmer Trust Highlights */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '1.5rem',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--primary)' }} /> Simple & Practical
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--primary)' }} /> Multilingual (EN • TE • HI)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--primary)' }} /> Mobile-First Design
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Lock size={14} style={{ color: 'var(--primary)' }} /> Private Farmer Data
            </span>
          </div>
        </div>
      </section>

      {/* ─── Small Feature Preview Section (4 Simple Cards) ─── */}
      <section
        id="feature-preview-section"
        style={{
          padding: '3.5rem 1.25rem 4rem',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--primary)',
              marginBottom: '0.5rem',
            }}
          >
            🌾 Built For Farmers
          </div>
          <h2
            style={{
              fontSize: 'clamp(1.6rem, 3.2vw, 2.3rem)',
              fontWeight: 850,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '0.75rem',
            }}
          >
            Essential Crop Intelligence at Your Fingertips
          </h2>
          <p
            style={{
              fontSize: '0.98rem',
              color: 'var(--text-secondary)',
              maxWidth: 620,
              margin: '0 auto',
            }}
          >
            Preview what FarmerAI provides. Log in or create your free account to access
            live crop monitoring and AI guidance.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {previewCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                id={`preview-card-${card.id}`}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  padding: '1.75rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.875rem',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 240ms ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 35%, var(--border))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'var(--surface-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {card.emoji}
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.6rem',
                      borderRadius: 9999,
                      background: 'var(--surface-subtle)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {card.badge}
                  </span>
                </div>

                <div>
                  <h3
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      marginBottom: '0.35rem',
                    }}
                  >
                    {card.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.88rem',
                      lineHeight: 1.55,
                      color: 'var(--text-secondary)',
                      margin: 0,
                    }}
                  >
                    {card.desc}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '0.85rem',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Requires Login
                  </span>
                  <button
                    onClick={onLogin}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Explore <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Farmer-Friendly Disclaimer & Footer ─── */}
      <footer
        style={{
          marginTop: 'auto',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: '2rem 1.25rem',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--forest)' }}>
            <Leaf size={16} color="var(--primary)" />
            FarmerAI Platform • Smart Agriculture & Crop Intelligence
          </div>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Disclaimer: FarmerAI provides educational recommendations and machine learning predictions.
            AI scan results should be treated as possible indicators rather than certified laboratory diagnoses.
            FarmerAI does not guarantee disease prevention, weather outcomes, or specific crop yield.
            For serious crop damage, please consult your local Krishi Vigyan Kendra (KVK) or agricultural extension officer.
          </p>
          <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            © {new Date().getFullYear()} FarmerAI. Designed for farmers across India.
          </div>
        </div>
      </footer>
    </div>
  );
}
