import React, { createContext, useCallback, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import type { RegisterPayload, Role, User } from '../types';

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function decodeTokenRole(token: string): Role | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role as Role;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem('access_token');
    if (stored && !isTokenExpired(stored)) return stored;
    localStorage.removeItem('access_token');
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Prefer role from fetched user object; fall back to decoded token (for initial render before /me returns)
  const role: Role | null = user?.role ?? (token ? decodeTokenRole(token) : null);

  const fetchMe = useCallback(async (_t: string) => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      localStorage.removeItem('access_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setIsLoading(false);
    }
  }, [token, fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const { access_token } = response;
    localStorage.setItem('access_token', access_token);
    setToken(access_token);
    const me = await authApi.me();
    setUser(me);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
    // After registration, log the user in
    await login(payload.email, payload.password);
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
