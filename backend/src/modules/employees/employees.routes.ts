import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import {
  createEmployeeSchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
} from "./employees.schema.js";
import * as employeesService from "./employees.service.js";

export const employeesRouter = Router();

employeesRouter.use(auth, requireAdmin);

employeesRouter.get("/", async (req, res, next) => {
  try {
    const query = listEmployeesQuerySchema.parse(req.query);
    res.json(await employeesService.listEmployees(query.isActive));
  } catch (err) {
    next(err);
  }
});

employeesRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await employeesService.getEmployee(req.params.id));
  } catch (err) {
    next(err);
  }
});

employeesRouter.post("/", async (req, res, next) => {
  try {
    const body = createEmployeeSchema.parse(req.body);
    res.status(201).json(await employeesService.createEmployee(body));
  } catch (err) {
    next(err);
  }
});

employeesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateEmployeeSchema.parse(req.body);
    res.json(await employeesService.updateEmployee(req.params.id, body, req.user!.userId));
  } catch (err) {
    next(err);
  }
});

employeesRouter.delete("/:id", async (req, res, next) => {
  try {
    res.json(await employeesService.deactivateEmployee(req.params.id, req.user!.userId));
  } catch (err) {
    next(err);
  }
});