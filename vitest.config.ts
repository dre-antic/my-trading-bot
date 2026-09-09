import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: {
      DEMO_MODE: "true",
      OFFLINE_MODE: "true",
      ALLOW_PAID_PROVIDERS: "false",
      DATA_DIR: "./data/test",
      PROJECTS_DIR: "./data/test-projects",
      LOG_LEVEL: "error",
    },
  },
});
