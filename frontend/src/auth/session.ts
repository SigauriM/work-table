const REFRESH_KEY = "worktable_refresh";

let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}
export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}
export function setRefreshToken(token: string | null) {
  if (token == null) localStorage.removeItem(REFRESH_KEY);
  else localStorage.setItem(REFRESH_KEY, token);
}

export function clearSession() {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}