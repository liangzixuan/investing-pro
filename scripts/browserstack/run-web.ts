import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mode = process.argv[2];
if (process.argv.length !== 3 || (mode !== "--check" && mode !== "--run")) {
  console.error(
    "Use --check for local configuration or --run for one remote smoke.",
  );
  process.exitCode = 2;
} else {
  const missing = ["BROWSERSTACK_USERNAME", "BROWSERSTACK_ACCESS_KEY"].filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length > 0) {
    console.error(`BrowserStack inputs required: ${missing.join(", ")}.`);
    console.error(
      "No remote test started. Supply credentials privately in this process environment.",
    );
    process.exitCode = 2;
  } else if (mode === "--check") {
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
              ([name]) => !/^(?:BROWSERSTACK_|PERCY_)/iu.test(name),
            ),
          ),
          BROWSERSTACK_USERNAME: process.env.BROWSERSTACK_USERNAME,
          BROWSERSTACK_ACCESS_KEY: process.env.BROWSERSTACK_ACCESS_KEY,
          BROWSERSTACK_LOG_DIR: resolve(root, "logs/browserstack"),
          BROWSERSTACK_CONFIG_FILE: resolve(root, "browserstack.yml"),
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
