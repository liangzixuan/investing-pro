import { defineConfig } from "@playwright/test";

import { resolveWebTarget } from "./web-target";

export const webTarget = resolveWebTarget(
  process.env.INVESTMENT_BROWSERSTACK_WEB_MODE ?? "preview",
  process.env.INVESTMENT_EXPECTED_BUILD_SHA,
);
export const previewOrigin = webTarget.origin;

export default defineConfig({
  testDir: ".",
  testMatch:
    webTarget.mode === "staging" ? "clerk-staging.pw.ts" : "disconnected.pw.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  maxFailures: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "../../test-results/browserstack",
  use: {
    baseURL: previewOrigin,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: false,
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name:
        webTarget.mode === "staging" ? "clerk-staging" : "disconnected-preview",
      use: { browserName: "chromium" },
    },
  ],
});
