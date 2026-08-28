import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { listAuditQuerySchema } from "./audit.schema.js";
import * as auditService from "./audit.service.js";

export const auditRouter = Router();

auditRouter.use(auth, requireAdmin);

auditRouter.get("/", async (req, res, next) => {
  try {
    const query = listAuditQuerySchema.parse(req.query);
    res.json(await auditService.listAudit(query));
  } catch (err) {
    next(err);
  }
});
