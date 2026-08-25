import { Router } from "express";
import { Role } from "@prisma/client";
import { auth } from "../../middleware/auth.js";
import { scopeEmployee } from "../../middleware/scopeEmployee.js";
import { HttpError } from "../../middleware/errorHandler.js";
import {
  createShiftSchema,
  listShiftsQuerySchema,
  updateShiftSchema,
} from "./shifts.schema.js";
import * as shiftsService from "./shifts.service.js";

export const shiftsRouter = Router();

shiftsRouter.use(auth, scopeEmployee);

shiftsRouter.get("/", async (req, res, next) => {
  try {
    if (req.user!.role === Role.ADMIN && !req.query.employeeId) {
      throw new HttpError(400, "employeeId is required");
    }
    const query = listShiftsQuerySchema.parse(req.query);
    res.json(await shiftsService.listShifts(query));
  } catch (err) {
    next(err);
  }
});

shiftsRouter.post("/", async (req, res, next) => {
  try {
    if (req.user!.role === Role.ADMIN && req.body?.employeeId == null) {
      throw new HttpError(400, "employeeId is required");
    }
    const body = createShiftSchema.parse(req.body);
    res.status(201).json(await shiftsService.createShift(body));
  } catch (err) {
    next(err);
  }
});

shiftsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateShiftSchema.parse(req.body);
    res.json(await shiftsService.updateShift(req.params.id, body, req.user!));
  } catch (err) {
    next(err);
  }
});

shiftsRouter.delete("/:id", async (req, res, next) => {
  try {
    await shiftsService.deleteShift(req.params.id, req.user!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});