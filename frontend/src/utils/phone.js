export function digitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 9);
}

export function groupPhone(raw) {
  const d = digitsOnly(raw);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ');
}

export function toDisplayPhone(raw) {
  return '+94 ' + groupPhone(raw);
}

export function toApiPhone(raw) {
  return '+94' + digitsOnly(raw);
}

export function phoneError(raw) {
  const d = digitsOnly(raw);
  if (!d) return 'Enter a phone number.';
  if (d.length < 9) return 'A Sri Lankan mobile number has 9 digits after +94.';
  if (d[0] !== '7') return 'Mobile numbers start with 7 — for example 77 123 4567.';
  return '';
}
