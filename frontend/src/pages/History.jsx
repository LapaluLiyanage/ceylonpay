import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { formatMoney } from '../utils/money';
import { getHistory, cancelTransfer, reportTransfer } from '../api/transfer';
import { SkeletonRows, ActivityErrorState, ActivityEmptyState, TransactionRow, rowFor } from '../components/Activity';

export default function History() {
  const navigate = useNavigate();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [reporting, setReporting] = useState(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');

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

  async function submitReport() {
    try {
      await reportTransfer(reporting.id, note.trim());
      setNotice('Reported. The receiving account is on hold while we review it.');
    } catch (err) {
      setNotice(err?.message || "Couldn't send the report. Try again.");
    } finally {
      setReporting(null);
      setNote('');
      load();
    }
  }

  async function cancel(id) {
    try {
      await cancelTransfer(id);
    } finally {
      load();
    }
  }

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

          {notice && (
            <p role="status" style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(20,23,15,.7)' }}>
              {notice}
            </p>
          )}
          {reporting && (
            <div style={{ padding: 18, borderRadius: 16, background: '#fff', border: '1px solid rgba(200,70,40,.35)', marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>Report this transfer as a scam?</p>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'rgba(20,23,15,.6)' }}>
                {formatMoney(reporting.amount)} to {reporting.counterpartyName}. We&apos;ll put their outgoing money on hold and a reviewer will try to get yours back.
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="What happened? (optional)"
                rows={3}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(20,23,15,.2)', fontSize: 14, marginBottom: 10 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitReport} style={{ padding: '10px 14px', borderRadius: 10, background: '#14170f', color: '#f3f4ef', fontSize: 13, fontWeight: 700 }}>
                  Send report
                </button>
                <button onClick={() => setReporting(null)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(20,23,15,.25)', fontSize: 13, fontWeight: 700 }}>
                  Never mind
                </button>
              </div>
            </div>
          )}

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
                <TransactionRow
                  key={tx.id}
                  {...rowFor(tx)}
                  action={
                    rowFor(tx).canCancel
                      ? { label: 'Cancel', onClick: () => cancel(tx.id) }
                      : rowFor(tx).canReport
                        ? { label: 'Report scam', onClick: () => setReporting(tx) }
                        : null
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
