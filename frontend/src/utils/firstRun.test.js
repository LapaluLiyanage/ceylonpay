import { describe, expect, it } from 'vitest';
import { entryPath, markSplashSeen, markWelcomed, shouldShowSplash } from './firstRun';

function fakeStorage() {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

const blocked = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

describe('shouldShowSplash', () => {
  it('shows once per session for signed-out visitors', () => {
    const session = fakeStorage();
    expect(shouldShowSplash({ session, hasToken: false, reducedMotion: false })).toBe(true);
    markSplashSeen(session);
    expect(shouldShowSplash({ session, hasToken: false, reducedMotion: false })).toBe(false);
  });

  it('is skipped when signed in or when motion is reduced', () => {
    const session = fakeStorage();
    expect(shouldShowSplash({ session, hasToken: true, reducedMotion: false })).toBe(false);
    expect(shouldShowSplash({ session, hasToken: false, reducedMotion: true })).toBe(false);
  });

  it('survives blocked storage', () => {
    expect(shouldShowSplash({ session: blocked, hasToken: false, reducedMotion: false })).toBe(true);
    expect(() => markSplashSeen(blocked)).not.toThrow();
  });
});

describe('entryPath', () => {
  it('sends new visitors to the intro, then to log in', () => {
    const local = fakeStorage();
    expect(entryPath({ local, hasToken: false })).toBe('/welcome');
    markWelcomed(local);
    expect(entryPath({ local, hasToken: false })).toBe('/login');
  });

  it('sends signed-in people to the dashboard', () => {
    expect(entryPath({ local: fakeStorage(), hasToken: true })).toBe('/dashboard');
  });
});
