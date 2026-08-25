import { Router } from "express";
import { Role } from "@prisma/client";
import { auth } from "../../middleware/auth.js";
import { scopeEmployee } from "../../middleware/scopeEmployee.js";
import { HttpError } from "../../middleware/errorHandler.js";
import {
  createSickDaySchema,
  listSickDaysQuerySchema,
} from "./sickdays.schema.js";
import * as sickdaysService from "./sickdays.service.js";

export const sickdaysRouter = Router();

sickdaysRouter.use(auth, scopeEmployee);

sickdaysRouter.get("/", async (req, res, next) => {
  try {
    if (req.user!.role === Role.ADMIN && !req.query.employeeId) {
      throw new HttpError(400, "employeeId is required");
    }
    const query = listSickDaysQuerySchema.parse(req.query);
    res.json(await sickdaysService.listSickDays(query));
  } catch (err) {
    next(err);
  }
});

sickdaysRouter.post("/", async (req, res, next) => {
  try {
    if (req.user!.role === Role.ADMIN && req.body?.employeeId == null) {
      throw new HttpError(400, "employeeId is required");
    }
    const body = createSickDaySchema.parse(req.body);
    res.status(201).json(await sickdaysService.createSickDay(body));
  } catch (err) {
    next(err);
  }
});

sickdaysRouter.delete("/:id", async (req, res, next) => {
  try {
    await sickdaysService.deleteSickDay(req.params.id, req.user!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});