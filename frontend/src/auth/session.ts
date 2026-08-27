const CSRF_COOKIE = "csrf";

let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}
export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return match[1]!;
  }
}

export function clearSession() {
  accessToken = null;
}
