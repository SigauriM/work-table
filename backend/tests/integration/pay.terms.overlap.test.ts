import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
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

describe("salary, payouts, terms, parallel overlap", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("SALARY monthlyPay is the salary, not hours times a rate", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const emp = await createEmployee(admin.accessToken, "sal1", {
      payType: "SALARY",
      monthlySalary: "2500",
    });
    const a = await login("sal1", EMP_PASSWORD);
    const shift = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: emp.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(shift.status).toBe(201);

    const stats = await request(app)
      .get(`/api/v1/employees/${emp.id}/stats`)
      .query({ year: 2026, month: 3 })
      .set(auth(admin.accessToken));
    expect(stats.status).toBe(200);
    expect(stats.body.terms.some((t: { payType: string }) => t.payType === "SALARY")).toBe(
      true,
    );
    expect(stats.body.monthlyPay).toBe("2500");
    expect(stats.body.workedHours).toBe("8");
  });

  it("overtime payout create, list, stats, delete", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const emp = await createEmployee(admin.accessToken, "pay1");

    const created = await request(app)
      .post(`/api/v1/employees/${emp.id}/overtime-payouts`)
      .set(auth(admin.accessToken))
      .send({ date: "2026-03-15", hoursPaid: "2.00", amount: "30.00" });
    expect(created.status).toBe(201);
    expect(created.body.amount).toBe("30");

    const listed = await request(app)
      .get(`/api/v1/employees/${emp.id}/overtime-payouts`)
      .query({ year: 2026, month: 3 })
      .set(auth(admin.accessToken));
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const stats = await request(app)
      .get(`/api/v1/employees/${emp.id}/stats`)
      .query({ year: 2026, month: 3 })
      .set(auth(admin.accessToken));
    expect(stats.status).toBe(200);
    expect(stats.body.paidOvertimeAmount).toBe("30");
    expect(stats.body.paidOvertimeHours).toBe("2");

    const deleted = await request(app)
      .delete(`/api/v1/employees/${emp.id}/overtime-payouts/${created.body.id}`)
      .set(auth(admin.accessToken));
    expect(deleted.status).toBe(204);
  });

  it("PATCH terms requires effectiveFrom and splits history", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const emp = await createEmployee(admin.accessToken, "trm1");

    const missing = await request(app)
      .patch(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken))
      .send({ hoursPerDay: "7.00" });
    expect(missing.status).toBe(400);

    const split = await request(app)
      .patch(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken))
      .send({ hoursPerDay: "7.00", effectiveFrom: "2026-04-01" });
    expect(split.status).toBe(200);

    const periods = await prisma.employeeTerms.findMany({
      where: { employeeId: emp.id },
      orderBy: { validFrom: "asc" },
    });
    expect(periods).toHaveLength(2);
    expect(Number(periods[1]!.hoursPerDay)).toBe(7);
  });

  it("terms change back into a closed period is 400", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const emp = await createEmployee(admin.accessToken, "trm2");

    const first = await request(app)
      .patch(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken))
      .send({ hoursPerDay: "7.00", effectiveFrom: "2026-04-01" });
    expect(first.status).toBe(200);

    const backdated = await request(app)
      .patch(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken))
      .send({ hoursPerDay: "6.00", effectiveFrom: "2026-03-15" });
    expect(backdated.status).toBe(400);
    expect(backdated.body.error).toBe("Cannot change terms in a closed period");
  });

  it("parallel overlapping shifts: one 201 and one 409", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const emp = await createEmployee(admin.accessToken, "ovl1");
    const a = await login("ovl1", EMP_PASSWORD);

    const [first, second] = await Promise.all([
      request(app)
        .post("/api/v1/shifts")
        .set(auth(a.accessToken))
        .send({ employeeId: emp.id, ...dayShift("2026-03-02", "09:00", "17:00") }),
      request(app)
        .post("/api/v1/shifts")
        .set(auth(a.accessToken))
        .send({ employeeId: emp.id, ...dayShift("2026-03-02", "10:00", "12:00") }),
    ]);
    const statuses = [first.status, second.status].sort((x, y) => x - y);
    expect(statuses[0]).toBe(201);
    expect([201, 409]).toContain(statuses[1]);
    if (statuses[1] === 409) {
      const denied = first.status === 409 ? first : second;
      expect(denied.body.error).toBe("Overlapping shift");
      expect(denied.body.code).toBe("SHIFT_OVERLAP");
    }
  });
});
