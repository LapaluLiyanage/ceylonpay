import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { getReviews, approveReview, rejectReview, getReports, resolveReport, getMules, holdAccount, releaseAccount } from '../api/admin';
import { ApiError } from '../api/client';
import { formatMoney } from '../utils/money';
import { toDisplayPhone, normalizeStoredPhone } from '../utils/phone';
import { timestampLabel } from '../components/Activity';

const card = { padding: 24, borderRadius: 22, background: '#141614', border: '1px solid rgba(255,255,255,.07)' };
const item = { padding: 16, borderRadius: 14, background: '#0f110f', border: '1px solid rgba(255,255,255,.07)' };
const small = { fontSize: 13, color: 'rgba(242,244,239,.55)', lineHeight: 1.6 };

function ActionButton({ children, onClick, disabled, tone }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 14px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        background: tone === 'primary' ? '#c9f24d' : 'transparent',
        color: tone === 'primary' ? '#131707' : 'rgba(242,244,239,.75)',
        border: tone === 'primary' ? 0 : '1px solid rgba(255,255,255,.14)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function who(name, phone) {
  return `${name} · ${toDisplayPhone(normalizeStoredPhone(phone))}`;
}

export default function Admin() {
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [mules, setMules] = useState([]);
  const [state, setState] = useState('loading');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');

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
    setMessage('');
    try {
      await fn();
      setMessage(done);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't complete that. Try again.");
    } finally {
      setBusyId(null);
      load();
    }
  }

  return (
    <AppShell>
      <main style={{ marginTop: 20, display: 'grid', gap: 16, animation: 'cp-rise .35s ease both' }}>
        {state === 'forbidden' && (
          <section style={card}>
            <p style={{ margin: 0, fontSize: 14 }}>This page is for CeylonPay reviewers only.</p>
          </section>
        )}
        {state === 'error' && (
          <section style={card}>
            <p style={{ margin: 0, fontSize: 14, color: '#ff9b85' }}>Couldn&apos;t load the review queues. Refresh to try again.</p>
          </section>
        )}

        {state === 'ready' && (
          <>
            {message && (
              <p role="status" style={{ margin: 0, fontSize: 13, color: 'rgba(242,244,239,.7)' }}>
                {message}
              </p>
            )}

            <section style={card}>
              <h2 style={{ margin: '0 0 4px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 21, fontWeight: 500 }}>
                Held transfers ({reviews.length})
              </h2>
              <p style={{ ...small, margin: '0 0 16px' }}>Stopped by the scam check. No money has moved yet.</p>
              {reviews.length === 0 && <p style={small}>Nothing waiting.</p>}
              <div style={{ display: 'grid', gap: 10 }}>
                {reviews.map((r) => (
                  <div key={r.id} style={item}>
                    <p style={{ margin: '0 0 4px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 600 }}>
                      {formatMoney(r.amount)}
                    </p>
                    <p style={small}>
                      {who(r.senderName, r.senderPhone)} → {who(r.receiverName, r.receiverPhone)}
                      <br />
                      {timestampLabel(r.createdAt)} · {r.detail}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <ActionButton
                        tone="primary"
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, () => approveReview(r.id), 'Transfer released.')}
                      >
                        Approve
                      </ActionButton>
                      <ActionButton disabled={busyId === r.id} onClick={() => act(r.id, () => rejectReview(r.id), 'Transfer rejected.')}>
                        Reject
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={card}>
              <h2 style={{ margin: '0 0 4px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 21, fontWeight: 500 }}>
                Scam reports ({reports.length})
              </h2>
              <p style={{ ...small, margin: '0 0 16px' }}>
                The reported account&apos;s outgoing money is on hold. Upholding pulls back what they still have.
              </p>
              {reports.length === 0 && <p style={small}>Nothing waiting.</p>}
              <div style={{ display: 'grid', gap: 10 }}>
                {reports.map((r) => (
                  <div key={r.id} style={item}>
                    <p style={{ margin: '0 0 4px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 600 }}>
                      {formatMoney(r.amount)}
                    </p>
                    <p style={small}>
                      Reported by {who(r.senderName, r.senderPhone)}
                      <br />
                      Receiver {who(r.receiverName, r.receiverPhone)} · holds {formatMoney(r.receiverBalance)} now
                      <br />
                      {timestampLabel(r.createdAt)}
                      {r.note ? ` · “${r.note}”` : ''}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <ActionButton
                        tone="primary"
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, () => resolveReport(r.id, 'UPHOLD'), 'Report upheld. Money recovered where possible.')}
                      >
                        Uphold &amp; recover
                      </ActionButton>
                      <ActionButton
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, () => resolveReport(r.id, 'DISMISS'), 'Report dismissed. Hold lifted.')}
                      >
                        Dismiss
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={card}>
              <h2 style={{ margin: '0 0 4px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 21, fontWeight: 500 }}>
                Suspected mule accounts ({mules.length})
              </h2>
              <p style={{ ...small, margin: '0 0 16px' }}>
                Received from 3 or more people in the last 24 hours, and also pass money on, are new, or have been reported.
                Holding an account stops it sending money; it can still receive.
              </p>
              {mules.length === 0 && <p style={small}>Nobody looks suspicious right now.</p>}
              <div style={{ display: 'grid', gap: 10 }}>
                {mules.map((m) => (
                  <div key={m.userId} style={item}>
                    <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{who(m.name, m.phone)}</p>
                    <p style={small}>
                      {m.senders} senders · received {formatMoney(m.received)} · sent on {formatMoney(m.sentOn)}
                      {m.accountAgeDays >= 0 ? ` · account ${m.accountAgeDays} days old` : ''}
                      <br />
                      {m.flags.join(' · ')}
                      {m.onHold ? ' · ON HOLD' : ''}
                    </p>
                    <div style={{ marginTop: 12 }}>
                      {m.onHold ? (
                        <ActionButton disabled={busyId === m.userId} onClick={() => act(m.userId, () => releaseAccount(m.userId), 'Hold lifted.')}>
                          Release hold
                        </ActionButton>
                      ) : (
                        <ActionButton tone="primary" disabled={busyId === m.userId} onClick={() => act(m.userId, () => holdAccount(m.userId), 'Account put on hold.')}>
                          Hold account
                        </ActionButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
