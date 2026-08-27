import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { loginSchema, changePasswordSchema } from "./auth.schema.js";
import { loginRateLimiter, peekRefreshTokenId, refreshRateLimiters } from "./auth.rateLimit.js";
import { clearAuthCookies, readRefreshCookie, setAuthCookies } from "./auth.cookies.js";
import { requireCsrf } from "./auth.csrf.js";
import * as authService from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/login", loginRateLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body.login, body.password);
    setAuthCookies(res, result.refreshToken);
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    next(err);
  }
});

// Does not rotate: new access + same refresh cookie. See auth.service refresh() and LIMITATIONS.md.
authRouter.post("/refresh", ...refreshRateLimiters, requireCsrf, async (req, res, next) => {
  try {
    const raw = readRefreshCookie(req);
    if (!raw) {
      throw new HttpError(401, "Invalid credentials");
    }
    const result = await authService.refresh(raw);
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", requireCsrf, async (req, res, next) => {
  try {
    const raw = readRefreshCookie(req);
    if (raw) {
      try {
        await authService.logout(raw);
      } catch (err) {
        if (!(err instanceof HttpError && err.status === 401)) throw err;
      }
    }
    clearAuthCookies(res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", auth, async (req, res, next) => {
  try {
    res.json(await authService.getMe(req.user!.userId));
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/password", auth, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const keepRefreshId = peekRefreshTokenId(readRefreshCookie(req));
    const user = await authService.changePassword(
      req.user!.userId,
      body.currentPassword,
      body.newPassword,
      keepRefreshId,
    );
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
