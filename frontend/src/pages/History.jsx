import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { getHistory } from '../api/transfer';
import { SkeletonRows, ActivityErrorState, ActivityEmptyState, TransactionRow, rowFor } from '../components/Activity';

export default function History() {
  const navigate = useNavigate();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getHistory()
      .then((data) => setTxs(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ready = !loading && !error;
  const hasAny = ready && txs.length > 0;
  const filtered =
    filter === 'sent' ? txs.filter((t) => t.direction === 'SENT') : filter === 'received' ? txs.filter((t) => t.direction === 'RECEIVED') : txs;
  const filterEmpty = hasAny && filtered.length === 0;

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'received', label: 'Received' },
  ];

  return (
    <AppShell>
      <main style={{ marginTop: 20, animation: 'cp-rise .35s ease both' }}>
        <section style={{ padding: 24, borderRadius: 22, background: '#f3f4ef', color: '#14170f' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}>
                Activity
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(20,23,15,.55)' }}>
                {hasAny ? `${filtered.length} of ${txs.length} transactions` : 'Every transaction on this wallet'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: '#e6e8de' }}>
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    background: filter === f.key ? '#14170f' : 'transparent',
                    color: filter === f.key ? '#f3f4ef' : 'rgba(20,23,15,.6)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading && <SkeletonRows count={4} height={66} />}
          {!loading && error && <ActivityErrorState onRetry={load} />}
          {ready && txs.length === 0 && <ActivityEmptyState onDeposit={() => navigate('/deposit')} />}
          {filterEmpty && (
            <div style={{ padding: '30px 24px', borderRadius: 16, background: '#fff', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(20,23,15,.6)' }}>No {filter} transactions yet.</p>
            </div>
          )}
          {hasAny && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((tx) => (
                <TransactionRow key={tx.id} {...rowFor(tx)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
