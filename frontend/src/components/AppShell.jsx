import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES } from '../i18n/strings';
import { toDisplayPhone } from '../utils/phone';
import { C, Logo, LogoMark, GradButton, mono } from './ui';
import { useMedia, DESKTOP_QUERY } from './useMedia';

const ICONS = {
  '/dashboard': 'M4 10.5L12 4l8 6.5V20H4z M10 20v-5.5h4V20',
  '/deposit': 'M12 4v10 M7.5 9.5L12 14l4.5-4.5 M5 19.5h14',
  '/transfer': 'M5 19L19 5 M9 5h10v10',
  '/receive': 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2.5v2.5H14z M17.5 17.5H20V20h-2.5z M14 20h1 M20 14v1',
  '/history': 'M3.5 12h4l2.5-6.5 4 13 2.5-6.5h4',
  '/safety': 'M12 3.5l7.5 2.8v5.6c0 4.6-3.2 7.6-7.5 8.6-4.3-1-7.5-4-7.5-8.6V6.3z M9 12l2.2 2.2L15.2 10',
  '/admin': 'M4 6h16 M4 12h9 M4 18h6 M14.5 17l2.5 2.5L21 15',
};

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Home' },
  { path: '/deposit', label: 'Deposit' },
  { path: '/transfer', label: 'Send' },
  { path: '/receive', label: 'Receive' },
  { path: '/history', label: 'Activity' },
  { path: '/safety', label: 'Safety' },
];

// How wide the content may grow on a large screen.
const MAX_WIDTH = { '/dashboard': 1160, '/admin': 1280, '/history': 900, '/safety': 1000 };

function Icon({ path, size = 18, stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={path} />
    </svg>
  );
}

function LanguageSwitch({ stretch, track }) {
  const { lang, setLang } = useLanguage();
  return (
    <div role="group" aria-label="Language" style={{ display: 'flex', background: track, borderRadius: 999, padding: 3, gap: 2 }}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          title={l.name}
          style={{
            flex: stretch ? 1 : 'none',
            height: 32,
            minWidth: 38,
            padding: '0 8px',
            borderRadius: 999,
            background: lang === l.code ? C.accent : 'transparent',
            color: lang === l.code ? '#fff' : C.text,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function VerifyBanner({ onVerify, compact }) {
  return (
    <div style={{ background: 'rgba(226,87,43,.18)', borderRadius: 18, padding: compact ? '10px 10px 10px 16px' : 14, display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: compact ? 'center' : 'stretch', gap: 10 }}>
      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
        <b>Verify your phone</b> to start sending money.
      </span>
      <GradButton height={compact ? 36 : 38} onClick={onVerify} style={{ fontSize: 12.5, padding: '0 14px' }}>
        {compact ? 'Verify →' : 'Verify now →'}
      </GradButton>
    </div>
  );
}

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const desktop = useMedia(DESKTOP_QUERY);

  const items = user?.role === 'ADMIN' ? [...NAV_ITEMS, { path: '/admin', label: 'Review' }] : NAV_ITEMS;
  const needsVerify = user?.phoneVerified === false && location.pathname !== '/verify';
  const initials = (user?.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const phone = user?.phone ? toDisplayPhone(user.phone) : '';
  const maxWidth = MAX_WIDTH[location.pathname] || 620;

  if (desktop) {
    return (
      <div style={{ display: 'flex', height: '100vh' }}>
        <aside style={{ flex: 'none', width: 264, height: '100%', display: 'flex', flexDirection: 'column', gap: 22, padding: '26px 16px 18px', borderRight: `1px solid ${C.line}`, background: 'rgba(10,8,7,.4)', overflowY: 'auto' }}>
          <div style={{ padding: '0 10px' }}>
            <Logo size={30} fontSize={15} />
          </div>
          <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...mono, fontSize: 11, color: '#8A7C70', padding: '0 12px 6px' }}>MENU</span>
            {items.map((item, i) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    height: 52,
                    borderRadius: 16,
                    background: active ? C.grad : 'transparent',
                    color: active ? '#fff' : '#CDBFB3',
                    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,.25), 0 10px 24px -10px rgba(226,87,43,.7)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '0 14px 0 9px',
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ flex: 'none', width: 34, height: 34, borderRadius: 11, background: active ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.06)', display: 'grid', placeItems: 'center' }}>
                    <Icon path={ICONS[item.path]} />
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{ ...mono, fontSize: 10.5, opacity: 0.5 }}>{String(i + 1).padStart(2, '0')}</span>
                </button>
              );
            })}
          </nav>
          <div style={{ flex: 1 }} />
          {needsVerify && <VerifyBanner onVerify={() => navigate('/verify')} />}
          <div style={{ background: C.surface, borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: C.grad, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>{initials}</span>
              <div style={{ minWidth: 0, lineHeight: 1.3 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                <div style={{ ...mono, fontSize: 11.5, color: C.muted }}>{phone}</div>
              </div>
            </div>
            <LanguageSwitch stretch track={C.surface2} />
            <button className="cp-danger" onClick={logout} style={{ height: 40, borderRadius: 999, border: `1.5px solid ${C.outline}`, fontSize: 13, fontWeight: 500 }}>
              Log out
            </button>
          </div>
        </aside>
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '36px 48px 56px' }}>
          <div style={{ maxWidth, margin: '0 auto', animation: 'cp-rise .35s ease both' }}>{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 112 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 10px' }}>
        <LogoMark size={28} />
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25, }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
          <div style={{ ...mono, fontSize: 11.5, color: C.muted }}>{phone}</div>
        </div>
        <LanguageSwitch track={C.surface} />
        <button className="cp-danger" onClick={logout} style={{ height: 38, padding: '0 12px', borderRadius: 999, border: `1.5px solid ${C.outline}`, fontSize: 12.5, fontWeight: 500 }}>
          Log out
        </button>
      </header>
      {needsVerify && (
        <div style={{ margin: '0 16px 8px' }}>
          <VerifyBanner compact onVerify={() => navigate('/verify')} />
        </div>
      )}
      <main style={{ padding: '6px 18px 0', maxWidth: 620, margin: '0 auto', animation: 'cp-rise .35s ease both' }}>{children}</main>
      <nav
        aria-label="Main"
        style={{ position: 'fixed', left: 10, right: 10, bottom: 10, borderRadius: 28, background: 'rgba(28,20,16,.78)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)', padding: 5, display: 'flex', gap: 2, zIndex: 5, maxWidth: 600, margin: '0 auto' }}
      >
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={active ? 'page' : undefined}
              style={{ flex: '1 1 0', minWidth: 0, height: 54, borderRadius: 22, background: active ? C.grad : 'transparent', color: active ? '#fff' : '#CDBFB3', fontSize: 10, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, whiteSpace: 'nowrap' }}
            >
              <Icon path={ICONS[item.path]} size={19} stroke={1.9} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
