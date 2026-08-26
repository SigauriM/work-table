import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "../auth/session";
import type { AuthResponse } from "../types/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: string };
    return new ApiError(res.status, body.error ?? res.statusText);
  } catch {
    return new ApiError(res.status, res.statusText);
  }
}

let refreshInFlight: Promise<AuthResponse | null> | null = null;

/** Один POST /auth/refresh на всех; параллельные вызовы ждут тот же Promise.
 * Нужен и для PWA: старый и новый бандл не должны параллельно гасить refresh,
 * если ротацию когда-нибудь вернут (сейчас бэк отдаёт тот же refresh). */
export function refreshSession(): Promise<AuthResponse | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Второй запрос после ротации: не трогать уже записанный новый refresh.
      if (getRefreshToken() === refreshToken) {
        clearSession();
      }
      return null;
    }

    const data = (await res.json()) as AuthResponse;
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
  _retried?: boolean;
};

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, skipAuth, _retried, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const access = getAccessToken();
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }

  const res = await fetch(path.startsWith("/api") ? path : `/api${path}`, {
    ...rest,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && !skipAuth && !_retried) {
    const data = await refreshSession();
    if (data) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as T;
}
