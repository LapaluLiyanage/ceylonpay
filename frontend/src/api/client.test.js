import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, setAuthToken, setRefreshToken, setUnauthorizedHandler, setTokensRefreshedHandler, ApiError } from './client';

describe('request', () => {
  beforeEach(() => {
    setAuthToken(null);
    setRefreshToken(null);
    setUnauthorizedHandler(null);
    setTokensRefreshedHandler(null);
    global.fetch = vi.fn();
  });

  it('attaches the Authorization header when a token is set', async () => {
    setAuthToken('abc123');
    global.fetch.mockResolvedValue({ ok: true, text: async () => '{"walletId":"w1"}' });

    await request('/api/wallet/balance');

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer abc123');
  });

  it('omits the Authorization header when no token is set', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => '{}' });

    await request('/api/auth/login');

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('resolves with the parsed JSON body on success', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => '{"balance":500}' });

    const result = await request('/api/wallet/balance');

    expect(result).toEqual({ balance: 500 });
  });

  it('throws an ApiError with the backend message and status on failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"Phone number already registered"}',
    });

    await expect(request('/api/auth/register', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 400, message: 'Phone number already registered' });
    await expect(request('/api/auth/register', { method: 'POST', body: {} }))
      .rejects.toBeInstanceOf(ApiError);
  });

  it('falls back to a generic message when the error body has no message', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => '' });

    await expect(request('/api/wallet/balance'))
      .rejects.toMatchObject({ status: 500, message: 'Something went wrong. Please try again.' });
  });

  it('reports a gateway error page as "server is waking up" instead of failing to parse it', async () => {
    for (const status of [502, 503, 504]) {
      global.fetch.mockResolvedValueOnce({ ok: false, status, text: async () => '<html><body>Gateway Timeout</body></html>' });
      await expect(request('/api/wallet/balance')).rejects.toMatchObject({ status, code: 'GATEWAY', message: expect.stringContaining('waking up') });
    }
  });

  it('does not crash on a non-JSON error body from some other status', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => '<html>oops</html>' });

    await expect(request('/api/wallet/balance')).rejects.toMatchObject({ status: 500, message: 'Something went wrong. Please try again.' });
  });

  it('treats a request that never answers as a gateway timeout', async () => {
    vi.useFakeTimers();
    try {
      global.fetch.mockImplementation((url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }));
      const pending = request('/api/wallet/balance');
      const assertion = expect(pending).rejects.toMatchObject({ status: 504, code: 'GATEWAY' });
      await vi.advanceTimersByTimeAsync(66000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the request body as JSON', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => '{}' });

    await request('/api/wallet/deposit', { method: 'POST', body: { amount: 500 } });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBe(JSON.stringify({ amount: 500 }));
    expect(options.method).toBe('POST');
  });

  it('invokes the unauthorized handler on a 401 from a protected endpoint', async () => {
    setAuthToken('abc123');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    global.fetch.mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":"Unauthorized"}' });

    await expect(request('/api/wallet/balance')).rejects.toBeInstanceOf(ApiError);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not invoke the unauthorized handler on a 401 from the login endpoint', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    global.fetch.mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":"Wrong phone number or password"}' });

    await expect(request('/api/auth/login', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not invoke the unauthorized handler on a 401 from the register endpoint', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    global.fetch.mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":"Unauthorized"}' });

    await expect(request('/api/auth/register', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError);

    expect(handler).not.toHaveBeenCalled();
  });

  describe('silent token refresh', () => {
    const unauthorized = { ok: false, status: 401, text: async () => '{"error":"Unauthorized"}' };
    const refreshed = { ok: true, status: 200, text: async () => '{"token":"new-access","refreshToken":"new-refresh"}' };

    it('refreshes on a 401, retries the request once with the new token, and reports the new tokens', async () => {
      setAuthToken('old-access');
      setRefreshToken('old-refresh');
      const saved = vi.fn();
      setTokensRefreshedHandler(saved);
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      global.fetch
        .mockResolvedValueOnce(unauthorized)
        .mockResolvedValueOnce(refreshed)
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{"balance":5}' });

      const result = await request('/api/wallet/balance');

      expect(result).toEqual({ balance: 5 });
      expect(global.fetch.mock.calls[1][0]).toContain('/api/auth/refresh');
      expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ refreshToken: 'old-refresh' });
      expect(global.fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new-access');
      expect(saved).toHaveBeenCalledWith({ token: 'new-access', refreshToken: 'new-refresh' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('signs the user out when the refresh itself is refused', async () => {
      setAuthToken('old-access');
      setRefreshToken('revoked');
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      global.fetch.mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(unauthorized);

      await expect(request('/api/wallet/balance')).rejects.toBeInstanceOf(ApiError);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not loop when the retried request is still unauthorized', async () => {
      setAuthToken('old-access');
      setRefreshToken('old-refresh');
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      global.fetch.mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(refreshed).mockResolvedValueOnce(unauthorized);

      await expect(request('/api/wallet/balance')).rejects.toBeInstanceOf(ApiError);

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('shares one refresh between requests that fail together', async () => {
      setAuthToken('old-access');
      setRefreshToken('old-refresh');
      global.fetch.mockImplementation(async (url, options) => {
        if (String(url).includes('/api/auth/refresh')) return refreshed;
        return options.headers.Authorization === 'Bearer new-access'
          ? { ok: true, status: 200, text: async () => '{}' }
          : unauthorized;
      });

      await Promise.all([request('/api/wallet/balance'), request('/api/transactions')]);

      const refreshCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes('/api/auth/refresh'));
      expect(refreshCalls).toHaveLength(1);
    });
  });

  it('exposes the error code from the response body', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"That code is not correct.","code":"INVALID_OTP"}',
    });

    await expect(request('/api/transfer', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_OTP',
    });
  });
});
