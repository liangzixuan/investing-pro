# Android client

The managed Android app packages the shared React workspace with Capacitor.
Clerk supplies native sign-in; Appwrite hosts the managed API and data. The
production package is `app.investingpro.android`.
[Current work](./CURRENT_WORK.md#current-capability-and-delivery-status) records the accepted
version, source revision and physical-device status.

PR 32 delivered Investment 1.3.0 (version code 4) from its accepted source tree.
Its package, signer, bundled assets and backup rules passed artifact review;
physical installation and use of 1.3 were not established by that review.

The production 1.1 upgrade/checklist was owner-reported as passed on a Pixel 10 Pro
XL running Android 17, without per-step device logs. Earlier development-trial
results are separate: its package and debug signer cannot upgrade the production
app. The local research app and encrypted vault also remain separate.

The signed 1.19.0 update (code 20) delivers PR 63's complete current-note reader
in company research and My Watchlist. Wrapped plain text includes unsaved changes
and remains available when editing is paused. Saving stays explicit. Build,
complete artifact and delivery reviews passed with the existing production signer.
Twenty invented-data native cases and 22 scoped original images are accepted.
On October 10 the owner reported the requested 1.19 and Brave checklist passed
on a Pixel 10 Pro XL running Android 17, without per-step device logs or browser
measurements. Physical 1.14 through 1.18, screen-reader and backup/restore
acceptance remain open. The earlier issue-free Pixel 1.13 report is separate.
See Current work for exact source, APK identity and checklist scope.

## WebView and software licenses

The client supports Chromium-based WebView 111 or newer. Capacitor's
`android.minWebViewVersion` declares this minimum. In the current configuration,
Capacitor logs an unsupported version; it does not block startup without an
error-page configuration. Huawei WebView uses Capacitor's separate version check.

Software licenses remain available through the explicit footer disclosure.
The canonical notice inventory is compressed into a lazy JavaScript module at
build time and decoded in memory with `DecompressionStream`. Build and client
checks preserve the complete original text, including the appended icon and font
licenses. This requires no data endpoint or content-security-policy exception.
When decoding is unavailable or fails, the disclosure shows an error and Retry;
it never displays partial license text. This change adds no new dependency.

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

The current managed native source renders Markets, Discover and My Watchlist
through the same native session adapter used by the trial. The shared workspace
includes direct research switching and retained refresh histories. Each
session generation owns its workspace; sign-out retires it and cancels pending work.
The Clerk Android SDK owns hosted sign-in, callbacks and encrypted credential
storage. Short-lived operation tokens cross the bridge only when needed; the
app adds no JavaScript refresh-token store or callback parser.

The managed API verifies browser and native requests separately. Browser requests
require the canonical web Origin and authorized party. Native requests require
exact `https://localhost`; their verified authorized-party claim may be absent
or name that exact origin. Both require the same production issuer and configured
account, signature, active session and time checks. Origin is not installation
attestation. The original production demo service stays web only.

The catalog contains AAPL, GOOG and GOOGL with distinct listing identities.
Annual reports and EOD close history load explicitly. Current service admission
covers AAPL, GOOG and GOOGL; that scope does not imply other market coverage.
Shared watchlist
notes, ordering, removal, explicit saves and conflict/uncertain-save
reconciliation reuse the website's implementation and private storage adapter.
There is no offline editing queue or local-vault migration.

The BEA agenda shares the managed Markets renderer and an independent session
read model. Loading is explicit. Failed refresh, Cancel and navigation retain
accepted dates and the dirty watchlist draft; session retirement clears the
agenda and rejects late responses. See the [Markets contract](MANAGED_MARKETS_HOME.md#bea-release-agenda).

The Precision Desk workspace shares the browser's dark surfaces, selected-note
editor, bundled Inter font and narrow bottom navigation. Its native fixture
mounts the real workspace coordinator and router in the managed frame. Hidden
notes are checked through fixture-only subscriptions; visible checkpoints select
each listing and check its actual editor. These diagnostics add no production
bridge or authentication path.

API-36 run `38174145166`, attempt 1, passed all 22 named cases: three disconnected
and nineteen managed, with no failures, errors or skips. Its PR merge checkout
`429085563064546c06166f1788e4774195133e5b` has tree
`8e9a26b57bb8ba9571d0623c8b75c96d0854cd49`, shared by accepted actual main
`c13b6e4bff3e1b78c9cc82f0b5ad85884c2cc9bf`. All nineteen managed source markers
matched. The actual-main native workflow passed separately; the downloaded
report remains the equivalent-tree PR report.

Of 67 retained native images, sixteen received agent visual review and two
received separate root review. Calendar layout is outside that image scope.
Executed Java assertions cover dates, retained data and drafts, cancellation and
late-response fencing. Invented-data Brave checks cover the shared responsive
layout at desktop, 390 and 320 pixels. These checks do not establish a live
account or physical-device journey.

Android 1.24.0/code 25 has an accepted actual-main build and production signer.
The APK is 6,719,623 bytes, SHA-256
`59c8247b51c87d0c3bac1440a996cac11f4ab99435b666e9f1de8c2313a73127`.
Complete review covered all 513 archive members, eight client assets, bundled
font/licenses and the full manifest. The manifest differs from accepted 1.23
only in version code/name. All eight payload files and the
ninth receipt were verified. All nine files in the previous 1.23 delivery remain
unchanged.
No installation, physical use or backup/restore is accepted. The earlier signed
1.24 candidate remains preserved and undelivered; it has a different digest.
[Current work](CURRENT_WORK.md) records website and Android delivery separately.
Original failed native runs and local offline compile evidence remain retained.

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
# Historical 1.3 build example, from apps/web/android with reviewed inputs supplied.
# For a new release, supply its reviewed version name and a higher version code.
./gradlew.bat --no-daemon --console=plain -PinvestmentClientProfile=managed -PinvestmentVersionCode=4 -PinvestmentVersionName=1.3.0 assembleRelease
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
is accepted as recoverable. Private operational receipts retain key creation,
certificate and recovery evidence. Public release status belongs in [Current work](./CURRENT_WORK.md);
keys, passwords and machine-specific custody locations do not belong in Git.

## Automated emulator checks

The `Android emulator` GitHub Actions workflow builds and installs the
disconnected debug app on a fresh virtual Pixel. It runs for pull requests and
main pushes, and can also be started from the Actions page. The runner supplies the emulator;
the owner's phone and Windows Android SDK are not needed.

The tests exercise packaged WebView startup, locked local routes, the home
link, Android Back and activity recreation through Android's instrumentation
runner and Espresso. They check the embedded commit marker and disconnected
access controls, and retain an emulator screenshot for each test.
They use the existing disconnected profile, which has no account, API access
or research data. The APK uses the runner's disposable debug signer. Production
signing custody, Clerk admission and WebView debugging settings are unchanged.

The disconnected route bridge follows React Router's link convention: navigating
to the current location replaces its history entry. Repeated Home taps therefore
keep Watchlist as the previous destination. The navigation and recreation tests
explicitly repeat the physical Home tap, check locked state, user activation and
native history, then press Android Back. The gesture helper retains Espresso's
bounded Escape recovery for a tap delayed into a long press; recovery does not
relax the navigation assertions.

The test APK also contains an isolated bundle of the shared managed workspace.
Its invented session and in-memory API make no network requests. Native tests
open the Annual report, press Android Back and check that the unsaved note and
focus survive. A second case closes a pending report, verifies cancellation and
deliberately completes the old request to check that its result stays discarded.
A third case stops and resumes the same Activity while a report is pending. It
checks that the Activity, WebView and document remain the same, preserves the
draft, order and search, and rejects duplicate reads. It then checks cancellation
and late-response handling through Android Back after resuming.
These tests use the real Capacitor App bridge with empty WebView history. The
fixture is absent from the application APK, and CI checks that separation.

The managed refresh case first loads invented annual evidence, then fails an
explicit refresh and checks that the previous report stays readable with its
original provenance. An explicit retry replaces that report. The watchlist
draft and exact request counts are checked through the same native screen.

The catalog recovery case starts with an invented catalog-load failure, then
holds an explicit refresh open. It checks the loading label and disabled Search
button while the query remains editable. Releasing that response restores the
original dated catalog receipt and allows a ZERO search without reloading the
Activity or document, losing the draft or sending extra requests. Synchronized
screenshots retain the failed and recovered states.

The EOD case loads invented raw closes into the shared EOD close history panel, then
holds a refresh open. Cancel preserves the previous validated rows with their
original dates and discards the deliberately late reply. Native Back restores the opening control
and preserves the draft,
order, Activity, WebView and document. Its chart/table screenshots contain only
invented prices. The accepted PR 32 main run passed all eleven required cases
and retained eighteen screenshots. Additional cases cover direct research switching
and the Markets board: ordered loading, Cancel and late-response rejection, row
selection and return to the mounted watchlist draft.
These are fixture results, not live-provider or physical-device results.

The Filings journey uses fixed invented SEC metadata. It checks 25-row local
paging, retained provenance through cancellation and failure, empty replacement,
native Back and rejection of late results. After those zero-write checks, a new
visit explicitly loads a fresh packet and adds its page-two reference to the
existing reordered note draft. A second activation must leave the exact note
unchanged. Review, explicit Save and reload must preserve both complete notes,
listing order and version while adding no source read. This extends the existing
case and requires its own successful emulator run; source and fixture tests alone
do not establish native acceptance.

The next Filings extension selects 10-Q, 8-K and All forms through the same native
Space-key/dialog interaction used by the date and basis controls. It checks exact
filtered counts and rows without another read, restores the original paging
journey and resets a retained filter on a new empty response. The existing exact
note and Save/reload checks remain. The helper's name reflects its shared select
role; its picker mechanics are unchanged. This extension needs its own emulator
result before native acceptance.

The Markets journey also asserts the three-listing shared-date comparison. It
checks exact raw endpoints, percentage changes and original completion times
after the existing three loads. A partial refresh leaves one shared date, so
the table disappears while the retained histories keep their provenance.
Cancellation and late replies cannot restore old comparison values; leaving
and returning to Markets clears them without an extra price request. These
assertions reuse the existing invented responses and require a successful
emulator run for their source revision.

The selected company-visit regression extends direct switching: it loads both
sections, returns to the same rows and annual provenance without another read,
then checks native Back and an unloaded new visit. Separate screenshots show the
company header and Price/Annual controls, then the retained close and dated
provenance. Each frame checks that its subjects are fully visible before and
after capture. This extension still requires a successful emulator run for its
own source revision; the earlier PR 32 result does not accept it.

The Annual-note regression uses a separate invented ZERO journey. It chooses an
eligible revenue basis, appends the dated evidence to an existing note draft,
then reviews, explicitly saves and reloads the watchlist. It checks the full note
text, source dates, unrelated note and membership order, plus exact source-read
and save counts. Scoped captures show the pair action and note controls; they do
not claim to display the entire long note at once. This case requires its own
successful emulator run before native acceptance.

The report-navigation extension activates all four **On this report** links in
that same Annual-note journey. It checks linked target identity, 44-pixel touch
height, focus and visibility above the mobile navigation, unchanged URL/history,
the complete note draft and source-read/save counts. The source link opens the
existing disclosure; the test closes it before continuing the original note
journey. Cases, captures and loader limits stay unchanged. Static checks do not
establish emulator acceptance for this extension.

The watchlist Annual comparison adds a separate invented two-company journey.
It uses the actual company and revenue-basis controls, checks independent fiscal
periods and filing details, and preserves the reordered note draft through
failed refresh, cancellation and late completion. Session retirement clears the
draft and both reports. It adds no provider connection or Save action. Its source and fixture checks do not establish
native acceptance; the original hosted run must execute the new required case.

The liquidity comparison extension keeps that journey and adds four rows to its
existing value assertions. It checks each company's exact balances, working
capital, rounded ratio, separate balance date and current-use text through basis
changes and report lifetimes. Its source assertions retain original instant
observations, capture clocks, filing links and calculation references. The case
and capture sets, loader limit and APK isolation gates stay unchanged. Source and
syntax checks do not establish emulator acceptance for this extension.

The liquidity comparison note extension selects Liquidity and ONE as the
explicit destination, edits ONE's latest prefix, then appends while ZERO remains
selected in the editor. It checks the whole separately dated paragraph, the
retained qualifier on ZERO only, unchanged order and other note, duplicate
refusal, and source/read/save counts. It restores the original draft before the
existing cash comparison Save and reload checks. Liquidity Save and reload are
covered separately by composed workspace and browser checks; this native
extension covers append and refusal. Its own hosted execution remains required.

The earlier-date comparison case uses the native date control in the shared
chart. It checks the chosen observed close, fixed latest endpoint, exact change,
retained history and reset behavior without extra price reads or saves. It
focuses the exact enabled select, verifies DOM and native window focus, then
opens the picker with one native Space-key action. The option lookup waits for
the native dialog and touches the exact date. This covers keyboard opening and
native option touch; it does not establish touch-opening reliability. JavaScript
does not assign the selected value or dispatch selection events. The exact
selected value and resulting comparison remain required, and the revised helper
still needs a successful emulator run for its source revision.

The accepted PR 46 main attempt 2 passed all sixteen required cases and retained 33
PNGs, 30 managed captures and 13 source markers. Two comparison frames received
scoped visual review. The first attempt's picker interaction failure remains
recorded with unknown cause; passing the unchanged rerun does not establish
repeat reliability. Android 1.11 passed separate signed-package and delivery
review; physical use remains unperformed. [Current work](CURRENT_WORK.md) records
the exact release and limits.

The saved-watchlist export increment adds the
`savedWatchlistExportUsesSystemPickerAndPreservesDraft` journey to the required
native case set. It uses the real system document picker with an invented
DocumentsProvider declared only in the test APK. A separate test-only provider
offers fixed-cache metadata and reset calls restricted to the target app's UID.
The destination is test cache; no owner file, Downloads permission or cloud
account is involved. The runtime app must contain neither provider nor their
manifest declarations. Exact
UTF-8 file bytes, picker cancellation, pending-operation retirement and
recreation require separate assertions from the frontend adapter tests.

The production `InvestmentWatchlistExport` plugin is a separate, bounded text
output capability. Its chooser receives only an operation ID and version; the
chosen URI stays native. The managed client checks the current saved version
and session before handing text to the one-use write operation. No note text
is restored after Activity recreation, and ordinary stop/resume while the picker
is open retains the operation. Authentication and broad storage permissions are
unchanged. See [saved-watchlist export](APPWRITE_WATCHLIST.md#export-the-saved-watchlist)
for user behavior and [Current work](CURRENT_WORK.md) for executed evidence.

Each run retains its Android test results and HTML report. The workflow rejects
missing or skipped required tests. A failing emulator job prevents the source checks from accepting that revision for an
Appwrite release. Read the test report when a run fails; a successful build
alone does not mean the tests executed.

The managed lifecycle case covers same-process stop/resume, not recovery after
process death or persistent drafts. This native regression layer does not test managed sign-in,
shared watchlist saves, live Annual or price requests, production signing or upgrades
over an installed release. Those paths retain their existing unit/browser
coverage and selected physical Pixel checks. Routine changes covered by this
suite no longer require a manual APK installation for these checks.

In the managed Android workspace, Back closes an open Annual report or EOD close history through the
same action as the on-screen Back control, cancelling its read and restoring
focus without changing the draft. With no report open, existing WebView history
handles Back; at the root it leaves the screen open. Browser navigation and the
disconnected router keep their existing behavior.

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
substitute for physical Pixel results. The production 1.1 owner report remains
historical and does not accept later versions. See
[Current work](./CURRENT_WORK.md#current-capability-and-delivery-status) for version-specific physical
acceptance and its limits.
Native iOS and public store distribution are later
outcomes with separate toolchain, signing and device requirements.
