import React, { useEffect, useState } from 'react';
import {
  Camera,
  Sprout,
  CloudSun,
  Droplets,
  Thermometer,
  CloudRain,
  Wind,
  ShieldCheck,
  CheckCircle2,
  Bot,
  Sparkles,
  BookOpen,
  TrendingDown,
  TrendingUp,
  Scale,
  ArrowRight,
  Tractor,
} from 'lucide-react';
import FarmScene from './FarmScene';
import { getPlants, getWeather, getFarmSummary, getTractorSummary } from '../services/apiService';

const DEFAULT_LOC = { latitude: 17.385, longitude: 78.487 };

export default function Dashboard({
  user,
  onOpenScanner,
  setActiveTab,
}) {
  const [plantCount, setPlantCount] = useState(0);
  const [loadingPlants, setLoadingPlants] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [farmSummary, setFarmSummary] = useState(null);
  const [tractorSummary, setTractorSummary] = useState(null);

  // Load actual plants count
  useEffect(() => {
    let isMounted = true;
    setLoadingPlants(true);
    getPlants()
      .then((res) => {
        if (isMounted && res?.success && Array.isArray(res.plants)) {
          setPlantCount(res.plants.length);
        }
      })
      .catch((err) => {
        console.warn('Failed to load plants:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingPlants(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Load real current weather
  useEffect(() => {
    let isMounted = true;
    setLoadingWeather(true);
    getWeather(DEFAULT_LOC.latitude, DEFAULT_LOC.longitude)
      .then((res) => {
        if (isMounted && res?.success && res.current) {
          setWeatherData(res);
        }
      })
      .catch((err) => {
        console.warn('Failed to load real weather:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingWeather(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Load farm diary summary stats
  useEffect(() => {
    let isMounted = true;
    getFarmSummary()
      .then((res) => {
        if (isMounted && res?.success && res.summary) {
          setFarmSummary(res.summary);
        }
      })
      .catch((err) => {
        console.warn('Failed to load farm diary summary in dashboard:', err);
      });

    getTractorSummary()
      .then((res) => {
        if (isMounted && res?.success && res.summary) {
          setTractorSummary(res.summary);
        }
      })
      .catch((err) => {
        console.warn('Failed to load tractor summary in dashboard:', err);
      });

    return () => { isMounted = false; };
  }, []);

  const currentTemp = weatherData?.current?.temperature != null
    ? Math.round(weatherData.current.temperature)
    : null;
  const currentCondition = weatherData?.current?.condition || 'Clear';
  const feelsLike = weatherData?.current?.feels_like != null
    ? Math.round(weatherData.current.feels_like)
    : null;
  const humidity = weatherData?.current?.humidity;
  const rainProb = weatherData?.next_18_hours?.rain_probability ?? 0;
  const windSpeed = weatherData?.current?.wind_speed != null
    ? Math.round(weatherData.current.wind_speed)
    : null;

  // Derive simple irrigation advisory
  const precipitation = weatherData?.next_18_hours?.precipitation ?? 0;
  const irrigationAdvice = precipitation >= 5 || rainProb >= 70
    ? { title: 'Rain Expected Soon', detail: `${precipitation} mm rain expected in next 18h. Defer watering.` }
    : { title: 'Soil Moisture Check', detail: 'Low precipitation forecast. Check soil depth before irrigating.' };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: '3.5rem' }}>

      {/* ─── Hero Section with 3D Agricultural FarmScene Background ─── */}
      <section
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-2xl)',
          overflow: 'hidden',
          marginBottom: '2rem',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-md)',
          minHeight: 340,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Subtle 3D Agricultural Canvas (pointer-events-none, never blocks clicks) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.85,
            zIndex: 1,
          }}
          aria-hidden="true"
        >
          <FarmScene />
        </div>

        {/* High-Contrast Gradient Backdrop Layer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, var(--surface) 0%, color-mix(in srgb, var(--surface) 92%, transparent) 55%, color-mix(in srgb, var(--surface) 60%, transparent) 100%)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
          aria-hidden="true"
        />

        {/* Hero Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 3,
            padding: '2.5rem 2rem',
            maxWidth: 620,
          }}
        >
          {/* Platform Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.3rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              background: 'var(--success-bg)',
              border: '1px solid var(--border)',
              color: 'var(--success)',
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            <span>🌱</span> FarmerAI
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: 'clamp(1.85rem, 4.5vw, 2.5rem)',
              fontWeight: 900,
              lineHeight: 1.15,
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
              margin: '0 0 0.85rem 0',
            }}
          >
            Smart Agriculture & Crop Intelligence
          </h1>

          {/* Short Description */}
          <p
            style={{
              fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '1.75rem',
              fontWeight: 500,
            }}
          >
            Monitor your plants, detect possible problems, understand weather conditions and get simple AI-powered guidance.
          </p>

          {/* ONE Main Action Button: Scan Plant */}
          <div>
            <button
              onClick={() => onOpenScanner && onOpenScanner()}
              className="btn btn-primary btn-lg"
              style={{
                fontSize: '1rem',
                padding: '0.8rem 1.8rem',
                borderRadius: 'var(--radius-lg)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontWeight: 800,
                boxShadow: '0 4px 14px color-mix(in srgb, var(--primary) 40%, transparent)',
              }}
              id="hero-scan-btn"
            >
              <Camera size={20} />
              Scan Plant
            </button>
          </div>
        </div>
      </section>

      {/* ─── Useful Current Agricultural Information (Informative, Not Duplicate Navigation Cards) ─── */}
      <section aria-label="Current Farm Information" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {/* Summary Section 1: 🌿 My Plants */}
          <div
            className="card"
            style={{
              padding: '1.4rem',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'var(--success-bg)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sprout size={20} />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Farm Status
                </span>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  🌿 My Plants
                </h2>
              </div>
            </div>

            {loadingPlants ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Checking registered crops…</p>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {plantCount}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {plantCount === 1 ? 'Registered Crop' : 'Registered Crops'}
                  </span>
                </div>

                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '0.65rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <span>
                    {plantCount > 0
                      ? 'Visual history and diagnostic records active'
                      : 'No crops registered yet'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Summary Section 2: 🌦️ Weather */}
          <div
            className="card"
            style={{
              padding: '1.4rem',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'var(--info-bg)', color: 'var(--info)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CloudSun size={20} />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Live Telemetry
                </span>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  🌦️ Weather
                </h2>
              </div>
            </div>

            {loadingWeather ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Loading live weather…</p>
            ) : currentTemp !== null ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {currentTemp}°C
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {currentCondition}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Droplets size={13} style={{ color: 'var(--info)' }} />
                    <span>Humidity: {humidity}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CloudRain size={13} style={{ color: 'var(--info)' }} />
                    <span>Rain: {rainProb}%</span>
                  </div>
                  {windSpeed !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Wind size={13} style={{ color: 'var(--text-muted)' }} />
                      <span>Wind: {windSpeed} km/h</span>
                    </div>
                  )}
                  {feelsLike !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Thermometer size={13} style={{ color: 'var(--warning)' }} />
                      <span>Feels: {feelsLike}°C</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Live weather active.</p>
            )}
          </div>

          {/* Summary Section 3: 🤖 Farmer AI */}
          <div
            className="card"
            style={{
              padding: '1.4rem',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={20} />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  AI Agronomist
                </span>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  🤖 Farmer AI
                </h2>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Instant Agricultural Intelligence
              </div>
              <p style={{
                fontSize: '0.825rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                margin: '0 0 0.65rem 0',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.65rem'
              }}>
                Ask questions about crop pests, fertilizer doses, soil treatments, and day-to-day farming advice.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700 }}>
                <Sparkles size={13} />
                <span>Contextual assistance available</span>
              </div>
            </div>
          </div>

          {/* Summary Section 4: 📒 Farm Diary & Expenses */}
          <div
            className="card"
            style={{
              padding: '1.4rem',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--surface)',
              cursor: 'pointer',
              transition: 'box-shadow 180ms ease, transform 180ms ease'
            }}
            onClick={() => setActiveTab && setActiveTab('diary')}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'var(--success-bg)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    Financial & Daily Log
                  </span>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    📒 Farm Diary
                  </h2>
                </div>
              </div>

              <span style={{
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)',
                display: 'inline-flex', alignItems: 'center', gap: '0.2rem'
              }}>
                Open Diary <ArrowRight size={13} />
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>
                    Net Balance:
                  </span>
                  <span style={{
                    fontSize: '1.6rem', fontWeight: 900,
                    color: (farmSummary?.net_balance || 0) >= 0 ? 'var(--primary)' : 'var(--danger)',
                    lineHeight: 1
                  }}>
                    {farmSummary ? `₹${(farmSummary.net_balance || 0).toLocaleString('en-IN')}` : '₹0'}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>
                    Diary Entries:
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {farmSummary?.diary_count ?? 0}
                  </span>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.65rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <TrendingDown size={13} style={{ color: 'var(--danger)' }} />
                  <span>Expenses: ₹{(farmSummary?.total_expenses || 0).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <TrendingUp size={13} style={{ color: 'var(--primary)' }} />
                  <span>Income: ₹{(farmSummary?.total_income || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Section 5: 🚜 Tractor Work Tracker */}
          <div
            className="card"
            style={{
              padding: '1.4rem',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--surface)',
              cursor: 'pointer',
              transition: 'box-shadow 180ms ease, transform 180ms ease'
            }}
            onClick={() => setActiveTab && setActiveTab('tractor')}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Tractor size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    Phase 2 Module
                  </span>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    🚜 Tractor Work
                  </h2>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)' }}>
                <span>Open Tracker</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: '0.6rem'
              }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>
                    Active / Running:
                  </span>
                  <span style={{
                    fontSize: '1.6rem', fontWeight: 900,
                    color: (tractorSummary?.farmer?.active_jobs || 0) > 0 ? 'var(--primary)' : 'var(--text-primary)',
                    lineHeight: 1
                  }}>
                    {tractorSummary?.farmer?.active_jobs ?? 0}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>
                    Completed:
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {tractorSummary?.farmer?.completed_jobs ?? 0}
                  </span>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.65rem'
              }}>
                <div>
                  <span>Pending: {tractorSummary?.farmer?.pending_confirmations ?? 0}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span>Expenses: ₹{(tractorSummary?.farmer?.month_expenses || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
