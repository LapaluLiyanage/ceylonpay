import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { FieldLabel, FieldError } from '../components/FormFields';
import { useAuth } from '../context/AuthContext';
import { requestPhoneCode, verifyPhone } from '../api/account';
import { toDisplayPhone } from '../utils/phone';

export default function VerifyPhone() {
  const navigate = useNavigate();
  const { user, markPhoneVerified } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('We texted a 6-digit code to your phone when you signed up.');
  const [busy, setBusy] = useState(false);

  async function resend() {
    setError('');
    setBusy(true);
    try {
      const sent = await requestPhoneCode();
      setInfo(sent.devCode ? `New code sent. (Development: ${sent.devCode})` : 'New code sent. It can take a minute to arrive.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verifyPhone(code);
      markPhoneVerified();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main style={{ marginTop: 20, display: 'flex', justifyContent: 'center', animation: 'cp-rise .35s ease both' }}>
        <section style={{ width: '100%', maxWidth: 480, padding: 28, borderRadius: 22, background: '#141614', border: '1px solid rgba(255,255,255,.07)' }}>
          <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500 }}>Verify your phone</h2>
          <p style={{ margin: '0 0 22px', fontSize: 14, lineHeight: 1.6, color: 'rgba(242,244,239,.55)' }}>
            {user?.phone ? `${toDisplayPhone(user.phone)}. ` : ''}
            {info} You need this before you can send money.
          </p>
          <form onSubmit={submit}>
            <FieldLabel>6-digit code</FieldLabel>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              style={{
                width: '100%',
                height: 56,
                padding: '0 14px',
                borderRadius: 12,
                background: '#0f110f',
                border: '1px solid rgba(255,255,255,.1)',
                color: '#f2f4ef',
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 26,
                letterSpacing: '.3em',
              }}
            />
            <FieldError>{error}</FieldError>
            <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
              <Button type="button" variant="outlineLight" style={{ flex: '1 1 150px' }} onClick={resend} disabled={busy}>
                Send a new code
              </Button>
              <Button type="submit" variant="primary" style={{ flex: '1 1 150px' }} disabled={busy}>
                Verify
              </Button>
            </div>
          </form>
        </section>
      </main>
    </AppShell>
  );
}
