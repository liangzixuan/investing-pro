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

## Explicit build profiles

The normal mobile build remains disconnected. The synthetic client and function
require an explicit `development` or `production` environment. Missing, unknown
or mixed configuration fails before output is created or cleaned. Both builders
use the same checked configuration as their runtime consumer.

For the client, set `INVESTMENT_CLERK_ENVIRONMENT`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `INVESTMENT_CLERK_TRIAL_API_ORIGIN`.
The official Clerk key parser checks the environment and Frontend API host.
Its direct `@clerk/shared` dependency is included in the runtime notice mapping
and the client's bundled license texts.
Development uses its matching `*.clerk.accounts.dev` host and the reviewed API
`https://investment-clerk-api-6abac57a.appwrite.network`. Production requires
`https://clerk.investingpro.app` and `https://api.investingpro.app`.
The production API domain and HTTPS boundary checks are accepted; authenticated
account access is a separate deployment decision.
Environment-file discovery and public-directory copying remain disabled.
The client accepts no server key, account allowlist or storage routing fields.

Build with the repository's pinned Node and pnpm versions:

```text
pnpm --filter @research-cockpit/web exec vite build --config vite.clerk-trial.config.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/clerk-trial/build-function.ts demo <reviewed-config-path>
```

The function input contains `environment`, `auth` and `allowedOrigins`. Validation
checks nested fields and copies the accepted configuration before composing the
request handler. Storage endpoint, project and table names are fixed. Each
profile selects its own fixed database; callers cannot supply routing IDs.
The development function accepts only the existing issuer
`https://allowed-lobster-3386.clerk.accounts.dev`, the trial website origin and
its optional `https://localhost` Android origin.

| Profile     | Client output                    | Function output                  | Synthetic database               |
| ----------- | -------------------------------- | -------------------------------- | -------------------------------- |
| Development | `apps/web/dist/clerk-trial`      | `dist/clerk-trial-function`      | `investment_clerk_trial_v1`      |
| Production  | `apps/web/dist/clerk-production` | `dist/clerk-production-function` | `investment_clerk_prod_trial_v1` |

Production accepts only issuer `https://clerk.investingpro.app` and the sole
browser origin and authorized party `https://app.investingpro.app`. Its allowed
subject is either `null` or one explicitly configured Clerk `user_` ID. Null
denies every account before storage opens; a configured ID admits only a valid
active session from that exact production account. Confirm the account in the
correct production instance before building its server configuration. Email,
client-supplied identity and a development user ID cannot confer access. Keep
the account ID out of the public client. No native-origin exception is allowed.
The separate production database and service are provisioned and have accepted
synthetic transaction evidence. They do not connect the full research workspace
or migrate owner data.

The production web bundle includes its source SHA and uses the existing
[staging and promotion workflow](./APPWRITE_DELIVERY.md). At the exact staging
origin it renders an inert preview of the real frame and notices, with neither
SDK nor a watchlist session. Only `https://app.investingpro.app` mounts the
production Clerk client. BrowserStack staging acceptance covers this preview;
real sign-in, shared saves and session behavior require canonical-origin checks.

Production client configuration is rejected on a native platform before either
SDK adapter mounts. For the accepted development Android trial, set
`INVESTMENT_CLIENT_PROFILE=clerk-trial` only for Capacitor sync and build with
`-PinvestmentClerkTrial=true`. Its application ID is
`local.investment.personal.clerktrial`; it can coexist with the disconnected app.
The default profile retains `local.investment.personal`. No secret key belongs
in either client bundle or an Android build. Synthetic configuration/build checks
prove composition, not service-issued key ownership or production sign-in.

## Private storage proof profiles

The private storage proof requires an explicit `development` or `production`
build profile. The selected database, invented principal and command-key prefix
are fixed by that profile. An HTTP request cannot select a profile or storage
target. Missing or unknown profiles fail before output cleanup or storage opens.

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/clerk-trial/build-proof.ts development
node --import ./node_modules/tsx/dist/loader.mjs scripts/clerk-trial/build-proof.ts production
```

Development builds to `dist/clerk-trial-proof`; production builds to
`dist/clerk-production-proof`. The plan digest includes the selected target and
invented identity. The build marker binds that plan, profile and source hashes.
Both profiles retain the seven existing transaction scenarios and their request
budgets, deadlines and finite traces. Development results do not establish
production storage acceptance.

The production service layer uses the separate database
`investment_clerk_prod_trial_v1`, private proof function
`investment_watchlist_prod_proof_v1` and API function
`investment-clerk-prod-trial-v1`. Provisioning must preserve empty client
permissions, row security and the execution credential's existing row scopes.
The private proof has no public execution grant, event or schedule. The API keeps
production account admission closed until an exact subject is independently
confirmed and its configuration is deployed. All seven production storage
scenarios and the API domain/HTTPS rejection checks have accepted evidence.
Workspace CURRENT records actual schema, transaction, deployment and account
outcomes; source changes alone do not establish a running update.

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

Production needs an account allowlist, registered Android release certificate,
and reviewed production client/API configuration. The owner registered `investingpro.app`,
superseding the earlier `investmentdesk.app` selection. A separate production
instance has now been created within the Investment Clerk application. A
follow-up check confirmed that the development instance remains present.
All six approved CNAME records are saved at Name.com, and public DNS matches the
Appwrite target and five Clerk targets. `app.investingpro.app` serves the accepted
static build over verified HTTPS. Clerk reports DNS, SSL and email verification
complete. Independent requests validated the certificates on both Clerk hosts.
The account domain and its documented `/sign-in` page returned HTTP 403 to
unauthenticated HTTP checks, including one sign-in-page check after Clerk's
verification completed. The cause is unresolved. A later normal Brave navigation
rendered the production sign-in form with its email and Google options. No
credentials or account choice were entered, and no form was submitted. This
verifies page rendering only; successful production sign-in, callbacks and
account admission remain untested. The
[domain handoff](../../tmp/clerk-trial/production-domain/plan.md) records the actual
configuration and remaining steps. Google sign-in, if retained, needs the
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
