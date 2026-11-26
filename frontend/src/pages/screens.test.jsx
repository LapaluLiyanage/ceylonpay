import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { PHRASES } from '../i18n/phrases';
import Login from './Login';
import Register from './Register';
import Welcome from './Welcome';
import Dashboard from './Dashboard';
import Deposit from './Deposit';
import Receive from './Receive';
import History from './History';
import Safety from './Safety';
import Transfer from './Transfer';
import VerifyPhone from './VerifyPhone';

// Renders each screen once, as the server would, in every language. It cannot click through the
// flows, but it catches a screen that crashes while drawing, which is the usual way a text change breaks.
const store = {};
const original = {};

beforeAll(() => {
  original.window = globalThis.window;
  original.localStorage = globalThis.localStorage;
  Object.assign(store, { ceylonpay_token: 'test-token', ceylonpay_user: JSON.stringify({ name: 'Nimali Perera', phone: '771234567', role: 'USER', phoneVerified: false }) });
  globalThis.localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
  globalThis.window = {
    location: { origin: 'http://localhost', search: '' },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    localStorage: globalThis.localStorage,
  };
});

afterAll(() => {
  globalThis.window = original.window;
  globalThis.localStorage = original.localStorage;
});

const SCREENS = { Login, Register, Welcome, Dashboard, Deposit, Receive, History, Safety, Transfer, VerifyPhone };

describe.each(['en', 'si', 'ta'])('screens in %s', (lang) => {
  it.each(Object.entries(SCREENS))('%s draws without crashing', (name, Screen) => {
    store.ceylonpay_lang = lang;
    const html = renderToString(
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter>
            <Screen />
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    );
    expect(html.length).toBeGreaterThan(200);
  });
});

describe('the language shows on a screen', () => {
  it('draws the sign-in heading in Sinhala when Sinhala is chosen', () => {
    store.ceylonpay_lang = 'si';
    const html = renderToString(
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter>
            <Login />
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    );
    expect(html).toContain(PHRASES.si['Create an account']);
  });
});
