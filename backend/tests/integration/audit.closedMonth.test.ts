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
import {
  berlinYmd,
  lastYmdOfMonth,
  parseYmd,
} from "../../src/core/berlin.js";

function closedMonthMidYmd(): string {
  const today = berlinYmd(new Date());
  const { year, month } = parseYmd(today);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  expect(lastYmdOfMonth(prevYear, prevMonth) <= today).toBe(true);
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}-15`;
}

describe("audit, closed months, stable terms ids", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("employee cannot patch a shift in a closed month; admin can and writes AuditLog", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const a = await login("inta", EMP_PASSWORD);
    const closedYmd = closedMonthMidYmd();

    const created = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift(closedYmd, "09:00", "17:00") });
    expect(created.status).toBe(201);

    const denied = await request(app)
      .patch(`/api/v1/shifts/${created.body.id}`)
      .set(auth(a.accessToken))
      .send({ note: "nope" });
    expect(denied.status).toBe(409);
    expect(denied.body.error).toBe("Month is closed");

    const allowed = await request(app)
      .patch(`/api/v1/shifts/${created.body.id}`)
      .set(auth(admin.accessToken))
      .send({ note: "admin edit" });
    expect(allowed.status).toBe(200);
    expect(allowed.body.note).toBe("admin edit");

    const logs = await prisma.auditLog.findMany({
      where: { entity: "Shift", entityId: created.body.id, action: "shift.update" },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("admin GET /audit sees the shift update; employee is 403", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const a = await login("inta", EMP_PASSWORD);
    const closedYmd = closedMonthMidYmd();

    const created = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift(closedYmd, "09:00", "17:00") });
    expect(created.status).toBe(201);

    const allowed = await request(app)
      .patch(`/api/v1/shifts/${created.body.id}`)
      .set(auth(admin.accessToken))
      .send({ note: "admin edit" });
    expect(allowed.status).toBe(200);

    const listed = await request(app)
      .get("/api/v1/audit")
      .query({ entity: "Shift", entityId: created.body.id })
      .set(auth(admin.accessToken));
    expect(listed.status).toBe(200);
    expect(listed.body.nextCursor === null || typeof listed.body.nextCursor === "string").toBe(
      true,
    );
    const update = listed.body.items.find(
      (row: { action: string; entityId: string }) =>
        row.action === "shift.update" && row.entityId === created.body.id,
    );
    expect(update).toBeTruthy();
    expect(update).toMatchObject({
      entity: "Shift",
      entityId: created.body.id,
      action: "shift.update",
      actorLogin: ADMIN_LOGIN,
    });
    expect(update!.before).toBeTruthy();
    expect(update!.after).toBeTruthy();

    const denied = await request(app).get("/api/v1/audit").set(auth(a.accessToken));
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("Forbidden");
  });

  it("UPDATE and DELETE on AuditLog fail under the same DATABASE_URL", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    await request(app)
      .patch(`/api/v1/employees/${empA.id}`)
      .set(auth(admin.accessToken))
      .send({ password: "int-emp-passY" });

    const row = await prisma.auditLog.findFirst({
      where: { action: "user.password.change" },
    });
    expect(row).toBeTruthy();

    await expect(
      prisma.auditLog.update({
        where: { id: row!.id },
        data: { action: "tamper" },
      }),
    ).rejects.toThrow();

    await expect(prisma.auditLog.delete({ where: { id: row!.id } })).rejects.toThrow();
  });

  it("terms split keeps ids of already closed periods", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");

    const first = await request(app)
      .patch(`/api/v1/employees/${empA.id}`)
      .set(auth(admin.accessToken))
      .send({ hoursPerDay: "7.00", effectiveFrom: "2026-03-01" });
    expect(first.status).toBe(200);

    const afterFirst = await prisma.employeeTerms.findMany({
      where: { employeeId: empA.id },
      orderBy: { validFrom: "asc" },
    });
    expect(afterFirst).toHaveLength(2);
    const closedId = afterFirst[0]!.id;

    const second = await request(app)
      .patch(`/api/v1/employees/${empA.id}`)
      .set(auth(admin.accessToken))
      .send({ hoursPerDay: "6.00", effectiveFrom: "2026-04-01" });
    expect(second.status).toBe(200);

    const afterSecond = await prisma.employeeTerms.findMany({
      where: { employeeId: empA.id },
      orderBy: { validFrom: "asc" },
    });
    expect(afterSecond).toHaveLength(3);
    expect(afterSecond[0]!.id).toBe(closedId);
  });
});
