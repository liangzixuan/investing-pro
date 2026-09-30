# Android client

The personal launch targets computer and Android use before November 2026.
The Android app bundles the existing React workspace with Capacitor. Desktop
continues to use Next.js. The owner selected the existing Appwrite Education
project for the shared service. Isolated storage evidence is accepted for the
separate Clerk trial. Root verified a signed-in desktop reload, and the owner
reported passing its Pixel checklist. The owner later confirmed testing trial
1.1 after the update handoff, without itemized outcomes or device logs. Production
configuration remains pending. Native iOS remains a later platform with build,
signing and device requirements.

## Current scope

This first client foundation packages the shared interface and platform
navigation. It is deliberately disconnected: the bundle fixes its API base to
an empty value, the existing API clients reject that value before requesting
data, and its content security policy disallows connections. It cannot load or
save research. No desktop authentication or request boundary was changed.

`PersonalWorkspaceClient` composes the existing workspace. The desktop adapter
uses Next navigation; the Android adapter uses React Router hash navigation so
deep research routes work from bundled assets. Ordinary link modifiers retain
browser behavior. Android Back uses the native App plugin and retires its
listener when the component unmounts. Shared feature and calculation code stays
in the existing modules.

`vite.mobile.config.ts` builds only the mobile entry, excludes environment files
and public-directory copying, and rejects Next/server/database/vault modules in
the client graph. The Android project loads `dist/mobile`, with no development
server URL or mixed-content exception. Signing keys, generated assets, SDK paths
and build outputs stay out of Git. Public client-library notices are bundled.

The separate [Clerk trial](./CLERK_TRIAL.md) uses `dist/clerk-trial` and application
ID `local.investment.personal.clerktrial`. Its
[debug APK packaging review](../../tmp/clerk-trial/native-apk-actual-independent-review.json)
accepted the package identity, signature and bundled assets. The ordinary profile
and build commands below remain disconnected. Neither packaging nor the trial's
public website checks establish an installed phone session. The separate
[owner report](../../tmp/clerk-trial/pixel-owner-acceptance.json) records successful
phone checklist results; it is not an agent-captured device trace.

## Build

Use Node and pnpm versions pinned in the root package manifest. From the repository:

```sh
pnpm --filter @research-cockpit/web build:mobile
pnpm --filter @research-cockpit/web exec cap sync android
```

The native source is in `apps/web/android`. Its Gradle wrapper pins the
distribution and checksum. Capacitor 8 uses Java 21 and this project targets
Android SDK 36, minimum API 24. The reviewed local toolchain uses Build Tools
35.0.0. Set `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_USER_HOME` and `GRADLE_USER_HOME`
for the build process; keep local paths and key material out of source.

```powershell
# From apps/web/android with the toolchain environment configured:
./gradlew.bat --no-daemon --console=plain assembleDebug
```

A debug APK establishes a build, not a personal release. Actual build logs,
hashes and limitations are recorded in workspace `tmp/android-launch` and
`CURRENT.md`. Do not infer physical-device acceptance from compilation or a
desktop browser running the bundle.

## Versions and release signing

Each delivered update needs a higher `versionCode` and the same application ID
and signing certificate as the installed app. Supply the public version values
explicitly for each build:

```powershell
./gradlew.bat --no-daemon --console=plain -PinvestmentVersionCode=2 -PinvestmentVersionName=1.1 assembleDebug
```

The separate trial also requires `-PinvestmentClerkTrial=true`, its existing
public development configuration and the trial assets. Its update must retain
`local.investment.personal.clerktrial` and the accepted debug certificate. Install
over the previous trial without uninstalling or clearing app data; only that
phone check can establish session preservation through an update.

Release builds use Gradle's separate release signing configuration. They require
all four process environment inputs: `INVESTMENT_ANDROID_KEYSTORE` (an absolute
path to an existing private keystore), `INVESTMENT_ANDROID_KEY_ALIAS`,
`INVESTMENT_ANDROID_STORE_PASSWORD` and `INVESTMENT_ANDROID_KEY_PASSWORD`.
Supply credentials privately through the build environment; do not place values
in shell arguments, Git, logs or chat. Missing inputs fail before app release
preparation/signing. The build never falls back to the debug signer. Debug builds
do not require these release inputs.

The release key still needs owner-controlled custody and a recoverable backup.
No production key is generated or provisioned by the versioning change. The
existing trial debug signer remains separate from the future production signer.
The trial 1.1 APK (version code 2) built with that same certificate and unchanged
web/Capacitor assets. Four invalid-version checks and the missing-signing-input
check passed. The owner confirmed testing 1.1 after receiving the
[Pixel update checklist](../../tmp/clerk-trial/android-release-preparation/pixel-upgrade-checklist.md).
The [report](../../tmp/clerk-trial/android-release-preparation/pixel-upgrade-owner-report.json)
records overall test completion; per-step results were not supplied. The artifact
and raw packaging results are recorded in workspace CURRENT.
See [Android versioning](https://developer.android.com/studio/publish/versioning)
and [app signing](https://developer.android.com/studio/publish/app-signing).

## Next acceptance steps

1. Preserve the completed initial trial results: root observed a signed-in Brave
   reload, and the owner reported passing the Pixel checklist. The
   [isolated storage review](../../tmp/clerk-trial/storage-cloud-actual-independent-review.json)
   accepts seven scenarios with a qualified overlap result. See
   [Appwrite storage](./APPWRITE_WATCHLIST.md) for proof limits.
2. Carry the owner-reported callback/cancellation, Android Back,
   background/resume and force-stop/reopen results, plus the later overall
   trial 1.1 update-test confirmation. Broader focus, touch and external-link
   behavior remain separate from these reports.
3. Carry the owner-reported shared watchlist/note, stale-draft and independent
   sign-out results. Live uncertain-save reconciliation and expired-session
   behavior remain separate from that checklist. Keep the
   local-access endpoint loopback-only. Connecting the ordinary workspace and
   measuring its chart/startup performance remain separate work; offline edits
   need a defined conflict and persistence policy.
4. Prepare protected release signing, install/upgrade evidence and operation
   outside a Codex session. Test recovery without changing real owner records.

The PC/Tailscale host plan is superseded. The disconnected foundation still has
no public store release, connected phone session or owner-data migration.
The owner selected BrowserStack Automate/Playwright for browser tests only;
see [BrowserStack testing](./BROWSERSTACK_TESTING.md). Installed app testing uses
the owner's Pixel phones, starting with Pixel 10 Pro XL / Android 17. The earlier
App Automate upload handoff is cancelled. Prior App Live attempts established no
native-device coverage. Verify installation, Android Back, touch, background/resume
and upgrade preservation on the actual phones.
