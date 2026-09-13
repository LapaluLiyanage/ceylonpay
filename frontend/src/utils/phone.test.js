import { describe, it, expect } from 'vitest';
import { digitsOnly, groupPhone, toDisplayPhone, toApiPhone, phoneError } from './phone';

describe('digitsOnly', () => {
  it('strips non-digit characters', () => {
    expect(digitsOnly('77 123 4567')).toBe('771234567');
  });

  it('truncates to 9 digits', () => {
    expect(digitsOnly('12345678901')).toBe('123456789');
  });
});

describe('groupPhone', () => {
  it('groups digits as 2-3-4', () => {
    expect(groupPhone('771234567')).toBe('77 123 4567');
  });

  it('handles a partial number', () => {
    expect(groupPhone('771')).toBe('77 1');
  });
});

describe('toDisplayPhone', () => {
  it('prefixes +94 and groups the digits', () => {
    expect(toDisplayPhone('771234567')).toBe('+94 77 123 4567');
  });
});

describe('toApiPhone', () => {
  it('prefixes +94 with no spaces, for the backend', () => {
    expect(toApiPhone('771234567')).toBe('+94771234567');
  });
});

describe('phoneError', () => {
  it('rejects an empty number', () => {
    expect(phoneError('')).toBe('Enter a phone number.');
  });

  it('rejects a number shorter than 9 digits', () => {
    expect(phoneError('771234')).toBe('A Sri Lankan mobile number has 9 digits after +94.');
  });

  it('rejects a number not starting with 7', () => {
    expect(phoneError('812345678')).toBe('Mobile numbers start with 7 — for example 77 123 4567.');
  });

  it('accepts a valid 9-digit number starting with 7', () => {
    expect(phoneError('771234567')).toBe('');
  });
});
