# BrowserStack testing

The shared React interface has two test targets: the hosted website and the
installed Capacitor Android app. Use Automate with Playwright for the website
and App Automate with Appium through WebdriverIO for the APK. These development
packages do not enter the client bundle. BrowserStack hosts the Appium server;
no local Appium server or driver installation is needed for these cloud tests.

## Account status

On September 28, 2026, the signed-in account's App Automate dashboard displayed
**100 minutes remaining on its free plan**. The Current Plans panel separately
listed Live Desktop & Mobile for one user and Automate Desktop & Mobile for one
parallel test, both extended trials. The free App Automate allowance is useful
for bounded Android smoke runs; it is not evidence of an extended or unlimited
App Automate subscription. Saved observations are in workspace
`tmp/browserstack-evaluation/app-automate-access.txt` and the adjacent screenshot.

## Installed setup

- Playwright Test 1.59.0 and BrowserStack Node SDK 1.70.2 for website automation.
  Playwright 1.59 is listed with Android support in the provider's compatibility
  table. Keep client/platform versions aligned when expanding the matrix.
- WebdriverIO 9.32.0 as the Appium client for Android.
- One website platform, one worker, one smoke test and zero test retries.
- One Android session per explicit invocation, zero connection retries, finite
  command waits, stage-only results and session cleanup in `finally`.

The first SDK installation stopped at blocked transitive install scripts. The
final install explicitly disables local Edge/Firefox driver downloads and the
protobufjs install script, retains esbuild's existing permission and adds no
package-age exception. These local drivers are unnecessary for the remote grid.
The SDK has its own BrowserStack license and is confined to development use.

## Credentials and commands

Supply `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` privately as process
environment variables. Browser sign-in alone does not authenticate the runners.
Do not put keys in this guide, YAML, command arguments, Git, screenshots or chat.
The runners do not load saved CLI credentials. Local SDK logs are ignored and
must be treated as potentially sensitive; only share reviewed, redacted evidence.
Do not run the SDK's credential-writing setup command.

From the repository, using its pinned pnpm version:

```sh
pnpm test:browserstack:web:list
pnpm test:browserstack:web:check
pnpm test:browserstack:android:check
```

Listing only collects the website test. Check commands validate inputs without
starting a session and fail with exit 2 when inputs are missing. They do not
prove authentication, device availability or test success. Actual remote runs
are explicit and separate from the normal unit-test and release commands:

```sh
pnpm test:browserstack:web
pnpm test:browserstack:android
```

The Android runner additionally needs `BROWSERSTACK_APP_ID` (the `bs://` ID for
our uploaded disconnected APK), `ANDROID_DEVICE` and `ANDROID_OS_VERSION` from
current App Automate inventory. Do not reuse an App Live upload ID by assumption
or invent a Pixel/OS combination. No upload is performed by these scripts.

## Initial coverage

The website smoke targets only
`https://investment-device-preview.appwrite.network`. It checks startup,
disconnected controls, notices, 390px/1440px layout and hash navigation/Back.
Requests are restricted to that preview's public document and bundled assets.
The first remote platform is Windows 11 / Chrome. Narrow desktop viewport checks
are not Android device coverage. Add a separately verified real Android browser
configuration after the initial authenticated run works.

The Android smoke checks the `local.investment.personal` package, the matching
localhost WebView, disconnected Markets, notices, background/resume and Android
Back at the root followed by reopening. BrowserStack instruments its uploaded
testing copy to expose the WebView. This does not establish the behavior of the
unmodified APK on the owner's physical Pixel 10 Pro XL / Android 17.

Both suites use the existing disconnected foundation. They perform no owner
sign-in, data migration, watchlist writes or provider loads. Connected Appwrite
sessions and shared-data journeys require their own fixtures and acceptance.
Never count collection, configuration checks or compilation as remote passes.

The SDK configuration disables Local tunneling, optional reporting, automatic
troubleshooting-log capture, Percy, accessibility automation, video, network and
console capture. Our wrapper fixes the config/log location and discards inherited
BrowserStack/Percy overrides except credentials. It does not forward raw SDK
streams. Inspect the matching Automate build for actual job results. Appium
returns finite stage/status metadata and marks the remote session result.

## References

- [Playwright SDK integration](https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs/integrate-your-tests)
- [Supported Playwright platforms](https://www.browserstack.com/docs/automate/playwright/browsers-and-os)
- [Appium with WebdriverIO](https://www.browserstack.com/docs/app-automate/appium/getting-started/nodejs/webdriverio)
- [WebView testing copies](https://www.browserstack.com/docs/app-automate/appium/troubleshooting/app-webview)
- [SDK release notes](https://www.browserstack.com/docs/sdk/release-notes)
