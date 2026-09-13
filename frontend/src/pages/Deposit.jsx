import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { timestampLabel } from '../components/Activity';
import { deposit } from '../api/wallet';
import { ApiError } from '../api/client';
import { formatMoney, parseAmountInput } from '../utils/money';
import { Button } from '../components/Button';
import { FieldLabel, FieldError } from '../components/FormFields';

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
      <main style={{ marginTop: 20, display: 'flex', justifyContent: 'center', animation: 'cp-rise .35s ease both' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          {stage === 'form' && (
            <section style={{ padding: 28, borderRadius: 22, background: '#141614', border: '1px solid rgba(255,255,255,.07)' }}>
              <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500, letterSpacing: '-.02em' }}>
                Deposit
              </h2>
              <p style={{ margin: '0 0 26px', fontSize: 14, color: 'rgba(242,244,239,.5)' }}>Money lands in your wallet right away.</p>

              <form onSubmit={handleSubmit}>
                <FieldLabel>Amount</FieldLabel>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '0 18px',
                    height: 72,
                    borderRadius: 16,
                    background: '#0f110f',
                    border: '1px solid rgba(255,255,255,.1)',
                  }}
                >
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, color: 'rgba(242,244,239,.45)' }}>Rs.</span>
                  <input
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError('');
                    }}
                    inputMode="decimal"
                    placeholder="0.00"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '100%',
                      background: 'transparent',
                      border: 0,
                      color: '#f2f4ef',
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontSize: 34,
                      fontWeight: 500,
                      letterSpacing: '-.02em',
                    }}
                  />
                </div>
                <FieldError>{error}</FieldError>
                {!error && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'rgba(242,244,239,.4)' }}>Minimum Rs. 1.00</p>}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                  {[500, 1000, 5000].map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => pick(v)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 999,
                        background: '#1f231f',
                        border: '1px solid rgba(255,255,255,.09)',
                        color: '#f2f4ef',
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontSize: 14,
                      }}
                    >
                      Rs. {v.toLocaleString('en-US')}
                    </button>
                  ))}
                </div>

                {netError && (
                  <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: 'rgba(255,122,92,.1)', border: '1px solid rgba(255,122,92,.3)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#ffb8a6' }}>Deposit didn&apos;t go through</p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'rgba(255,184,166,.8)' }}>
                      The server didn&apos;t respond. No money left or entered your wallet — press Add money to try again.
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
                  <Button type="button" variant="outlineLight" style={{ flex: '0 1 120px' }} onClick={() => navigate('/dashboard')}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" style={{ flex: '1 1 180px', minWidth: 0 }}>
                    {busy ? 'Adding…' : 'Add money'}
                  </Button>
                </div>
              </form>
            </section>
          )}

          {stage === 'done' && (
            <section style={{ padding: '32px 28px', borderRadius: 22, background: '#f3f4ef', color: '#14170f', textAlign: 'center', animation: 'cp-rise .3s ease both' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 20px',
                  borderRadius: 16,
                  background: '#c9f24d',
                  color: '#131707',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                }}
              >
                ✓
              </div>
              <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>
                Added {formatMoney(depositedAmount)}
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(20,23,15,.6)' }}>
                {timestampLabel(new Date().toISOString())}
              </p>
              <div style={{ padding: 20, borderRadius: 16, background: '#fff', marginBottom: 24 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(20,23,15,.5)' }}>New balance</p>
                <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 34, fontWeight: 600, letterSpacing: '-.02em' }}>
                  {formatMoney(newBalance)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="dark" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/transfer')}>
                  Send money
                </Button>
                <Button variant="outlineDark" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/dashboard')}>
                  Back to wallet
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
