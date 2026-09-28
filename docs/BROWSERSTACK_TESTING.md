# BrowserStack testing

Use BrowserStack for browser tests only. Test the installed Android app on the
owner's Pixel phones. Physical Pixel 10 Pro XL / Android 17 acceptance remains
separate from browser coverage.

## When to run

Dependency installation and repository configuration are one-time setup.
Each `run-web.ts --run` invocation starts one cloud browser smoke test and exits
when the runner finishes. It does not start a daemon, schedule later tests or run
automatically after code changes. Run it after a meaningful web-interface change
and before release acceptance, once the intended build is deployed to the preview.

The installed website tools are Playwright Test 1.59.0 and BrowserStack Node SDK
1.70.2. They are development dependencies. The configuration uses one website
platform, one worker, one smoke test and zero test retries.

## Credentials and commands

Keep `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` private in the process
environment of the owner's PowerShell session. They remain available to commands
launched from that session until it closes; a new PowerShell session needs them
supplied privately again. Browser sign-in alone does not authenticate the runner.
The wrapper does not save these credentials or load saved CLI credentials.
Do not put keys in command arguments, YAML, Git, screenshots or chat, and do not
run the SDK's credential-writing setup command.

From the repository, using its pinned pnpm version:

```sh
pnpm test:browserstack:web:list
pnpm test:browserstack:web:check
```

Listing only collects the test and needs no credentials. The check validates
that the required environment inputs are present without authenticating or
starting a session; missing inputs produce exit 2. Neither proves test success.

Start one remote test when needed:

```sh
pnpm test:browserstack:web
```

This runs `tsx scripts/browserstack/run-web.ts --run`. Each invocation starts a
new test. It is separate from the normal unit-test and release commands.

## Target and coverage

The smoke targets only
`https://investment-device-preview.appwrite.network`. It checks Markets startup,
disabled data controls, unloaded prices, bundled notices, 390px/1440px layout and
hash navigation with browser Back. Requests are restricted to the preview's
public document and bundled assets. The configured platform is Windows 11 /
Chrome; narrow desktop viewports do not establish Android device coverage.

The target serves the deployed disconnected mobile bundle. Editing local source
does not update that site. Rebuild and deploy the intended preview assets before
using this test to assess a changed interface. A pass covers the deployed assets
at the time of the run, not unshipped local edits.

The smoke performs no owner sign-in, data migration, watchlist writes or provider
loads. Connected Appwrite sessions and shared-data journeys need their own
fixtures and acceptance. Native installation, Android Back, background/resume
and daily use must be checked on the owner's Pixel phones.

## Observed result

On September 28, 2026 at 23:04:16 UTC, the first remote session showed **Passed**
on Windows 11 / Chrome 154, with a duration of 13 seconds. The build header still
showed **Running**, and the owner's PowerShell exit result was not observed.
This records a session pass; completion of the overall build and runner remains
unverified. See the
[first-session receipt](../../tmp/browserstack-evaluation/web-smoke-first-session.json).

## Results and capture

The SDK configuration disables Local tunneling, optional reporting, automatic
troubleshooting-log capture, Percy, accessibility automation, video, network and
console capture. The wrapper fixes the config/log location and discards inherited
BrowserStack/Percy overrides except credentials. It does not forward raw SDK
streams. Inspect the matching Automate build for actual session and build results.
Local SDK logs are ignored and may contain credentials; share only reviewed,
redacted evidence. Collection, input checks and compilation are not remote passes.

## References

- [Playwright SDK integration](https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs/integrate-your-tests)
- [Supported Playwright platforms](https://www.browserstack.com/docs/automate/playwright/browsers-and-os)
- [SDK release notes](https://www.browserstack.com/docs/sdk/release-notes)
