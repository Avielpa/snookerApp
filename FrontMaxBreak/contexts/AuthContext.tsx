// contexts/AuthContext.tsx
// Global auth state. Reads stored tokens on mount.
// All components that need to know if the user is logged in use this context.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login, logout, register, getUser, isLoggedIn, AuthUser } from '../services/authService';

interface AuthContextValue {
  user: AuthUser | null;
  loggedIn: boolean;
  loading: boolean;
  doLogin: (username: string, password: string) => Promise<void>;
  doRegister: (username: string, password: string, email?: string) => Promise<void>;
  doLogout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loggedIn: false,
  loading: true,
  doLogin: async () => {},
  doRegister: async () => {},
  doLogout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const logged = await isLoggedIn();
    if (logged) {
      setUser(await getUser());
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const doLogin = useCallback(async (username: string, password: string) => {
    const u = await login(username, password);
    setUser(u);
  }, []);

  const doRegister = useCallback(async (username: string, password: string, email = '') => {
    await register(username, password, email);
    const u = await login(username, password);
    setUser(u);
  }, []);

  const doLogout = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loggedIn: !!user, loading, doLogin, doRegister, doLogout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
