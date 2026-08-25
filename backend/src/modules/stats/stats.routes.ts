import { Router } from "express";
import { Role } from "@prisma/client";
import { auth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { statsQuerySchema } from "./stats.schema.js";
import * as statsService from "./stats.service.js";

export const statsRouter = Router();

statsRouter.get(
  "/employees/:id/stats",
  auth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const query = statsQuerySchema.parse(req.query);
      res.json(
        await statsService.getEmployeeStats(req.params.id, query.year, query.month),
      );
    } catch (err) {
      next(err);
    }
  },
);

statsRouter.get("/stats/overview", auth, requireAdmin, async (req, res, next) => {
  try {
    const query = statsQuerySchema.parse(req.query);
    res.json(await statsService.getStatsOverview(query.year, query.month));
  } catch (err) {
    next(err);
  }
});

statsRouter.get("/me/stats", auth, async (req, res, next) => {
  try {
    if (req.user!.role !== Role.EMPLOYEE || !req.user!.employeeId) {
      throw new HttpError(403, "Forbidden");
    }
    const query = statsQuerySchema.parse(req.query);
    res.json(
      await statsService.getEmployeeStats(
        req.user!.employeeId,
        query.year,
        query.month,
      ),
    );
  } catch (err) {
    next(err);
  }
});