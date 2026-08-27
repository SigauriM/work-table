import { type APIRequestContext, type Page, expect } from "@playwright/test";
import { ADMIN_LOGIN, ADMIN_PASSWORD, E2E_API } from "./env";

export { ADMIN_LOGIN, ADMIN_PASSWORD, E2E_API };

export const EMP_PASSWORD = "e2e-emp-pass12";
export const EMP_PASSWORD_NEW = "e2e-emp-pass99";

export async function adminAccess(request: APIRequestContext) {
  const res = await request.post(`${E2E_API}/api/v1/auth/login`, {
    data: { login: ADMIN_LOGIN, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

export async function createEmployee(request: APIRequestContext, loginName: string) {
  const token = await adminAccess(request);
  const hiredAt = "2026-01-15";
  const res = await request.post(`${E2E_API}/api/v1/employees`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      login: loginName,
      password: EMP_PASSWORD,
      firstName: "E2e",
      lastName: loginName,
      payType: "HOURLY",
      hourlyRate: "10",
      hoursPerDay: "8",
      daysPerWeek: 5,
      hiredAt,
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { id: string; login: string };
}

export async function signIn(page: Page, loginName: string, password: string) {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Login", { exact: true }).fill(loginName);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Log out" }).first().click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
}

export async function addShift(page: Page, start: string, end: string) {
  await page.getByRole("gridcell", { selected: true }).click();
  await page.getByRole("textbox", { name: /^Start/ }).fill(start);
  await page.getByRole("textbox", { name: /^End/ }).fill(end);
  await page.getByRole("button", { name: /Add to/ }).click();
}

export async function changePassword(page: Page, current: string, next: string) {
  await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel("New password").fill(next);
  await page.getByRole("button", { name: "Save password" }).click();
}

export async function employeeSession(page: Page, request: APIRequestContext, loginName: string) {
  await createEmployee(request, loginName);
  await signIn(page, loginName, EMP_PASSWORD);
  await changePassword(page, EMP_PASSWORD, EMP_PASSWORD_NEW);
  await expect(page.getByRole("link", { name: "Timesheet" }).first()).toBeVisible();
}
