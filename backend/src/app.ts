import { payoutsRouter } from "./modules/payouts/payouts.routes.js";
import { statsRouter } from "./modules/stats/stats.routes.js";
import { shiftsRouter } from "./modules/shifts/shifts.routes.js";
import { sickdaysRouter } from "./modules/sickdays/sickdays.routes.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { auditRouter } from "./modules/audit/audit.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { employeesRouter } from "./modules/employees/employees.routes.js";

export const app = express();
if (process.env.NODE_ENV !== "test") {
  app.use(helmet({ contentSecurityPolicy: false }));
}
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});

const apiV1 = express.Router();
apiV1.use("/auth", authRouter);
apiV1.use("/audit", auditRouter);
apiV1.use("/employees", employeesRouter);
apiV1.use("/shifts", shiftsRouter);
apiV1.use("/sick-days", sickdaysRouter);
apiV1.use(statsRouter);
apiV1.use(payoutsRouter);
app.use("/api/v1", apiV1);
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);
