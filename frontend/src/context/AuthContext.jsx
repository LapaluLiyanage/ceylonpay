import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import { getBalance } from '../api/wallet';
import { setAuthToken, ApiError } from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'ceylonpay_token';
const USER_KEY = 'ceylonpay_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [isReady, setIsReady] = useState(false);

  const persistSession = useCallback((newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (!existingToken) {
      setIsReady(true);
      return;
    }
    setAuthToken(existingToken);
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
    const data = await apiLogin({ phone, password });
    persistSession(data.token, { id: data.userId, name: data.name, phone });
    return data;
  }

  async function register({ name, phone, nic, password }) {
    const data = await apiRegister({ name, phone, nic, password });
    persistSession(data.token, { id: data.userId, name: data.name, phone });
    return data;
  }

  function logout() {
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
