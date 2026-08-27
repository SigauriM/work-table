const url =
  process.env.DATABASE_URL ??
  "postgresql://worktable:worktable@127.0.0.1:5432/worktable_test";

let dbName = "";
try {
  dbName = new URL(url).pathname.replace(/^\//, "");
} catch {
  throw new Error("DATABASE_URL is invalid");
}
if (dbName === "worktable") {
  throw new Error(
    "Refusing integration tests against database 'worktable'; use worktable_test",
  );
}

process.env.DATABASE_URL = url;
process.env.JWT_ACCESS_SECRET ??= "int-test-jwt-access-secret";
