import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";
import { HttpError } from "./errorHandler.js";

type AccessClaims = {
  sub: string;
  role: Role;
  employeeId: string | null;
};

export const auth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new HttpError(401, "Unauthorized"));
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AccessClaims;
    req.user = {
      userId: payload.sub,
      role: payload.role,
      employeeId: payload.employeeId,
    };
    next();
  } catch {
    next(new HttpError(401, "Unauthorized"));
  }
};