import { describe, expect, it } from 'vitest';
import { buildPayLink, parsePayLink } from './payLink';

describe('payLink', () => {
  it('builds a link with and without an amount', () => {
    expect(buildPayLink('https://app.example', '771234567', '')).toBe('https://app.example/transfer?to=771234567');
    expect(buildPayLink('https://app.example', '77 123 4567', '250.50')).toBe(
      'https://app.example/transfer?to=771234567&amount=250.50',
    );
  });

  it('drops an amount that is not a positive money value', () => {
    expect(buildPayLink('https://a.b', '771234567', '-5')).not.toContain('amount');
    expect(buildPayLink('https://a.b', '771234567', '0')).not.toContain('amount');
    expect(buildPayLink('https://a.b', '771234567', 'abc')).not.toContain('amount');
  });

  it('reads its own links back', () => {
    const link = buildPayLink('https://app.example', '771234567', '1200');
    expect(parsePayLink(link)).toEqual({ phone: '771234567', amount: '1200' });
  });

  it('reads a bare phone number in the usual formats', () => {
    expect(parsePayLink('+94771234567')).toEqual({ phone: '771234567', amount: '' });
    expect(parsePayLink('077 123 4567')).toEqual({ phone: '771234567', amount: '' });
    expect(parsePayLink('771234567')).toEqual({ phone: '771234567', amount: '' });
  });

  it('rejects anything else', () => {
    expect(parsePayLink('')).toBeNull();
    expect(parsePayLink('hello')).toBeNull();
    expect(parsePayLink('https://evil.example/login?to=771234567')).toBeNull();
    expect(parsePayLink('https://a.b/transfer?to=12345')).toBeNull();
    expect(parsePayLink('+94112345678')).toBeNull();
  });

  it('ignores a bad amount but keeps the number', () => {
    expect(parsePayLink('https://a.b/transfer?to=771234567&amount=-3')).toEqual({ phone: '771234567', amount: '' });
  });
});
