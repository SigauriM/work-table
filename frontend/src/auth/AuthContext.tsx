import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
  } from "react";
  import { apiFetch, ApiError } from "../api/client";
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
  
  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<PublicUser | null>(null);
    const [ready, setReady] = useState(false);
  
    const restore = useCallback(async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setReady(true);
        return;
      }
      try {
        const data = await apiFetch<AuthResponse>("/api/auth/refresh", {
          method: "POST",
          body: { refreshToken },
          skipAuth: true,
        });
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        const me = await apiFetch<PublicUser>("/api/auth/me");
        setUser(me);
      } catch {
        clearSession();
        setUser(null);
      } finally {
        setReady(true);
      }
    }, []);
  
    useEffect(() => {
      void restore();
    }, [restore]);
  
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