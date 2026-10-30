import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, type Me } from './api';
import { clearApiCache } from './useApi';

interface Auth {
  user: Me | null;
  /** True until the first /me check finishes. */
  loading: boolean;
  signedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (b: { email: string; password: string; username: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  /** Re-reads the signed-in user, e.g. after editing the profile. Signs out locally if the session is gone. */
  refresh: () => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

const ME = 'weyvo-me';

function remembered(): Me | null {
  try {
    return JSON.parse(localStorage.getItem(ME) ?? 'null') as Me | null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start from the account last seen on this device, so the app is usable while the server wakes up;
  // the real check below confirms or corrects it.
  const [user, setUserState] = useState<Me | null>(remembered);
  const [loading, setLoading] = useState(() => remembered() === null);
  const setUser = useCallback((u: Me | null) => {
    setUserState(u);
    try {
      if (u) localStorage.setItem(ME, JSON.stringify(u));
      else localStorage.removeItem(ME);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    api.me().then(setUser, (err) => {
      // Signed out for real only when the server says so; a slow or sleeping server keeps the remembered account.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) setUser(null);
    }).finally(() => setLoading(false));
  }, [setUser]);

  const login = useCallback(async (email: string, password: string) => setUser(await api.login({ email, password })), []);
  const signup = useCallback(async (b: Parameters<Auth['signup']>[0]) => setUser(await api.signup(b)), []);
  const logout = useCallback(async () => {
    await api.logout();
    clearApiCache();
    setUser(null);
  }, []);
  // Cached pages belong to whoever was signed in; a different account starts fresh.
  const owner = useRef(user?.id);
  useEffect(() => {
    if (owner.current !== user?.id) clearApiCache();
    owner.current = user?.id;
  }, [user?.id]);
  const verifyEmail = useCallback(async (code: string) => setUser(await api.verifyEmail(code)), []);
  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      setUser(null);
    }
  }, []);
  const resetPassword = useCallback(async (email: string, code: string, password: string) => setUser(await api.resetPassword(email, code, password)), []);

  return (
    <AuthContext.Provider value={{ user, loading, signedIn: user !== null, login, signup, logout, verifyEmail, resetPassword, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
