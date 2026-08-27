import { execSync } from "node:child_process";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { instantFromBerlin } from "../../src/core/berlin.js";

const ADMIN_LOGIN = "int-admin";
const ADMIN_PASSWORD = "int-admin-pass";
const EMP_PASSWORD = "int-emp-pass";

function auth(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function login(loginName: string, password: string) {
  const res = await request(app).post("/auth/login").send({ login: loginName, password });
  expect(res.status).toBe(200);
  return res.body as {
    accessToken: string;
    refreshToken: string;
    user: { employeeId: string | null };
  };
}

async function createEmployee(
  adminAccess: string,
  loginName: string,
): Promise<{ id: string; login: string }> {
  const res = await request(app)
    .post("/employees")
    .set(auth(adminAccess))
    .send({
      login: loginName,
      password: EMP_PASSWORD,
      firstName: loginName,
      lastName: "Test",
      payType: "HOURLY",
      hourlyRate: "10",
      hoursPerDay: "8",
      daysPerWeek: 5,
      hiredAt: "2026-01-15",
    });
  expect(res.status).toBe(201);
  return res.body as { id: string; login: string };
}

function dayShift(dateYmd: string, startHm: string, endHm: string) {
  return {
    date: dateYmd,
    startTime: instantFromBerlin(dateYmd, startHm).toISOString(),
    endTime: instantFromBerlin(dateYmd, endHm).toISOString(),
  };
}

describe("auth and access boundaries", () => {
  beforeAll(() => {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.overtimePayout.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.sickDay.deleteMany();
    await prisma.employeeTerms.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: {
        login: ADMIN_LOGIN,
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.ADMIN,
      },
    });
  });

  it("employee A does not read B's shifts even with B's employeeId in the query", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const empB = await createEmployee(admin.accessToken, "intb");
    const a = await login("inta", EMP_PASSWORD);
    const b = await login("intb", EMP_PASSWORD);

    const created = await request(app)
      .post("/shifts")
      .set(auth(b.accessToken))
      .send({ employeeId: empB.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(created.status).toBe(201);

    const listed = await request(app)
      .get("/shifts")
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
      .post("/shifts")
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

    const list = await request(app).get("/employees").set(auth(a.accessToken));
    expect(list.status).toBe(403);

    const overview = await request(app)
      .get("/stats/overview")
      .query({ year: 2026, month: 3 })
      .set(auth(a.accessToken));
    expect(overview.status).toBe(403);
  });

  it("deactivated employee cannot log in and refresh is revoked", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const a = await login("inta", EMP_PASSWORD);

    const deactivated = await request(app)
      .delete(`/employees/${empA.id}`)
      .set(auth(admin.accessToken));
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);

    const loginAgain = await request(app)
      .post("/auth/login")
      .send({ login: "inta", password: EMP_PASSWORD });
    expect(loginAgain.status).toBe(401);

    const refreshed = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: a.refreshToken });
    expect(refreshed.status).toBe(401);
  });

  it("shift and sick day on the same date return 409", async () => {
    const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
    const empA = await createEmployee(admin.accessToken, "inta");
    const a = await login("inta", EMP_PASSWORD);

    const shift = await request(app)
      .post("/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(shift.status).toBe(201);

    const sick = await request(app)
      .post("/sick-days")
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
      .post("/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift("2026-03-02", "09:00", "17:00") });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/shifts")
      .set(auth(a.accessToken))
      .send({ employeeId: empA.id, ...dayShift("2026-03-02", "10:00", "12:00") });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("Overlapping shift");
  });
});
