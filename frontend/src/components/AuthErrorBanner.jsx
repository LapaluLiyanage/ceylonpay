export function AuthErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(255,122,92,.1)',
        border: '1px solid rgba(255,122,92,.3)',
        marginBottom: 18,
      }}
    >
      <span style={{ color: '#ff7a5c', fontWeight: 700, lineHeight: 1.4 }}>!</span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: '#ffb8a6' }}>{message}</span>
    </div>
  );
}
