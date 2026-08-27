import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { PayType, Role } from "@prisma/client";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { instantFromBerlin, ymdToDateColumn } from "../../src/core/berlin.js";
import { truncateAppTables } from "./harness.js";

const ADMIN_LOGIN = "perf-admin";
const ADMIN_PASSWORD = "perf-admin-pass";
const N = 200;
const SAMPLES = 20;

function auth(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function p95(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

describe("overview p95 (200 employees, no MonthlyStats cache)", () => {
  beforeAll(async () => {
    await truncateAppTables();

    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 4);
    const empHash = await bcrypt.hash("perf-emp-pass12", 4);

    await prisma.user.create({
      data: {
        login: ADMIN_LOGIN,
        passwordHash: adminHash,
        role: Role.ADMIN,
      },
    });

    const hiredAt = ymdToDateColumn("2026-01-15");
    const validFrom = hiredAt;
    const shiftDate = ymdToDateColumn("2026-03-02");
    const start = instantFromBerlin("2026-03-02", "09:00");
    const end = instantFromBerlin("2026-03-02", "17:00");

    for (let i = 0; i < N; i += 25) {
      const chunk = Math.min(25, N - i);
      const users = await Promise.all(
        Array.from({ length: chunk }, (_, j) => {
          const n = i + j;
          return prisma.user.create({
            data: {
              login: `perf${String(n).padStart(3, "0")}`,
              passwordHash: empHash,
              role: Role.EMPLOYEE,
            },
          });
        }),
      );
      const employees = await Promise.all(
        users.map((user, j) =>
          prisma.employee.create({
            data: {
              userId: user.id,
              firstName: "Perf",
              lastName: `E${String(i + j).padStart(3, "0")}`,
              daysPerWeek: 5,
              hiredAt,
            },
          }),
        ),
      );
      await prisma.employeeTerms.createMany({
        data: employees.map((emp) => ({
          employeeId: emp.id,
          payType: PayType.HOURLY,
          hourlyRate: 10,
          hoursPerDay: 8,
          validFrom,
        })),
      });
      await prisma.shift.createMany({
        data: employees.map((emp) => ({
          employeeId: emp.id,
          date: shiftDate,
          startTime: start,
          endTime: end,
          workedMinutes: 480,
        })),
      });
    }
  }, 120_000);

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.overtimePayout.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.sickDay.deleteMany();
    await prisma.employeeTerms.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.user.deleteMany();
  });

  it("p95 of GET /stats/overview stays under 200ms without a cache table", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.accessToken as string;

    for (let i = 0; i < 2; i++) {
      const warm = await request(app)
        .get("/api/v1/stats/overview")
        .query({ year: 2026, month: 3 })
        .set(auth(token));
      expect(warm.status).toBe(200);
      expect(warm.body).toHaveLength(N);
    }

    const times: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t0 = performance.now();
      const res = await request(app)
        .get("/api/v1/stats/overview")
        .query({ year: 2026, month: 3 })
        .set(auth(token));
      times.push(performance.now() - t0);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(N);
    }

    const p = p95(times);
    const min = Math.min(...times);
    const max = Math.max(...times);
    process.stderr.write(
      `overview p95=${p.toFixed(1)}ms min=${min.toFixed(1)}ms max=${max.toFixed(1)}ms n=${N} samples=${SAMPLES} (no MonthlyStats)\n`,
    );
    expect(p).toBeLessThan(200);
  }, 120_000);
});
