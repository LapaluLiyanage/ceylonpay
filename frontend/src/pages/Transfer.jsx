import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { timestampLabel } from '../components/Activity';
import { getBalance } from '../api/wallet';
import { transfer } from '../api/transfer';
import { ApiError } from '../api/client';
import { formatMoney, parseAmountInput } from '../utils/money';
import { digitsOnly, groupPhone, phoneError, toApiPhone, toDisplayPhone } from '../utils/phone';
import { Button } from '../components/Button';
import { FieldLabel, FieldError, PhoneField } from '../components/FormFields';

const FAIL_COPY = {
  network: { title: "Transfer didn't go through", label: 'Try again' },
  notfound: { title: 'No wallet on that number', label: 'Change the number' },
  balance: { title: 'Not enough balance', label: 'Deposit money' },
};

export default function Transfer() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [balanceError, setBalanceError] = useState(false);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [amountErr, setAmountErr] = useState('');
  const [stage, setStage] = useState('form');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failKind, setFailKind] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getBalance()
      .then((data) => setBalance(data.balance))
      .catch(() => setBalanceError(true));
  }, []);

  function reviewTransfer(e) {
    e.preventDefault();
    const pe = phoneError(phone);
    const parsed = parseAmountInput(amount);
    if (pe || parsed.error) {
      setPhoneErr(pe);
      setAmountErr(parsed.error || '');
      return;
    }
    setPhoneErr('');
    setAmountErr('');
    setDraft({ phoneDigits: phone, amountValue: parsed.value });
    setStage('confirm');
  }

  async function confirmTransfer() {
    if (busy) return;
    setBusy(true);
    try {
      const data = await transfer(toApiPhone(draft.phoneDigits), draft.amountValue);
      setResult(data);
      setBalance(data.newBalance);
      setStage('sent');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setFailKind('notfound');
      else if (err instanceof ApiError && err.status === 400) setFailKind('balance');
      else setFailKind('network');
      setStage('failed');
    } finally {
      setBusy(false);
    }
  }

  const balanceAfter = draft ? balance - draft.amountValue : balance;
  const fail = failKind ? FAIL_COPY[failKind] : null;
  const failBody =
    failKind === 'notfound'
      ? `${toDisplayPhone(draft?.phoneDigits)} isn't registered with CeylonPay. Check the number, or ask them to sign up first.`
      : failKind === 'balance'
        ? `You need ${formatMoney((draft?.amountValue || 0) - balance)} more to send ${formatMoney(draft?.amountValue || 0)}. Deposit first, then send.`
        : "We couldn't reach the server, so the transfer was never sent. Try again in a moment.";

  function failPrimaryAction() {
    if (failKind === 'balance') navigate('/deposit');
    else if (failKind === 'notfound') setStage('form');
    else confirmTransfer();
  }

  return (
    <AppShell>
      <main style={{ marginTop: 20, display: 'flex', justifyContent: 'center', animation: 'cp-rise .35s ease both' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          {stage === 'form' && (
            <section style={{ padding: 28, borderRadius: 22, background: '#141614', border: '1px solid rgba(255,255,255,.07)' }}>
              <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500, letterSpacing: '-.02em' }}>
                Send money
              </h2>
              <p style={{ margin: '0 0 26px', fontSize: 14, color: 'rgba(242,244,239,.5)' }}>
                You&apos;ll review everything before it leaves your wallet.
              </p>

              <form onSubmit={reviewTransfer}>
                <FieldLabel>Send to</FieldLabel>
                <PhoneField
                  value={groupPhone(phone)}
                  onChange={(e) => {
                    setPhone(digitsOnly(e.target.value));
                    setPhoneErr('');
                  }}
                  height={56}
                />
                <FieldError>{phoneErr}</FieldError>

                <div style={{ marginTop: 20 }}>
                  <FieldLabel>Amount</FieldLabel>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '0 16px',
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
                        setAmountErr('');
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
                  <FieldError>{amountErr}</FieldError>
                </div>

                {balanceError ? (
                  <p style={{ margin: '16px 0 0', fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: '#ff7a5c' }}>
                    Couldn&apos;t load your balance — refresh the page to try again.
                  </p>
                ) : (
                  <p style={{ margin: '16px 0 0', fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: 'rgba(242,244,239,.4)' }}>
                    Available {formatMoney(balance)}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
                  <Button type="button" variant="outlineLight" style={{ flex: '0 1 120px' }} onClick={() => navigate('/dashboard')}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" style={{ flex: '1 1 180px', minWidth: 0 }} disabled={balanceError}>
                    Review transfer
                  </Button>
                </div>
              </form>
            </section>
          )}

          {stage === 'confirm' && draft && (
            <section style={{ padding: 28, borderRadius: 22, background: '#f3f4ef', color: '#14170f', animation: 'cp-rise .3s ease both' }}>
              <p style={{ margin: '0 0 20px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(20,23,15,.5)' }}>
                Step 2 of 2 · Confirm
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 14, color: 'rgba(20,23,15,.6)' }}>You&apos;re sending</p>
              <p
                style={{
                  margin: '0 0 24px',
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: 'clamp(34px,6vw,44px)',
                  fontWeight: 600,
                  letterSpacing: '-.03em',
                  lineHeight: 1,
                }}
              >
                {formatMoney(draft.amountValue)}
              </p>

              <div style={{ borderRadius: 16, background: '#fff', overflow: 'hidden', marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, borderBottom: '1px solid rgba(20,23,15,.08)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>Phone</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 500 }}>{toDisplayPhone(draft.phoneDigits)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, borderBottom: '1px solid rgba(20,23,15,.08)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>Fee</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 500 }}>Rs. 0.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16 }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>Balance after</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600 }}>{formatMoney(balanceAfter)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 12, background: '#f6edd3', border: '1px solid rgba(190,150,40,.3)', marginBottom: 22 }}>
                <span style={{ color: '#8a6a12', fontWeight: 700, lineHeight: 1.4 }}>!</span>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#6b530c' }}>
                  Once sent, this transfer can&apos;t be reversed. Check the number belongs to the person you mean to pay.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="outlineDark" style={{ flex: '0 1 130px' }} onClick={() => setStage('form')}>
                  Edit
                </Button>
                <Button variant="dark" style={{ flex: '1 1 180px', minWidth: 0 }} onClick={confirmTransfer} disabled={busy}>
                  {busy ? 'Sending…' : `Send ${formatMoney(draft.amountValue)}`}
                </Button>
              </div>
            </section>
          )}

          {stage === 'sent' && result && draft && (
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
                Sent {formatMoney(result.amount)}
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(20,23,15,.6)' }}>
                to {toDisplayPhone(draft.phoneDigits)} ·{' '}
                {timestampLabel(result.timestamp)}
              </p>
              <div style={{ borderRadius: 16, background: '#fff', overflow: 'hidden', textAlign: 'left', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, borderBottom: '1px solid rgba(20,23,15,.08)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>Reference</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 500 }}>{result.transactionId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16 }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>New balance</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600 }}>{formatMoney(result.newBalance)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="dark" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/history')}>
                  See activity
                </Button>
                <Button variant="outlineDark" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/dashboard')}>
                  Back to wallet
                </Button>
              </div>
            </section>
          )}

          {stage === 'failed' && fail && (
            <section style={{ padding: '32px 28px', borderRadius: 22, background: '#141614', border: '1px solid rgba(255,122,92,.28)', animation: 'cp-rise .3s ease both' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  marginBottom: 20,
                  borderRadius: 15,
                  background: 'rgba(255,122,92,.14)',
                  color: '#ff7a5c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                !
              </div>
              <h2 style={{ margin: '0 0 8px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 23, fontWeight: 500, letterSpacing: '-.02em' }}>
                {fail.title}
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'rgba(242,244,239,.6)' }}>{failBody}</p>
              <p style={{ margin: '0 0 24px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: 'rgba(242,244,239,.4)' }}>
                Nothing left your wallet. Balance {formatMoney(balance)}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="primary" style={{ flex: '1 1 170px', minWidth: 0 }} onClick={failPrimaryAction} disabled={busy}>
                  {fail.label}
                </Button>
                <Button variant="outlineLight" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/dashboard')}>
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
