import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

let base =
  process.env.DATABASE_URL ??
  "postgresql://worktable:worktable@127.0.0.1:5432/worktable_test";

let dbName = "";
try {
  dbName = new URL(base).pathname.replace(/^\//, "");
} catch {
  throw new Error("DATABASE_URL is invalid");
}
if (dbName === "worktable") {
  const redirected = new URL(base);
  redirected.pathname = "/worktable_test";
  base = redirected.toString();
  dbName = "worktable_test";
}

const worker = String(process.env.VITEST_POOL_ID ?? "0").replace(/[^a-zA-Z0-9]/g, "") || "0";
const schema = `int_w${worker}`;

const adminUrl = new URL(base);
adminUrl.searchParams.delete("schema");

const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
await admin.$disconnect();

const next = new URL(base);
next.searchParams.set("schema", schema);
process.env.DATABASE_URL = next.toString();
process.env.JWT_ACCESS_SECRET ??= "int-test-jwt-access-secret";

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
});
