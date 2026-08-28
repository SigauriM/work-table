import { test, expect } from "@playwright/test";
import {
  ADMIN_LOGIN,
  ADMIN_PASSWORD,
  EMP_PASSWORD,
  addShift,
  createEmployee,
  employeeSession,
  signIn,
  signOut,
} from "./helpers";

function uniq(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

test.describe("wave 9 journeys", () => {
  test("login as admin reaches overview", async ({ page }) => {
    await signIn(page, ADMIN_LOGIN, ADMIN_PASSWORD);
    await expect(page.getByRole("heading", { name: "Overview" }).first()).toBeVisible();
  });

  test("employee logs a daytime shift", async ({ page, request }) => {
    const loginName = uniq("sh");
    await employeeSession(page, request, loginName);
    await addShift(page, "09:00", "17:00");
    await expect(page.getByText("09:00 – 17:00")).toBeVisible();
  });

  test("employee logs an overnight shift", async ({ page, request }) => {
    const loginName = uniq("nt");
    await employeeSession(page, request, loginName);
    await addShift(page, "22:00", "06:00");
    await expect(page.getByText("22:00 – 06:00")).toBeVisible();
    await expect(page.getByText("8 h").first()).toBeVisible();
  });

  test("employee logs a sick day", async ({ page, request }) => {
    const loginName = uniq("sk");
    await employeeSession(page, request, loginName);
    await page.getByRole("gridcell", { selected: true }).click();
    await page.getByRole("button", { name: "Sick" }).click();
    await page.getByRole("button", { name: /Add to/ }).click();
    await expect(page.getByText("Full day")).toBeVisible();
  });

  test("employee stats page shows worked hours", async ({ page, request }) => {
    const loginName = uniq("st");
    await employeeSession(page, request, loginName);
    await addShift(page, "09:00", "13:00");
    await expect(page.getByText("09:00 – 13:00")).toBeVisible();
    await page.getByRole("link", { name: "Stats" }).first().click();
    await expect(page.getByText("Worked")).toBeVisible();
    await expect(page.getByText("4 h").first()).toBeVisible();
  });

  test("admin deactivates an employee and they cannot sign in", async ({ page, request }) => {
    const loginName = uniq("da");
    await createEmployee(request, loginName);
    await signIn(page, ADMIN_LOGIN, ADMIN_PASSWORD);
    await page.getByRole("link", { name: "Employees" }).first().click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page
      .getByRole("row", { name: new RegExp(loginName) })
      .getByRole("button", { name: "Deactivate" })
      .click();
    await expect(page.getByRole("row", { name: new RegExp(loginName) }).getByText("inactive")).toBeVisible();
    await signOut(page);
    await signIn(page, loginName, EMP_PASSWORD);
    await expect(page.getByRole("alert")).toContainText(
      /Invalid credentials|Ungültige Zugangsdaten/,
    );
  });
});
