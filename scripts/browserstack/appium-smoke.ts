import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import type { remote as createRemote } from "webdriverio";

type AndroidDriver = Awaited<ReturnType<typeof createRemote>>;
type InstrumentedBrowserStackOptions = NonNullable<
  WebdriverIO.Capabilities["bstack:options"]
> & {
  // Documented BrowserStack extension, absent from WebdriverIO 9.32's types:
  // https://www.browserstack.com/docs/app-automate/appium/troubleshooting/app-webview
  readonly enableWebviewDebug: true;
};

const APP_PACKAGE = "local.investment.personal";
const REQUEST_TIMEOUT_MS = 45_000;
const WAIT_TIMEOUT_MS = 15_000;
const RUN_BUDGET_MS = 180_000;
const REQUIRED_INPUTS = [
  "BROWSERSTACK_USERNAME",
  "BROWSERSTACK_ACCESS_KEY",
  "BROWSERSTACK_APP_ID",
  "ANDROID_DEVICE",
  "ANDROID_OS_VERSION",
] as const;
type InputName = (typeof REQUIRED_INPUTS)[number];
type Configuration = Readonly<Record<InputName, string>>;

type ConfigurationCheck =
  | { readonly valid: true; readonly configuration: Configuration }
  | {
      readonly valid: false;
      readonly missing: readonly InputName[];
      readonly invalid: readonly InputName[];
    };

/** Does not load a credential file, SDK, device inventory or remote session. */
export function checkAppiumConfiguration(
  environment: Readonly<NodeJS.ProcessEnv>,
): ConfigurationCheck {
  const missing: InputName[] = [];
  const invalid: InputName[] = [];
  const values = {} as Record<InputName, string>;
  for (const name of REQUIRED_INPUTS) {
    const value = environment[name];
    if (value === undefined || value.trim() === "") {
      missing.push(name);
      continue;
    }
    if (
      value.length > 256 ||
      value !== value.trim() ||
      /[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)
    ) {
      invalid.push(name);
      continue;
    }
    values[name] = value;
    if (
      (name === "BROWSERSTACK_APP_ID" &&
        !/^bs:\/\/[A-Za-z0-9_-]{1,128}$/u.test(value)) ||
      (name === "ANDROID_DEVICE" &&
        !/^[A-Za-z0-9][A-Za-z0-9 .()+_-]{0,119}$/u.test(value)) ||
      (name === "ANDROID_OS_VERSION" &&
        !/^\d{1,2}(?:\.\d{1,2}){0,2}$/u.test(value))
    ) {
      invalid.push(name);
    }
  }
  return missing.length > 0 || invalid.length > 0
    ? { valid: false, missing, invalid }
    : { valid: true, configuration: values };
}

async function enterAppWebview(driver: AndroidDriver): Promise<void> {
  await driver.switchContext({
    appIdentifier: APP_PACKAGE,
    url: /^https:\/\/localhost(?:\/|$)/u,
    androidWebviewConnectTimeout: WAIT_TIMEOUT_MS,
    androidWebviewConnectionRetryTime: 500,
  });
  const page = new URL(await driver.getUrl());
  assert.equal(page.origin, "https://localhost");
  assert.equal(page.hash, "#/markets");
}

async function assertDisconnectedMarkets(driver: AndroidDriver): Promise<void> {
  const notice = driver.$('aside[aria-label="Connection status"]');
  await notice.waitForDisplayed({ timeout: WAIT_TIMEOUT_MS });
  assert.match(
    await notice.getText(),
    /Not connected to your computer[\s\S]*This build cannot load or save your research\./u,
  );
  const heading = driver.$("#markets-title");
  await heading.scrollIntoView();
  assert.equal(await heading.getText(), "Markets");
  assert.equal(await heading.isDisplayed(), true);
  assert.equal(await driver.$("button=Load board").isEnabled(), false);
  assert.equal(
    await driver.$(".personal-locked-state h1").getText(),
    "Sign in to search companies.",
  );
}

