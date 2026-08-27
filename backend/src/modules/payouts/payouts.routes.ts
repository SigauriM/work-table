import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import {
  createOvertimePayoutSchema,
  listPayoutsQuerySchema,
} from "./payouts.schema.js";
import * as payoutsService from "./payouts.service.js";

export const payoutsRouter = Router();

payoutsRouter.use(auth, requireAdmin);

payoutsRouter.get("/employees/:id/overtime-payouts", async (req, res, next) => {
  try {
    const query = listPayoutsQuerySchema.parse(req.query);
    res.json(await payoutsService.listOvertimePayouts(req.params.id, query));
  } catch (err) {
    next(err);
  }
});

payoutsRouter.post("/employees/:id/overtime-payouts", async (req, res, next) => {
  try {
    const body = createOvertimePayoutSchema.parse(req.body);
    res.status(201).json(
      await payoutsService.createOvertimePayout(req.params.id, body, req.user!.userId),
    );
  } catch (err) {
    next(err);
  }
});

payoutsRouter.delete("/employees/:id/overtime-payouts/:payoutId", async (req, res, next) => {
  try {
    await payoutsService.deleteOvertimePayout(
      req.params.id,
      req.params.payoutId,
      req.user!.userId,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
