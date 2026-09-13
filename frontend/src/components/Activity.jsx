import { formatMoney } from '../utils/money';
import { toDisplayPhone, normalizeStoredPhone } from '../utils/phone';

export function SkeletonRows({ count = 3, height = 62 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{ height, borderRadius: 14, background: '#e4e6dd', animation: `cp-pulse 1.4s ease-in-out ${i * 0.12}s infinite` }}
        />
      ))}
    </div>
  );
}

export function ActivityErrorState({ onRetry }) {
  return (
    <div style={{ padding: 22, borderRadius: 16, background: '#fff', border: '1px solid rgba(20,23,15,.1)' }}>
      <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>Activity didn&apos;t load</p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(20,23,15,.6)' }}>
        The server didn&apos;t answer. Nothing has changed in your wallet.
      </p>
      <button
        onClick={onRetry}
        style={{ padding: '10px 14px', borderRadius: 10, background: '#14170f', color: '#f3f4ef', fontSize: 13, fontWeight: 600 }}
      >
        Try again
      </button>
    </div>
  );
}

export function ActivityEmptyState({ onDeposit }) {
  return (
    <div style={{ padding: '30px 24px', borderRadius: 16, background: '#fff', border: '1px dashed rgba(20,23,15,.2)', textAlign: 'center' }}>
      <p style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 600 }}>No money has moved yet</p>
      <p style={{ margin: '0 auto 18px', maxWidth: 340, fontSize: 13, lineHeight: 1.6, color: 'rgba(20,23,15,.6)' }}>
        Put your first rupees in the wallet — then you can send to any CeylonPay phone number.
      </p>
      <button
        onClick={onDeposit}
        style={{ padding: '12px 20px', borderRadius: 12, background: '#c9f24d', color: '#131707', fontSize: 14, fontWeight: 700 }}
      >
        Make your first deposit
      </button>
    </div>
  );
}

export function TransactionRow({ direction, title, subtitle, amountText, stateLabel }) {
  const isOut = direction === 'SENT';
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderRadius: 14,
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            flex: 'none',
            background: isOut ? '#14170f' : '#c9f24d',
            color: isOut ? '#f3f4ef' : '#131707',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          {isOut ? '↑' : '↓'}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600 }}>{title}</p>
          <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: 'rgba(20,23,15,.5)' }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            padding: '5px 10px',
            borderRadius: 999,
            background: '#eef0e8',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            color: 'rgba(20,23,15,.65)',
          }}
        >
          {stateLabel}
        </span>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>
          {amountText}
        </span>
      </div>
    </div>
  );
}

export function timestampLabel(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

export function rowFor(tx) {
  const isOut = tx.direction === 'SENT';
  return {
    id: tx.id,
    direction: tx.direction,
    stateLabel: isOut ? 'Sent' : 'Received',
    title: isOut ? `To ${tx.counterpartyName}` : `From ${tx.counterpartyName}`,
    subtitle: `${toDisplayPhone(normalizeStoredPhone(tx.counterpartyPhone))} · ${timestampLabel(tx.timestamp)} · ${tx.id}`,
    amountText: (isOut ? '− ' : '+ ') + formatMoney(tx.amount),
  };
}
