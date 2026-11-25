import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { FieldLabel, FieldError } from '../components/FormFields';
import { getSafety, updateSafety } from '../api/safety';
import { formatMoney, parseAmountInput } from '../utils/money';

const card = { padding: 28, borderRadius: 22, background: '#141614', border: '1px solid rgba(255,255,255,.07)' };

function LimitInput({ value, onChange, placeholder }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        height: 52,
        borderRadius: 12,
        background: '#0f110f',
        border: '1px solid rgba(255,255,255,.1)',
      }}
    >
      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, color: 'rgba(242,244,239,.45)' }}>Rs.</span>
      <input
        value={value}
        onChange={onChange}
        inputMode="decimal"
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, height: '100%', background: 'transparent', border: 0, color: '#f2f4ef', fontSize: 16 }}
      />
    </div>
  );
}

function parseLimit(raw) {
  if (!String(raw || '').trim()) return { value: null };
  return parseAmountInput(raw);
}

export default function Safety() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [daily, setDaily] = useState('');
  const [night, setNight] = useState('');
  const [nightHours, setNightHours] = useState({ start: 22, end: 6 });
  const [dailyErr, setDailyErr] = useState('');
  const [nightErr, setNightErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function apply(data) {
    setFrozen(data.frozen);
    setDaily(data.dailyLimit == null ? '' : String(Number(data.dailyLimit)));
    setNight(data.nightLimit == null ? '' : String(Number(data.nightLimit)));
    setNightHours({ start: data.nightStartHour, end: data.nightEndHour });
  }

  useEffect(() => {
    getSafety()
      .then((data) => {
        apply(data);
        setLoaded(true);
      })
      .catch(() => setLoadError(true));
  }, []);

  async function save(nextFrozen = frozen) {
    if (busy) return;
    const d = parseLimit(daily);
    const n = parseLimit(night);
    setDailyErr(d.error || '');
    setNightErr(n.error || '');
    if (d.error || n.error) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await updateSafety({ frozen: nextFrozen, dailyLimit: d.value, nightLimit: n.value });
      apply(data);
      setMessage(nextFrozen !== frozen ? (data.frozen ? 'Wallet frozen.' : 'Wallet unfrozen.') : 'Saved.');
    } catch {
      setMessage("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main style={{ marginTop: 20, display: 'flex', justifyContent: 'center', animation: 'cp-rise .35s ease both' }}>
        <div style={{ width: '100%', maxWidth: 520, display: 'grid', gap: 16 }}>
          {loadError && (
            <section style={card}>
              <p style={{ margin: 0, fontSize: 14, color: '#ff9b85' }}>Couldn&apos;t load your safety settings. Refresh to try again.</p>
            </section>
          )}

          {loaded && (
            <>
              <section style={{ ...card, border: frozen ? '1px solid rgba(255,122,92,.35)' : card.border }}>
                <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 500 }}>
                  {frozen ? 'Your wallet is frozen' : 'Freeze wallet'}
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'rgba(242,244,239,.55)' }}>
                  {frozen
                    ? 'Nobody can send money from your wallet, including you, until you unfreeze it. You can still receive money.'
                    : 'Think someone has your phone or password? Freeze sending instantly. You can still receive money.'}
                </p>
                <Button
                  variant={frozen ? 'primary' : 'outlineLight'}
                  style={{ width: '100%' }}
                  disabled={busy}
                  onClick={() => save(!frozen)}
                >
                  {frozen ? 'Unfreeze wallet' : 'Freeze wallet'}
                </Button>
              </section>

              <section style={card}>
                <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 500 }}>
                  Your own limits
                </h2>
                <p style={{ margin: '0 0 22px', fontSize: 14, lineHeight: 1.6, color: 'rgba(242,244,239,.55)' }}>
                  Limits you set on yourself. Leave a box empty for no limit.
                </p>

                <FieldLabel>Daily limit</FieldLabel>
                <LimitInput
                  value={daily}
                  onChange={(e) => {
                    setDaily(e.target.value);
                    setDailyErr('');
                  }}
                  placeholder="No limit"
                />
                <FieldError>{dailyErr}</FieldError>

                <div style={{ marginTop: 20 }}>
                  <FieldLabel>
                    Night limit ({String(nightHours.start).padStart(2, '0')}:00 – {String(nightHours.end).padStart(2, '0')}:00)
                  </FieldLabel>
                  <LimitInput
                    value={night}
                    onChange={(e) => {
                      setNight(e.target.value);
                      setNightErr('');
                    }}
                    placeholder="No limit"
                  />
                  <FieldError>{nightErr}</FieldError>
                </div>

                <p style={{ margin: '16px 0 0', fontSize: 12, color: 'rgba(242,244,239,.4)' }}>
                  Sri Lanka time.
                  {daily && !parseLimit(daily).error ? ` Daily: up to ${formatMoney(parseLimit(daily).value)}.` : ''}
                </p>

                <Button variant="primary" style={{ width: '100%', marginTop: 22 }} disabled={busy} onClick={() => save()}>
                  {busy ? 'Saving…' : 'Save limits'}
                </Button>
                {message && (
                  <p role="status" style={{ margin: '12px 0 0', fontSize: 13, color: 'rgba(242,244,239,.6)' }}>
                    {message}
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}
