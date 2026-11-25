import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/auth';
import { getBalance } from '../api/wallet';
import { setAuthToken, setRefreshToken, setUnauthorizedHandler, setTokensRefreshedHandler, ApiError } from '../api/client';
import { toApiPhone } from '../utils/phone';

const AuthContext = createContext(null);

const TOKEN_KEY = 'ceylonpay_token';
const USER_KEY = 'ceylonpay_user';
const REFRESH_KEY = 'ceylonpay_refresh';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  const [isReady, setIsReady] = useState(false);

  const persistSession = useCallback((newToken, newUser, newRefreshToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    if (newRefreshToken) localStorage.setItem(REFRESH_KEY, newRefreshToken);
    setAuthToken(newToken);
    setRefreshToken(newRefreshToken || null);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setAuthToken(null);
    setRefreshToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    // A silent refresh hands us a new pair; keep storage and state in step with it.
    setTokensRefreshedHandler(({ token: newToken, refreshToken: newRefresh }) => {
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(REFRESH_KEY, newRefresh);
      setToken(newToken);
    });
  }, [clearSession]);

  useEffect(() => {
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (!existingToken) {
      setIsReady(true);
      return;
    }
    setAuthToken(existingToken);
    setRefreshToken(localStorage.getItem(REFRESH_KEY));
    getBalance()
      .then(() => setIsReady(true))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
        }
        setIsReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login({ phone, password }) {
    const data = await apiLogin({ phone: toApiPhone(phone), password });
    persistSession(data.token, { id: data.userId, name: data.name, phone, role: data.role }, data.refreshToken);
    return data;
  }

  async function register({ name, phone, nic, password }) {
    const data = await apiRegister({ name, phone: toApiPhone(phone), nic, password });
    persistSession(data.token, { id: data.userId, name: data.name, phone, role: data.role }, data.refreshToken);
    return data;
  }

  function logout() {
    // End the session on the server too; the local sign-out must not wait on (or fail because of) the network.
    const existingRefresh = localStorage.getItem(REFRESH_KEY);
    if (existingRefresh) apiLogout(existingRefresh).catch(() => {});
    clearSession();
  }

  return (
    <AuthContext.Provider value={{ token, user, isReady, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
