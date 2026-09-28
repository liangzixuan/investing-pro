# Android client

The personal launch targets computer and Android use before November 2026.
The Android app bundles the existing React workspace with Capacitor. Desktop
continues to use Next.js. This Windows PC will host the shared data service while
it is on and connected. Native iOS remains a later platform with separate build,
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

## Next acceptance steps

1. Implement authenticated access from the phone to this Windows PC over a
   reviewed HTTPS/private-network path. Keep the existing local-access endpoint
   loopback-only. Support independent device sessions and server-held provider
   credentials.
2. Install on the owner's Android phone, verify launch, Back, focus, touch,
   external links and background/resume, and measure chart/startup performance.
3. Complete a shared watchlist/note journey with conflict handling and an
   explicit disconnected state. Do not introduce offline edits before they have
   a defined conflict and persistence policy.
4. Prepare protected release signing, install/upgrade evidence and operation
   outside a Codex session. Test recovery without changing real owner records.

The service will be unavailable when the host PC is off, asleep or disconnected.
There is no public store release, remote service activation or owner-data
migration in this foundation.
