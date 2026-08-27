import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { apiFetch, ApiError, refreshSession } from "../api/client";
import { clearSession, getCsrfToken, setAccessToken } from "./session";
import type { AuthResponse, PublicUser } from "../types/api";
import { AuthContext } from "./auth-context";

/** One restore on page load (StrictMode remount waits on the same Promise) */
let restoreInFlight: Promise<PublicUser | null> | null = null;

function restoreSession(): Promise<PublicUser | null> {
  if (restoreInFlight) return restoreInFlight;

  restoreInFlight = (async () => {
    if (!getCsrfToken()) return null;
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
        if (!getCsrfToken()) {
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
    const data = await apiFetch<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: { login: loginName, password },
      skipAuth: true,
      credentials: "include",
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getCsrfToken()) {
        await apiFetch("/api/v1/auth/logout", {
          method: "POST",
          skipAuth: true,
          credentials: "include",
          csrf: true,
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

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const data = await apiFetch<{ user: PublicUser }>("/api/v1/auth/password", {
      method: "PATCH",
      body: { currentPassword, newPassword },
      credentials: "include",
    });
    setUser(data.user);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout, changePassword }),
    [user, ready, login, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
