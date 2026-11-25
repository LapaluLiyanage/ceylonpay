import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { getBalance } from '../api/wallet';
import { getHistory } from '../api/transfer';
import { getSafety } from '../api/safety';
import { formatMoney } from '../utils/money';
import { SkeletonRows, ActivityErrorState, ActivityEmptyState, TransactionRow, rowFor } from '../components/Activity';
import { C, GradButton, OutlineButton, Heading, Pill, Skeleton, display, mono } from '../components/ui';
import { useMedia, DESKTOP_QUERY } from '../components/useMedia';

function greeting(hour) {
  if (hour < 12) return 'GOOD MORNING';
  if (hour < 18) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

/** Completed money in and out for the current calendar month. Held, cancelled and rejected items are not counted. */
function monthTotals(txs, now = new Date()) {
  let sent = 0;
  let received = 0;
  let any = false;
  for (const t of txs) {
    const d = new Date(t.timestamp);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    if (t.direction === 'SENT' && t.status === 'SUCCESS') {
      sent += Number(t.amount);
      any = true;
    } else if (t.direction === 'RECEIVED' && (t.status === 'SUCCESS' || t.status === 'REVERSAL')) {
      received += Number(t.amount);
      any = true;
    }
  }
  return { sent, received, any };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const desktop = useMedia(DESKTOP_QUERY);
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [txs, setTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState(false);

  const loadBalance = useCallback(() => {
    setBalanceLoading(true);
    setBalanceError(false);
    getBalance()
      .then((data) => setBalance(data.balance))
      .catch(() => setBalanceError(true))
      .finally(() => setBalanceLoading(false));
    getSafety()
      .then((s) => setFrozen(Boolean(s.frozen)))
      .catch(() => {
        // The status chip just stays on "Active" if settings cannot be read.
      });
  }, []);

  const loadHistory = useCallback(() => {
    setTxLoading(true);
    setTxError(false);
    getHistory()
      .then((data) => setTxs(data))
      .catch(() => setTxError(true))
      .finally(() => setTxLoading(false));
  }, []);

  useEffect(() => {
    loadBalance();
    loadHistory();
  }, [loadBalance, loadHistory]);

  const now = new Date();
  const month = monthTotals(txs, now);
  const ready = !txLoading && !txError;
  const isEmpty = ready && txs.length === 0;
  const firstName = (user?.name || '').split(/\s+/)[0] || 'there';

  const cols = desktop ? 'minmax(360px,1fr) minmax(0,1.15fr)' : 'minmax(0,1fr)';

  return (
    <AppShell>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: desktop ? 20 : 14, alignItems: 'start' }}>
        {desktop && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', paddingBottom: 6 }}>
            <div>
              <span style={{ ...mono, fontSize: 12, color: C.muted }}>{greeting(now.getHours())}</span>
              <Heading size={38} style={{ margin: '6px 0 0', lineHeight: 1.1 }}>
                Welcome back, <Pill pad={14}>{firstName}</Pill>
              </Heading>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <OutlineButton onClick={() => navigate('/receive')} style={{ whiteSpace: 'nowrap' }}>Get paid</OutlineButton>
              <GradButton onClick={() => navigate('/transfer')} style={{ whiteSpace: 'nowrap', padding: '0 20px' }}>Send money ↗</GradButton>
            </div>
          </div>
        )}

        {/* Balance */}
        <div
          style={{ position: 'relative', background: 'radial-gradient(130% 110% at 100% 0%, #F2763A 0%, #B8401C 38%, #4A1D10 72%, #1A110D 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 20px 50px -20px rgba(226,87,43,.6)', color: '#fff', borderRadius: 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 18, overflow: 'hidden' }}
        >
          <div aria-hidden="true" style={{ position: 'absolute', right: -40, top: -40, width: 170, height: 170, borderRadius: '50%', border: '1px solid rgba(255,255,255,.14)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', right: 22, top: 22, width: 44, height: 44, borderRadius: '50%', background: C.accent }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#CFCAC2' }}>Wallet balance</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 999, background: 'rgba(0,0,0,.32)', fontSize: 12, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: frozen ? '#FFB08F' : C.ok }} />
              {frozen ? 'Frozen' : 'Active'}
            </span>
          </div>
          {balanceLoading && <Skeleton height={34} radius={10} />}
          {!balanceLoading && balanceError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ ...display, fontSize: 28, opacity: 0.4 }}>Rs. ——</span>
              <span style={{ fontSize: 13, color: '#FFD3C4' }}>Couldn&apos;t reach the server. Your balance is unchanged.</span>
              <GradButton onClick={loadBalance} style={{ alignSelf: 'flex-start', height: 40, background: C.surface }}>Try again</GradButton>
            </div>
          )}
          {!balanceLoading && !balanceError && (
            <div style={{ ...display, fontSize: 'clamp(26px, 6vw, 34px)', fontWeight: 500, letterSpacing: '-.01em', lineHeight: 1, whiteSpace: 'nowrap' }}>{formatMoney(balance)}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/transfer')}
              style={{ flex: 1, height: 52, borderRadius: 999, background: C.surface, color: C.text, fontSize: 14.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5px 0 18px' }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>Send money</span>
              <span style={{ flex: 'none', width: 42, height: 42, borderRadius: '50%', background: C.grad, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)', color: '#fff', display: 'grid', placeItems: 'center' }}>↗</span>
            </button>
            <button
              onClick={() => navigate('/deposit')}
              style={{ flex: 1, height: 52, borderRadius: 999, border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', fontSize: 14.5, fontWeight: 500 }}
            >
              Deposit
            </button>
          </div>
        </div>

        {/* This month */}
        <div style={{ background: C.surface, borderRadius: 24, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>This month</span>
            <span style={{ ...mono, fontSize: 11, color: C.muted }}>{now.toLocaleString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()}</span>
          </div>
          {!month.any ? (
            <span style={{ fontSize: 13.5, color: C.muted }}>No transactions on record yet.</span>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
                <div style={{ background: C.surface2, borderRadius: 16, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, color: C.muted }}>↗ Sent</div>
                  <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{formatMoney(month.sent)}</div>
                </div>
                <div style={{ background: C.surface2, borderRadius: 16, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, color: C.muted }}>↙ Received</div>
                  <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4, color: C.ok }}>{formatMoney(month.received)}</div>
                </div>
              </div>
              <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
                Completed payments and deposits only. Held, cancelled and rejected payments aren&apos;t counted.
              </span>
            </>
          )}
        </div>

        {/* Recent activity */}
        <div style={{ background: C.surface, borderRadius: 24, padding: '16px 18px 4px', gridColumn: desktop ? 2 : 'auto', gridRow: desktop ? '2 / span 3' : 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Recent activity</span>
            {ready && txs.length > 0 && (
              <OutlineButton height={34} onClick={() => navigate('/history')} style={{ fontSize: 12.5, padding: '0 12px' }}>
                See all ↗
              </OutlineButton>
            )}
          </div>
          {txLoading && <SkeletonRows count={3} />}
          {!txLoading && txError && <ActivityErrorState onRetry={loadHistory} />}
          {isEmpty && <ActivityEmptyState onDeposit={() => navigate('/deposit')} />}
          {ready && txs.slice(0, 4).map((tx) => <TransactionRow key={tx.id} compact {...rowFor(tx)} />)}
        </div>
      </div>
    </AppShell>
  );
}
