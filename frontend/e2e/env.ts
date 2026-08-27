import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const path = resolve(import.meta.dirname, "../../.env");
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* CI sets env explicitly */
  }
}

loadDotEnv();

export const E2E_API = process.env.E2E_API ?? "http://127.0.0.1:3000";
export const ADMIN_LOGIN = process.env.E2E_ADMIN_LOGIN ?? process.env.ADMIN_LOGIN ?? "admin";
export const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";

if (!ADMIN_PASSWORD) {
  throw new Error("Set ADMIN_PASSWORD or E2E_ADMIN_PASSWORD for Playwright");
}
