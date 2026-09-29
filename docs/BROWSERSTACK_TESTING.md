# BrowserStack testing

Use BrowserStack for browser tests only. Test the installed Android app on the
owner's Pixel phones. Physical Pixel 10 Pro XL / Android 17 acceptance remains
separate from browser coverage.

## When to run

Dependency installation and repository configuration are one-time setup.
Each `run-web.ts --run` invocation starts one cloud browser smoke test and exits
when the runner finishes. It does not start a daemon. GitHub Actions can invoke
the same command automatically as described below. For a manual check, run it
after a meaningful web-interface change and before release acceptance, once the
intended build is deployed to the preview.

The installed website tools are Playwright Test 1.59.0 and BrowserStack Node SDK
1.70.2. They are development dependencies. The configuration uses one website
platform, one worker, one smoke test and zero test retries.

## GitHub Actions

The `BrowserStack deployed-preview smoke` workflow runs on pushes to `main` and
`codex/android-launch` when web/shared code, browser test configuration or
dependencies change. Documentation-only changes do not trigger it. It has one
Ubuntu job, one browser session, a ten-minute job limit and a five-minute remote
step limit. Runs share a concurrency group; a new push does not cancel a running
test. There is no schedule, pull-request secret exposure or native app test.

These repository secrets are configured in
[GitHub Actions secrets](https://github.com/liangzixuan/investing-pro/settings/secrets/actions).
Their names were verified without inspecting their values:

- `BROWSERSTACK_USERNAME`: the automation username.
- `BROWSERSTACK_ACCESS_KEY`: the current access key.

GitHub supplies them only to the test step, after dependency installation.
Missing secrets fail the step before a BrowserStack session starts. The workflow
does not upload SDK logs, screenshots or other artifacts. It preserves the
existing release gates and reports its own result separately.

The workflow is published on `codex/android-launch`. Merging it into `main` and
enabling its default-branch **Run workflow** control remain pending. A failed run
can be rerun from its Actions page after its cause is fixed. No PowerShell window
or running owner PC is needed for GitHub runs, and rotating the BrowserStack key
requires updating the stored secret.

This workflow checks the existing hosted preview. It neither deploys that site
nor proves its assets match the triggering commit. The checkout SHA in its
summary identifies the test code only. Deploy the intended preview before using
its result as evidence for an interface change. The hosted runner has passed as
recorded below; independent BrowserStack session details remain unverified.

## Exact-build staging pipeline

The approved [Appwrite delivery workflow](./APPWRITE_DELIVERY.md) adds a separate
staging mode. It deploys a SHA-labelled artifact and calls
`run-web.ts --run-staging` with `INVESTMENT_EXPECTED_BUILD_SHA`. The test requires
one matching public commit marker before interacting with the page. The ordinary
`--run` mode rejects an expected SHA so it cannot silently stand in for this check.
`--check-staging` validates inputs without a remote session. The runner supplies
its internal child mode; callers do not need to set it.

Source preparation does not establish cloud acceptance. The new workflow still
needs default-branch integration, Appwrite environment credentials and its first
observed run. It shares concurrency with the existing preview smoke. Once the
new release path is proved, retire the old push trigger to avoid duplicate runs.
No Appium, App Automate or extra BrowserStack platform has been added.

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
new test. The command remains available locally alongside the separate CI job.

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
