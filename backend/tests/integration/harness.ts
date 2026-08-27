import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import request from "supertest";
import { Role } from "@prisma/client";
import { expect } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { instantFromBerlin, nextBerlinYmd } from "../../src/core/berlin.js";

export const ADMIN_LOGIN = "int-admin";
export const ADMIN_PASSWORD = "int-admin-pass";
export const EMP_PASSWORD = "int-emp-pass";

export function auth(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export function migrate() {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

/** Wipe app tables in the current schema. AuditLog is append-only (trigger). */
export async function truncateAppTables() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "RefreshToken",
      "OvertimePayout",
      "Shift",
      "SickDay",
      "EmployeeTerms",
      "Employee",
      "User"
    RESTART IDENTITY CASCADE
  `);
}

export async function resetDb() {
  await truncateAppTables();
  await prisma.user.create({
    data: {
      login: ADMIN_LOGIN,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: Role.ADMIN,
    },
  });
}

export async function login(loginName: string, password: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ login: loginName, password });
  expect(res.status).toBe(200);
  expect(res.body.refreshToken).toBeUndefined();
  return res.body as {
    accessToken: string;
    user: { employeeId: string | null; mustChangePassword: boolean };
  };
}

export function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers["set-cookie"];
  if (!raw) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  const line = list.find((c) => c.startsWith(`${name}=`));
  if (!line) return undefined;
  return decodeURIComponent(line.split(";")[0]!.slice(name.length + 1));
}

export async function loginSession(loginName: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/v1/auth/login").send({ login: loginName, password });
  expect(res.status).toBe(200);
  expect(res.body.refreshToken).toBeUndefined();
  const csrf = cookieValue(res, "csrf");
  expect(csrf).toBeTruthy();
  return {
    agent,
    csrf: csrf!,
    accessToken: res.body.accessToken as string,
    user: res.body.user as { employeeId: string | null; mustChangePassword: boolean },
  };
}

export async function createEmployee(
  adminAccess: string,
  loginName: string,
  extra?: {
    payType?: "HOURLY" | "SALARY";
    hourlyRate?: string;
    monthlySalary?: string;
    hoursPerDay?: string;
    hiredAt?: string;
  },
) {
  const payType = extra?.payType ?? "HOURLY";
  const res = await request(app)
    .post("/api/v1/employees")
    .set(auth(adminAccess))
    .send({
      login: loginName,
      password: EMP_PASSWORD,
      firstName: loginName,
      lastName: "Test",
      payType,
      hourlyRate: payType === "HOURLY" ? (extra?.hourlyRate ?? "10") : undefined,
      monthlySalary: payType === "SALARY" ? (extra?.monthlySalary ?? "2500") : undefined,
      hoursPerDay: extra?.hoursPerDay ?? "8",
      daysPerWeek: 5,
      hiredAt: extra?.hiredAt ?? "2026-01-15",
    });
  expect(res.status).toBe(201);
  return res.body as { id: string; login: string; monthlySalary: string | null; payType: string };
}

export function dayShift(dateYmd: string, startHm: string, endHm: string) {
  const endYmd = endHm <= startHm ? nextBerlinYmd(dateYmd) : dateYmd;
  return {
    date: dateYmd,
    startTime: instantFromBerlin(dateYmd, startHm).toISOString(),
    endTime: instantFromBerlin(endYmd, endHm).toISOString(),
  };
}
