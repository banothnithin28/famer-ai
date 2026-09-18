import React, { useState } from 'react';
import {
  X, User, Lock, Mail, ArrowRight, CheckCircle2, AlertCircle,
  Leaf, KeyRound,
} from 'lucide-react';
import { loginFarmer, registerFarmer, forgotPassword } from '../services/apiService';

/* ─── Reusable form input ─── */
function AuthInput({ type = 'text', icon: Icon, value, onChange, placeholder, required, minLength, id }) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && (
        <Icon size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
      )}
      <input
        id={id}
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="form-input"
        style={{ paddingLeft: Icon ? '2.25rem' : undefined }}
      />
    </div>
  );
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode]       = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login / Register shared
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]       = useState('');
  const [location, setLocation] = useState('Telangana');
  const [language, setLanguage] = useState('en');
  const [farmSize, setFarmSize] = useState('5.0');
  const [soilType, setSoilType] = useState('Black');
  const [primaryCrop, setPrimaryCrop] = useState('Cotton');

  // Forgot password
  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!isOpen) return null;

  const reset = (nextMode) => { setMode(nextMode); setError(''); setSuccessMsg(''); };

  const handleFillDemo = () => { setEmail('ramesh@farmer.ai'); setPassword('password123'); setError(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const data = await loginFarmer(email, password);
      setSuccessMsg(data.message || 'Login successful!');
      setTimeout(() => { onAuthSuccess(data.user); onClose(); }, 700);
    } catch (err) {
      setError(err.message || 'Failed to login. Please check credentials.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const data = await registerFarmer({ name, email, password, location, language, farm_size_acres: farmSize, soil_type: soilType, primary_crop: primaryCrop });
      setSuccessMsg(data.message || 'Registration successful!');
      setTimeout(() => { onAuthSuccess(data.user); onClose(); }, 700);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const data = await forgotPassword(email, newPassword, confirmPassword);
      setSuccessMsg(data.message || 'Password reset successfully!');
      setTimeout(() => { setMode('login'); setPassword(newPassword); setSuccessMsg('You can now log in with your new password.'); }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally { setLoading(false); }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      id="auth-modal-backdrop"
    >
      <div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        id="auth-modal-panel"
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface-elevated)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Leaf size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Join Farmer AI' : 'Reset Password'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {mode === 'login' ? 'Sign in to your farm' : mode === 'register' ? 'Create your free account' : 'Recover your account'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            id="auth-close-btn"
            style={{
              width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher (login / register only) */}
        {mode !== 'forgot' && (
          <div style={{ padding: '1rem 1.5rem 0' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              background: 'var(--surface-subtle)', borderRadius: 10, padding: 4,
            }}>
              {[['login', 'Sign In'], ['register', 'Create Account']].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => reset(m)}
                  id={`auth-tab-${m}`}
                  style={{
                    padding: '0.5rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: '0.82rem', fontWeight: 700, transition: 'all 200ms',
                    background: mode === m ? 'var(--surface)' : 'transparent',
                    color: mode === m ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Messages */}
          {error && (
            <div className="alert alert-danger" role="alert">
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}
          {successMsg && (
            <div className="alert alert-success" role="status">
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} /> {successMsg}
            </div>
          )}

          {/* ── Login Form ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="form-label" htmlFor="login-email">Email Address</label>
                <AuthInput id="login-email" type="email" icon={Mail} value={email} onChange={e => setEmail(e.target.value)} placeholder="ramesh@farmer.ai" required />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>Password</label>
                  <button type="button" onClick={() => reset('forgot')} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Forgot Password?
                  </button>
                </div>
                <AuthInput id="login-password" type="password" icon={Lock} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary" id="login-submit-btn" style={{ width: '100%', marginTop: '0.25rem' }}>
                {loading ? 'Signing in…' : 'Sign In'} <ArrowRight size={16} />
              </button>

              {/* Demo pill */}
              <div
                onClick={handleFillDemo}
                id="demo-autofill-btn"
                style={{
                  cursor: 'pointer', padding: '0.75rem', borderRadius: 10,
                  background: 'var(--success-bg)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--success-text)' }}>🔑 Quick Demo Account</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    <code>ramesh@farmer.ai</code> / <code>password123</code>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>Auto-fill →</span>
              </div>
            </form>
          )}

          {/* ── Register Form ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <AuthInput id="reg-name" icon={User} value={name} onChange={e => setName(e.target.value)} placeholder="Ramesh Kumar" required />
              </div>
              <div>
                <label className="form-label" htmlFor="reg-email">Email Address</label>
                <AuthInput id="reg-email" type="email" icon={Mail} value={email} onChange={e => setEmail(e.target.value)} placeholder="farmer@domain.com" required />
              </div>
              <div>
                <label className="form-label" htmlFor="reg-password">Password (min 6 chars)</label>
                <AuthInput id="reg-password" type="password" icon={Lock} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" htmlFor="reg-location">State / Region</label>
                  <select id="reg-location" value={location} onChange={e => setLocation(e.target.value)} className="form-input">
                    {['Telangana', 'Andhra Pradesh', 'Maharashtra', 'Karnataka', 'Punjab', 'Tamil Nadu', 'Madhya Pradesh', 'Uttar Pradesh'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="reg-language">Language</label>
                  <select id="reg-language" value={language} onChange={e => setLanguage(e.target.value)} className="form-input">
                    <option value="en">English</option>
                    <option value="te">తెలుగు (Telugu)</option>
                    <option value="hi">हिंदी (Hindi)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary" id="register-account-btn" style={{ width: '100%' }}>
                {loading ? 'Creating Account…' : 'Create Account'} <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* ── Forgot Password Form ── */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Enter your registered email and choose a new password.
              </p>
              <div>
                <label className="form-label" htmlFor="forgot-email">Registered Email</label>
                <AuthInput id="forgot-email" type="email" icon={Mail} value={email} onChange={e => setEmail(e.target.value)} placeholder="ramesh@farmer.ai" required />
              </div>
              <div>
                <label className="form-label" htmlFor="forgot-new-password">New Password (min 6 chars)</label>
                <AuthInput id="forgot-new-password" type="password" icon={KeyRound} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <div>
                <label className="form-label" htmlFor="forgot-confirm-password">Confirm New Password</label>
                <AuthInput id="forgot-confirm-password" type="password" icon={KeyRound} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary" id="reset-password-btn" style={{ width: '100%' }}>
                {loading ? 'Updating…' : 'Update Password'} <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => reset('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.25rem 0' }}>
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
