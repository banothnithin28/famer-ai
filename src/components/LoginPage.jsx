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
  ShieldCheck,
  RotateCw,
} from 'lucide-react';
import {
  loginFarmer,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
} from '../services/apiService';

export default function LoginPage({ onLoginSuccess, onGoToRegister, onBackToLanding, darkMode, setDarkMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Multi-step Forgot Password state:
  // isForgotPassword = true/false
  // forgotStep: 'email' -> 'verify' -> 'new-password' -> 'success'
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState('email');
  const [resetEmail, setResetEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');

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

  // 1. Open Forgot Password flow
  const handleOpenForgotPassword = () => {
    setIsForgotPassword(true);
    setForgotStep('email');
    setResetEmail(email ? email.trim() : '');
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken('');
    setError('');
    setSuccessMsg('');
  };

  // 2. Step 1: Request verification code
  const handleSendCodeSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your registered email address.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await requestPasswordReset(cleanEmail);
      setSuccessMsg(data.message || 'If an account exists with this email, a verification code has been sent.');
      setForgotStep('verify');
    } catch (err) {
      setError(err.message || "We couldn't send the verification email right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Step 2: Resend verification code
  const handleResendCode = async () => {
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) return;
    setLoading(true);
    setError('');
    try {
      const data = await requestPasswordReset(cleanEmail);
      setSuccessMsg(data.message || 'A new verification code has been sent.');
    } catch (err) {
      setError(err.message || "We couldn't resend the verification email right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Step 2: Verify reset code
  const handleVerifyCodeSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = verificationCode.trim();
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanCode) {
      setError('Please enter the verification code.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await verifyResetCode(cleanCode, cleanEmail);
      if (data.reset_token) {
        setResetToken(data.reset_token);
      }
      setSuccessMsg(data.message || 'Code verified successfully! Set your new password.');
      setForgotStep('new-password');
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Step 3: Submit new password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
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
      const cleanEmail = resetEmail.trim().toLowerCase();
      const data = await resetPassword(newPassword, confirmPassword, resetToken, cleanEmail);
      setSuccessMsg(data.message || 'Password reset successfully!');
      setForgotStep('success');
    } catch (err) {
      setError(err.message || 'Password reset failed. Please restart verification.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Step 4: Return to login with updated email
  const handleBackToLoginFromSuccess = () => {
    setIsForgotPassword(false);
    setForgotStep('email');
    setEmail(resetEmail);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setResetToken('');
    setError('');
    setSuccessMsg('Password updated! You can now log in.');
  };

  // 7. Cancel and return to login
  const handleCancelForgot = () => {
    setIsForgotPassword(false);
    setForgotStep('email');
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken('');
    setError('');
    setSuccessMsg('');
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
              {!isForgotPassword
                ? 'Welcome Back'
                : forgotStep === 'email'
                ? 'Reset Password'
                : forgotStep === 'verify'
                ? 'Verify Reset Code'
                : forgotStep === 'new-password'
                ? 'Create New Password'
                : 'Password Reset'}
            </h1>
            <p
              style={{
                fontSize: '0.86rem',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {!isForgotPassword
                ? 'Sign in to continue monitoring your crops.'
                : forgotStep === 'email'
                ? 'Enter your registered email to receive a verification code.'
                : forgotStep === 'verify'
                ? `Enter the 6-digit verification code sent to ${resetEmail || 'your email'}.`
                : forgotStep === 'new-password'
                ? 'Enter your new password (minimum 8 characters).'
                : 'Your password has been securely updated.'}
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
                      onClick={handleOpenForgotPassword}
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
            ) : forgotStep === 'email' ? (
              /* ── Step 1: Forgot Password - Request Verification Code ── */
              <form onSubmit={handleSendCodeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div>
                  <label htmlFor="forgot-email-input" className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    Registered Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      id="forgot-email-input"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="ramesh@farmer.ai"
                      className="form-input"
                      style={{ paddingLeft: '2.4rem' }}
                      autoFocus
                    />
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: 0 }}>
                    We will send a 6-digit verification code to this address.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  id="send-verification-code-btn"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', borderRadius: 12, fontWeight: 750, marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {loading ? 'Sending Code…' : 'Send Verification Code'} <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleCancelForgot}
                  id="forgot-cancel-btn"
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
            ) : forgotStep === 'verify' ? (
              /* ── Step 2: Verification Code Screen ── */
              <form onSubmit={handleVerifyCodeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div style={{ padding: '0.85rem 1rem', background: 'var(--surface-subtle)', borderRadius: 12, border: '1px solid var(--border)', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  <div>A 6-digit verification code has been sent to: <strong style={{ color: 'var(--text-primary)' }}>{resetEmail}</strong></div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Please check your email inbox and spam folder. The code expires in 10 minutes.
                  </div>
                </div>

                <div>
                  <label htmlFor="reset-verify-code-input" className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    6-Digit Verification Code
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      id="reset-verify-code-input"
                      type="text"
                      required
                      maxLength={32}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="e.g. 123456"
                      className="form-input"
                      style={{ paddingLeft: '2.4rem', letterSpacing: '0.1em', fontWeight: 700 }}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  id="verify-code-submit-btn"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', borderRadius: 12, fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {loading ? 'Verifying…' : 'Verify Code'} <ArrowRight size={16} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    id="resend-verification-code-btn"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <RotateCw size={13} /> Resend Code
                  </button>

                  <button
                    type="button"
                    onClick={() => setForgotStep('email')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Change Email
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCancelForgot}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  ← Back to Login
                </button>
              </form>
            ) : forgotStep === 'new-password' ? (
              /* ── Step 3: New Password Screen ── */
              <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div style={{ padding: '0.65rem 0.9rem', background: 'var(--success-bg)', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--success-text)', fontWeight: 700 }}>
                  <ShieldCheck size={16} /> Code verified! Please choose your new password.
                </div>

                <div>
                  <label htmlFor="reset-new-pwd-input" className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    New Password (min 8 characters)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      id="reset-new-pwd-input"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
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
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reset-confirm-pwd-input" className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      id="reset-confirm-pwd-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  id="reset-password-final-btn"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', borderRadius: 12, fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {loading ? 'Updating Password…' : 'Reset Password'} <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleCancelForgot}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  ← Back to Login
                </button>
              </form>
            ) : (
              /* ── Step 4: Success Screen ── */
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    background: 'var(--success-bg)',
                    color: 'var(--success-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                    border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 850, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Password Reset Successfully!
                </h2>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '1.75rem' }}>
                  Your password has been securely updated. You can now log in to your farm dashboard.
                </p>
                <button
                  type="button"
                  onClick={handleBackToLoginFromSuccess}
                  id="reset-success-login-now-btn"
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    fontSize: '0.98rem',
                    fontWeight: 750,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  Login Now <ArrowRight size={17} />
                </button>
              </div>
            )}

            {/* Switch to Register link */}
            {!isForgotPassword && (
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
