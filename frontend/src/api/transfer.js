import { request } from './client';

export function transfer(toPhone, amount, acknowledgeRisk = false, otpCode = null) {
  const body = acknowledgeRisk ? { toPhone, amount, acknowledgeRisk: true } : { toPhone, amount };
  if (acknowledgeRisk && otpCode) body.otpCode = otpCode;
  return request('/api/transfer', { method: 'POST', body });
}

/** Texts the sender a code for this exact transfer. Resolves { required, devCode? }. */
export function requestTransferCode(toPhone, amount) {
  return request('/api/transfer/otp', { method: 'POST', body: { toPhone, amount } });
}

/** Scam check preview: { score, outcome: ALLOW|WARN|HOLD, reasons: [{ code, message }] }. */
export function riskCheck(toPhone, amount) {
  return request('/api/transfer/risk-check', { method: 'POST', body: { toPhone, amount } });
}

/** Withdraw a transfer that is being held for review. */
export function cancelTransfer(id) {
  return request(`/api/transfer/${id}/cancel`, { method: 'POST' });
}

/** "This was a scam": report a completed transfer. The receiver's outgoing money is put on hold. */
export function reportTransfer(id, note) {
  return request(`/api/transfer/${id}/report`, { method: 'POST', body: note ? { note } : undefined });
}

export function getHistory() {
  return request('/api/transactions');
}
