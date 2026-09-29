import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/appwrite/*.test.ts", "scripts/browserstack/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
