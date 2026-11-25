import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Float } from '../components/AuthSplitLayout';
import { Hero3D } from '../components/Hero3D';
import { useMedia, DESKTOP_QUERY } from '../components/useMedia';
import { Logo, OutlineButton, Pill, PrimaryButton, C, display, mono } from '../components/ui';
import { markWelcomed } from '../utils/firstRun';

const SLIDES = [
  { tag: '01 — SEND', a: 'SEND TO ANY', b: 'PHONE', c: 'NUMBER', body: 'Type a +94 number or scan a code. No fees, no bank details — a wallet tied to your phone.', pills: ['+94 77 123 4567', 'Fee Rs. 0.00', 'Scan to pay'], rotation: -0.35 },
  { tag: '02 — CHECK', a: 'SEE WHO', b: 'YOU PAY', c: 'FIRST', body: 'Every transfer shows the recipient’s name and is scored against scam signals. Risky ones warn you; the riskiest wait for a reviewer.', pills: ['Paying K. Perera', 'Risk score 62', 'Held for review'], rotation: 0.45 },
  { tag: '03 — RECOVER', a: 'SCAMMED?', b: 'GET IT', c: 'BACK', body: 'Report a payment within 30 days. We stop the receiver sending at once and return what’s still in their wallet.', pills: ['Report scam', 'Account on hold', 'Refund Rs. 7,400.00'], rotation: -0.75 },
];

/** Three intro slides over the 3D scene, shown to first-time visitors. */
export default function Welcome() {
  const navigate = useNavigate();
  const desktop = useMedia(DESKTOP_QUERY);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  function leave(path) {
    markWelcomed(window.localStorage);
    navigate(path);
  }

  const hero = (
    <div style={{ position: 'relative', flex: desktop ? 1.3 : '1 0 190px', minHeight: desktop ? 0 : 190, borderRadius: desktop ? 32 : 30, overflow: 'hidden', background: 'radial-gradient(120% 90% at 50% 30%, #6E4534 0%, #3A2419 58%, #1C130E 100%)' }}>
      <Hero3D rotation={slide.rotation} />
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', background: C.surface2, borderRadius: '0 0 22px 22px', padding: '10px 14px 12px', display: 'flex', gap: 6, zIndex: 3 }} aria-hidden="true">
        {SLIDES.map((_, i) => (
          <span key={i} style={{ height: 8, width: i === index ? 26 : 8, borderRadius: 999, background: i === index ? C.accent : '#5A4A40', transition: 'width .4s' }} />
        ))}
      </div>
      <Float knobFirst style={{ left: '6%', top: '20%' }} key={`p1-${index}`}>{slide.pills[0]}</Float>
      <Float style={{ right: '5%', top: '50%' }} key={`p2-${index}`}>{slide.pills[1]}</Float>
      <Float knobFirst style={{ left: '7%', bottom: '9%' }} key={`p3-${index}`}>{slide.pills[2]}</Float>
    </div>
  );

  const copy = (
    <div key={index} className="wl-swap" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ ...mono, fontSize: 12, color: C.muted }}>{slide.tag}</span>
      <h1 style={{ margin: 0, ...display, fontSize: desktop ? 'clamp(34px, 3.6vw, 52px)' : 28, lineHeight: 1.16, letterSpacing: '-.01em' }}>
        {slide.a} <Pill>{slide.b}</Pill> {slide.c}
      </h1>
      <p style={{ margin: 0, fontSize: desktop ? 16 : 14.5, lineHeight: 1.5, color: C.soft, textWrap: 'pretty', maxWidth: 520 }}>{slide.body}</p>
    </div>
  );

  const actions = (
    <div style={{ display: 'flex', gap: 10, maxWidth: 520 }}>
      {last ? (
        <PrimaryButton knob="→" onClick={() => leave('/register')} style={{ flex: 1 }}>
          Create wallet
        </PrimaryButton>
      ) : (
        <PrimaryButton knob="→" onClick={() => setIndex(index + 1)} style={{ flex: 1 }}>
          Next
        </PrimaryButton>
      )}
      <OutlineButton height={56} onClick={() => leave('/login')} style={{ fontSize: 15, padding: '0 22px' }}>
        Log in
      </OutlineButton>
    </div>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Logo size={28} fontSize={14} />
      <button onClick={() => leave('/login')} style={{ height: 44, padding: '0 18px', borderRadius: 999, background: C.surface, fontSize: 14, fontWeight: 500 }}>
        Skip
      </button>
    </div>
  );

  if (desktop) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex' }}>
        <div style={{ flex: 1.3, display: 'flex', padding: 16 }}>{hero}</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, padding: '32px 48px' }}>
          {header}
          <div style={{ flex: 1 }} />
          {copy}
          {actions}
          <div style={{ flex: 1 }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 18px 28px', maxWidth: 520, margin: '0 auto' }}>
      {header}
      {hero}
      {copy}
      {actions}
    </div>
  );
}
