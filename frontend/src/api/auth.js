import { request } from './client';

export function register({ name, phone, nic, password }) {
  return request('/api/auth/register', { method: 'POST', body: { name, phone, nic, password } });
}

export function logout(refreshToken) {
  return request('/api/auth/logout', { method: 'POST', body: { refreshToken } });
}

export function login({ phone, password }) {
  return request('/api/auth/login', { method: 'POST', body: { phone, password } });
}
