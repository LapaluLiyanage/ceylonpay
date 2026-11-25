import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { requestPhoneCode, verifyPhone } from '../api/account';
import { toDisplayPhone } from '../utils/phone';
import { Card, ErrorText, Label, OutlineButton, PageTitle, PrimaryButton, C, mono } from '../components/ui';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
        <PageTitle sub={`We text a 6-digit code to ${user?.phone ? toDisplayPhone(user.phone) : 'your phone'}. You need it before you can send money.`}>
          Verify your phone
        </PageTitle>
        <form onSubmit={submit} noValidate>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Label htmlFor="otp">6-digit code</Label>
            <input
              id="otp"
              className="cp-field"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              style={{ height: 58, borderRadius: 16, background: C.surface2, padding: '0 16px', ...mono, fontSize: 24, letterSpacing: '.5em' }}
            />
            <ErrorText>{error}</ErrorText>
            <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>{info}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <OutlineButton type="button" height={44} disabled={busy} onClick={resend} style={{ fontSize: 13 }}>
                Send a new code
              </OutlineButton>
            </div>
            <PrimaryButton type="submit" knob={null} height={52} disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Verify'}
            </PrimaryButton>
            <span style={{ fontSize: 12, color: C.muted }}>Codes last 5 minutes. After 5 wrong tries you&apos;ll need a new one.</span>
          </Card>
        </form>
      </div>
    </AppShell>
  );
}
