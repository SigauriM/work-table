import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: true,
    setupFiles: ["./tests/integration/setupEnv.ts"],
    coverage: {
      provider: "v8",
      include: ["src/modules/**/*.service.ts"],
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
