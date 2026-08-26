import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
} from "./auth.schema.js";
import * as authService from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    res.json(await authService.login(body.login, body.password));
  } catch (err) {
    next(err);
  }
});

// Does not rotate: new access + same refresh. See auth.service refresh() and LIMITATIONS.md.
authRouter.post("/refresh", async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    res.json(await authService.refresh(body.refreshToken));
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const body = logoutSchema.parse(req.body);
    await authService.logout(body.refreshToken);
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
