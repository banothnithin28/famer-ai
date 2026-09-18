import React from 'react';
import {
  Leaf,
  Home,
  Sprout,
  Camera,
  Bot,
  CloudSun,
  Sun,
  Moon,
  User,
  LogOut,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'plants',    label: 'My Plants', icon: Sprout },
  { id: 'scanner',   label: 'Scan Plant', icon: Camera, isPrimary: true },
  { id: 'weather',   label: 'Weather', icon: CloudSun },
  { id: 'chat',      label: 'Farmer AI', icon: Bot },
];

export default function Navbar({
  activeTab,
  setActiveTab,
  darkMode,
  setDarkMode,
  user,
  onOpenAuthModal,
  onLogout,
}) {
  const navTo = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const greeting = user?.name ? user.name.split(' ')[0] : null;

  return (
    <>
      {/* ─── Desktop Top Navigation ─── */}
      <header
        className="top-nav hidden lg:flex items-center"
        style={{
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>

          {/* Brand */}
          <button
            onClick={() => navTo('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label="Go to Farmer AI Home"
          >
            <span style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent)'
            }}>
              <Leaf size={22} color="#fff" />
            </span>
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontWeight: 900, fontSize: '1.15rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'block', lineHeight: 1.1 }}>
                Farmer<span style={{ color: 'var(--primary)' }}>AI</span>
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Smart Crop Platform
              </span>
            </div>
          </button>

          {/* Core 5 Navigation Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} aria-label="Main Navigation">
            {navItems.map(({ id, label, icon: Icon, isPrimary }) => {
              const isActive = activeTab === id || (id === 'plants' && activeTab === 'plant-details');

              if (isPrimary) {
                return (
                  <button
                    key={id}
                    onClick={() => navTo(id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.45rem',
                      padding: '0.45rem 1.1rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontSize: '0.875rem', fontWeight: 800,
                      background: 'var(--primary)',
                      color: '#FFFFFF',
                      boxShadow: isActive
                        ? '0 0 0 2px var(--surface), 0 0 0 4px var(--primary)'
                        : '0 2px 8px color-mix(in srgb, var(--primary) 35%, transparent)',
                      transform: isActive ? 'scale(1.02)' : 'none',
                      transition: 'all 180ms ease',
                      marginLeft: '0.25rem',
                      marginRight: '0.25rem',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary)'; }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                );
              }

              return (
                <button
                  key={id}
                  onClick={() => navTo(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                    padding: '0.45rem 0.95rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: '0.875rem', fontWeight: 700,
                    background: isActive ? 'var(--success-bg)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    transition: 'all 180ms ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--surface-secondary)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={16} style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Secondary Controls: Profile / Settings / Theme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                  background: 'var(--surface-secondary)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)',
                }}>
                  <User size={13} style={{ color: 'var(--primary)' }} />
                  {greeting || user.email}
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.4rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)',
                    fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)',
                    background: 'var(--surface)', cursor: 'pointer', transition: 'all 180ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="btn btn-primary btn-sm"
                id="nav-login-btn"
              >
                <User size={14} />
                Login
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--surface-secondary)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', transition: 'all 180ms',
                color: 'var(--text-primary)'
              }}
              id="dark-mode-toggle"
            >
              {darkMode
                ? <Sun size={17} style={{ color: 'var(--warning)' }} />
                : <Moon size={17} style={{ color: 'var(--text-muted)' }} />}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Mobile Top Header ─── */}
      <header
        className="mobile-top-header lg:hidden flex items-center justify-between"
        style={{
          padding: '0.75rem 1rem',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <button
          onClick={() => navTo('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Leaf size={18} color="#fff" />
          </span>
          <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            Farmer<span style={{ color: 'var(--primary)' }}>AI</span>
          </span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {user ? (
            <button
              onClick={onLogout}
              title="Sign Out"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid var(--border)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
                background: 'var(--surface-secondary)', cursor: 'pointer',
              }}
            >
              <LogOut size={13} />
              Exit
            </button>
          ) : (
            <button
              onClick={onOpenAuthModal}
              style={{
                background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6,
                padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Login
            </button>
          )}

          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface-secondary)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            {darkMode
              ? <Sun size={15} style={{ color: 'var(--warning)' }} />
              : <Moon size={15} style={{ color: 'var(--text-muted)' }} />}
          </button>
        </div>
      </header>

      {/* ─── Mobile Bottom Tab Bar (5 Core Features) ─── */}
      <nav
        className="bottom-nav lg:hidden"
        aria-label="Mobile Navigation"
        id="mobile-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 'var(--bottom-nav-height)',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          alignItems: 'center',
          zIndex: 50,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.06)'
        }}
      >
        {navItems.map(({ id, label, icon: Icon, isPrimary }) => {
          const isActive = activeTab === id || (id === 'plants' && activeTab === 'plant-details');

          if (isPrimary) {
            return (
              <button
                key={id}
                onClick={() => navTo(id)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 10px color-mix(in srgb, var(--primary) 40%, transparent)',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    transition: 'all 180ms ease',
                    marginTop: -10,
                  }}
                >
                  <Icon size={22} />
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: 'var(--primary)',
                  marginTop: 2,
                }}>
                  {label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={id}
              onClick={() => navTo(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 0',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'all 180ms ease',
              }}
            >
              <Icon size={20} style={{ marginBottom: 2 }} />
              <span style={{
                fontSize: '0.68rem',
                fontWeight: isActive ? 800 : 600,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
