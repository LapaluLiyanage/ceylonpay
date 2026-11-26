// Shared building blocks for the CeylonPay look: warm dark surfaces, an orange gradient, pill shapes.
// Text passed to these as a plain string is translated into the chosen language automatically.
import { useLanguage } from '../context/LanguageContext';

/** Returns a function that translates a plain string and leaves anything else (markup) alone. */
export function useTr() {
  const { t } = useLanguage();
  return (child) => (typeof child === 'string' ? t(child) : child);
}

export const C = {
  bg: '#0B0908',
  text: '#F4EEE8',
  muted: '#A69688',
  soft: '#C9BCB0',
  accent: '#E2572B',
  grad: 'linear-gradient(135deg,#F47B3E 0%,#D9481F 100%)',
  surface: '#1E1713',
  surface2: '#2A201A',
  card: 'linear-gradient(160deg,#2C1D15 0%,#16100D 100%)',
  line: 'rgba(255,255,255,.07)',
  outline: 'rgba(244,238,232,.28)',
  error: '#FF8F7E',
  errorSoft: '#F4A69D',
  errorBg: 'rgba(214,60,45,.16)',
  warn: '#F6CB98',
  warnBg: 'rgba(230,140,50,.15)',
  ok: '#7FD39C',
  okSoft: '#9FE0B5',
  okBg: 'rgba(47,160,95,.16)',
};

const INSET = 'inset 0 1px 0 rgba(255,255,255,.25)';

export const display = { fontStretch: '125%', fontWeight: 400 };
export const mono = { fontFamily: "'JetBrains Mono', monospace" };

export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M32 4L60 20L4 20Z" fill="#F4EEE8" stroke="#F4EEE8" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="32" cy="14" r="3.6" fill="#E2572B" />
      <rect x="9" y="25" width="8" height="24" rx="2" fill="#F4EEE8" />
      <rect x="21" y="25" width="8" height="24" rx="2" fill="#F4EEE8" />
      <rect x="35" y="25" width="8" height="24" rx="2" fill="#F4EEE8" />
      <rect x="47" y="25" width="8" height="24" rx="2" fill="#F4EEE8" />
      <rect x="4" y="53" width="56" height="7" rx="2.5" fill="#F4EEE8" />
    </svg>
  );
}

export function Logo({ size = 28, fontSize = 14 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <LogoMark size={size} />
      <span style={{ fontStretch: '125%', fontWeight: 700, fontSize, letterSpacing: '.02em' }}>CEYLONPAY.</span>
    </div>
  );
}

/** The highlighted word inside a heading. */
export function Pill({ children, pad = 12 }) {
  return (
    <span style={{ display: 'inline-block', background: C.grad, color: '#fff', borderRadius: 999, padding: `0 ${pad}px` }}>{children}</span>
  );
}

export function Heading({ children, size = 30, style }) {
  const tr = useTr();
  return (
    <h1 style={{ margin: 0, ...display, fontSize: size, lineHeight: 1.15, letterSpacing: '-.01em', textTransform: 'uppercase', ...style }}>{tr(children)}</h1>
  );
}

/** Text with [bracketed] words shown on the orange pill, for headings. Pass already-translated text. */
export function Rich({ text, pad }) {
  return text.split(/\[([^\]]+)\]/).map((part, i) => (i % 2 ? <Pill key={i} pad={pad}>{part}</Pill> : part));
}

/** Orange call-to-action with an arrow knob on the right. */
export function PrimaryButton({ children, knob = '→', height = 56, style, ...props }) {
  const tr = useTr();
  return (
    <button
      className="cp-grad"
      style={{
        height,
        border: 0,
        borderRadius: 999,
        background: C.grad,
        boxShadow: INSET,
        color: '#fff',
        fontSize: 15,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: knob ? 'space-between' : 'center',
        padding: knob ? '0 6px 0 22px' : '0 22px',
        opacity: props.disabled ? 0.55 : 1,
        ...style,
      }}
      {...props}
    >
      <span>{tr(children)}</span>
      {knob && (
        <span
          style={{
            flex: 'none',
            width: height - 12,
            height: height - 12,
            borderRadius: '50%',
            background: C.surface,
            color: C.text,
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
          }}
        >
          {knob}
        </span>
      )}
    </button>
  );
}

/** Plain orange pill, no knob. */
export function GradButton({ children, height = 46, style, ...props }) {
  const tr = useTr();
  return (
    <button
      className="cp-grad"
      style={{ height, padding: '0 18px', border: 0, borderRadius: 999, background: C.grad, boxShadow: INSET, color: '#fff', fontSize: 14, fontWeight: 600, opacity: props.disabled ? 0.55 : 1, ...style }}
      {...props}
    >
      {tr(children)}
    </button>
  );
}

export function OutlineButton({ children, height = 46, style, ...props }) {
  const tr = useTr();
  return (
    <button
      className="cp-outline"
      style={{ height, padding: '0 18px', borderRadius: 999, border: `1.5px solid ${C.outline}`, background: 'transparent', fontSize: 14, fontWeight: 500, opacity: props.disabled ? 0.55 : 1, ...style }}
      {...props}
    >
      {Array.isArray(children) ? children : tr(children)}
    </button>
  );
}

