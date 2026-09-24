import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**"],
      thresholds: { statements: 90, branches: 65, functions: 90, lines: 90 },
    },
  },
});
