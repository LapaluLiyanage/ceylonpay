export function FieldLabel({ children }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 12,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: 'rgba(242,244,239,.45)',
        marginBottom: 8,
      }}
    >
      {children}
    </label>
  );
}

export function TextField({ value, onChange, type = 'text', placeholder, height = 50 }) {
  return (
    <input
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      style={{
        width: '100%',
        height,
        padding: '0 14px',
        borderRadius: 12,
        background: '#141614',
        border: '1px solid rgba(255,255,255,.09)',
        color: '#f2f4ef',
        fontSize: 16,
      }}
    />
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ff9b85' }}>{children}</p>;
}

export function PhoneField({ value, onChange, height = 50 }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        height,
        borderRadius: 12,
        background: '#141614',
        border: '1px solid rgba(255,255,255,.09)',
      }}
    >
      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, color: 'rgba(242,244,239,.5)' }}>+94</span>
      <input
        value={value}
        onChange={onChange}
        inputMode="numeric"
        placeholder="77 123 4567"
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          background: 'transparent',
          border: 0,
          color: '#f2f4ef',
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize: 16,
          letterSpacing: '.02em',
        }}
      />
    </div>
  );
}
