import type { NextFunction, Request, RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { readRefreshCookie } from "./auth.cookieRead.js";

const TOO_MANY = "Too many requests";

const rateLimitOn =
  process.env.NODE_ENV !== "test";

export function peekRefreshTokenId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null;
  return raw.slice(0, dot);
}

export function loginAttemptKey(req: Request): string {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const login =
    req.body && typeof req.body === "object" && typeof (req.body as { login?: unknown }).login === "string"
      ? (req.body as { login: string }).login.trim().toLowerCase()
      : "";
  return `login:${ip}:${login}`;
}

function tooMany(_req: Request, res: Response, _next: NextFunction) {
  res.status(429).json({ error: TOO_MANY });
}

const validateOff = {
  xForwardedForHeader: false,
  keyGeneratorIpFallback: false,
} as const;

export function createLoginRateLimiter(enabled: boolean): RequestHandler {
  if (!enabled) {
    return (_req, _res, next) => next();
  }
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: loginAttemptKey,
    handler: tooMany,
    legacyHeaders: false,
    standardHeaders: false,
    validate: validateOff,
  });
}

export function createRefreshRateLimiters(enabled: boolean): RequestHandler[] {
  if (!enabled) {
    return [(_req, _res, next) => next()];
  }
  const byId = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    skip: (req) => peekRefreshTokenId(readRefreshCookie(req)) == null,
    keyGenerator: (req) => `refresh-id:${peekRefreshTokenId(readRefreshCookie(req))!}`,
    handler: tooMany,
    legacyHeaders: false,
    standardHeaders: false,
    validate: validateOff,
  });
  const junkByIp = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    skip: (req) => peekRefreshTokenId(readRefreshCookie(req)) != null,
    keyGenerator: (req) => `refresh-junk:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`,
    handler: tooMany,
    legacyHeaders: false,
    standardHeaders: false,
    validate: validateOff,
  });
  return [byId, junkByIp];
}

export const loginRateLimiter = createLoginRateLimiter(rateLimitOn);
export const refreshRateLimiters = createRefreshRateLimiters(rateLimitOn);
