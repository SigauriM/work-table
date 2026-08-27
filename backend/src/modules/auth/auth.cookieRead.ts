import type { Request } from "express";

export const REFRESH_COOKIE = "refresh";
export const CSRF_COOKIE = "csrf";
export const CSRF_HEADER = "X-CSRF-Token";

export function readRefreshCookie(req: Request): string | undefined {
  const fromParser = req.cookies?.[REFRESH_COOKIE];
  if (typeof fromParser === "string" && fromParser.length > 0) {
    return fromParser;
  }
  const header = req.headers.cookie;
  if (typeof header !== "string") return undefined;
  const match = new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]*)`).exec(header);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return match[1];
  }
}
