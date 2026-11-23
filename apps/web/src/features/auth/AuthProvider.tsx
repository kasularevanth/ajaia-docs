import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { AuthResponse, UserRef } from '@ajaia/shared';
import { api, isApiError, onUnauthorized, tokenStore } from '../../lib/api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: UserRef | null;
  login: (email: string, password: string) => Promise<UserRef>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserRef | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (tokenStore.get() ? 'loading' : 'anonymous'));

  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    setUser(null);
    setStatus('anonymous');
  }, [queryClient]);

  // Rehydrate the session on boot. Only a real 401 ends the session — a sleeping/restarting
  // server (network error or 5xx) is retried, so a free-tier cold start never signs people out.
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    let timer: number | undefined;
    const attempt = (n: number) => {
      api<{ user: UserRef }>('/api/auth/me')
        .then(({ user }) => {
          if (cancelled) return;
          setUser(user);
          setStatus('authenticated');
        })
        .catch((err) => {
          if (cancelled) return;
          if (isApiError(err) && err.status === 401) return logout();
          if (n >= 20) return logout();
          timer = window.setTimeout(() => attempt(n + 1), Math.min(1000 * 2 ** n, 5000));
        });
    };
    attempt(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [logout]);

  // Any 401 from the API (expired / invalid token) signs the user out.
  useEffect(() => {
    onUnauthorized(() => {
      if (!tokenStore.get()) return;
      logout();
      toast.info('Your session ended. Sign in again to continue.');
    });
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } });
      queryClient.clear();
      tokenStore.set(res.token);
      setUser(res.user);
      setStatus('authenticated');
      return res.user;
    },
    [queryClient],
  );

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For components rendered behind <RequireAuth>, where a user is guaranteed. */
export function useCurrentUser(): UserRef {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser called without an authenticated user');
  return user;
}
