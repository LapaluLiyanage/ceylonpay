import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { C, mono } from './ui';

const LETTERS = 'CEYLONPAY'.split('');
const EXIT_AT = 2.9; // seconds into the timeline where the exit starts

/**
 * The opening screen, built to the design's timeline: the base grows, the four columns rise one by one,
 * the roof drops in with a bounce, the dot pops with a spring, the name slides up letter by letter while a
 * counter and bar run to 100, then everything lifts away. Tap anywhere to skip to the exit.
 * `onDone` fires once the screen has left.
 */
export function Splash({ onDone }) {
  const rootRef = useRef(null);
  const timelineRef = useRef(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    const q = (k) => el.querySelectorAll(`[data-a="${k}"]`);
    const counter = q('count')[0];
    const progress = { v: 0 };

    const ctx = gsap.context(() => {
      gsap.set(el, { yPercent: 0 });
      gsap.set(q('base'), { scaleX: 0, transformOrigin: '50% 50%' });
      gsap.set(q('facet'), { scaleY: 0, transformOrigin: '50% 100%' });
      gsap.set(q('arc'), { y: -26, opacity: 0 });
      gsap.set(q('dot'), { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(q('ch'), { yPercent: 115 });
      gsap.set(q('tag'), { opacity: 0, y: 12 });
      gsap.set(q('mark'), { scale: 1, y: 0, rotate: 0, opacity: 1, transformOrigin: '50% 50%' });

      timelineRef.current = gsap
        .timeline({ onComplete: onDone })
        .to(q('base'), { scaleX: 1, duration: 0.55, ease: 'power3.out' }, 0.1)
        .to(q('facet'), { scaleY: 1, duration: 0.55, stagger: 0.09, ease: 'power3.out' }, 0.4)
        .to(q('arc'), { y: 0, opacity: 1, duration: 0.6, ease: 'bounce.out' }, 0.85)
        .to(q('dot'), { scale: 1, duration: 0.8, ease: 'elastic.out(1,.4)' }, 1.4)
        .to(q('ch'), { yPercent: 0, duration: 0.8, stagger: 0.045, ease: 'power4.out' }, 1.1)
        .to(q('tag'), { opacity: 1, y: 0, duration: 0.6 }, 1.6)
        .to(
          progress,
          {
            v: 100,
            duration: 2.6,
            ease: 'power1.inOut',
            onUpdate: () => {
              if (counter) counter.textContent = String(Math.round(progress.v)).padStart(3, '0');
            },
          },
          0
        )
        .to(q('bar'), { scaleX: 1, duration: 2.6, ease: 'power1.inOut' }, 0)
        .to([q('ch'), q('tag')], { yPercent: -115, opacity: 0, duration: 0.5, stagger: 0.02, ease: 'power3.in' }, EXIT_AT)
        .to(q('mark'), { scale: 0.3, y: -30, opacity: 0, duration: 0.55, ease: 'power3.in' }, EXIT_AT + 0.1)
        .to(el, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, EXIT_AT + 0.4);
    }, el);

    // If the animation somehow stalls, never trap the person behind the splash.
    const safety = setTimeout(onDone, 6000);
    return () => {
      clearTimeout(safety);
      ctx.revert();
    };
  }, [onDone]);

  function skip() {
    const tl = timelineRef.current;
    if (tl && tl.time() < EXIT_AT) tl.seek(EXIT_AT);
  }

  return (
    <div
      ref={rootRef}
      role="status"
      aria-label="Loading CeylonPay"
      onClick={skip}
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
        cursor: 'pointer',
        background: 'radial-gradient(70% 60% at 85% 10%, #6B2A12 0%, transparent 60%), radial-gradient(60% 50% at 0% 100%, #3A1A0E 0%, transparent 70%), #0C0A09',
      }}
    >
      <svg data-a="mark" width="132" height="132" viewBox="0 0 64 64" aria-hidden="true">
        <path data-a="arc" d="M32 4L60 20L4 20Z" fill="#F4EEE8" stroke="#F4EEE8" strokeWidth="4" strokeLinejoin="round" />
        <circle data-a="dot" cx="32" cy="14" r="3.6" fill="#E2572B" />
        {[9, 21, 35, 47].map((x) => (
          <rect key={x} data-a="facet" x={x} y="25" width="8" height="24" rx="2" fill="#F4EEE8" />
        ))}
        <rect data-a="base" x="4" y="53" width="56" height="7" rx="2.5" fill="#F4EEE8" />
      </svg>
      <div style={{ display: 'flex', overflow: 'hidden', fontStretch: '125%', fontSize: 'clamp(30px, 7vw, 54px)', fontWeight: 600, letterSpacing: '.01em', lineHeight: 1.1 }}>
        {LETTERS.map((ch, i) => (
          <span key={i} data-a="ch" style={{ display: 'inline-block' }}>{ch}</span>
        ))}
        <span data-a="ch" style={{ display: 'inline-block', color: C.accent }}>.</span>
      </div>
      <span data-a="tag" style={{ fontSize: 13, color: C.soft, letterSpacing: '.2em', textTransform: 'uppercase', textAlign: 'center', padding: '0 24px' }}>Scam-safe payments for Sri Lanka</span>
      <div style={{ position: 'absolute', left: 32, right: 32, bottom: 40, display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 12, color: C.soft }}>
        <span>English · සිංහල · தமிழ்</span>
        <span data-a="count">000</span>
      </div>
      <div data-a="bar" style={{ position: 'absolute', left: 32, right: 32, bottom: 28, height: 2, background: C.grad, transformOrigin: 'left center', transform: 'scaleX(0)' }} />
    </div>
  );
}
