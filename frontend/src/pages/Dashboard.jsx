import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { getBalance } from '../api/wallet';
import { getHistory } from '../api/transfer';
import { formatMoney } from '../utils/money';
import { SkeletonRows, ActivityErrorState, ActivityEmptyState, TransactionRow, rowFor } from '../components/Activity';
import { Button } from '../components/Button';

export default function Dashboard() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState(false);
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

  const sentTotal = txs.filter((t) => t.direction === 'SENT').reduce((a, t) => a + Number(t.amount), 0);
  const receivedTotal = txs.filter((t) => t.direction === 'RECEIVED').reduce((a, t) => a + Number(t.amount), 0);
  const ready = !txLoading && !txError;
  const isEmpty = ready && txs.length === 0;

  return (
    <AppShell>
      <main style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20, animation: 'cp-rise .35s ease both' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          <section
            style={{
              flex: '1 1 420px',
              minWidth: 'min(100%,300px)',
              padding: 28,
              borderRadius: 22,
              background: '#141614',
              border: '1px solid rgba(255,255,255,.07)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(242,244,239,.45)' }}>
                  Wallet balance
                </p>
                {balanceLoading && (
                  <div style={{ width: 230, height: 52, borderRadius: 12, background: '#22261f', animation: 'cp-pulse 1.4s ease-in-out infinite' }} />
                )}
                {!balanceLoading && balanceError && (
                  <div>
                    <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 34, fontWeight: 500, color: 'rgba(242,244,239,.3)' }}>
                      Rs. ——
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: '#ffb8a6' }}>Couldn&apos;t reach the server. Your balance is unchanged.</p>
                    <button
                      onClick={loadBalance}
                      style={{ marginTop: 12, padding: '9px 14px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,.18)', color: '#f2f4ef', fontSize: 13, fontWeight: 600 }}
                    >
                      Try again
                    </button>
                  </div>
                )}
                {!balanceLoading && !balanceError && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 400, color: 'rgba(242,244,239,.5)' }}>Rs.</span>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 'clamp(38px,6vw,56px)', fontWeight: 500, letterSpacing: '-.03em', lineHeight: 1 }}>
                      {Number(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, background: '#1b1f1b', border: '1px solid rgba(255,255,255,.06)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c9f24d' }} />
                <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(242,244,239,.55)' }}>Active</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
              <Button variant="primary" style={{ flex: '1 1 160px', minWidth: 0 }} onClick={() => navigate('/transfer')}>
                Send money
              </Button>
              <Button variant="dark" style={{ flex: '1 1 160px', minWidth: 0 }} onClick={() => navigate('/deposit')}>
                Deposit
              </Button>
            </div>
          </section>

          <section
            style={{
              flex: '1 1 240px',
              minWidth: 'min(100%,240px)',
              padding: 24,
              borderRadius: 22,
              background: '#101210',
              border: '1px solid rgba(255,255,255,.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <p style={{ margin: 0, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(242,244,239,.45)' }}>This month</p>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(242,244,239,.5)' }}>Sent</p>
              <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500, letterSpacing: '-.02em' }}>
                {formatMoney(sentTotal)}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(242,244,239,.5)' }}>Received</p>
              <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500, letterSpacing: '-.02em', color: '#c9f24d' }}>
                {formatMoney(receivedTotal)}
              </p>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'rgba(242,244,239,.35)' }}>
                {txs.length ? `${txs.length} transactions on record, all auditable.` : 'No transactions on record yet.'}
              </p>
            </div>
          </section>
        </div>

        <section style={{ padding: 24, borderRadius: 22, background: '#f3f4ef', color: '#14170f' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: '-.01em' }}>Recent activity</h3>
            <button
              onClick={() => navigate('/history')}
              style={{ padding: '8px 14px', borderRadius: 999, background: '#14170f', color: '#f3f4ef', fontSize: 12, fontWeight: 600 }}
            >
              See all
            </button>
          </div>

          {txLoading && <SkeletonRows count={3} height={62} />}
          {!txLoading && txError && <ActivityErrorState onRetry={loadHistory} />}
          {isEmpty && <ActivityEmptyState onDeposit={() => navigate('/deposit')} />}
          {ready && txs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {txs.slice(0, 4).map((tx) => (
                <TransactionRow key={tx.id} {...rowFor(tx)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
