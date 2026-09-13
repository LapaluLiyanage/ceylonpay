import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, setAuthToken, setUnauthorizedHandler, ApiError } from './client';

describe('request', () => {
  beforeEach(() => {
    setAuthToken(null);
    setUnauthorizedHandler(null);
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
});
