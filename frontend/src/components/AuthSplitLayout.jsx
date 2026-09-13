const BULLETS = [
  'Transfers by phone number, in seconds',
  'Every rupee logged and auditable',
  'LKR only — no conversion surprises',
];

export function AuthSplitLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', background: '#0b0c0b' }}>
      <div
        style={{
          flex: '1 1 360px',
          minWidth: 'min(100%, 320px)',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 48,
          background: '#101210',
          borderRight: '1px solid rgba(255,255,255,.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: '#c9f24d' }} />
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: '-.01em' }}>
            CeylonPay
          </span>
        </div>
        <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 'clamp(32px,4.4vw,50px)',
              lineHeight: 1.04,
              fontWeight: 500,
              letterSpacing: '-.03em',
            }}
          >
            Send money to a phone number.
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'rgba(242,244,239,.55)', maxWidth: 340 }}>
            A wallet in rupees. Deposit, send, and see every transaction — no card numbers, no branch visits.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'rgba(242,244,239,.45)', marginTop: 8 }}>
            {BULLETS.map((line) => (
              <div key={line} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#c9f24d' }} />
                {line}
              </div>
            ))}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(242,244,239,.3)' }}>Licensed demo build · Colombo, Sri Lanka</p>
      </div>

      <div style={{ flex: '1 1 420px', minWidth: 'min(100%, 320px)', padding: '48px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420, animation: 'cp-rise .4s ease both' }}>{children}</div>
      </div>
    </div>
  );
}
