import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const coreDir = join(dirname(fileURLToPath(import.meta.url)), "../src/core");

describe("core/", () => {
  it("does not import @prisma/client", () => {
    const files = readdirSync(coreDir).filter((name) => name.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const text = readFileSync(join(coreDir, name), "utf8");
      expect(text.includes("@prisma/client"), name).toBe(false);
    }
  });
});
