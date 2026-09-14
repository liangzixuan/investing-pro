import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/release-classification*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
