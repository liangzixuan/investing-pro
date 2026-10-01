# BrowserStack testing

Use BrowserStack for browser tests only. Test the installed Android app on the
owner's Pixel phones. Physical Pixel 10 Pro XL / Android 17 acceptance remains
separate from browser coverage.

## When to run

Dependency installation and repository configuration are one-time setup.
The Appwrite release workflow runs BrowserStack after deploying the exact build
to staging and before production promotion. Each invocation starts one cloud
browser smoke test and exits when the runner finishes. It does not start a daemon.
No owner PC or terminal needs to remain running for GitHub releases.

The installed website tools are Playwright Test 1.59.0 and BrowserStack Node SDK
1.70.2. They are development dependencies. The configuration uses one website
platform, one worker, one smoke test and zero test retries.

## GitHub Actions

The `Appwrite site release` workflow owns the current browser gate. Its one
staging test session uses the fixed target and exact source marker. Runs share a
concurrency group, and a new release does not cancel a running test. The obsolete
automatic disconnected-preview workflow is retired because staging will receive
the Clerk client. Historical preview results remain separate evidence.

These repository secrets are configured in
[GitHub Actions secrets](https://github.com/liangzixuan/investing-pro/settings/secrets/actions).
Their names were verified without inspecting their values:

- `BROWSERSTACK_USERNAME`: the automation username.
- `BROWSERSTACK_ACCESS_KEY`: the current access key.

GitHub supplies them only to the test step, after dependency installation.
Missing secrets fail the step before a BrowserStack session starts. SDK logs are
not uploaded; finite source, artifact and deployment receipts are retained by
the release workflow. Rotating the key requires updating the stored secret.

## Exact-build staging pipeline

The approved [Appwrite delivery workflow](./APPWRITE_DELIVERY.md) deploys one
SHA-labelled artifact and calls `run-web.ts --run-staging` with
`INVESTMENT_EXPECTED_BUILD_SHA`. The test requires one matching public marker
before interacting with the page. `--check-staging` validates inputs without a
remote session. The runner supplies its internal child mode.

The first pipeline completed for the disconnected client on September 29.
The production Clerk client subsequently passed its exact-build release gate
on September 30 at main `b2172d26`, followed by same-archive production promotion.
See the [delivery status table](./CURRENT_WORK.md#delivery-status). This gate
tested the inert staging frame; authenticated desktop/Pixel acceptance is
separate evidence. A later source change still needs its own release result.

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

For the current staging client, use the release workflow. A separately authorized
manual check can use these commands with the exact deployed commit SHA and
privately supplied credentials:

```sh
pnpm exec tsx scripts/browserstack/run-web.ts --check-staging
pnpm exec tsx scripts/browserstack/run-web.ts --run-staging
```

Both require `INVESTMENT_EXPECTED_BUILD_SHA`. Each `--run-staging` invocation
starts a new test. The older `pnpm test:browserstack:web` command selects the
retained disconnected-preview scenario, which no longer describes staging once
the Clerk client is deployed. It cannot substitute for the release check.

## Target and coverage

The staging smoke targets only
`https://investment-device-preview.appwrite.network`. It verifies the commit
marker, JavaScript startup, inert Clerk trial frame, synthetic-data disclosure,
bundled software notices and 390px/1440px layouts. Only the fixed public document
and hashed bundled assets are allowed; authentication, API, websocket and other
unexpected requests fail the test. The configured platform is Windows 11 /
Chrome. Narrow desktop viewports do not establish Android device coverage.

The canonical production origin mounts Clerk; staging does not start an auth
session or load saved data. Sign-in, shared watchlist save/reload and independent
sign-out need separate acceptance on the production origin. The smoke performs
no owner sign-in, watchlist writes, migration or provider loads. Native install,
Android Back, background/resume and daily use remain Pixel checks.

## Observed results

GitHub [run 36499410858, attempt 2](https://github.com/liangzixuan/investing-pro/actions/runs/36499410858/attempts/2)
at `50add08` succeeded in 1 minute 11 seconds. Job `109191600638` succeeded in
1 minute 6 seconds. Its 31-second test step printed:

> BrowserStack website runner completed successfully. Review the matching build in Automate.

The BrowserStack build list showed `disconnected-web-smoke #CI 36499410858`.
Opening that entry's details and then the project list redirected to
`request_access`. The new session's identity, platform and result, and the
BrowserStack build's terminal state, remain independently unverified. The GitHub
result establishes that the published workflow ran successfully with its
configured credentials.

An earlier manual session on September 28, 2026 at 23:04:16 UTC showed **Passed**
on Windows 11 / Chrome 154, with a duration of 13 seconds. That build's header
still showed **Running**, and the owner's PowerShell exit result was not observed.
This separate session does not establish the new CI session's result. See the
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
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
