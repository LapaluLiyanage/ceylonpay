import { request } from './client';

/** Texts a verification code to the signed-in user's own phone. Resolves { required, devCode? }. */
export function requestPhoneCode() {
  return request('/api/account/phone/request', { method: 'POST' });
}

export function verifyPhone(code) {
  return request('/api/account/phone/verify', { method: 'POST', body: { code } });
}
