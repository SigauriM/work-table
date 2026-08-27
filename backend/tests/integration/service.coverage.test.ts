import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { instantFromBerlin } from "../../src/core/berlin.js";
import {
  ADMIN_LOGIN,
  ADMIN_PASSWORD,
  EMP_PASSWORD,
  auth,
  createEmployee,
  dayShift,
  login,
  loginSession,
  resetDb,
} from "./harness.js";

const MISSING = "00000000-0000-4000-8000-000000000001";

describe("service coverage paths", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("sick days: create, list, duplicate, delete, 404, inactive, foreign delete", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "cova");
    const empB = await createEmployee(admin.accessToken, "covb");
    const a = await login("cova", EMP_PASSWORD);
    const b = await login("covb", EMP_PASSWORD);

    const missingEmp = await request(app)
      .post("/api/v1/sick-days")
      .set(auth(admin.accessToken))
      .send({ employeeId: MISSING, date: "2026-03-04" });
    expect(missingEmp.status).toBe(404);

    const created = await request(app)
      .post("/api/v1/sick-days")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, date: "2026-03-04", note: "flu" });
    expect(created.status).toBe(201);

    const dup = await request(app)
      .post("/api/v1/sick-days")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, date: "2026-03-04" });
    expect(dup.status).toBe(409);

    const listed = await request(app)
      .get("/api/v1/sick-days")
      .query({ employeeId: empA.id, year: 2026, month: 3 })
      .set(auth(a.accessToken));
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const foreign = await request(app)
      .delete(`/api/v1/sick-days/${created.body.id}`)
      .set(auth(b.accessToken));
    expect(foreign.status).toBe(403);

    const gone = await request(app)
      .delete(`/api/v1/sick-days/${MISSING}`)
      .set(auth(admin.accessToken));
    expect(gone.status).toBe(404);

    const deleted = await request(app)
      .delete(`/api/v1/sick-days/${created.body.id}`)
      .set(auth(a.accessToken));
    expect(deleted.status).toBe(204);

    const deactivated = await request(app)
      .delete(`/api/v1/employees/${empB.id}`)
      .set(auth(admin.accessToken));
    expect(deactivated.status).toBe(200);

    const onInactive = await request(app)
      .post("/api/v1/sick-days")
      .set(auth(admin.accessToken))
      .send({ employeeId: empB.id, date: "2026-03-05" });
    expect(onInactive.status).toBe(403);
  });

  it("shifts: breaks, patch, delete, cursor 400, inactive, move onto sick", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const emp = await createEmployee(admin.accessToken, "covs");
    const a = await login("covs", EMP_PASSWORD);
    const times = dayShift("2026-03-02", "09:00", "17:00");

    const withBreak = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({
        employeeId: emp.id,
        ...times,
        breakStart: instantFromBerlin("2026-03-02", "12:00").toISOString(),
        breakEnd: instantFromBerlin("2026-03-02", "12:30").toISOString(),
        note: "lunch",
      });
    expect(withBreak.status).toBe(201);
    expect(withBreak.body.workedMinutes).toBe(450);

    const patched = await request(app)
      .patch(`/api/v1/shifts/${withBreak.body.id}`)
      .set(auth(admin.accessToken))
      .send({
        startTime: instantFromBerlin("2026-03-02", "09:00").toISOString(),
        endTime: instantFromBerlin("2026-03-02", "08:00").toISOString(),
      });
    expect(patched.status).toBe(400);

    const breakOnly = await request(app)
      .patch(`/api/v1/shifts/${withBreak.body.id}`)
      .set(auth(admin.accessToken))
      .send({
        breakStart: null,
      });
    expect(breakOnly.status).toBe(400);

    const outside = await request(app)
      .patch(`/api/v1/shifts/${withBreak.body.id}`)
      .set(auth(admin.accessToken))
      .send({
        breakStart: instantFromBerlin("2026-03-02", "08:00").toISOString(),
        breakEnd: instantFromBerlin("2026-03-02", "08:30").toISOString(),
      });
    expect(outside.status).toBe(400);

    const noteOnly = await request(app)
      .patch(`/api/v1/shifts/${withBreak.body.id}`)
      .set(auth(admin.accessToken))
      .send({ note: "edited" });
    expect(noteOnly.status).toBe(200);
    expect(noteOnly.body.note).toBe("edited");

    const missingShift = await request(app)
      .patch(`/api/v1/shifts/${MISSING}`)
      .set(auth(admin.accessToken))
      .send({ note: "x" });
    expect(missingShift.status).toBe(404);

    const missingDel = await request(app)
      .delete(`/api/v1/shifts/${MISSING}`)
      .set(auth(admin.accessToken));
    expect(missingDel.status).toBe(404);

    const badCursor = await request(app)
      .get("/api/v1/shifts")
      .query({ employeeId: emp.id, take: 1, cursor: MISSING })
      .set(auth(admin.accessToken));
    expect(badCursor.status).toBe(400);

    const sick = await request(app)
      .post("/api/v1/sick-days")
      .set(auth(a.accessToken))
      .send({ employeeId: emp.id, date: "2026-03-06" });
    expect(sick.status).toBe(201);

    const moveOntoSick = await request(app)
      .patch(`/api/v1/shifts/${withBreak.body.id}`)
      .set(auth(admin.accessToken))
      .send({
        date: "2026-03-06",
        startTime: instantFromBerlin("2026-03-06", "09:00").toISOString(),
        endTime: instantFromBerlin("2026-03-06", "17:00").toISOString(),
        breakStart: null,
        breakEnd: null,
      });
    expect(moveOntoSick.status).toBe(409);

    const shiftOnSick = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: emp.id, ...dayShift("2026-03-06", "09:00", "17:00") });
    expect(shiftOnSick.status).toBe(409);

    const removed = await request(app)
      .delete(`/api/v1/shifts/${withBreak.body.id}`)
      .set(auth(admin.accessToken));
    expect(removed.status).toBe(204);

    await request(app).delete(`/api/v1/employees/${emp.id}`).set(auth(admin.accessToken));
    const other = await createEmployee(admin.accessToken, "covs2");
    const onInactive = await request(app)
      .post("/api/v1/shifts")
      .set(auth(admin.accessToken))
      .send({ employeeId: emp.id, ...dayShift("2026-03-09", "09:00", "17:00") });
    expect(onInactive.status).toBe(403);

    const missingEmp = await request(app)
      .post("/api/v1/shifts")
      .set(auth(admin.accessToken))
      .send({ employeeId: MISSING, ...dayShift("2026-03-09", "09:00", "17:00") });
    expect(missingEmp.status).toBe(404);
    expect(other.id).toBeTruthy();
  });

  it("employees, payouts, auth me/logout, pay-type switch, overview with sick+payout", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const emp = await createEmployee(admin.accessToken, "cove");
    const other = await createEmployee(admin.accessToken, "covf");
    const session = await loginSession("cove", EMP_PASSWORD);

    const me = await request(app).get("/api/v1/auth/me").set(auth(session.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.login).toBe("cove");

    const wrongPw = await request(app)
      .post("/api/v1/auth/login")
      .send({ login: "cove", password: "nope-nope-12" });
    expect(wrongPw.status).toBe(401);

    const badCurrent = await session.agent
      .patch("/api/v1/auth/password")
      .set(auth(session.accessToken))
      .send({ currentPassword: "wrong-pass-12", newPassword: "int-emp-pass3" });
    expect(badCurrent.status).toBe(401);

    const got = await request(app)
      .get(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken));
    expect(got.status).toBe(200);
    expect(got.body.terms).toHaveLength(1);

    const missingEmp = await request(app)
      .get(`/api/v1/employees/${MISSING}`)
      .set(auth(admin.accessToken));
    expect(missingEmp.status).toBe(404);

    const renamed = await request(app)
      .patch(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken))
      .send({ firstName: "Cove", lastName: "Coverage", daysPerWeek: 4 });
    expect(renamed.status).toBe(200);
    expect(renamed.body.firstName).toBe("Cove");

    const taken = await request(app)
      .patch(`/api/v1/employees/${other.id}`)
      .set(auth(admin.accessToken))
      .send({ login: "cove" });
    expect(taken.status).toBe(409);

    const hired = await request(app)
      .patch(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken))
      .send({ hiredAt: "2026-01-20" });
    expect(hired.status).toBe(200);

    const salary = await request(app)
      .patch(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken))
      .send({
        payType: "SALARY",
        monthlySalary: "3000",
        effectiveFrom: "2026-05-01",
      });
    expect(salary.status).toBe(200);

    const hiredAfterSplit = await request(app)
      .patch(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken))
      .send({ hiredAt: "2026-01-10" });
    expect(hiredAfterSplit.status).toBe(400);

    const beforeHire = await request(app)
      .patch(`/api/v1/employees/${emp.id}`)
      .set(auth(admin.accessToken))
      .send({ hoursPerDay: "6.00", effectiveFrom: "2025-01-01" });
    expect(beforeHire.status).toBe(400);

    const missingPayoutEmp = await request(app)
      .get(`/api/v1/employees/${MISSING}/overtime-payouts`)
      .set(auth(admin.accessToken));
    expect(missingPayoutEmp.status).toBe(404);

    const payout = await request(app)
      .post(`/api/v1/employees/${emp.id}/overtime-payouts`)
      .set(auth(admin.accessToken))
      .send({ date: "2026-03-15", hoursPaid: "1.00", amount: "15.00" });
    expect(payout.status).toBe(201);

    const wrongPayout = await request(app)
      .delete(`/api/v1/employees/${other.id}/overtime-payouts/${payout.body.id}`)
      .set(auth(admin.accessToken));
    expect(wrongPayout.status).toBe(404);

    const missingPayout = await request(app)
      .delete(`/api/v1/employees/${emp.id}/overtime-payouts/${MISSING}`)
      .set(auth(admin.accessToken));
    expect(missingPayout.status).toBe(404);

    const sick = await request(app)
      .post("/api/v1/sick-days")
      .set(auth(session.accessToken))
      .send({ employeeId: emp.id, date: "2026-03-10" });
    expect(sick.status).toBe(201);

    const overview = await request(app)
      .get("/api/v1/stats/overview")
      .query({ year: 2026, month: 3 })
      .set(auth(admin.accessToken));
    expect(overview.status).toBe(200);
    expect(overview.body.length).toBeGreaterThanOrEqual(1);

    const listed = await request(app)
      .get("/api/v1/employees")
      .query({ isActive: "true" })
      .set(auth(admin.accessToken));
    expect(listed.status).toBe(200);

    const missingDeactivate = await request(app)
      .delete(`/api/v1/employees/${MISSING}`)
      .set(auth(admin.accessToken));
    expect(missingDeactivate.status).toBe(404);

    const loggedOut = await session.agent
      .post("/api/v1/auth/logout")
      .set("X-CSRF-Token", session.csrf);
    expect(loggedOut.status).toBe(204);
  });
});
