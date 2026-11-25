import { request } from './client';

/** Name check: resolves a phone number to the shortened name of its owner (404 if nobody has it). */
export function lookupUser(phone) {
  return request(`/api/users/lookup?phone=${encodeURIComponent(phone)}`);
}
