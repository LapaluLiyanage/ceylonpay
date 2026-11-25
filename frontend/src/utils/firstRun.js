// Decides when the opening splash and the intro slides appear. Storage is passed in so it can be tested.

const SPLASH_KEY = 'cp_splash_seen';
const WELCOME_KEY = 'cp_welcomed';

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key) {
  try {
    storage.setItem(key, '1');
  } catch {
    // Storage can be blocked; the worst case is seeing the splash again.
  }
}

/** The splash plays once per browser session, only for signed-out visitors, and never with reduced motion. */
export function shouldShowSplash({ session, hasToken, reducedMotion }) {
  if (hasToken || reducedMotion) return false;
  return safeGet(session, SPLASH_KEY) !== '1';
}

export function markSplashSeen(session) {
  safeSet(session, SPLASH_KEY);
}

/** New signed-out visitors land on the intro slides; everyone else goes straight to log in. */
export function entryPath({ local, hasToken }) {
  if (hasToken) return '/dashboard';
  return safeGet(local, WELCOME_KEY) === '1' ? '/login' : '/welcome';
}

export function markWelcomed(local) {
  safeSet(local, WELCOME_KEY);
}
