import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: "./",
    include: ["**/*.int.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    globalSetup: ["./vitest.global.int.ts"],
    setupFiles: ["./vitest.setup.int.ts"],
    fileParallelism: false,
    // Every query is a round trip to a remote RDS, so the 5 s defaults time out mid-suite.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
