import React, { useState } from 'react';
import {
  Leaf,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ArrowLeft,
} from 'lucide-react';
import { loginFarmer, forgotPassword } from '../services/apiService';

export default function LoginPage({ onLoginSuccess, onGoToRegister, onBackToLanding, darkMode, setDarkMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Forgot password modal/toggle state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleFillDemo = () => {
    setEmail('ramesh@farmer.ai');
    setPassword('password123');
    setError('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await loginFarmer(email.trim(), password);
      setSuccessMsg(data.message || 'Login successful! Opening dashboard…');
      setTimeout(() => {
        onLoginSuccess(data.user);
      }, 500);
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !newPassword || !confirmPassword) {
      setError('Please fill in all password reset fields.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await forgotPassword(email.trim(), newPassword, confirmPassword);
      setSuccessMsg(data.message || 'Password reset successfully!');
      setTimeout(() => {
        setIsForgotPassword(false);
        setPassword(newPassword);
        setSuccessMsg('Password updated! You can now log in.');
      }, 1400);
    } catch (err) {
      setError(err.message || 'Unable to reset password. Please check the email entered.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── Top minimal navbar ─── */}
      <header
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <button
          onClick={onBackToLanding}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '0.35rem 0.5rem',
            borderRadius: 8,
          }}
          id="login-back-to-home-btn"
        >
          <ArrowLeft size={16} /> Back to Welcome
        </button>

        <button
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Light mode' : 'Dark mode'}
          aria-label="Toggle dark mode"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: darkMode ? 'var(--warning)' : 'var(--text-muted)',
          }}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      {/* ─── Main Form Card ─── */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem 1rem 3rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            background: 'var(--surface)',
            borderRadius: 20,
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {/* Card Header */}
          <div
            style={{
              padding: '2rem 2rem 1.25rem',
              textAlign: 'center',
              borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(180deg, var(--surface-elevated) 0%, var(--surface) 100%)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #2e7d32, #4E8B52)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(46, 125, 50, 0.25)',
              }}
            >
              <Leaf size={24} />
            </div>

            <div
              style={{
                fontWeight: 900,
                fontSize: '1.05rem',
                color: 'var(--forest)',
                marginBottom: '0.2rem',
              }}
            >
              Farmer<span style={{ color: 'var(--primary)' }}>AI</span>
            </div>

            <h1
              style={{
                fontSize: '1.45rem',
                fontWeight: 850,
                color: 'var(--text-primary)',
                margin: '0 0 0.4rem',
              }}
            >
              {isForgotPassword ? 'Reset Password' : 'Welcome Back'}
            </h1>
            <p
              style={{
                fontSize: '0.86rem',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {isForgotPassword
                ? 'Enter your registered email and choose a new password.'
                : 'Sign in to continue monitoring your crops.'}
            </p>
          </div>

          {/* Card Body */}
          <div style={{ padding: '1.75rem 2rem 2rem' }}>
            {/* Status alerts */}
            {error && (
              <div
                className="alert alert-danger"
                role="alert"
                style={{
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  borderRadius: 10,
                }}
              >
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div
                className="alert alert-success"
                role="status"
                style={{
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  borderRadius: 10,
                }}
              >
                <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {!isForgotPassword ? (
              /* ── Regular Login Form ── */
              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div>
                  <label
                    htmlFor="login-page-email"
                    className="form-label"
                    style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.4rem' }}
                  >
                    Email / Username
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={17}
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="login-page-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ramesh@farmer.ai"
                      className="form-input"
                      style={{ paddingLeft: '2.4rem' }}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <label
                      htmlFor="login-page-password"
                      className="form-label"
                      style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError('');
                        setSuccessMsg('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      id="forgot-password-link-btn"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      size={17}
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="login-page-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  id="login-page-submit-btn"
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    fontSize: '0.98rem',
                    fontWeight: 750,
                    borderRadius: 12,
                    marginTop: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(78, 139, 82, 0.28)',
                  }}
                >
                  {loading ? 'Signing In…' : 'Login'} <ArrowRight size={17} />
                </button>

                {/* Quick Demo Autofill Box */}
                <div
                  onClick={handleFillDemo}
                  id="login-page-demo-autofill"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleFillDemo();
                  }}
                  style={{
                    cursor: 'pointer',
                    padding: '0.85rem 1rem',
                    borderRadius: 12,
                    background: 'var(--success-bg)',
                    border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.5rem',
                    transition: 'all 180ms ease',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--success-text)' }}>
                      🔑 Quick Demo Farmer Account
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      <code>ramesh@farmer.ai</code> / <code>password123</code>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--primary)' }}>
                    Auto-Fill →
                  </span>
                </div>
              </form>
            ) : (
              /* ── Forgot Password Form ── */
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div>
                  <label htmlFor="forgot-email-input" className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    Registered Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      id="forgot-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ramesh@farmer.ai"
                      className="form-input"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="forgot-new-pwd-input" className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    New Password (min 6 characters)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      id="forgot-new-pwd-input"
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="forgot-confirm-pwd-input" className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      id="forgot-confirm-pwd-input"
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  id="forgot-password-submit-btn"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.8rem', borderRadius: 12, fontWeight: 750 }}
                >
                  {loading ? 'Updating Password…' : 'Update Password'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError('');
                    setSuccessMsg('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                    marginTop: '0.25rem',
                  }}
                >
                  ← Back to Login
                </button>
              </form>
            )}

            {/* Switch to Register link */}
            <div
              style={{
                marginTop: '1.75rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid var(--border)',
                textAlign: 'center',
                fontSize: '0.86rem',
                color: 'var(--text-secondary)',
              }}
            >
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onGoToRegister}
                id="login-switch-to-register-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
