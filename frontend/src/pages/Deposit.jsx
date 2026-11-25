import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { deposit } from '../api/wallet';
import { ApiError } from '../api/client';
import { formatMoney, parseAmountInput } from '../utils/money';
import { AmountBox, Banner, Card, ErrorText, Hint, Label, OutlineButton, PageTitle, PrimaryButton, C, display } from '../components/ui';

export default function Deposit() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [netError, setNetError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('form');
  const [newBalance, setNewBalance] = useState(null);
  const [depositedAmount, setDepositedAmount] = useState(0);

  function pick(value) {
    setAmount(String(value));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const parsed = parseAmountInput(amount);
    if (parsed.error) {
      setError(parsed.error);
      setNetError(false);
      return;
    }

    setError('');
    setNetError(false);
    setBusy(true);
    try {
      const data = await deposit(parsed.value);
      setNewBalance(data.balance);
      setDepositedAmount(parsed.value);
      setStage('done');
      setAmount('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setNetError(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
        {stage === 'form' && (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PageTitle sub="Money lands in your wallet right away.">Deposit</PageTitle>
            <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Amount</Label>
              <AmountBox
                height={66}
                fontSize={26}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                aria-label="Amount in rupees"
              />
              {error ? <ErrorText>{error}</ErrorText> : <Hint>Minimum Rs. 1.00</Hint>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[500, 1000, 5000].map((v) => (
                  <button
                    type="button"
                    key={v}
                    className="cp-outline"
                    onClick={() => pick(v)}
                    style={{ height: 38, padding: '0 14px', borderRadius: 999, border: `1.5px solid ${C.outline}`, fontSize: 13 }}
                  >
                    Rs. {v.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, marginTop: 4, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.muted }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />
                From: External Funding Source (simulated)
              </div>
            </Card>
            {netError && (
              <Banner>
                <b style={{ display: 'block', marginBottom: 4 }}>Deposit didn&apos;t go through</b>
                We couldn&apos;t reach the server. Nothing was added to your wallet. Try again in a moment.
              </Banner>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton type="submit" disabled={busy} style={{ flex: 1 }}>
                {busy ? 'Adding…' : 'Add money'}
              </PrimaryButton>
              <OutlineButton type="button" height={56} onClick={() => navigate('/dashboard')} style={{ fontSize: 15, padding: '0 20px' }}>
                Cancel
              </OutlineButton>
            </div>
          </form>
        )}

        {stage === 'done' && (
          <>
            <Card tone="dark" style={{ borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
              <span style={{ width: 54, height: 54, borderRadius: '50%', background: C.accent, display: 'grid', placeItems: 'center', fontSize: 24 }} aria-hidden="true">✓</span>
              <span style={{ ...display, fontSize: 24, lineHeight: 1.2, textTransform: 'uppercase' }}>Deposited {formatMoney(depositedAmount)}</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: 14, fontSize: 14 }}>
                <span style={{ color: '#CFCAC2' }}>New balance</span>
                <b>{formatMoney(newBalance)}</b>
              </div>
            </Card>
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton knob={null} onClick={() => navigate('/dashboard')} style={{ flex: 1 }}>
                Go to Home
              </PrimaryButton>
              <OutlineButton height={56} onClick={() => setStage('form')} style={{ flex: 1, fontSize: 15 }}>
                Deposit again
              </OutlineButton>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
