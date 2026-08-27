import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import {
  ADMIN_LOGIN,
  ADMIN_PASSWORD,
  EMP_PASSWORD,
  auth,
  createEmployee,
  dayShift,
  login,
  resetDb,
} from "./harness.js";
import {
  attachPrismaQueryCounter,
  getPrismaQueryCount,
  resetPrismaQueryCount,
} from "./queryCount.js";

describe("overview batch and shift cursor", () => {
  beforeAll(() => {
    attachPrismaQueryCounter();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("overview matches per-employee stats and does not N+1", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "ovwa");
    const empB = await createEmployee(admin.accessToken, "ovwb");
    const a = await login("ovwa", EMP_PASSWORD);
    const b = await login("ovwb", EMP_PASSWORD);

    const shiftA = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(shiftA.status).toBe(201);
    const shiftB = await request(app)
      .post("/api/v1/shifts")
      .set(auth(b.accessToken))
      .send({ employeeId: empB.id, ...dayShift("2026-03-03", "09:00", "13:00") });
    expect(shiftB.status).toBe(201);

    const statsA = await request(app)
      .get(`/api/v1/employees/${empA.id}/stats`)
      .query({ year: 2026, month: 3 })
      .set(auth(admin.accessToken));
    const statsB = await request(app)
      .get(`/api/v1/employees/${empB.id}/stats`)
      .query({ year: 2026, month: 3 })
      .set(auth(admin.accessToken));
    expect(statsA.status).toBe(200);
    expect(statsB.status).toBe(200);

    resetPrismaQueryCount();
    const overview = await request(app)
      .get("/api/v1/stats/overview")
      .query({ year: 2026, month: 3 })
      .set(auth(admin.accessToken));
    expect(overview.status).toBe(200);
    expect(getPrismaQueryCount()).toBeLessThanOrEqual(8);

    const rows = overview.body as {
      employeeId: string;
      workedHours: string;
      balance: string;
      monthlyPay: string;
    }[];
    expect(rows).toHaveLength(2);
    const rowA = rows.find((r) => r.employeeId === empA.id)!;
    const rowB = rows.find((r) => r.employeeId === empB.id)!;
    expect(rowA.workedHours).toBe(statsA.body.workedHours);
    expect(rowA.balance).toBe(statsA.body.balance);
    expect(rowA.monthlyPay).toBe(statsA.body.monthlyPay);
    expect(rowB.workedHours).toBe(statsB.body.workedHours);
    expect(rowB.balance).toBe(statsB.body.balance);
    expect(rowB.monthlyPay).toBe(statsB.body.monthlyPay);
  });

  it("unbounded listShifts is cursor-paged with a take cap", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "pagea");
    const a = await login("pagea", EMP_PASSWORD);

    for (const day of ["2026-03-02", "2026-03-03", "2026-03-04"]) {
      const created = await request(app)
        .post("/api/v1/shifts")
        .set(auth(a.accessToken))
        .send({ employeeId: empA.id, ...dayShift(day, "09:00", "17:00") });
      expect(created.status).toBe(201);
    }

    const first = await request(app)
      .get("/api/v1/shifts")
      .query({ employeeId: empA.id, take: 2 })
      .set(auth(admin.accessToken));
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await request(app)
      .get("/api/v1/shifts")
      .query({ employeeId: empA.id, take: 2, cursor: first.body.nextCursor })
      .set(auth(admin.accessToken));
    expect(second.status).toBe(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();

    const ids = [
      ...first.body.items.map((s: { id: string }) => s.id),
      ...second.body.items.map((s: { id: string }) => s.id),
    ];
    expect(new Set(ids).size).toBe(3);

    const monthList = await request(app)
      .get("/api/v1/shifts")
      .query({ employeeId: empA.id, year: 2026, month: 3 })
      .set(auth(admin.accessToken));
    expect(monthList.status).toBe(200);
    expect(Array.isArray(monthList.body)).toBe(true);
    expect(monthList.body).toHaveLength(3);
  });
});