export function SoftButton({ children, height = 44, style, ...props }) {
  const tr = useTr();
  return (
    <button style={{ height, padding: '0 18px', borderRadius: 999, background: C.surface, fontSize: 14, fontWeight: 500, ...style }} {...props}>
      {tr(children)}
    </button>
  );
}

export function Card({ children, tone = 'surface', style, ...props }) {
  const tones = {
    surface: { background: C.surface },
    dark: { background: C.card, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.07)', color: '#fff' },
    error: { background: C.errorBg, color: C.errorSoft },
    warn: { background: C.warnBg, color: C.warn },
    ok: { background: C.okBg, color: C.okSoft },
  };
  return (
    <div style={{ borderRadius: 24, padding: 18, ...tones[tone], ...style }} {...props}>
      {children}
    </div>
  );
}

export function Label({ children, style, ...props }) {
  const tr = useTr();
  return (
    <label style={{ fontSize: 13, fontWeight: 600, ...style }} {...props}>
      {tr(children)}
    </label>
  );
}

export function ErrorText({ children }) {
  const tr = useTr();
  if (!children) return null;
  return (
    <span role="alert" style={{ fontSize: 12.5, color: C.error }}>
      {tr(children)}
    </span>
  );
}

export function Hint({ children }) {
  const tr = useTr();
  return <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.4 }}>{tr(children)}</span>;
}

export function Banner({ tone = 'error', children, style }) {
  const tr = useTr();
  const tones = {
    error: { background: C.errorBg, color: C.errorSoft },
    warn: { background: C.warnBg, color: C.warn },
    ok: { background: C.okBg, color: C.okSoft },
    info: { background: C.surface, color: C.soft },
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} style={{ borderRadius: 16, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.45, ...tones[tone], ...style }}>
      {tr(children)}
    </div>
  );
}

const inputBase = { flex: 1, minWidth: 0, border: 0, background: 'transparent', font: 'inherit', color: C.text };

export function TextInput({ style, ...props }) {
  return (
    <input
      className="cp-field"
      style={{ height: 54, borderRadius: 16, background: C.surface, padding: '0 16px', fontSize: 16, width: '100%', ...style }}
      {...props}
    />
  );
}

/** +94 prefix inside the box; the person types the nine digits. */
export function PhoneBox({ value, onChange, height = 54, fontSize = 16, tone = C.surface, bordered = true, ...props }) {
  return (
    <div
      className={bordered ? 'cp-field' : undefined}
      style={{ display: 'flex', alignItems: 'center', height, background: tone, borderRadius: 16, overflow: 'hidden' }}
    >
      <span style={{ padding: '0 12px 0 16px', fontWeight: 600, height: '100%', display: 'flex', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,.1)' }}>+94</span>
      <input
        value={value}
        onChange={onChange}
        inputMode="numeric"
        placeholder="77 123 4567"
        style={{ ...inputBase, height: '100%', padding: '0 14px', fontSize, letterSpacing: '.04em' }}
        {...props}
      />
    </div>
  );
}

/** Rs. prefix with a large, wide number. */
export function AmountBox({ value, onChange, height = 62, fontSize = 24, placeholder = '0.00', wide = true, ...props }) {
  return (
    <div className="cp-field" style={{ display: 'flex', alignItems: 'center', height, background: C.surface2, borderRadius: 16, padding: '0 16px', gap: 10 }}>
      <span style={{ fontWeight: 600, color: C.muted }}>Rs.</span>
      <input
        value={value}
        onChange={onChange}
        inputMode="decimal"
        placeholder={placeholder}
        style={{ ...inputBase, fontSize, fontWeight: 500, ...(wide ? { fontStretch: '125%' } : null) }}
        {...props}
      />
    </div>
  );
}

const CHIP = {
  neutral: ['rgba(255,255,255,.08)', '#E8DED5'],
  ok: [C.okBg, C.okSoft],
  warn: [C.warnBg, C.warn],
  error: [C.errorBg, C.errorSoft],
  muted: ['rgba(255,255,255,.08)', C.soft],
  report: ['rgba(226,87,43,.18)', '#FFB08F'],
};

export function Chip({ tone = 'neutral', children }) {
  const tr = useTr();
  const [bg, fg] = CHIP[tone];
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap' }}>{tr(children)}</span>;
}

export function Skeleton({ height = 100, radius = 22 }) {
  return <div style={{ height, borderRadius: radius, background: 'rgba(255,255,255,.07)', animation: 'cp-pulse 1.4s ease-in-out infinite' }} />;
}

/** Page title block used at the top of most screens. */
export function PageTitle({ children, sub }) {
  const tr = useTr();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Heading>{children}</Heading>
      {sub && <span style={{ fontSize: 14, color: C.soft, lineHeight: 1.5 }}>{tr(sub)}</span>}
    </div>
  );
}
