import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./test/setup.ts",
    exclude: [...configDefaults.exclude, "e2e/**", "test-results/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/shared/ui/demo-sign-in-card.tsx",
        "src/shared/ui/sign-in-card.tsx",
      ],
      thresholds: { statements: 15, branches: 20, functions: 20, lines: 16 },
    },
  },
});
