import type { CookieOptions, Response } from "express";
import { randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { CSRF_COOKIE, REFRESH_COOKIE } from "./auth.cookieRead.js";

export {
  CSRF_COOKIE,
  CSRF_HEADER,
  REFRESH_COOKIE,
  readRefreshCookie,
} from "./auth.cookieRead.js";

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    path: "/api/v1/auth",
    secure: env.cookieSecure,
    maxAge: env.jwtRefreshDays * 24 * 60 * 60 * 1000,
  };
}

export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    sameSite: "strict",
    path: "/",
    secure: env.cookieSecure,
    maxAge: env.jwtRefreshDays * 24 * 60 * 60 * 1000,
  };
}

export function newCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function setAuthCookies(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.cookie(CSRF_COOKIE, newCsrfToken(), csrfCookieOptions());
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    path: "/api/v1/auth",
    secure: env.cookieSecure,
  });
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: false,
    sameSite: "strict",
    path: "/",
    secure: env.cookieSecure,
  });
}
