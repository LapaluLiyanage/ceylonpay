import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { getReviews, approveReview, rejectReview, getReports, resolveReport, getMules, holdAccount, releaseAccount } from '../api/admin';
import { ApiError } from '../api/client';
import { formatMoney } from '../utils/money';
import { toDisplayPhone, normalizeStoredPhone } from '../utils/phone';
import { timestampLabel } from '../components/Activity';
import { Banner, Heading, C, display, mono } from '../components/ui';
import { useMedia, DESKTOP_QUERY } from '../components/useMedia';

function who(name, phone) {
  return `${name} · ${toDisplayPhone(normalizeStoredPhone(phone))}`;
}

function SectionTitle({ title, count, sub }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <b style={{ fontSize: 16 }}>{title}</b>
        <span style={{ height: 24, minWidth: 24, padding: '0 8px', borderRadius: 999, background: C.grad, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)', color: '#fff', fontSize: 12, display: 'grid', placeItems: 'center' }}>{count}</span>
      </div>
      <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{sub}</span>
    </>
  );
}

function Empty({ children }) {
  return <div style={{ background: C.surface, borderRadius: 18, padding: 16, fontSize: 13.5, color: C.muted }}>{children}</div>;
}

function Item({ children }) {
  return <div style={{ background: C.surface, borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>;
}

function Amount({ children }) {
  return <span style={{ ...display, fontSize: 20, fontWeight: 500 }}>{children}</span>;
}

function Go({ children, onClick, disabled, danger }) {
  return (
    <button
      className="cp-grad"
      onClick={onClick}
      disabled={disabled}
      style={{ flex: 1, height: 44, border: 0, borderRadius: 999, background: danger ? C.accent : C.grad, boxShadow: danger ? 'none' : 'inset 0 1px 0 rgba(255,255,255,.25)', color: '#fff', fontSize: 13.5, fontWeight: 600, opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}

function Ghost({ children, onClick, disabled }) {
  return (
    <button className="cp-outline" onClick={onClick} disabled={disabled} style={{ flex: 1, height: 44, borderRadius: 999, border: `1.5px solid ${C.outline}`, fontSize: 13.5, opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

export default function Admin() {
  const desktop = useMedia(DESKTOP_QUERY);
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [mules, setMules] = useState([]);
  const [state, setState] = useState('loading');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState({ text: '', tone: 'ok' });

  const load = useCallback(async () => {
    try {
      const [r, p, m] = await Promise.all([getReviews(), getReports('OPEN'), getMules(24)]);
      setReviews(r);
      setReports(p);
      setMules(m);
      setState('ready');
    } catch (err) {
      setState(err instanceof ApiError && (err.status === 403 || err.status === 401) ? 'forbidden' : 'error');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(id, fn, done) {
    setBusyId(id);
    setMessage({ text: '', tone: 'ok' });
    try {
      await fn();
      setMessage({ text: done, tone: 'ok' });
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : "Couldn't complete that. Try again.", tone: 'error' });
    } finally {
      setBusyId(null);
      load();
    }
  }

  return (
    <AppShell>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(3, minmax(0,1fr))' : 'minmax(0,1fr)', gap: desktop ? 20 : 14, alignItems: 'start', paddingTop: 6 }}>
        <Heading style={{ gridColumn: '1 / -1' }}>Review</Heading>

        {state === 'forbidden' && <Banner tone="info" style={{ gridColumn: '1 / -1' }}>This page is for CeylonPay reviewers only.</Banner>}
        {state === 'error' && <Banner style={{ gridColumn: '1 / -1' }}>Couldn&apos;t load the review queues. Refresh to try again.</Banner>}
        {message.text && <Banner tone={message.tone} style={{ gridColumn: '1 / -1' }}>{message.text}</Banner>}

        {state === 'ready' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SectionTitle title="Held transfers" count={reviews.length} sub="Stopped by the scam check. No money has moved yet." />
              {reviews.length === 0 && <Empty>Nothing waiting.</Empty>}
              {reviews.map((r) => (
                <Item key={r.id}>
                  <Amount>{formatMoney(r.amount)}</Amount>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {who(r.senderName, r.senderPhone)} → <b>{who(r.receiverName, r.receiverPhone)}</b>
                    <br />
                    <span style={{ color: C.muted }}>Held {timestampLabel(r.createdAt)}</span>
                  </div>
                  {r.detail && <div style={{ fontSize: 12.5, lineHeight: 1.45, color: C.soft }}>{r.detail}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Go disabled={busyId === r.id} onClick={() => act(r.id, () => approveReview(r.id), 'Transfer released.')}>Approve</Go>
                    <Ghost disabled={busyId === r.id} onClick={() => act(r.id, () => rejectReview(r.id), 'Transfer rejected.')}>Reject</Ghost>
                  </div>
                </Item>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SectionTitle title="Scam reports" count={reports.length} sub="The reported account's outgoing money is on hold. Upholding pulls back what they still have." />
              {reports.length === 0 && <Empty>Nothing waiting.</Empty>}
              {reports.map((r) => (
                <Item key={r.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Amount>{formatMoney(r.amount)}</Amount>
                    <span style={{ fontSize: 12, color: C.muted }}>{timestampLabel(r.createdAt)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 13 }}>
                    <span style={{ color: C.muted }}>Reported by</span>
                    <span>{who(r.senderName, r.senderPhone)}</span>
                    <span style={{ color: C.muted }}>Receiver</span>
                    <span>
                      <b>{who(r.receiverName, r.receiverPhone)}</b> · still holds {formatMoney(r.receiverBalance)}
                    </span>
                  </div>
                  {r.note && <div style={{ background: C.surface2, borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.45, fontStyle: 'italic' }}>“{r.note}”</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Go danger disabled={busyId === r.id} onClick={() => act(r.id, () => resolveReport(r.id, 'UPHOLD'), 'Report upheld. Money recovered where possible.')}>
                      Uphold &amp; recover
                    </Go>
                    <Ghost disabled={busyId === r.id} onClick={() => act(r.id, () => resolveReport(r.id, 'DISMISS'), 'Report dismissed. Hold lifted.')}>Dismiss</Ghost>
                  </div>
                </Item>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SectionTitle
                title="Suspected mule accounts"
                count={mules.length}
                sub="Received from 3 or more people in the last 24 hours, and also pass money on, are new, or have been reported. Holding an account stops it sending money; it can still receive."
              />
              {mules.length === 0 && <Empty>Nobody looks suspicious right now.</Empty>}
              {mules.map((m) => (
                <Item key={m.userId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <b style={{ fontSize: 15 }}>{m.name}</b>
                      <div style={{ ...mono, fontSize: 12, color: C.muted }}>{toDisplayPhone(normalizeStoredPhone(m.phone))}</div>
                    </div>
                    <span style={{ height: 28, padding: '0 10px', borderRadius: 999, background: m.onHold ? C.errorBg : 'rgba(255,255,255,.08)', color: m.onHold ? C.errorSoft : C.soft, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                      {m.onHold ? 'On hold' : 'Not held'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6, fontSize: 11.5, color: C.muted }}>
                    {[
                      ['Senders', m.senders],
                      ['In', formatMoney(m.received)],
                      ['Out', formatMoney(m.sentOn)],
                      ['Age', m.accountAgeDays >= 0 ? `${m.accountAgeDays} days` : '—'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ background: C.surface2, borderRadius: 12, padding: 8 }}>
                        {label}
                        <br />
                        <b style={{ color: C.text, fontSize: 13 }}>{value}</b>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {m.flags.map((f) => (
                      <span key={f} style={{ fontSize: 11.5, padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.16)' }}>{f}</span>
                    ))}
                  </div>
                  {m.onHold ? (
                    <Ghost disabled={busyId === m.userId} onClick={() => act(m.userId, () => releaseAccount(m.userId), 'Hold lifted.')}>Release hold</Ghost>
                  ) : (
                    <Go disabled={busyId === m.userId} onClick={() => act(m.userId, () => holdAccount(m.userId), 'Account put on hold.')}>Hold account</Go>
                  )}
                </Item>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
