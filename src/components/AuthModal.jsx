import React, { useState } from 'react';
import {
  X, User, Lock, Mail, ArrowRight, CheckCircle2, AlertCircle,
  Leaf, KeyRound, ShieldCheck, RotateCw,
} from 'lucide-react';
import {
  loginFarmer,
  registerFarmer,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
} from '../services/apiService';

/* ─── Reusable form input ─── */
function AuthInput({ type = 'text', icon: Icon, value, onChange, placeholder, required, minLength, id, autoFocus }) {
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
        autoFocus={autoFocus}
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

  // Multi-step Forgot password
  const [forgotStep, setForgotStep] = useState('email'); // 'email' | 'verify' | 'new-password' | 'success'
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');

  if (!isOpen) return null;

  const reset = (nextMode) => {
    setMode(nextMode);
    setForgotStep('email');
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken('');
    setError('');
    setSuccessMsg('');
  };

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

  // Step 1: Send verification code
  const handleSendResetCode = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your registered email address.');
      return;
    }
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const data = await requestPasswordReset(cleanEmail);
      setSuccessMsg(data.message || 'Verification code sent to your email.');
      setForgotStep('verify');
    } catch (err) {
      setError(err.message || 'Unable to request password reset.');
    } finally { setLoading(false); }
  };

  // Step 2: Verify code
  const handleVerifyResetCode = async (e) => {
    e.preventDefault();
    const cleanCode = verificationCode.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanCode) {
      setError('Please enter the verification code.');
      return;
    }
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const data = await verifyResetCode(cleanCode, cleanEmail);
      if (data.reset_token) {
        setResetToken(data.reset_token);
      }
      setSuccessMsg(data.message || 'Code verified! Enter your new password.');
      setForgotStep('new-password');
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally { setLoading(false); }
  };

  // Step 3: Set new password
  const handleFinalResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const cleanEmail = email.trim().toLowerCase();
      const data = await resetPassword(newPassword, confirmPassword, resetToken, cleanEmail);
      setSuccessMsg(data.message || 'Password reset successfully!');
      setForgotStep('success');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
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
                {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Join Farmer AI' : forgotStep === 'verify' ? 'Verify Reset Code' : forgotStep === 'new-password' ? 'Create New Password' : forgotStep === 'success' ? 'Password Reset' : 'Reset Password'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {mode === 'login' ? 'Sign in to your farm' : mode === 'register' ? 'Create your free account' : forgotStep === 'verify' ? 'Enter 6-digit code' : forgotStep === 'new-password' ? 'Minimum 8 characters' : forgotStep === 'success' ? 'Ready to log in' : 'Recover your account'}
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

          {/* ── Multi-step Forgot Password Flow ── */}
          {mode === 'forgot' && forgotStep === 'email' && (
            <form onSubmit={handleSendResetCode} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Enter your registered email address to receive a 6-digit verification code.
              </p>
              <div>
                <label className="form-label" htmlFor="modal-forgot-email">Registered Email</label>
                <AuthInput id="modal-forgot-email" type="email" icon={Mail} value={email} onChange={e => setEmail(e.target.value)} placeholder="ramesh@farmer.ai" required autoFocus />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary" id="modal-send-code-btn" style={{ width: '100%', marginTop: '0.25rem' }}>
                {loading ? 'Sending Code…' : 'Send Verification Code'} <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => reset('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.25rem 0' }}>
                ← Back to Sign In
              </button>
            </form>
          )}

          {mode === 'forgot' && forgotStep === 'verify' && (
            <form onSubmit={handleVerifyResetCode} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--surface-subtle)', borderRadius: 10, border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Code sent to: <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Please check your inbox or spam folder. The code expires in 10 minutes.
                </div>
              </div>
              <div>
                <label className="form-label" htmlFor="modal-verify-token">Verification Code</label>
                <AuthInput id="modal-verify-token" type="text" icon={KeyRound} value={verificationCode} onChange={e => setVerificationCode(e.target.value)} placeholder="e.g. 123456" required autoFocus />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary" id="modal-verify-code-btn" style={{ width: '100%' }}>
                {loading ? 'Verifying…' : 'Verify Code'} <ArrowRight size={16} />
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <button type="button" onClick={handleSendResetCode} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <RotateCw size={12} /> Resend Code
                </button>
                <button type="button" onClick={() => setForgotStep('email')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                  Change Email
                </button>
              </div>
              <button type="button" onClick={() => reset('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.25rem 0' }}>
                ← Back to Sign In
              </button>
            </form>
          )}

          {mode === 'forgot' && forgotStep === 'new-password' && (
            <form onSubmit={handleFinalResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ padding: '0.5rem 0.75rem', background: 'var(--success-bg)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--success-text)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={15} /> Code verified. Set your new password.
              </div>
              <div>
                <label className="form-label" htmlFor="modal-new-password">New Password (min 8 chars)</label>
                <AuthInput id="modal-new-password" type="password" icon={Lock} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={8} autoFocus />
              </div>
              <div>
                <label className="form-label" htmlFor="modal-confirm-password">Confirm New Password</label>
                <AuthInput id="modal-confirm-password" type="password" icon={Lock} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={8} />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary" id="modal-reset-password-btn" style={{ width: '100%', marginTop: '0.25rem' }}>
                {loading ? 'Updating…' : 'Reset Password'} <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => reset('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.25rem 0' }}>
                ← Back to Sign In
              </button>
            </form>
          )}

          {mode === 'forgot' && forgotStep === 'success' && (
            <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <CheckCircle2 size={26} />
              </div>
              <div style={{ fontWeight: 850, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Password Reset Successfully!
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Your password has been securely updated. You can now sign in.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setForgotStep('email');
                  setPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setVerificationCode('');
                  setError('');
                  setSuccessMsg('Password updated! Please sign in.');
                }}
                className="btn btn-primary"
                id="modal-login-now-btn"
                style={{ width: '100%' }}
              >
                Sign In Now <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
