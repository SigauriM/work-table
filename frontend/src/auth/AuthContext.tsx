import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { apiFetch, ApiError, refreshSession } from "../api/client";
import {
  clearSession,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./session";
import type { AuthResponse, PublicUser } from "../types/api";

type AuthContextValue = {
  user: PublicUser | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Один restore на загрузку страницы (StrictMode remount ждёт тот же Promise) */
let restoreInFlight: Promise<PublicUser | null> | null = null;

function restoreSession(): Promise<PublicUser | null> {
  if (restoreInFlight) return restoreInFlight;

  restoreInFlight = (async () => {
    if (!getRefreshToken()) return null;
    const data = await refreshSession();
    return data?.user ?? null;
  })();

  return restoreInFlight;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (!getRefreshToken()) {
          if (!cancelled) setReady(true);
          return;
        }
        const me = await restoreSession();
        if (cancelled) return;
        setUser(me);
      } catch {
        if (cancelled) return;
        clearSession();
        setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void import("../pwa").then((mod) => mod.registerPwa());
  }, [ready]);

  const login = useCallback(async (loginName: string, password: string) => {
    const data = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: { login: loginName, password },
      skipAuth: true,
    });
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await apiFetch("/api/auth/logout", {
          method: "POST",
          body: { refreshToken },
          skipAuth: true,
        });
      }
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    } finally {
      restoreInFlight = null;
      clearSession();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
