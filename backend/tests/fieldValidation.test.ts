import { describe, expect, it } from "vitest";
import { createEmployeeSchema, updateEmployeeSchema } from "../src/modules/employees/employees.schema.js";
import { createOvertimePayoutSchema } from "../src/modules/payouts/payouts.schema.js";
import { changePasswordSchema, loginSchema } from "../src/modules/auth/auth.schema.js";

const validCreate = {
  login: "anna",
  password: "twelvechars1",
  firstName: "Anna",
  lastName: "Test",
  payType: "HOURLY" as const,
  hourlyRate: "10",
  hoursPerDay: "8",
  daysPerWeek: 5,
  hiredAt: "2026-01-15",
};

describe("createEmployeeSchema", () => {
  it("accepts a valid hourly employee", () => {
    expect(createEmployeeSchema.parse(validCreate).login).toBe("anna");
  });

  it("rejects a password shorter than 12", () => {
    expect(() => createEmployeeSchema.parse({ ...validCreate, password: "short" })).toThrow();
  });

  it("rejects hourlyRate abc", () => {
    expect(() => createEmployeeSchema.parse({ ...validCreate, hourlyRate: "abc" })).toThrow();
  });

  it("rejects negative hourlyRate", () => {
    expect(() => createEmployeeSchema.parse({ ...validCreate, hourlyRate: "-1" })).toThrow();
  });

  it("rejects hourlyRate with 3 decimal places", () => {
    expect(() => createEmployeeSchema.parse({ ...validCreate, hourlyRate: "1.234" })).toThrow();
  });

  it("rejects hoursPerDay 0", () => {
    expect(() => createEmployeeSchema.parse({ ...validCreate, hoursPerDay: "0" })).toThrow();
  });

  it("rejects hoursPerDay 25", () => {
    expect(() => createEmployeeSchema.parse({ ...validCreate, hoursPerDay: "25" })).toThrow();
  });
});

describe("updateEmployeeSchema", () => {
  it("rejects a short password", () => {
    expect(() => updateEmployeeSchema.parse({ password: "short" })).toThrow();
  });
});

describe("createOvertimePayoutSchema", () => {
  it("rejects amount abc", () => {
    expect(() =>
      createOvertimePayoutSchema.parse({ date: "2026-01-15", hoursPaid: "1", amount: "abc" }),
    ).toThrow();
  });
});

describe("loginSchema", () => {
  it("still accepts a short password on login", () => {
    expect(loginSchema.parse({ login: "admin", password: "short" }).password).toBe("short");
  });
});

describe("changePasswordSchema", () => {
  it("rejects a new password shorter than 12", () => {
    expect(() =>
      changePasswordSchema.parse({ currentPassword: "old-password", newPassword: "short" }),
    ).toThrow();
  });

  it("accepts a 12-character new password", () => {
    expect(
      changePasswordSchema.parse({
        currentPassword: "old-password",
        newPassword: "twelvechars1",
      }).newPassword,
    ).toBe("twelvechars1");
  });
});
