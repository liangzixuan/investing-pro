import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveWebRun } from "./web-target";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function main() {
  let input: ReturnType<typeof resolveWebRun>;
  try {
    input = resolveWebRun(
      process.argv.slice(2),
      process.env.INVESTMENT_EXPECTED_BUILD_SHA,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Invalid website inputs.",
    );
    process.exitCode = 2;
    return;
  }
  const missing = ["BROWSERSTACK_USERNAME", "BROWSERSTACK_ACCESS_KEY"].filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length > 0) {
    console.error(`BrowserStack inputs required: ${missing.join(", ")}.`);
    console.error(
      "No remote test started. Supply credentials privately in this process environment.",
    );
    process.exitCode = 2;
  } else if (!input.run) {
    console.log(
      "Required website inputs are present. No authentication or remote test performed.",
    );
  } else {
    // Resolve the installed, pinned CLI; do not use npx or put credentials in argv.
    const sdkRoot = resolve(root, "node_modules/browserstack-node-sdk");
    const child = spawn(
      process.execPath,
      [
        resolve(sdkRoot, "src/bin/runner.js"),
        "playwright",
        "test",
        "--config=scripts/browserstack/playwright.config.ts",
        "--workers=1",
        "--retries=0",
        "--global-timeout=180000",
      ],
      {
        cwd: root,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([name]) =>
                !/^(?:BROWSERSTACK_|PERCY_|INVESTMENT_BROWSERSTACK_WEB_MODE$|INVESTMENT_EXPECTED_BUILD_SHA$)/iu.test(
                  name,
                ),
            ),
          ),
          BROWSERSTACK_USERNAME: process.env.BROWSERSTACK_USERNAME,
          BROWSERSTACK_ACCESS_KEY: process.env.BROWSERSTACK_ACCESS_KEY,
          BROWSERSTACK_LOG_DIR: resolve(root, "logs/browserstack"),
          BROWSERSTACK_CONFIG_FILE: resolve(root, "browserstack.yml"),
          INVESTMENT_BROWSERSTACK_WEB_MODE: input.target.mode,
          ...(input.target.mode === "staging"
            ? { INVESTMENT_EXPECTED_BUILD_SHA: input.target.expectedBuildSha }
            : {}),
        },
        // SDK error messages may contain capabilities. Do not forward raw streams.
        stdio: ["ignore", "ignore", "ignore"],
        windowsHide: true,
      },
    );
    child.once("error", () => {
      console.error("BrowserStack website runner could not start.");
      process.exitCode = 1;
    });
    child.once("exit", (code) => {
      console.log(
        code === 0
          ? "BrowserStack website runner completed successfully. Review the matching build in Automate."
          : "BrowserStack website runner failed. Review the matching build in Automate; local SDK logs may contain credentials.",
      );
      process.exitCode = code === 0 ? 0 : 1;
    });
  }
}

main();
