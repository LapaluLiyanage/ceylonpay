import { describe, it, expect } from 'vitest';
import { LANGUAGES, REASONS, UI, reasonText, uiText } from './strings';

// Every reason code the backend (RiskService) can return.
const BACKEND_CODES = [
  'FIRST_PAYMENT',
  'UNUSUAL_AMOUNT',
  'LARGER_THAN_USUAL',
  'MOST_OF_BALANCE',
  'HALF_OF_BALANCE',
  'RAPID_PAYMENTS',
  'LATE_NIGHT',
  'NEW_RECEIVER',
  'YOUNG_RECEIVER',
  'MANY_SENDERS',
  'SEVERAL_SENDERS',
  'PASS_THROUGH',
  'REPORTED_SCAM',
  'REPORT_PENDING',
];

describe('translations', () => {
  it('cover every backend reason code in every language', () => {
    for (const { code } of LANGUAGES) {
      for (const reasonCode of BACKEND_CODES) {
        expect(REASONS[code][reasonCode], `${code}/${reasonCode}`).toBeTruthy();
      }
    }
  });

  it('keep the same placeholders in every language', () => {
    const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    for (const reasonCode of BACKEND_CODES) {
      for (const { code } of LANGUAGES) {
        expect(placeholders(REASONS[code][reasonCode]), `${code}/${reasonCode}`).toBe(placeholders(REASONS.en[reasonCode]));
      }
    }
  });

  it('cover every UI string in every language', () => {
    for (const { code } of LANGUAGES) {
      for (const key of Object.keys(UI.en)) expect(UI[code][key], `${code}/${key}`).toBeTruthy();
    }
  });
});

describe('reasonText', () => {
  it('fills the numbers in from the reason params', () => {
    const reason = { code: 'MANY_SENDERS', message: 'English fallback', params: { count: '14' } };
    expect(reasonText(reason, 'en')).toBe('This account received money from 14 different people today.');
    expect(reasonText(reason, 'si')).toContain('14');
    expect(reasonText(reason, 'ta')).toContain('14');
  });

  it('falls back to the server text for an unknown code', () => {
    expect(reasonText({ code: 'SOMETHING_NEW', message: 'Server says so' }, 'si')).toBe('Server says so');
  });

  it('falls back to English for an unknown language', () => {
    expect(uiText('xx', 'warnTitle')).toBe(UI.en.warnTitle);
  });
});
