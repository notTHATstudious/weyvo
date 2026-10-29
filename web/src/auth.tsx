import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Me } from './api';

interface Auth {
  user: Me | null;
  /** True until the first /me check finishes. */
  loading: boolean;
  signedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (b: { email: string; password: string; username: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then(setUser, () => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => setUser(await api.login({ email, password })), []);
  const signup = useCallback(async (b: Parameters<Auth['signup']>[0]) => setUser(await api.signup(b)), []);
  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);
  const verifyEmail = useCallback(async (code: string) => setUser(await api.verifyEmail(code)), []);
  const resetPassword = useCallback(async (email: string, code: string, password: string) => setUser(await api.resetPassword(email, code, password)), []);

  return (
    <AuthContext.Provider value={{ user, loading, signedIn: user !== null, login, signup, logout, verifyEmail, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
