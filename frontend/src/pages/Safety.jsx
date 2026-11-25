import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { getSafety, updateSafety } from '../api/safety';
import { parseAmountInput } from '../utils/money';
import { AmountBox, Banner, ErrorText, Heading, Label, PrimaryButton, C, display } from '../components/ui';
import { useMedia, DESKTOP_QUERY } from '../components/useMedia';

function parseLimit(raw) {
  if (!String(raw || '').trim()) return { value: null };
  return parseAmountInput(raw);
}

export default function Safety() {
  const desktop = useMedia(DESKTOP_QUERY);
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

  const hours = (h) => `${String(h).padStart(2, '0')}:00`;
  const saved = message && message !== "Couldn't save. Try again.";

  return (
    <AppShell>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(2, minmax(0,1fr))' : 'minmax(0,1fr)', gap: 14, alignItems: 'start', paddingTop: 6 }}>
        <Heading style={{ gridColumn: '1 / -1' }}>Safety</Heading>

        {loadError && <Banner style={{ gridColumn: '1 / -1' }}>Couldn&apos;t load your safety settings. Refresh to try again.</Banner>}

        {loaded && (
          <>
            <div style={{ background: frozen ? C.grad : C.surface, color: frozen ? '#fff' : C.text, borderRadius: 26, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ ...display, fontSize: 20, textTransform: 'uppercase' }}>{frozen ? 'Wallet frozen' : 'Freeze wallet'}</span>
                <button
                  role="switch"
                  aria-checked={frozen}
                  aria-label="Freeze wallet"
                  disabled={busy}
                  onClick={() => save(!frozen)}
                  style={{ flex: 'none', width: 60, height: 34, borderRadius: 999, background: frozen ? 'rgba(0,0,0,.35)' : C.surface2, position: 'relative', padding: 0 }}
                >
                  <span style={{ position: 'absolute', top: 4, left: 4, width: 26, height: 26, borderRadius: '50%', background: frozen ? '#fff' : C.accent, transform: `translateX(${frozen ? 26 : 0}px)`, transition: 'transform .25s' }} />
                </button>
              </div>
              <span style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
                {frozen
                  ? 'Sending is switched off. You can still receive money. Unfreeze when you are ready to send again.'
                  : 'Think someone has your phone or password? Freeze sending instantly. You can still receive money.'}
              </span>
              <button
                onClick={() => save(!frozen)}
                disabled={busy}
                style={{ alignSelf: 'flex-start', height: 46, padding: '0 20px', borderRadius: 999, background: frozen ? C.surface : C.grad, boxShadow: frozen ? 'none' : 'inset 0 1px 0 rgba(255,255,255,.25)', color: '#fff', fontSize: 14, fontWeight: 600 }}
              >
                {frozen ? 'Unfreeze wallet' : 'Freeze wallet'}
              </button>
            </div>

            <div style={{ background: C.surface, borderRadius: 26, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ ...display, fontSize: 20, textTransform: 'uppercase' }}>Your own limits</span>
              <span style={{ fontSize: 13.5, color: C.soft }}>Limits you set on yourself. Leave a box empty for no limit.</span>
              <Label>Daily limit</Label>
              <AmountBox height={54} fontSize={17} wide={false} placeholder="No limit" value={daily} onChange={(e) => { setDaily(e.target.value); setDailyErr(''); }} aria-label="Daily limit in rupees" />
              <ErrorText>{dailyErr}</ErrorText>
              <Label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Night limit · {hours(nightHours.start)}–{hours(nightHours.end)}</span>
                <span style={{ fontWeight: 400, color: C.muted }}>Sri Lanka time.</span>
              </Label>
              <AmountBox height={54} fontSize={17} wide={false} placeholder="No limit" value={night} onChange={(e) => { setNight(e.target.value); setNightErr(''); }} aria-label="Night limit in rupees" />
              <ErrorText>{nightErr}</ErrorText>
              <PrimaryButton knob={null} height={52} disabled={busy} onClick={() => save()}>
                Save limits
              </PrimaryButton>
              {message && <Banner tone={saved ? 'ok' : 'error'} style={{ padding: '10px 12px', fontSize: 13 }}>{message}</Banner>}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
