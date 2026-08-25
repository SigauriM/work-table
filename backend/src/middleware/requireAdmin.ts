import type { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { HttpError } from "./errorHandler.js";

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== Role.ADMIN) {
    next(new HttpError(403, "Forbidden"));
    return;
  }
  next();
};