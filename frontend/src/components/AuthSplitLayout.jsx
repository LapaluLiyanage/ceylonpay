import { C, Logo, LogoMark, Pill, display } from './ui';
import { Hero3D } from './Hero3D';
import { useMedia, DESKTOP_QUERY } from './useMedia';

export function Float({ children, style, knobFirst }) {
  const knob = (
    <span style={{ width: 34, height: 34, borderRadius: '50%', background: C.grad, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, border: '2px solid #fff' }}>↗</span>
  );
  const label = (
    <span style={{ background: 'rgba(20,14,11,.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 999, padding: '8px 13px', fontSize: 12.5, fontWeight: 500 }}>{children}</span>
  );
  return (
    <div style={{ position: 'absolute', zIndex: 3, display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      {knobFirst ? knob : label}
      {knobFirst ? label : knob}
    </div>
  );
}

/** The score bar that explains what Allow, Warn and Hold mean. */
function ScoreExplainer() {
  return (
    <div style={{ width: 260, background: 'rgba(20,14,11,.6)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>How the scam check decides</span>
      <div style={{ display: 'grid', gridTemplateColumns: '40fr 35fr 25fr', gap: 4, height: 8 }}>
        <span style={{ background: '#2F9A5E', borderRadius: 999 }} />
        <span style={{ background: '#D9822B', borderRadius: 999 }} />
        <span style={{ background: '#D2382B', borderRadius: 999 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '40fr 35fr 25fr', gap: 4, fontSize: 11.5, lineHeight: 1.4 }}>
        <div><b>Allow</b><br /><span style={{ color: '#BFB1A5' }}>0–39</span></div>
        <div><b>Warn</b><br /><span style={{ color: '#BFB1A5' }}>40–74</span></div>
        <div><b>Hold</b><br /><span style={{ color: '#BFB1A5' }}>75+</span></div>
      </div>
    </div>
  );
}

function DesktopHero() {
  return (
    <div style={{ position: 'relative', flex: 1.3, margin: '16px 0 16px 16px', borderRadius: 32, overflow: 'hidden', background: 'radial-gradient(120% 90% at 50% 35%, #6E4534 0%, #3A2419 58%, #1C130E 100%)' }}>
      <Hero3D rotation={-0.35} />
      <div style={{ position: 'absolute', left: 32, top: 28, zIndex: 3 }}>
        <Logo size={30} fontSize={15} />
      </div>
      <div style={{ position: 'absolute', right: 28, top: 26, zIndex: 3, height: 36, padding: '0 14px', borderRadius: 999, background: 'rgba(20,14,11,.55)', backdropFilter: 'blur(10px)', fontSize: 13, display: 'flex', alignItems: 'center' }}>Fee Rs. 0.00</div>
      <Float knobFirst style={{ left: '10%', top: '24%' }}>Name check</Float>
      <Float style={{ right: '10%', top: '28%' }}>Scam score</Float>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', zIndex: 2, pointerEvents: 'none', background: 'linear-gradient(to top, rgba(14,9,7,.94) 0%, rgba(14,9,7,.7) 45%, transparent 100%)' }} />
      <div style={{ position: 'absolute', left: 32, right: 32, bottom: 32, zIndex: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ margin: 0, ...display, fontSize: 'clamp(30px, 3.2vw, 46px)', lineHeight: 1.12, letterSpacing: '-.01em' }}>
            SEND <Pill pad={14}>MONEY</Pill> WITH CONFIDENCE
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#DCCFC4' }}>A phone-number wallet for Sri Lanka. Every rupee is name-checked and scam-scored before it leaves.</p>
        </div>
        <ScoreExplainer />
      </div>
    </div>
  );
}

function MobileHero({ height, label }) {
  return (
    <div style={{ position: 'relative', height, borderRadius: 26, overflow: 'hidden', background: 'radial-gradient(120% 90% at 50% 30%, #6E4534 0%, #2E1C14 75%)' }}>
      <Hero3D rotation={-0.35} />
      <div style={{ position: 'absolute', left: 14, bottom: 14, zIndex: 3, background: C.surface, borderRadius: 999, padding: '8px 13px', fontSize: 12.5, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

/**
 * Frame for the sign-in and register screens. `action` is the small button in the corner that
 * switches to the other screen; `heroLabel` and `heroHeight` shape the picture on small screens.
 */
export function AuthSplitLayout({ children, action, heroLabel, heroHeight = 170 }) {
  const desktop = useMedia(DESKTOP_QUERY);

  if (desktop) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex' }}>
        <DesktopHero />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '48px 40px 40px' }}>
          <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, animation: 'cp-rise .35s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Logo size={28} fontSize={14} />
              {action}
            </div>
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '10px 18px 40px' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6, animation: 'cp-rise .35s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogoMark size={28} />
            <span style={{ fontStretch: '125%', fontWeight: 700, fontSize: 14 }}>CEYLONPAY.</span>
          </div>
          {action}
        </div>
        <MobileHero height={heroHeight} label={heroLabel} />
        {children}
      </div>
    </div>
  );
}

/** The corner switch button (Log in / Create an account), shown on small screens only by the layout. */
export function AuthSwitch({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ height: 44, padding: '0 18px', borderRadius: 999, background: C.surface, fontSize: 14, fontWeight: 500 }}>
      {children}
    </button>
  );
}
