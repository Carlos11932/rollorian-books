import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Only pick up tests inside src/ — avoids picking up .github scripts
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.*", "src/test/**", "src/**/*.d.ts"],
      // Start conservatively — many UI components are untested.
      // Raise incrementally as more tests are added (Phase 6+).
      thresholds: {
        lines: 20,
        functions: 18,
        branches: 18,
        statements: 20,
      },
    },
  },
});
