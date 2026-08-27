import type { RequestHandler } from "express";
import { HttpError } from "../../middleware/errorHandler.js";
import { CSRF_COOKIE, CSRF_HEADER } from "./auth.cookieRead.js";

export const requireCsrf: RequestHandler = (req, _res, next) => {
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);
  if (typeof cookie !== "string" || cookie.length === 0 || header !== cookie) {
    next(new HttpError(403, "Forbidden"));
    return;
  }
  next();
};
