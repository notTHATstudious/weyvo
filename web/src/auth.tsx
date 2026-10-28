import { createContext, useContext, useState, type ReactNode } from 'react';

// Pretend sign-in for the frontend milestone. Replaced by the Spring Boot auth API in milestone 2.
// The real 60% gate is enforced on the server; this only drives the UI.

interface Auth { signedIn: boolean; signIn: () => void; signOut: () => void }

const AuthContext = createContext<Auth>({ signedIn: false, signIn: () => {}, signOut: () => {} });

function read(): boolean {
  try {
    return localStorage.getItem('demo-signed-in') === '1';
  } catch {
    return false;
  }
}

function write(v: boolean) {
  try {
    localStorage.setItem('demo-signed-in', v ? '1' : '0');
  } catch {
    // storage unavailable: sign-in lasts for this visit only
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(read);
  const set = (v: boolean) => { write(v); setSignedIn(v); };
  return <AuthContext.Provider value={{ signedIn, signIn: () => set(true), signOut: () => set(false) }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
