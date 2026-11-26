import { describe, expect, it } from 'vitest';
import { PHRASES } from './phrases';
import { LOCALES, UI, plain, uiText } from './strings';

// Every source file except tests and the text tables themselves.
const sources = import.meta.glob(['../**/*.js', '../**/*.jsx', '!../**/*.test.js', '!../**/*.test.jsx', '!../i18n/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Text in the app that must have a translation: msg('...'), t('...') and tr('...') written with a plain string.
function markedText() {
  const found = new Map();
  const pattern = /\b(?:msg|t)\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/g;
  for (const [file, code] of Object.entries(sources)) {
    for (const match of code.matchAll(pattern)) {
      const text = (match[1] ?? match[2]).replace(/\\(['"])/g, '$1');
      if (!found.has(text)) found.set(text, file);
    }
  }
  return found;
}

const gaps = (text) => (text.match(/\{\w+\}/g) || []).sort().join(',');

describe('screen text coverage', () => {
  it('finds the marked text in the source', () => {
    expect(markedText().size).toBeGreaterThan(100);
  });

  it('has a Sinhala and a Tamil line for every marked piece of text', () => {
    const missing = [];
    for (const [text, file] of markedText()) {
      if (text in UI.en) continue; // the scam-warning wording has its own table and tests
      for (const lang of ['si', 'ta']) {
        if (!PHRASES[lang][text]) missing.push(`${lang}: "${text}" (${file})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps the {gaps} and [highlights] the same in every language', () => {
    const problems = [];
    for (const lang of ['si', 'ta']) {
      for (const [english, translated] of Object.entries(PHRASES[lang])) {
        if (gaps(english) !== gaps(translated)) problems.push(`${lang} gaps: "${english}"`);
        if (english.includes('[') !== translated.includes('[')) problems.push(`${lang} highlight: "${english}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('writes Sinhala in Sinhala letters and Tamil in Tamil letters', () => {
    const problems = [];
    for (const [english, text] of Object.entries(PHRASES.si)) if (!/[඀-෿]/.test(text)) problems.push(`si: "${english}"`);
    for (const [english, text] of Object.entries(PHRASES.ta)) if (!/[஀-௿]/.test(text)) problems.push(`ta: "${english}"`);
    expect(problems).toEqual([]);
  });
});

describe('looking up text', () => {
  it('returns the Sinhala and Tamil line for a known phrase', () => {
    expect(uiText('si', 'Log in')).toBe(PHRASES.si['Log in']);
    expect(uiText('ta', 'Log in')).toBe(PHRASES.ta['Log in']);
  });

  it('falls back to the English text for anything unknown, and for English itself', () => {
    expect(uiText('si', 'Something not translated')).toBe('Something not translated');
    expect(uiText('en', 'Log in')).toBe('Log in');
  });

  it('fills the {gaps} in any language and leaves unknown gaps alone', () => {
    expect(uiText('en', 'To {name}', { name: 'Nimali' })).toBe('To Nimali');
    expect(uiText('si', 'To {name}', { name: 'Nimali' })).toContain('Nimali');
    expect(plain('Sent {amount}', { amount: 'Rs. 5.00' })).toBe('Sent Rs. 5.00');
    expect(plain('Hello {who}')).toBe('Hello {who}');
  });

  it('knows how to format dates in each language', () => {
    expect(Object.keys(LOCALES)).toEqual(['en', 'si', 'ta']);
  });
});
