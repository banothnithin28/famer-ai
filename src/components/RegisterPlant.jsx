import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Leaf, MapPin, Sprout, ChevronDown, ChevronUp } from 'lucide-react';
import { createPlant } from '../services/apiService';

const CROP_OPTIONS = ['Tomato', 'Rice', 'Chilli', 'Cotton', 'Maize', 'Groundnut', 'Wheat', 'Sugarcane', 'Soybean', 'Banana', 'Turmeric', 'Other'];
const SOIL_OPTIONS = ['Sandy', 'Clay', 'Loamy', 'Black Soil', 'Red Soil', 'Sandy Loam', 'Other'];
const IRRIGATION_OPTIONS = ['Drip', 'Sprinkler', 'Flood', 'Manual', 'Rain-fed'];
const CROP_EMOJIS = {
  Tomato: '🍅', Rice: '🌾', Chilli: '🌶️', Cotton: '🌸',
  Maize: '🌽', Groundnut: '🥜', Wheat: '🌾', Sugarcane: '🎋',
  Soybean: '🫘', Banana: '🍌', Turmeric: '🟡',
};

function Field({ label, optional, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="form-label">
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </span>
      {children}
    </label>
  );
}

export default function RegisterPlant({ onBack, onRegistered, user }) {
  const [form, setForm] = useState({
    plantName: '', cropType: '', variety: '', plantingDate: '',
    fieldName: '', soilType: '', irrigationType: '', notes: '',
  });
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [registered, setRegistered] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const noteParts = [
      form.variety      && `Variety: ${form.variety}`,
      form.plantingDate && `Planting date: ${form.plantingDate}`,
      form.soilType     && `Soil type: ${form.soilType}`,
      form.irrigationType && `Irrigation: ${form.irrigationType}`,
      form.notes        && form.notes,
    ].filter(Boolean);

    try {
      const result = await createPlant({
        crop_name:  form.plantName.trim() || form.cropType,
        field_name: form.fieldName.trim(),
        location:   user?.location || '',
        notes:      noteParts.join('\n'),
      });
      if (!result.success) throw new Error(result.error || 'Unable to register this plant.');
      setRegistered(result.plant);
      onRegistered?.(result.plant);
    } catch (err) {
      setError(err.message || 'Unable to register this plant.');
    } finally {
      setSaving(false);
    }
  }

  /* ── Success State ── */
  if (registered) {
    const emoji = CROP_EMOJIS[form.cropType] || '🌿';
    return (
      <div style={{ maxWidth: 520, margin: '0 auto' }} className="animate-scale-in">
        <button onClick={onBack} className="btn btn-ghost" style={{ marginBottom: '1.25rem', padding: '0.25rem 0' }}>
          <ArrowLeft size={16} />Back to My Farm
        </button>

        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem', fontSize: '2rem',
          }}>
            {emoji}
          </div>

          <div className="kicker" style={{ color: 'var(--success)' }}>Plant Registered Successfully</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.5rem', letterSpacing: '-0.02em' }}>
            {registered.crop_name}
          </h1>
          {registered.field_name && (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
              <MapPin size={13} /> {registered.field_name}
            </p>
          )}

          <div className="alert alert-success" style={{ textAlign: 'left', marginTop: '1.5rem' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Your plant has been added to Farmer AI monitoring. Start a health check to record its first scan.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={onBack}
              id="success-view-farm-btn"
            >
              View My Farm
            </button>
            <button
              className="btn btn-primary"
              onClick={() => onBack('scanner', registered.id)}
              id="success-check-btn"
            >
              <span>📷</span> Check Health
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Registration Form ── */
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="animate-fade-in">
      <button onClick={onBack} className="btn btn-ghost" style={{ marginBottom: '1.25rem', padding: '0.25rem 0' }}>
        <ArrowLeft size={16} /> Back to My Farm
      </button>

      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sprout size={26} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div className="kicker">New Plant Record</div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
              Register Your Plant
            </h1>
          </div>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.65 }}>
          Add a plant to start monitoring its health. It takes less than a minute.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Plant Name */}
        <Field label="Plant Name">
          <input
            required
            value={form.plantName}
            onChange={e => update('plantName', e.target.value)}
            placeholder="e.g. My Tomato Plant, Field A Rice"
            className="form-input"
            id="field-plant-name"
          />
        </Field>

        {/* Crop Type + Field Name */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Crop Type">
            <select
              required
              value={form.cropType}
              onChange={e => update('cropType', e.target.value)}
              className="form-input"
              id="field-crop-type"
            >
              <option value="">Choose crop</option>
              {CROP_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Field / Location">
            <input
              required
              value={form.fieldName}
              onChange={e => update('fieldName', e.target.value)}
              placeholder="e.g. Backyard Field"
              className="form-input"
              id="field-field-name"
            />
          </Field>
        </div>

        {/* Advanced (Optional) Fields */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0',
              fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)',
            }}
            id="toggle-advanced-btn"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Leaf size={15} style={{ color: 'var(--primary)' }} />
              Additional Details (optional)
            </span>
            {advancedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {advancedOpen && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Field label="Variety" optional>
                  <input
                    value={form.variety}
                    onChange={e => update('variety', e.target.value)}
                    placeholder="e.g. Local variety"
                    className="form-input"
                    id="field-variety"
                  />
                </Field>
                <Field label="Planting Date" optional>
                  <input
                    type="date"
                    value={form.plantingDate}
                    onChange={e => update('plantingDate', e.target.value)}
                    className="form-input"
                    id="field-planting-date"
                  />
                </Field>
                <Field label="Soil Type" optional>
                  <select
                    value={form.soilType}
                    onChange={e => update('soilType', e.target.value)}
                    className="form-input"
                    id="field-soil-type"
                  >
                    <option value="">Choose soil</option>
                    {SOIL_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Irrigation" optional>
                  <select
                    value={form.irrigationType}
                    onChange={e => update('irrigationType', e.target.value)}
                    className="form-input"
                    id="field-irrigation"
                  >
                    <option value="">Choose irrigation</option>
                    {IRRIGATION_OPTIONS.map(i => <option key={i}>{i}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Notes" optional>
                <textarea
                  value={form.notes}
                  onChange={e => update('notes', e.target.value)}
                  placeholder="Anything Farmer AI should know about this plant?"
                  className="form-input"
                  rows="3"
                  id="field-notes"
                />
              </Field>
            </div>
          )}
        </div>

        {/* Info note */}
        <div style={{
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '0.75rem 1rem',
          fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55,
          display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
        }}>
          <span>📸</span>
          <span>Photos are added when you run a health check from the "Check Plant" screen and are automatically saved to this plant's history.</span>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-danger" role="alert">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary btn-lg"
          id="register-submit-btn"
          style={{ width: '100%' }}
        >
          <Sprout size={20} />
          {saving ? 'Registering…' : 'Register Plant'}
        </button>
      </form>
    </div>
  );
}
