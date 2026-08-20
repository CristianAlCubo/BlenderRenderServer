import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolveSrc = (pkg: string) =>
  fileURLToPath(new URL(`../packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@render-server/db": resolveSrc("db"),
      "@render-server/shared": resolveSrc("shared"),
    },
  },
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["src/__tests__/e2e.test.ts"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
