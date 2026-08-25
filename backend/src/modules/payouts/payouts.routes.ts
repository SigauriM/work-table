import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import {
  createOvertimePayoutSchema,
  createSalaryPayoutSchema,
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
    res.status(201).json(await payoutsService.createOvertimePayout(req.params.id, body));
  } catch (err) {
    next(err);
  }
});

payoutsRouter.delete("/employees/:id/overtime-payouts/:payoutId", async (req, res, next) => {
  try {
    await payoutsService.deleteOvertimePayout(req.params.id, req.params.payoutId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

payoutsRouter.get("/employees/:id/salary-payouts", async (req, res, next) => {
  try {
    const query = listPayoutsQuerySchema.parse(req.query);
    res.json(await payoutsService.listSalaryPayouts(req.params.id, query));
  } catch (err) {
    next(err);
  }
});

payoutsRouter.post("/employees/:id/salary-payouts", async (req, res, next) => {
  try {
    const body = createSalaryPayoutSchema.parse(req.body);
    res.status(201).json(await payoutsService.createSalaryPayout(req.params.id, body));
  } catch (err) {
    next(err);
  }
});

payoutsRouter.delete("/employees/:id/salary-payouts/:payoutId", async (req, res, next) => {
  try {
    await payoutsService.deleteSalaryPayout(req.params.id, req.params.payoutId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
