import { request } from './client';

export function transfer(toPhone, amount) {
  return request('/api/transfer', { method: 'POST', body: { toPhone, amount } });
}

export function getHistory() {
  return request('/api/transactions');
}
