import { formatMoney } from '../utils/money';
import { toDisplayPhone, normalizeStoredPhone } from '../utils/phone';
import { C, Chip, GradButton, display, mono, Skeleton } from './ui';
import { useLanguage } from '../context/LanguageContext';
import { msg, plain } from '../i18n/strings';

export function SkeletonRows({ count = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={62} radius={18} />
      ))}
    </div>
  );
}

export function ActivityErrorState({ onRetry }) {
  const { t } = useLanguage();
  return (
    <div style={{ background: C.surface, borderRadius: 22, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ ...display, fontSize: 18, textTransform: 'uppercase' }}>{t("Activity didn't load")}</span>
      <span style={{ fontSize: 14, color: C.soft, lineHeight: 1.5 }}>{t("The server didn't answer. Nothing has changed in your wallet.")}</span>
      <GradButton onClick={onRetry}>Try again</GradButton>
    </div>
  );
}

export function ActivityEmptyState({ onDeposit }) {
  const { t } = useLanguage();
  return (
    <div style={{ padding: '14px 0 18px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ ...display, fontSize: 18, textTransform: 'uppercase' }}>{t('No money has moved yet')}</span>
      <span style={{ fontSize: 13.5, color: C.soft, lineHeight: 1.5, maxWidth: 380 }}>
        {t('Put your first rupees in the wallet — then you can send to any CeylonPay phone number.')}
      </span>
      <GradButton onClick={onDeposit}>Make your first deposit</GradButton>
    </div>
  );
}

/** One line of the transaction list. `action` is {label, onClick, kind: 'cancel' | 'report'}. */
export function TransactionRow({ direction, title, subtitle, amountText, stateLabel, tone, muted, struck, reference, action, compact }) {
  const { t } = useLanguage();
  const isOut = direction === 'SENT';
  return (
    <div style={{ display: 'flex', alignItems: compact ? 'center' : 'flex-start', gap: 12, padding: compact ? '13px 0' : '14px 0', borderTop: `1px solid ${C.line}` }}>
      <span
        aria-hidden="true"
        style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: isOut ? C.grad : C.surface2, color: isOut ? '#fff' : C.text, border: `1.5px solid ${C.outline}`, display: 'grid', placeItems: 'center', fontSize: 15 }}
      >
        {isOut ? '↗' : '↙'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</div>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
            <Chip tone={tone}>{stateLabel}</Chip>
            <span style={{ ...mono, fontSize: 10.5, color: '#8A7C70' }}>{reference}</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: compact ? 5 : 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', color: muted ? '#8A7C70' : isOut ? C.text : C.ok, textDecoration: struck ? 'line-through' : 'none' }}>{amountText}</span>
        {compact && <Chip tone={tone}>{stateLabel}</Chip>}
        {action && (
          <button
            onClick={action.onClick}
            className={action.kind === 'report' ? undefined : 'cp-outline'}
            style={
              action.kind === 'report'
                ? { height: 32, padding: '0 12px', borderRadius: 999, background: 'rgba(226,87,43,.18)', color: '#FFB08F', fontSize: 12, fontWeight: 600 }
                : { height: 32, padding: '0 12px', borderRadius: 999, border: `1.5px solid ${C.outline}`, fontSize: 12 }
            }
          >
            {t(action.label)}
          </button>
        )}
      </div>
    </div>
  );
}

export function timestampLabel(iso, locale = 'en-GB') {
  return new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

const STATUS_LABELS = { PENDING_REVIEW: msg('Held for review'), REJECTED: msg('Rejected'), CANCELLED: msg('Cancelled'), REVERSED: msg('Reversed') };
const STATUS_TONES = { PENDING_REVIEW: 'warn', REJECTED: 'error', CANCELLED: 'muted', REVERSED: 'error' };

/** One transaction as the list shows it. Pass the translator and locale to get the person's language; the state label is translated when shown. */
export function rowFor(tx, t = plain, locale = 'en-GB') {
  const isOut = tx.direction === 'SENT';
  const reversal = tx.status === 'REVERSAL';
  return {
    id: tx.id,
    direction: tx.direction,
    stateLabel: reversal ? (isOut ? 'Refunded' : 'Refund') : STATUS_LABELS[tx.status] || (isOut ? 'Sent' : 'Received'),
    tone: reversal ? 'ok' : STATUS_TONES[tx.status] || (isOut ? 'neutral' : 'ok'),
    muted: ['PENDING_REVIEW', 'REJECTED', 'CANCELLED'].includes(tx.status),
    struck: ['REJECTED', 'CANCELLED'].includes(tx.status),
    canCancel: isOut && tx.status === 'PENDING_REVIEW',
    canReport: isOut && tx.status === 'SUCCESS',
    title: t(isOut ? msg('To {name}') : msg('From {name}'), { name: tx.counterpartyName }),
    subtitle: `${toDisplayPhone(normalizeStoredPhone(tx.counterpartyPhone))} · ${timestampLabel(tx.timestamp, locale)}`,
    reference: tx.id,
    amountText: (isOut ? '− ' : '+ ') + formatMoney(tx.amount),
  };
}
