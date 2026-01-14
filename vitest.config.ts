import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/core/**", "src/render/**", "src/convert/**", "src/ui/**"],
      exclude: ["**/node_modules/**", "**/e2e/**"],
    },
  },
});
