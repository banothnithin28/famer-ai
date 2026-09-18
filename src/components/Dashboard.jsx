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
} from 'lucide-react';
import FarmScene from './FarmScene';
import { getPlants, getWeather } from '../services/apiService';

const DEFAULT_LOC = { latitude: 17.385, longitude: 78.487 };

export default function Dashboard({
  user,
  onOpenScanner,
}) {
  const [plantCount, setPlantCount] = useState(0);
  const [loadingPlants, setLoadingPlants] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);

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
      <section aria-label="Current Farm Information">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {/* Information Card 1: Today's Field Weather Telemetry */}
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
                  Current Weather
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
                    <span>Rain prob: {rainProb}%</span>
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

          {/* Information Card 2: Crop Registry Status */}
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
                  Monitored Crops
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

          {/* Information Card 3: Real-Time Irrigation Guidance */}
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
                background: 'var(--warning-bg)', color: 'var(--warning-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Smart Water
                </span>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Irrigation Advisory
                </h2>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                {irrigationAdvice.title}
              </div>
              <p style={{
                fontSize: '0.825rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                margin: 0,
                borderTop: '1px solid var(--border)',
                paddingTop: '0.65rem'
              }}>
                {irrigationAdvice.detail}
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
