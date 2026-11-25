import { describe, it, expect } from 'vitest';
import { rowFor } from './Activity';

const base = { id: 't1', counterpartyName: 'K. Perera', counterpartyPhone: '+94771234567', amount: 100, timestamp: '2026-03-10T10:00:00' };

describe('rowFor', () => {
  it('labels completed transfers by direction', () => {
    expect(rowFor({ ...base, direction: 'SENT', status: 'SUCCESS' }).stateLabel).toBe('Sent');
    expect(rowFor({ ...base, direction: 'RECEIVED', status: 'SUCCESS' }).stateLabel).toBe('Received');
  });

  it('shows held transfers as under review and lets the sender cancel them', () => {
    const row = rowFor({ ...base, direction: 'SENT', status: 'PENDING_REVIEW' });
    expect(row.stateLabel).toBe('Held for review');
    expect(row.canCancel).toBe(true);
  });

  it('does not offer cancel for finished transfers', () => {
    expect(rowFor({ ...base, direction: 'SENT', status: 'SUCCESS' }).canCancel).toBe(false);
    expect(rowFor({ ...base, direction: 'SENT', status: 'CANCELLED' }).stateLabel).toBe('Cancelled');
  });

  it('offers a scam report only on completed sent transfers', () => {
    expect(rowFor({ ...base, direction: 'SENT', status: 'SUCCESS' }).canReport).toBe(true);
    expect(rowFor({ ...base, direction: 'RECEIVED', status: 'SUCCESS' }).canReport).toBe(false);
    expect(rowFor({ ...base, direction: 'SENT', status: 'PENDING_REVIEW' }).canReport).toBe(false);
  });

  it('labels reversed transfers and refunds', () => {
    expect(rowFor({ ...base, direction: 'SENT', status: 'REVERSED' }).stateLabel).toBe('Reversed');
    expect(rowFor({ ...base, direction: 'RECEIVED', status: 'REVERSAL' }).stateLabel).toBe('Refund');
    expect(rowFor({ ...base, direction: 'SENT', status: 'REVERSAL' }).stateLabel).toBe('Refunded');
  });
});
