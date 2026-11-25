import { digitsOnly, phoneError } from './phone';

/** A link that opens the Send page already filled in. Printed or shown as a QR code to get paid. */
export function buildPayLink(origin, phone, amount) {
  const params = new URLSearchParams({ to: digitsOnly(phone) });
  const cleaned = cleanAmount(amount);
  if (cleaned) params.set('amount', cleaned);
  return `${origin}/transfer?${params.toString()}`;
}

/**
 * Reads what a scanned code or pasted text says. Accepts a CeylonPay pay link or a plain Sri Lankan
 * mobile number; returns {phone, amount} (phone as the 9 digits after +94) or null.
 */
export function parsePayLink(text) {
  const value = String(text || '').trim();
  if (!value) return null;

  let phone = '';
  let amount = '';
  try {
    const url = new URL(value);
    if (url.pathname.replace(/\/+$/, '') !== '/transfer') return null;
    phone = url.searchParams.get('to') || '';
    amount = cleanAmount(url.searchParams.get('amount'));
  } catch {
    phone = value;
  }

  const digits = normalizePhone(phone);
  if (phoneError(digits)) return null;
  return { phone: digits, amount };
}

function normalizePhone(raw) {
  const d = String(raw).replace(/[\s-]/g, '');
  if (/^\+94\d{9}$/.test(d)) return d.slice(3);
  if (/^0\d{9}$/.test(d)) return d.slice(1);
  if (/^\d{9}$/.test(d)) return d;
  return '';
}

/** Keeps a positive amount with at most two decimals; anything else becomes empty. */
function cleanAmount(raw) {
  const v = String(raw ?? '').trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(v)) return '';
  return Number(v) > 0 ? v : '';
}
