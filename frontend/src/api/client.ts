import { clearSession, getAccessToken, getCsrfToken, setAccessToken } from "../auth/session";
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

/** One POST /api/v1/auth/refresh for everyone; parallel callers wait on the same Promise.
 * Refresh lives in an httpOnly cookie, not JS — F5 and PWA autoUpdate do not keep
 * a stale string in localStorage. */
export function refreshSession(): Promise<AuthResponse | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const csrf = getCsrfToken();
    if (!csrf) return null;

    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrf },
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const data = (await res.json()) as AuthResponse;
    setAccessToken(data.accessToken);
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
  csrf?: boolean;
};

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, skipAuth, _retried, csrf, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (csrf) {
    const token = getCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }

  if (!skipAuth) {
    const access = getAccessToken();
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }

  const res = await fetch(path.startsWith("/api") ? path : `/api/v1${path}`, {
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
