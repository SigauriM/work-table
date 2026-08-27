import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**"],
    coverage: {
      provider: "v8",
      include: ["src/core/**"],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
