import type { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { HttpError } from "./errorHandler.js";

export const scopeEmployee: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== Role.EMPLOYEE) {
    next();
    return;
  }
  const employeeId = req.user.employeeId;
  if (!employeeId) {
    next(new HttpError(403, "Forbidden"));
    return;
  }
  req.query.employeeId = employeeId;
  if (req.body && typeof req.body === "object") {
    req.body.employeeId = employeeId;
  }
  next();
};