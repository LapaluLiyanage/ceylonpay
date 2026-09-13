import { request } from './client';

export function getBalance() {
  return request('/api/wallet/balance');
}

export function deposit(amount) {
  return request('/api/wallet/deposit', { method: 'POST', body: { amount } });
}