async function runSmoke(configuration: Configuration): Promise<void> {
  // Import only after explicit --run and complete configuration validation.
  const { remote } = await import("webdriverio");
  let driver: AndroidDriver | undefined;
  let stage = "session_creation";
  let failed = false;
  let checksPassed = false;
  let finishing = false;
  let statusUpdate = "not_attempted";
  let cleanup = "not_created";
  const completed: string[] = [];
  const deadline = Date.now() + RUN_BUDGET_MS;
  const browserStackOptions: InstrumentedBrowserStackOptions = {
    projectName: "Investment",
    buildName: "Disconnected Android smoke",
    sessionName: "Markets, notices and Android lifecycle",
    local: false,
    idleTimeout: 60,
    debug: false,
    networkLogs: false,
    deviceLogs: false,
    appiumLogs: false,
    video: false,
    // BrowserStack patches its uploaded testing copy. The source APK
    // disables WebView debugging; this does not prove the unmodified APK.
    enableWebviewDebug: true,
  };
  try {
    driver = await remote({
      protocol: "https",
      hostname: "hub-cloud.browserstack.com",
      port: 443,
      path: "/wd/hub",
      user: configuration.BROWSERSTACK_USERNAME,
      key: configuration.BROWSERSTACK_ACCESS_KEY,
      logLevel: "silent",
      // Defence in depth for third-party loggers: no message content is needed.
      maskingPatterns: "/[\\s\\S]+/g",
      connectionRetryCount: 0,
      connectionRetryTimeout: REQUEST_TIMEOUT_MS,
      waitforTimeout: WAIT_TIMEOUT_MS,
      waitforInterval: 500,
      enableDirectConnect: false,
      strictSSL: true,
      beforeCommand(commandName) {
        if (
          !finishing &&
          commandName !== "deleteSession" &&
          Date.now() > deadline
        )
          throw new Error("smoke_deadline_exceeded");
      },
      capabilities: {
        platformName: "Android",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": configuration.ANDROID_DEVICE,
        "appium:platformVersion": configuration.ANDROID_OS_VERSION,
        "appium:app": configuration.BROWSERSTACK_APP_ID,
        "appium:appPackage": APP_PACKAGE,
        "appium:newCommandTimeout": 60,
        "bstack:options": browserStackOptions,
      },
    });
    cleanup = "pending";
    stage = "native_startup";
    assert.equal(await driver.getCurrentPackage(), APP_PACKAGE);
    completed.push(stage);

    stage = "disconnected_webview";
    await enterAppWebview(driver);
    await assertDisconnectedMarkets(driver);
    completed.push(stage);

    stage = "notices";
    const notices = driver.$("details.mobile-license-notices");
    const summary = driver.$("details.mobile-license-notices > summary");
    await summary.scrollIntoView();
    assert.equal(await summary.getText(), "Open-source notices");
    await summary.click();
    assert.equal(await notices.getProperty("open"), true);
    assert.match(await notices.$("pre").getText(), /@capacitor\/core/u);
    completed.push(stage);

    stage = "background_resume";
    await driver.switchContext("NATIVE_APP");
    await driver.background(3);
    await driver.waitUntil(
      async () => (await driver!.queryAppState(APP_PACKAGE)) === 4,
      { timeout: WAIT_TIMEOUT_MS, timeoutMsg: "foreground_not_restored" },
    );
    await enterAppWebview(driver);
    await assertDisconnectedMarkets(driver);
    assert.equal(
      await driver.$("details.mobile-license-notices").getProperty("open"),
      true,
    );
    completed.push(stage);

    // The disconnected app has no active Research route. This checks only Back
    // at the root, followed by reopening the same app; it claims no route history.
    stage = "android_back_root";
    await driver.switchContext("NATIVE_APP");
    await driver.pressKeyCode(4);
    await driver.waitUntil(
      async () => (await driver!.queryAppState(APP_PACKAGE)) !== 4,
      { timeout: WAIT_TIMEOUT_MS, timeoutMsg: "root_back_did_not_leave_app" },
    );
    await driver.activateApp(APP_PACKAGE);
    await driver.waitUntil(
      async () => (await driver!.queryAppState(APP_PACKAGE)) === 4,
      { timeout: WAIT_TIMEOUT_MS, timeoutMsg: "app_did_not_reopen" },
    );
    await enterAppWebview(driver);
    await assertDisconnectedMarkets(driver);
    completed.push(stage);
    checksPassed = true;
  } catch {
    // WebDriver errors can contain URLs, capabilities and credentials.
    failed = true;
  } finally {
    if (driver !== undefined) {
      // Two final requests remain bounded even after the interaction deadline.
      finishing = true;
      try {
        await driver.execute(
          "browserstack_executor: " +
            JSON.stringify({
              action: "setSessionStatus",
              arguments: {
                status: checksPassed ? "passed" : "failed",
                reason: checksPassed
                  ? "Disconnected startup, notices and Android lifecycle passed."
                  : `Disconnected smoke failed at ${stage}.`,
              },
            }),
        );
        statusUpdate = "updated";
      } catch {
        statusUpdate = "failed";
        if (!failed) stage = "session_status";
        failed = true;
      }
      try {
        await driver.deleteSession();
        cleanup = "deleted";
      } catch {
        cleanup = "delete_failed";
        if (!failed) stage = "session_cleanup";
        failed = true;
      }
    }
  }
  console.log(
    JSON.stringify({
      status: failed ? "failed" : "passed",
      testStatus: checksPassed ? "passed" : "failed",
      stage: failed ? stage : "complete",
      completed,
      cleanup,
      statusUpdate,
      instrumentedTestingCopy: true,
      connectedDataTested: false,
    }),
  );
  if (failed) process.exitCode = 1;
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  if (
    arguments_.length !== 1 ||
    (arguments_[0] !== "--check" && arguments_[0] !== "--run")
  ) {
    console.log(
      JSON.stringify({ status: "usage", options: ["--check", "--run"] }),
    );
    process.exitCode = 2;
    return;
  }
  const check = checkAppiumConfiguration(process.env);
  if (!check.valid) {
    console.log(
      JSON.stringify({
        status: "configuration_incomplete",
        missing: check.missing,
        invalid: check.invalid,
        remoteStarted: false,
      }),
    );
    process.exitCode = 2;
    return;
  }
  if (arguments_[0] === "--check") {
    console.log(
      JSON.stringify({
        status: "configuration_valid",
        remoteStarted: false,
        deviceAvailabilityVerified: false,
        testExecuted: false,
      }),
    );
    return;
  }
  await runSmoke(check.configuration);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main().catch(() => {
    console.log(
      JSON.stringify({
        status: "failed",
        stage: "setup",
        remoteStarted: false,
      }),
    );
    process.exitCode = 1;
  });
}
