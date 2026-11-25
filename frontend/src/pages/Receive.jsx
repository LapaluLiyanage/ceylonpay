import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { FieldLabel } from '../components/FormFields';
import { buildPayLink } from '../utils/payLink';
import { toDisplayPhone } from '../utils/phone';

export default function Receive() {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  const link = buildPayLink(window.location.origin, user?.phone, amount);

  useEffect(() => {
    let current = true;
    QRCode.toDataURL(link, { margin: 1, width: 280 })
      .then((url) => current && setQr(url))
      .catch(() => current && setQr(''));
    return () => {
      current = false;
    };
  }, [link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the code above still works.
    }
  }

  return (
    <AppShell>
      <main style={{ marginTop: 20, display: 'flex', justifyContent: 'center', animation: 'cp-rise .35s ease both' }}>
        <section style={{ width: '100%', maxWidth: 520, padding: 28, borderRadius: 22, background: '#141614', border: '1px solid rgba(255,255,255,.07)' }}>
          <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500 }}>Get paid</h2>
          <p style={{ margin: '0 0 22px', fontSize: 14, color: 'rgba(242,244,239,.5)' }}>
            Show this code. Whoever scans it lands on the Send page with your number{amount ? ' and the amount' : ''} filled in, and still checks the name before paying.
          </p>

          <FieldLabel>Amount (optional)</FieldLabel>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Any amount"
            style={{ width: '100%', height: 50, padding: '0 14px', borderRadius: 12, background: '#0f110f', border: '1px solid rgba(255,255,255,.09)', color: '#f2f4ef', fontSize: 16 }}
          />

          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {qr && <img src={qr} alt={`QR code to pay ${toDisplayPhone(user?.phone)}`} width={280} height={280} style={{ borderRadius: 16, background: '#fff' }} />}
            <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 16 }}>{user?.name} · {toDisplayPhone(user?.phone)}</p>
            <button
              type="button"
              onClick={copy}
              style={{ padding: '9px 14px', borderRadius: 10, background: 'rgba(255,255,255,.08)', color: '#f2f4ef', fontSize: 13 }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
