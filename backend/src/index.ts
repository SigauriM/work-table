import { statsRouter } from "./modules/stats/stats.routes.js";
import { shiftsRouter } from "./modules/shifts/shifts.routes.js";
import { sickdaysRouter } from "./modules/sickdays/sickdays.routes.js";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { employeesRouter } from "./modules/employees/employees.routes.js";

const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});

app.use("/auth", authRouter);
app.use("/employees", employeesRouter);
app.use("/shifts", shiftsRouter);
app.use("/sick-days", sickdaysRouter);
app.use(statsRouter);
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);

app.listen(env.port, "0.0.0.0", () => {
  console.log(`API listening on ${env.port}`);
});