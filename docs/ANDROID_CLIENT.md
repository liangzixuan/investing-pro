# Android client

The October personal launch uses the shared React interface in a Capacitor
Android app. Clerk supplies native sign-in and Appwrite hosts the managed API
and data. The connected website is accepted at main `de8fd252`; production
Android packaging, signing recovery and Pixel acceptance are tracked separately
in workspace [CURRENT.md](../../CURRENT.md). Production Investment 1.0.0 now has
an accepted signed APK and production Clerk registration. Its managed API
supports both browser and native requests. The installation package and checklists
are in workspace `delivery/android-1.0.0`; physical Pixel checks, an upgrade and
independent signing recovery remain pending.

The owner reported successful development trial 1.1 testing on a Pixel 10 Pro XL
running Android 17. That report covers the development application. Production
uses a distinct package and signer; it cannot upgrade or migrate the debug trial.
The accepted local research app and encrypted vault remain separate.

## Client profiles

| Profile                   | Selection                 | Bundled assets             | Application ID                         |
| ------------------------- | ------------------------- | -------------------------- | -------------------------------------- |
| Disconnected foundation   | Omitted or `disconnected` | `dist/mobile`              | `local.investment.personal`            |
| Development sign-in trial | `clerk-trial`             | `dist/clerk-trial-android` | `local.investment.personal.clerktrial` |
| Managed production        | `managed`                 | `dist/managed-android`     | `app.investingpro.android`             |

Use `INVESTMENT_CLIENT_PROFILE` for Vite and Capacitor and the matching Gradle
property `investmentClientProfile`. The authenticated profiles require their
matching explicit Clerk environment and public key. Omitted Vite profile builds
the browser client, whose output directories remain `dist/clerk-trial` and
`dist/clerk-production`. A native bundle requires Android at exact
`https://localhost`; browser and native targets cannot substitute for each other.

The production native app renders the existing managed Discover and My Watchlist
screens through the same native session adapter used by the trial. Each session
generation owns its workspace; sign-out retires it and cancels pending work.
The Clerk Android SDK owns hosted sign-in, callbacks and encrypted credential
storage. Short-lived operation tokens cross the bridge only when needed; the
app adds no JavaScript refresh-token store or callback parser.

The managed API verifies browser and native requests separately. Browser requests
require the canonical web Origin and authorized party. Native requests require
exact `https://localhost`; their verified authorized-party claim may be absent
or name that exact origin. Both require the same production issuer and configured
account, signature, active session and time checks. Origin is not installation
attestation. The original production demo service stays web only.

The catalog currently contains AAPL, GOOG and GOOGL, with no prices. Shared
watchlist notes, ordering, removal, explicit saves and conflict/uncertain-save
reconciliation reuse the website's implementation and private repository.
There is no offline editing queue or local-vault migration.

## Build and identity

Use the Node and pnpm versions pinned in the repository, Java 21, SDK 36 and
Build Tools 35.0.0. Minimum Android API is 24. Configure toolchain paths only for
the build process; generated outputs and local paths stay out of Git.

For an authenticated profile, set the selected public configuration and build
with `vite.clerk-trial.config.ts`, then sync Capacitor with the same profile.
The generated `investment-client.json` records the target, package, checked
public configuration, source SHA and asset hashes. Gradle validates that record
against its selected profile and copied Capacitor configuration before packaging.
Do not sync over retained outputs before preserving their original bytes.

```powershell
# From apps/web/android, with toolchain and public configuration supplied:
./gradlew.bat --no-daemon --console=plain -PinvestmentClientProfile=managed -PinvestmentVersionCode=1 -PinvestmentVersionName=1.0.0 assembleRelease
```

For the disconnected foundation, use `build:mobile` and the disconnected
Capacitor/Gradle profile. It keeps an empty API base and a CSP that disallows
connections. It cannot load or save research. No developer server URL or
mixed-content exception is permitted in any delivered APK.

Production registration must bind `app.investingpro.android` and the actual
release certificate to the existing production Clerk instance. The SDK callback
is `clerk://app.investingpro.android.callback`; its OAuth callback uses the same
package with `.oauth`. Inspect the final merged manifest and actual registration.
The Kotlin/Java source namespace does not define the installed package identity.

## Signing, updates and recovery

Release builds require four process inputs: `INVESTMENT_ANDROID_KEYSTORE`,
`INVESTMENT_ANDROID_KEY_ALIAS`, `INVESTMENT_ANDROID_STORE_PASSWORD` and
`INVESTMENT_ANDROID_KEY_PASSWORD`. The keystore path must be absolute. Missing
inputs fail the release guard; release never falls back to debug signing.
Passwords must not appear in arguments, source, logs or public receipts.

Production starts at version code 1/name 1.0.0. Every delivered update needs a
higher code and the same package and signing certificate. Keep the trial and its
accepted debug signer intact. A higher-version install is tested without
uninstalling or clearing data; an older APK is not an automatic downgrade path.

The signing tools use a dedicated native-owner Windows keystore and protected
local password custody. Local custody alone does not prove recovery. A portable
backup needs independent owner custody and a restore/signature proof before it
is accepted as recoverable. Workspace CURRENT records actual key creation,
certificate, artifact hashes, backup evidence and remaining owner steps.

## Acceptance

Verify the signed APK's package, explicit version, certificate, SDK levels,
non-debuggable flag, callback/provider names, backup/cleartext rules, notices and
bundled asset hashes. Compilation alone does not establish an installed session.

On the owner's Pixel, check installation, hosted sign-in and cancellation,
Android Back, keyboard/focus, background/resume, force-stop/reopen, independent
browser/native sign-out and a same-signer update. Distinguish reopening an
established session from killing a pending browser sign-in. Shared-data testing
must preserve existing owner records and follow the selected device journey.

BrowserStack remains browser-only. Synthetic tests and browser checks do not
substitute for physical Pixel results. The
[trial owner report](../../tmp/clerk-trial/pixel-owner-acceptance.json) and
[1.1 update report](../../tmp/clerk-trial/android-release-preparation/pixel-upgrade-owner-report.json)
remain development evidence. Native iOS and public store distribution are later
outcomes with separate toolchain, signing and device requirements.
