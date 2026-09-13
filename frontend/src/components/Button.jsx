const VARIANTS = {
  primary: { background: '#c9f24d', color: '#131707' },
  dark: { background: '#14170f', color: '#f3f4ef', fontWeight: 600 },
  outlineLight: { background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(242,244,239,.7)' },
  outlineDark: { background: 'transparent', border: '1px solid rgba(20,23,15,.2)', color: '#14170f', fontWeight: 600 },
};

export function Button({ variant = 'primary', style, children, ...props }) {
  const base = { height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700, padding: '0 20px' };
  return (
    <button style={{ ...base, ...VARIANTS[variant], ...style }} {...props}>
      {children}
    </button>
  );
}
