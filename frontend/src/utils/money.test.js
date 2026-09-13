import { describe, it, expect } from 'vitest';
import { formatMoney, parseAmountInput } from './money';

describe('formatMoney', () => {
  it('formats a whole number with two decimals and the Rs. prefix', () => {
    expect(formatMoney(500)).toBe('Rs. 500.00');
  });

  it('adds thousands separators', () => {
    expect(formatMoney(48200.75)).toBe('Rs. 48,200.75');
  });

  it('accepts a numeric string from the API', () => {
    expect(formatMoney('300.0000')).toBe('Rs. 300.00');
  });

  it('formats zero correctly', () => {
    expect(formatMoney(0)).toBe('Rs. 0.00');
  });
});

describe('parseAmountInput', () => {
  it('rejects an empty value', () => {
    expect(parseAmountInput('')).toEqual({ error: 'Enter an amount.' });
  });

  it('rejects non-numeric input', () => {
    expect(parseAmountInput('abc')).toEqual({ error: 'Use numbers only, up to two decimals.' });
  });

  it('rejects an amount below the minimum', () => {
    expect(parseAmountInput('0.50')).toEqual({ error: 'The smallest amount is Rs. 1.00.' });
  });

  it('accepts a valid whole number amount', () => {
    expect(parseAmountInput('500')).toEqual({ value: 500 });
  });

  it('accepts a valid decimal amount', () => {
    expect(parseAmountInput('1250.75')).toEqual({ value: 1250.75 });
  });

  it('accepts the exact minimum amount', () => {
    expect(parseAmountInput('1.00')).toEqual({ value: 1 });
  });
});
