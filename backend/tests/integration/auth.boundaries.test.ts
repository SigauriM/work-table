import { describe, it, expect, beforeEach } from "vitest";
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
  loginSession,
  resetDb,
} from "./harness.js";

describe("auth and access boundaries", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("employee A does not read B's shifts even with B's employeeId in the query", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const empB = await createEmployee(admin.accessToken, "intb");
    const a = await login("inta", EMP_PASSWORD);
    const b = await login("intb", EMP_PASSWORD);

    const created = await request(app)
      .post("/api/v1/shifts")
      .set(auth(b.accessToken))
      .send({ employeeId: empB.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(created.status).toBe(201);

    const listed = await request(app)
      .get("/api/v1/shifts")
      .query({ employeeId: empB.id, year: 2026, month: 3 })
      .set(auth(a.accessToken));
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([]);
    expect(a.user.employeeId).toBe(empA.id);
  });

  it("employee A posting a shift with B's employeeId still stores it as A", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const empB = await createEmployee(admin.accessToken, "intb");
    const a = await login("inta", EMP_PASSWORD);

    const created = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empB.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(created.status).toBe(201);
    expect(created.body.employeeId).toBe(empA.id);
    expect(created.body.employeeId).not.toBe(empB.id);
  });

  it("employee cannot call admin employee and overview endpoints", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    await createEmployee(admin.accessToken, "inta");
    const a = await login("inta", EMP_PASSWORD);

    const list = await request(app).get("/api/v1/employees").set(auth(a.accessToken));
    expect(list.status).toBe(403);

    const overview = await request(app)
      .get("/api/v1/stats/overview")
      .query({ year: 2026, month: 3 })
      .set(auth(a.accessToken));
    expect(overview.status).toBe(403);
  });

  it("deactivated employee cannot log in and refresh is revoked", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const a = await loginSession("inta", EMP_PASSWORD);

    const deactivated = await request(app)
      .delete(`/api/v1/employees/${empA.id}`)
      .set(auth(admin.accessToken));
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);

    const loginAgain = await request(app)
      .post("/api/v1/auth/login")
      .send({ login: "inta", password: EMP_PASSWORD });
    expect(loginAgain.status).toBe(401);

    const refreshed = await a.agent
      .post("/api/v1/auth/refresh")
      .set("X-CSRF-Token", a.csrf);
    expect(refreshed.status).toBe(401);
  });

  it("changing password revokes refresh", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const a = await loginSession("inta", EMP_PASSWORD);

    const patched = await request(app)
      .patch(`/api/v1/employees/${empA.id}`)
      .set(auth(admin.accessToken))
      .send({ password: "int-emp-passX" });
    expect(patched.status).toBe(200);

    const refreshed = await a.agent
      .post("/api/v1/auth/refresh")
      .set("X-CSRF-Token", a.csrf);
    expect(refreshed.status).toBe(401);

    const loginNew = await request(app)
      .post("/api/v1/auth/login")
      .send({ login: "inta", password: "int-emp-passX" });
    expect(loginNew.status).toBe(200);
  });

  it("refresh and logout need CSRF; POST /shifts does not", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const a = await loginSession("inta", EMP_PASSWORD);

    const noCsrf = await a.agent.post("/api/v1/auth/refresh");
    expect(noCsrf.status).toBe(403);

    const ok = await a.agent.post("/api/v1/auth/refresh").set("X-CSRF-Token", a.csrf);
    expect(ok.status).toBe(200);
    expect(ok.body.refreshToken).toBeUndefined();
    expect(ok.body.accessToken).toBeTruthy();

    const shift = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(shift.status).toBe(201);
  });

  it("shift and sick day on the same date return 409", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const a = await login("inta", EMP_PASSWORD);

    const shift = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(shift.status).toBe(201);

    const sick = await request(app)
      .post("/api/v1/sick-days")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, date: "2026-03-02" });
    expect(sick.status).toBe(409);
    expect(sick.body.error).toBe("Shift and sick day conflict");
  });

  it("overlapping shifts return 409", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const a = await login("inta", EMP_PASSWORD);

    const first = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/v1/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift("2026-03-02", "10:00", "12:00") });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("Overlapping shift");
    expect(second.body.code).toBe("SHIFT_OVERLAP");
  });

  it("self password change clears the flag and revokes other refresh cookies", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    expect(admin.user.mustChangePassword).toBe(false);
    await createEmployee(admin.accessToken, "inta");

    const first = await loginSession("inta", EMP_PASSWORD);
    expect(first.user.mustChangePassword).toBe(true);
    const second = await loginSession("inta", EMP_PASSWORD);

    const changed = await first.agent
      .patch("/api/v1/auth/password")
      .set(auth(first.accessToken))
      .send({ currentPassword: EMP_PASSWORD, newPassword: "int-emp-pass2" });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);

    const other = await second.agent.post("/api/v1/auth/refresh").set("X-CSRF-Token", second.csrf);
    expect(other.status).toBe(401);

    const kept = await first.agent.post("/api/v1/auth/refresh").set("X-CSRF-Token", first.csrf);
    expect(kept.status).toBe(200);
  });
});
