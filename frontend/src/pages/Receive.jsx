import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { buildPayLink } from '../utils/payLink';
import { toDisplayPhone } from '../utils/phone';
import { AmountBox, Card, GradButton, Heading, Label, Pill, C, mono } from '../components/ui';

export default function Receive() {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  const link = buildPayLink(window.location.origin, user?.phone, amount);
  const hasAmount = link.includes('amount=');

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Heading>
            Get <Pill>paid</Pill>
          </Heading>
          <span style={{ fontSize: 14, color: C.soft, lineHeight: 1.5 }}>
            Whoever scans this lands on Send with your number{hasAmount ? ' and the amount' : ' (and amount, if set)'} filled in — and still checks your name before paying.
          </span>
        </div>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
          <Label>Amount (optional)</Label>
          <AmountBox height={54} fontSize={18} wide={false} placeholder="Any amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Card>
        <Card tone="dark" style={{ borderRadius: 30, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#fff', borderRadius: 22, padding: 14, width: 'min(100%, 250px)', aspectRatio: '1', display: 'grid', placeItems: 'center' }}>
            {qr && <img src={qr} alt={`QR code to pay ${toDisplayPhone(user?.phone)}`} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ ...mono, fontSize: 13, color: '#CFCAC2', marginTop: 3 }}>{toDisplayPhone(user?.phone)}</div>
          </div>
          <span style={{ height: 30, padding: '0 12px', borderRadius: 999, background: C.accent, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            {hasAmount ? `Asks for Rs. ${Number(amount.replace(/[,\s]/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Any amount'}
          </span>
        </Card>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: C.surface, borderRadius: 999, padding: '5px 5px 5px 16px' }}>
          <span style={{ flex: 1, minWidth: 0, ...mono, fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link}</span>
          <GradButton height={42} onClick={copy} style={{ fontSize: 13 }}>
            {copied ? 'Copied' : 'Copy link'}
          </GradButton>
        </div>
      </div>
    </AppShell>
  );
}
