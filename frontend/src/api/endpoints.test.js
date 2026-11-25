import { describe, it, expect, vi } from 'vitest';

vi.mock('./client', () => ({ request: vi.fn().mockResolvedValue({}) }));

import { request } from './client';
import { register, login } from './auth';
import { getBalance, deposit } from './wallet';
import { transfer, getHistory } from './transfer';

describe('auth API', () => {
  it('register posts to /api/auth/register with the form fields', async () => {
    await register({ name: 'A', phone: '+94771234567', nic: '991234567V', password: 'pw' });
    expect(request).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: { name: 'A', phone: '+94771234567', nic: '991234567V', password: 'pw' },
    });
  });

  it('login posts to /api/auth/login with phone and password', async () => {
    await login({ phone: '+94771234567', password: 'pw' });
    expect(request).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { phone: '+94771234567', password: 'pw' },
    });
  });
});

describe('wallet API', () => {
  it('getBalance gets /api/wallet/balance', async () => {
    await getBalance();
    expect(request).toHaveBeenCalledWith('/api/wallet/balance');
  });

  it('deposit posts the amount to /api/wallet/deposit', async () => {
    await deposit(500);
    expect(request).toHaveBeenCalledWith('/api/wallet/deposit', { method: 'POST', body: { amount: 500 } });
  });
});

describe('transfer API', () => {
  it('transfer posts toPhone and amount to /api/transfer', async () => {
    await transfer('+94799999998', 200);
    expect(request).toHaveBeenCalledWith('/api/transfer', {
      method: 'POST',
      body: { toPhone: '+94799999998', amount: 200 },
    });
  });

  it('getHistory gets /api/transactions', async () => {
    await getHistory();
    expect(request).toHaveBeenCalledWith('/api/transactions');
  });
});

describe('name check and safety API', () => {
  it('lookupUser gets /api/users/lookup with the encoded phone', async () => {
    const { lookupUser } = await import('./users');
    await lookupUser('+94771234567');
    expect(request).toHaveBeenCalledWith('/api/users/lookup?phone=%2B94771234567');
  });

  it('getSafety gets /api/safety and updateSafety puts the settings', async () => {
    const { getSafety, updateSafety } = await import('./safety');
    await getSafety();
    expect(request).toHaveBeenCalledWith('/api/safety');
    await updateSafety({ frozen: true, dailyLimit: 5000, nightLimit: null });
    expect(request).toHaveBeenCalledWith('/api/safety', {
      method: 'PUT',
      body: { frozen: true, dailyLimit: 5000, nightLimit: null },
    });
  });
});

describe('scam check API', () => {
  it('transfer only sends acknowledgeRisk when it is true', async () => {
    await transfer('+94799999998', 200, true);
    expect(request).toHaveBeenCalledWith('/api/transfer', {
      method: 'POST',
      body: { toPhone: '+94799999998', amount: 200, acknowledgeRisk: true },
    });
  });

  it('riskCheck posts to /api/transfer/risk-check', async () => {
    const { riskCheck } = await import('./transfer');
    await riskCheck('+94799999998', 200);
    expect(request).toHaveBeenCalledWith('/api/transfer/risk-check', {
      method: 'POST',
      body: { toPhone: '+94799999998', amount: 200 },
    });
  });

  it('cancelTransfer posts to the cancel path', async () => {
    const { cancelTransfer } = await import('./transfer');
    await cancelTransfer('abc');
    expect(request).toHaveBeenCalledWith('/api/transfer/abc/cancel', { method: 'POST' });
  });
});

describe('report and admin API', () => {
  it('reportTransfer posts the note to the report path', async () => {
    const { reportTransfer } = await import('./transfer');
    await reportTransfer('abc', 'fake job');
    expect(request).toHaveBeenCalledWith('/api/transfer/abc/report', { method: 'POST', body: { note: 'fake job' } });
  });

  it('admin calls hit the review and report endpoints', async () => {
    const admin = await import('./admin');
    await admin.getReviews();
    expect(request).toHaveBeenCalledWith('/api/admin/reviews');
    await admin.approveReview('r1');
    expect(request).toHaveBeenCalledWith('/api/admin/reviews/r1/approve', { method: 'POST' });
    await admin.rejectReview('r1');
    expect(request).toHaveBeenCalledWith('/api/admin/reviews/r1/reject', { method: 'POST' });
    await admin.getReports();
    expect(request).toHaveBeenCalledWith('/api/admin/reports?status=OPEN');
    await admin.resolveReport('p1', 'UPHOLD');
    expect(request).toHaveBeenCalledWith('/api/admin/reports/p1/resolve', { method: 'POST', body: { decision: 'UPHOLD' } });
  });
});
