import { msg } from '../i18n/strings';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// The free host puts the API to sleep when idle. Waking it takes 30 to 60 seconds, and in that time the
// host's gateway can answer 502, 503 or 504 with an HTML page instead of JSON. Give up after this long.
const REQUEST_TIMEOUT_MS = 65000;
const GATEWAY_STATUSES = [502, 503, 504];
export const GATEWAY_MESSAGE = msg('The server is waking up. This can take up to a minute — try again shortly.');
const UNAUTHENTICATED_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'];

let authToken = null;
let refreshToken = null;
let onUnauthorized = null;
let onTokensRefreshed = null;
let refreshInFlight = null;

export function setAuthToken(token) {
  authToken = token;
}

export function setRefreshToken(token) {
  refreshToken = token;
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/** Called with { token, refreshToken } whenever a silent refresh succeeds, so the app can persist them. */
export function setTokensRefreshedHandler(fn) {
  onTokensRefreshed = fn;
}

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// One refresh at a time: several requests failing together must not each spend the (single-use) refresh token.
function refreshSession() {
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;
        const data = JSON.parse(await response.text());
        authToken = data.token;
        refreshToken = data.refreshToken;
        if (onTokensRefreshed) onTokensRefreshed({ token: data.token, refreshToken: data.refreshToken });
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function request(path, { method = 'GET', body } = {}, alreadyRetried = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  let text;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    text = await response.text();
  } catch (err) {
    // Aborted because the server never answered in time: report it like a gateway timeout.
    if (err?.name === 'AbortError') throw new ApiError(504, GATEWAY_MESSAGE, 'GATEWAY');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  // A gateway error page is HTML, not JSON, so it must not be parsed.
  if (GATEWAY_STATUSES.includes(response.status)) throw new ApiError(response.status, GATEWAY_MESSAGE, 'GATEWAY');

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (response.status === 401 && !UNAUTHENTICATED_PATHS.includes(path)) {
    // The access token probably just expired: renew it quietly and repeat the request once.
    if (!alreadyRetried && (await refreshSession())) {
      return request(path, { method, body }, true);
    }
    if (onUnauthorized) onUnauthorized();
  }

  if (!response.ok) {
    const message = (data && data.error) || 'Something went wrong. Please try again.';
    throw new ApiError(response.status, message, data && data.code);
  }

  return data;
}
