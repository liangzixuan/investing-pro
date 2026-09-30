# Clerk sign-in trial

The owner approved a separate Investment development application in Clerk. This
trial tests one account on desktop and the installed Android app, independent
sign-out, and a shared watchlist containing two invented entries. Appwrite remains
the hosting and storage service. The accepted local app and encrypted vault keep
their existing authentication. No owner research is migrated.

## Authentication and data

Desktop uses the official Clerk React SDK. Android uses Clerk's official Android
API SDK through the small `InvestmentAuth` Capacitor plugin. It opens Clerk's
hosted sign-in and lets the SDK handle its PKCE callback and encrypted credential
storage. Only the current short-lived token crosses into JavaScript when making
a protected request. The two SDKs are never initialized in the same Android view.

This intentionally changes the earlier Appwrite-cookie proposal for the trial.
Clerk's browser SDK exposes short-lived session tokens to JavaScript. Its
production browser client credential uses an HttpOnly cookie on the Clerk domain;
development instances use a different cross-site session mechanism. This trial
is a development instance and is unsuitable for owner financial data. It does not
establish production session configuration or the application's Pro entitlement.

The function verifies signatures and time claims using the official Clerk backend
SDK with a pinned public signing key. It checks the exact issuer, an active
session, and one configured allowed account ID before opening Appwrite storage.
Email addresses and client-supplied user IDs are not request authority. Public
signing-key rotation requires a reviewed configuration rebuild; an unknown key
fails closed.

Desktop tokens must name an allowed authorized party. Native tokens can omit that
claim because the Android SDK does not send a browser Origin header to Clerk.
That exception applies only to the explicit `https://localhost` native request
profile; a present authorized-party claim must still match. CORS controls browser
access. It does not attest that a request came from the installed app.

The public function accepts only its two trial routes. Every data operation uses
the existing Appwrite repository and bounded transport, fixed isolated tables,
and an execution credential limited to `rows.read` and `rows.write`. Clients have
no table or row grants. The synthetic catalog has no provider connection. A
private, separate proof function tests the existing transaction contract before
shared UI results can be accepted as cloud storage evidence.

## Session loss and saves

Each request captures its session identity. Sign-out or a session change clears
the watchlist and drafts, cancels requests, and prevents older responses from
restoring them. Tokens are requested from the SDK for each operation and are not
stored by the trial in localStorage or logs.

A stale edit retains its draft. An uncertain save retains its original command
key for explicit reconciliation; the client does not retry writes automatically.
Android clears its local session even when remote revocation cannot be confirmed,
and reports that uncertainty. A later request from an empty SDK client cannot
confirm revocation of the discarded session. Already issued JWTs remain subject
to their expiration; local sign-out is not a claim of immediate global revocation.

## Separate build profile

The normal mobile build remains disconnected. The trial uses
`vite.clerk-trial.config.ts` and `dist/clerk-trial`. Its build consumes only the
development publishable key and one exact HTTPS API origin. Environment-file
discovery and public-directory copying are disabled. The client bundle must not
contain the Clerk secret key, an Appwrite key, server modules, or vault code.

Build with the repository's pinned Node and pnpm versions. Supply the public key
as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and the reviewed API origin as
`INVESTMENT_CLERK_TRIAL_API_ORIGIN`, without printing either environment.

```text
pnpm --filter @research-cockpit/web exec vite build --config vite.clerk-trial.config.ts
```

Set `INVESTMENT_CLIENT_PROFILE=clerk-trial` only for the trial Capacitor sync, then
build Android with `-PinvestmentClerkTrial=true`. Its separate application ID is
`local.investment.personal.clerktrial`; it can coexist with the disconnected app.
The default profile retains `local.investment.personal`. The build rejects a
missing development public key. No secret key belongs in an Android build.

## Trial results and remaining acceptance

The isolated trial API and website were activated on September 29. The seven
storage scenarios have accepted evidence: six phases passed directly, and the
overlap scenario was completed by a separate exact receipt-absence check after
the harness reached its request budget. The original failed report is retained.
The deployed website's four assets match the reviewed build; unauthenticated
requests, an invalid origin and an unknown route returned the expected responses.

The separate debug APK's identity, bundled assets and signature were checked.
Root subsequently observed an authenticated desktop watchlist and explicitly
reloaded saved version 1 with its existing synthetic note unchanged.

On September 29 the owner reported completing all six steps of the
[Pixel checklist](../../tmp/clerk-trial/pixel-checklist.md) successfully. The
[acceptance record](../../tmp/clerk-trial/pixel-owner-acceptance.json) covers
installation and hosted sign-in, shared synthetic reads/writes, stale-draft
handling, independent sign-out in both directions, hosted callback cancellation,
Android Back, background/resume and force-stop/reopen. The previously identified
device is Pixel 10 Pro XL / Android 17. These are owner-reported results; no device
logs or per-step measurements were collected. Functional sign-out does not
establish immediate invalidation of an already issued token.

The initial trial supports continuing with Clerk for authentication and Appwrite
for hosting and storage. The owner later confirmed testing trial 1.1 in response
to the install-over-existing update handoff. This records overall test completion;
no itemized outcomes or device logs were supplied.
Live expired/denied-session behavior and response-retirement races
remain covered by focused tests rather than this owner checklist. Production
authentication, privacy/recovery configuration and release distribution still
need review before production adoption or owner-data migration. BrowserStack
remains browser-only and supplies no native evidence for this trial.

The version 1.1 trial APK (version code 2) has built successfully with the same
application ID, trial certificate and all eight packaged web/Capacitor assets
as the first APK. Four invalid-version cases were rejected, and a release build
without signing credentials failed before producing a release artifact. The
[update checklist](../../tmp/clerk-trial/android-release-preparation/pixel-upgrade-checklist.md)
defines the requested phone checks. The separate
[owner report](../../tmp/clerk-trial/android-release-preparation/pixel-upgrade-owner-report.json)
records the subsequent confirmation. Packaging evidence and the overall owner
report remain distinct; exact artifact evidence is in CURRENT.

Production also needs an owner-controlled domain and DNS, a separate production
instance/account allowlist, registered Android release certificate, and reviewed
production configuration. The owner reports registering `investingpro.app`,
superseding the earlier `investmentdesk.app` selection. A separate production
instance has now been created within the Investment Clerk application. A
follow-up check confirmed that the development instance remains present.
Clerk issued five required DNS records; the [domain handoff](../../tmp/clerk-trial/production-domain/plan.md)
records the actual configuration and remaining steps. DNS, certificates and
production sign-in remain unverified. Google sign-in, if retained, needs the
owner's production OAuth configuration. The existing trial remains available
while those inputs are prepared. [Clerk production setup](https://clerk.com/docs/guides/development/deployment/production).

Actual source hashes, checks and cloud results are recorded in workspace
`CURRENT.md` and `tmp/clerk-trial`. Expected results are not acceptance.

## References

- [Clerk React SDK](https://clerk.com/docs/react/getting-started/quickstart)
- [Android hosted authentication](https://clerk.com/docs/android/guides/account-portal/hosted-auth)
- [Clerk environments and session differences](https://clerk.com/docs/guides/development/managing-environments)
- [Session token verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
- [Appwrite function execution](https://appwrite.io/docs/products/functions/execute)
