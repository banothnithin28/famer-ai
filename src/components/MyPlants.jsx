import React, { useEffect, useState } from 'react';
import {
  Sprout,
  Camera,
  Plus,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { getPlants } from '../services/apiService';

const CROP_EMOJIS = {
  tomato: '🍅', rice: '🌾', paddy: '🌾', chilli: '🌶️', cotton: '🌸',
  maize: '🌽', corn: '🌽', groundnut: '🥜', wheat: '🌾', sugarcane: '🎋',
  soybean: '🫘', banana: '🍌', mango: '🥭', turmeric: '🟡',
  potato: '🥔', onion: '🧅', garlic: '🧄', cabbage: '🥬',
};

function getCropEmoji(name = '') {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(CROP_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return '🌱';
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(String(v).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

function checkedAgo(v) {
  const d = parseDate(v);
  if (!d) return 'Not scanned yet';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function getStatusInfo(plant) {
  const statusStr = (plant.latest_disease || plant.status || '').toLowerCase();
  if (statusStr.includes('healthy')) {
    return {
      label: 'Healthy',
      color: 'var(--success)',
      bg: 'var(--success-bg)',
      icon: CheckCircle2,
    };
  }
  if (statusStr.includes('blight') || statusStr.includes('virus') || statusStr.includes('rust') || statusStr.includes('spot') || statusStr.includes('critical') || statusStr.includes('severe')) {
    return {
      label: plant.latest_disease || 'Possible Problem Detected',
      color: 'var(--danger)',
      bg: 'var(--danger-bg)',
      icon: AlertTriangle,
    };
  }
  if (plant.latest_scan_date || plant.latest_disease) {
    return {
      label: plant.latest_disease || 'Attention Needed',
      color: 'var(--warning)',
      bg: 'var(--warning-bg)',
      icon: AlertCircle,
    };
  }
  return {
    label: 'Not Checked',
    color: 'var(--text-muted)',
    bg: 'var(--surface-secondary)',
    icon: Sprout,
  };
}

export default function MyPlants({
  onOpenPlantDetails,
  onRegisterPlant,
}) {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlants = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPlants();
      if (res?.success) {
        setPlants(res.plants || []);
      } else {
        throw new Error(res?.error || 'Unable to retrieve your plants.');
      }
    } catch (err) {
      setError(err.message || 'Unable to load your plants. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlants();
  }, []);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: '3rem' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1.75rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.2rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--success-bg)',
            color: 'var(--primary)',
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.35rem'
          }}>
            <Sprout size={13} /> Crop Registry
          </div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
            🌿 My Plants
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Track plant health history, day-to-day scans, and AI diagnostics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={loadPlants}
            disabled={loading}
            title="Refresh plant list"
            className="btn btn-secondary btn-sm"
            style={{ padding: '0 0.65rem' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => onRegisterPlant && onRegisterPlant()}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
          >
            <Plus size={16} /> Register Plant
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }} role="alert">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{error}</div>
          <button onClick={loadPlants} className="btn btn-sm btn-secondary">Retry</button>
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && (
        <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem', animation: 'pulse 1.5s infinite' }}>🌿</div>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Loading your registered crops…</p>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && plants.length === 0 && (
        <div
          className="card"
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-2xl)',
            border: '2px dashed var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--success-bg)',
            color: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}>
            <Sprout size={32} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
            No Plants Registered Yet
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
            Register your crops to keep a visual photo history, track day-to-day comparisons, and monitor disease diagnosis over time.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => onRegisterPlant && onRegisterPlant()}
              className="btn btn-primary"
              style={{ fontWeight: 700 }}
            >
              <Plus size={16} /> Register Your First Plant
            </button>
          </div>
        </div>
      )}

      {/* ── Plant Cards Grid ── */}
      {!loading && !error && plants.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {plants.map((plant) => {
            const emoji = getCropEmoji(plant.crop_name || '');
            const lastScanText = checkedAgo(plant.latest_scan_date);
            const statusInfo = getStatusInfo(plant);
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={plant.id}
                className="card card-interactive"
                style={{
                  padding: '1.4rem',
                  borderRadius: 'var(--radius-xl)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'var(--surface)',
                }}
              >
                <div>
                  {/* Top row: Emoji, Name, Field */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                    <span
                      style={{
                        fontSize: '2rem',
                        lineHeight: 1,
                        background: 'var(--surface-secondary)',
                        padding: '0.4rem',
                        borderRadius: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    >
                      {emoji}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          margin: '0 0 0.2rem 0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={plant.crop_name}
                      >
                        {plant.crop_name}
                      </h2>
                      {plant.field_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <MapPin size={12} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {plant.field_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info Rows: Last Scan & Status */}
                  <div
                    style={{
                      background: 'var(--surface-secondary)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 0.9rem',
                      marginBottom: '1.15rem',
                      fontSize: '0.825rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Last scan:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                        {lastScanText}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          color: statusInfo.color,
                          fontWeight: 800,
                          fontSize: '0.8rem',
                        }}
                      >
                        <StatusIcon size={13} />
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Single Clear Action: View Plant */}
                <div style={{ marginTop: 'auto' }}>
                  <button
                    onClick={() => onOpenPlantDetails && onOpenPlantDetails(plant.id)}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      minHeight: 40,
                      padding: '0 0.85rem',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    View Plant
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
