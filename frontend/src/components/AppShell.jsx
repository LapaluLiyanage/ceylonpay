import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toDisplayPhone } from '../utils/phone';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Home' },
  { path: '/deposit', label: 'Deposit' },
  { path: '/transfer', label: 'Send' },
  { path: '/history', label: 'Activity' },
];

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initials = (user?.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div style={{ minHeight: '100vh', padding: '20px 20px 64px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderRadius: 18,
            background: '#101210',
            border: '1px solid rgba(255,255,255,.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: '#c9f24d' }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600 }}>CeylonPay</span>
          </div>
          <nav style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: '#181b18', border: '1px solid rgba(255,255,255,.05)' }}>
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    background: active ? '#c9f24d' : 'transparent',
                    color: active ? '#131707' : 'rgba(242,244,239,.6)',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: 'rgba(242,244,239,.45)' }}>
                {user?.phone && toDisplayPhone(user.phone)}
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#1f231f',
                border: '1px solid rgba(255,255,255,.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: '#c9f24d',
              }}
            >
              {initials}
            </div>
            <button
              onClick={logout}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,.1)',
                color: 'rgba(242,244,239,.6)',
                fontSize: 12,
              }}
            >
              Log out
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
