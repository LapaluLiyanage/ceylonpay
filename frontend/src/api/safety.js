import { request } from './client';

export function getSafety() {
  return request('/api/safety');
}

export function updateSafety({ frozen, dailyLimit, nightLimit }) {
  return request('/api/safety', { method: 'PUT', body: { frozen, dailyLimit, nightLimit } });
}
