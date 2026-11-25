import { request } from './client';

export function transfer(toPhone, amount, acknowledgeRisk = false) {
  const body = acknowledgeRisk ? { toPhone, amount, acknowledgeRisk: true } : { toPhone, amount };
  return request('/api/transfer', { method: 'POST', body });
}

/** Scam check preview: { score, outcome: ALLOW|WARN|HOLD, reasons: [{ code, message }] }. */
export function riskCheck(toPhone, amount) {
  return request('/api/transfer/risk-check', { method: 'POST', body: { toPhone, amount } });
}

/** Withdraw a transfer that is being held for review. */
export function cancelTransfer(id) {
  return request(`/api/transfer/${id}/cancel`, { method: 'POST' });
}

export function getHistory() {
  return request('/api/transactions');
}
