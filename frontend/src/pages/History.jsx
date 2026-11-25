import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { formatMoney } from '../utils/money';
import { getHistory, cancelTransfer, reportTransfer } from '../api/transfer';
import { SkeletonRows, ActivityErrorState, ActivityEmptyState, TransactionRow, rowFor } from '../components/Activity';
import { Banner, Card, Heading, C } from '../components/ui';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'received', label: 'Received' },
];

export default function History() {
  const navigate = useNavigate();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [reporting, setReporting] = useState(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  // Transfers reported in this visit; the server also refuses a second report, this just hides the button.
  const [reportedIds, setReportedIds] = useState(() => new Set());

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
      setReportedIds((prev) => new Set(prev).add(reporting.id));
      setNotice({ text: 'Reported. The receiving account is on hold while we review it.', tone: 'ok' });
    } catch (err) {
      setNotice({ text: err?.message || "Couldn't send the report. Try again.", tone: 'error' });
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

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
        <div>
          <Heading>Activity</Heading>
          <span style={{ fontSize: 13, color: C.muted }}>{hasAny ? `${filtered.length} of ${txs.length} transactions` : 'Every transaction on this wallet'}</span>
        </div>

        <div role="group" aria-label="Filter" style={{ display: 'flex', background: C.surface, borderRadius: 999, padding: 4, gap: 4 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              style={{ flex: 1, height: 40, borderRadius: 999, background: filter === f.key ? C.accent : 'transparent', color: filter === f.key ? '#fff' : C.text, fontSize: 13.5, fontWeight: 500 }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {notice.text && <Banner tone={notice.tone}>{notice.text}</Banner>}

        {reporting && (
          <Card tone="dark" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <b style={{ fontSize: 16 }}>Report this transfer as a scam?</b>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, background: 'rgba(255,255,255,.08)', borderRadius: 14, padding: '12px 14px' }}>
              <span>{reporting.counterpartyName}</span>
              <b>{formatMoney(reporting.amount)}</b>
            </div>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, color: '#DDD8D0' }}>We&apos;ll put their outgoing money on hold and a reviewer will try to get yours back.</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="What happened? (optional)"
              rows={3}
              style={{ borderRadius: 14, border: 0, padding: '12px 14px', font: 'inherit', fontSize: 14, resize: 'vertical', background: C.surface2, color: C.text }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submitReport} style={{ flex: 1, height: 50, borderRadius: 999, background: C.accent, color: '#fff', fontSize: 14.5, fontWeight: 600 }}>
                Send report
              </button>
              <button className="cp-outline" onClick={() => setReporting(null)} style={{ flex: 1, height: 50, borderRadius: 999, border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', fontSize: 14.5 }}>
                Never mind
              </button>
            </div>
          </Card>
        )}

        <div style={{ background: C.surface, borderRadius: 24, padding: '6px 16px' }}>
          {loading && <div style={{ padding: '10px 0' }}><SkeletonRows count={4} /></div>}
          {!loading && error && <div style={{ padding: '10px 0' }}><ActivityErrorState onRetry={load} /></div>}
          {ready && txs.length === 0 && <ActivityEmptyState onDeposit={() => navigate('/deposit')} />}
          {filterEmpty && <div style={{ padding: '22px 0', fontSize: 14, color: C.muted, lineHeight: 1.5 }}>Nothing here yet. Try another filter.</div>}
          {hasAny &&
            filtered.map((tx) => {
              const row = rowFor(tx);
              const action = row.canCancel
                ? { label: 'Cancel', kind: 'cancel', onClick: () => cancel(tx.id) }
                : row.canReport && !reportedIds.has(tx.id)
                  ? { label: 'Report scam', kind: 'report', onClick: () => setReporting(tx) }
                  : null;
              return <TransactionRow key={tx.id} {...row} action={action} />;
            })}
        </div>
      </div>
    </AppShell>
  );
}
