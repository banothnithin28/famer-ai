import React, { useState } from 'react';
import {
  Leaf,
  User,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Globe,
  Sun,
  Moon,
  ArrowLeft,
} from 'lucide-react';
import { registerFarmer } from '../services/apiService';

export default function RegisterPage({ onRegisterSuccess, onGoToLogin, onBackToLanding, darkMode, setDarkMode }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [location, setLocation] = useState('Telangana');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in your name, email address, and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your confirm password.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const data = await registerFarmer({
        name: name.trim(),
        email: email.trim(),
        password,
        location,
        language,
        farm_size_acres: 5.0,
        soil_type: 'Black',
        primary_crop: 'Cotton',
      });
      setSuccessMsg(data.message || 'Account created successfully! Taking you to your dashboard…');
      setTimeout(() => {
        onRegisterSuccess(data.user);
      }, 600);
    } catch (err) {
      setError(err.message || 'Registration failed. An account with this email may already exist.');
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
          id="register-back-to-home-btn"
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
            maxWidth: 480,
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
              Create Your FarmerAI Account
            </h1>
            <p
              style={{
                fontSize: '0.86rem',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Join thousands of farmers using AI plant health monitoring and localized weather intelligence.
            </p>
          </div>

          {/* Card Body */}
          <div style={{ padding: '1.75rem 2rem 2rem' }}>
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

            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label
                  htmlFor="reg-page-name"
                  className="form-label"
                  style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}
                >
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    id="reg-page-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ramesh Kumar"
                    className="form-input"
                    style={{ paddingLeft: '2.3rem' }}
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-page-email"
                  className="form-label"
                  style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}
                >
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    id="reg-page-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="farmer@example.com"
                    className="form-input"
                    style={{ paddingLeft: '2.3rem' }}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label
                    htmlFor="reg-page-password"
                    className="form-label"
                    style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}
                  >
                    Password (min 6)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      id="reg-page-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      style={{ paddingLeft: '2.3rem' }}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-page-confirm"
                    className="form-label"
                    style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}
                  >
                    Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      id="reg-page-confirm"
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      style={{ paddingLeft: '2.3rem' }}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label
                    htmlFor="reg-page-location"
                    className="form-label"
                    style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}
                  >
                    State / Region
                  </label>
                  <select
                    id="reg-page-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="form-input"
                  >
                    {[
                      'Telangana',
                      'Andhra Pradesh',
                      'Maharashtra',
                      'Karnataka',
                      'Punjab',
                      'Tamil Nadu',
                      'Madhya Pradesh',
                      'Uttar Pradesh',
                      'Haryana',
                      'Rajasthan',
                      'Gujarat',
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="reg-page-language"
                    className="form-label"
                    style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}
                  >
                    Language
                  </label>
                  <select
                    id="reg-page-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="form-input"
                  >
                    <option value="en">English</option>
                    <option value="te">తెలుగు (Telugu)</option>
                    <option value="hi">हिंदी (Hindi)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                id="register-page-submit-btn"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '0.98rem',
                  fontWeight: 750,
                  borderRadius: 12,
                  marginTop: '0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(78, 139, 82, 0.28)',
                }}
              >
                {loading ? 'Creating Account…' : 'Create Account'} <ArrowRight size={17} />
              </button>
            </form>

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
              Already have an account?{' '}
              <button
                type="button"
                onClick={onGoToLogin}
                id="register-switch-to-login-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
