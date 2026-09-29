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

## Acceptance still required

The isolated trial API and website were activated on September 29. The seven
storage scenarios have accepted evidence: six phases passed directly, and the
overlap scenario was completed by a separate exact receipt-absence check after
the harness reached its request budget. The original failed report is retained.
The deployed website's four assets match the reviewed build; unauthenticated
requests, an invalid origin and an unknown route returned the expected responses.

The separate debug APK is built and its identity, bundled assets and signature
are checked. These results do not establish successful browser or Pixel sign-in.

Local tests, compilation and a debug APK are preparation. Accept the trial only
after observing the deployed function, exact browser build, real independent
sessions and synthetic shared reads/writes. Check stale edits, expired/denied
sessions, and sign-out in both directions.

The physical Pixel must also establish hosted callback/cancellation, Android Back,
background/resume, force-stop/relaunch and same-signature upgrade persistence.
BrowserStack covers browser behavior and cannot establish these native results.
Keep production Clerk adoption and owner migration pending until these checks and
the production privacy/recovery configuration are reviewed.

Actual source hashes, checks and cloud results are recorded in workspace
`CURRENT.md` and `tmp/clerk-trial`. Expected results are not acceptance.

## References

- [Clerk React SDK](https://clerk.com/docs/react/getting-started/quickstart)
- [Android hosted authentication](https://clerk.com/docs/android/guides/account-portal/hosted-auth)
- [Clerk environments and session differences](https://clerk.com/docs/guides/development/managing-environments)
- [Session token verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
- [Appwrite function execution](https://appwrite.io/docs/products/functions/execute)
