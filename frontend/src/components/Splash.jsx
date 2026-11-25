import { useEffect, useState } from 'react';
import { C, mono } from './ui';

const LETTERS = 'CEYLONPAY'.split('');
const RUN_MS = 2400; // how long the intro animation plays before the curtain lifts
const EXIT_MS = 800;

/**
 * The opening screen: the logo builds itself, a counter runs to 100, then the screen slides away.
 * Tap anywhere to skip. `onDone` fires once it has left the screen.
 */
export function Splash({ onDone }) {
  const [count, setCount] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / RUN_MS);
      setCount(Math.round(100 * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const leave = setTimeout(() => setLeaving(true), RUN_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(leave);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return undefined;
    const done = setTimeout(onDone, EXIT_MS);
    return () => clearTimeout(done);
  }, [leaving, onDone]);

  return (
    <div
      role="status"
      aria-label="Loading CeylonPay"
      onClick={() => setLeaving(true)}
      className={leaving ? 'sp-root sp-leave' : 'sp-root'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
        overflow: 'hidden',
        background: 'radial-gradient(70% 60% at 85% 10%, #6B2A12 0%, transparent 60%), radial-gradient(60% 50% at 0% 100%, #3A1A0E 0%, transparent 70%), #0C0A09',
      }}
    >
      <svg width="132" height="132" viewBox="0 0 64 64" aria-hidden="true" className="sp-mark">
        <path className="sp-arc" d="M32 4L60 20L4 20Z" fill="#F4EEE8" stroke="#F4EEE8" strokeWidth="4" strokeLinejoin="round" />
        <circle className="sp-dot" cx="32" cy="14" r="3.6" fill="#E2572B" />
        {[9, 21, 35, 47].map((x, i) => (
          <rect key={x} className="sp-facet" style={{ animationDelay: `${0.4 + i * 0.09}s` }} x={x} y="25" width="8" height="24" rx="2" fill="#F4EEE8" />
        ))}
        <rect className="sp-base" x="4" y="53" width="56" height="7" rx="2.5" fill="#F4EEE8" />
      </svg>
      <div className="sp-word" style={{ display: 'flex', overflow: 'hidden', fontStretch: '125%', fontSize: 'clamp(30px, 7vw, 54px)', fontWeight: 600, letterSpacing: '.01em', lineHeight: 1.15 }}>
        {LETTERS.map((ch, i) => (
          <span key={i} className="sp-ch" style={{ animationDelay: `${1.1 + i * 0.045}s` }}>{ch}</span>
        ))}
        <span className="sp-ch" style={{ animationDelay: `${1.1 + LETTERS.length * 0.045}s`, color: C.accent }}>.</span>
      </div>
      <span className="sp-tag" style={{ fontSize: 13, color: C.soft, letterSpacing: '.2em', textTransform: 'uppercase', textAlign: 'center', padding: '0 24px' }}>Scam-safe payments for Sri Lanka</span>
      <div style={{ position: 'absolute', left: 32, right: 32, bottom: 40, display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 12, color: C.soft }}>
        <span>English · සිංහල · தமிழ்</span>
        <span>{String(count).padStart(3, '0')}</span>
      </div>
      <div className="sp-bar" style={{ position: 'absolute', left: 32, right: 32, bottom: 28, height: 2, background: C.grad, transformOrigin: 'left center' }} />
    </div>
  );
}
