# Current work

Updated October 3, 2026. This is the portable status summary for the public
repository. [Product roadmap](PRODUCT_ROADMAP.md) owns the goals and delivery
order; [architecture](ARCHITECTURE.md) explains the runtime boundaries. Private
operational receipts are retained separately and are not required to understand
or develop the repository.

## Accepted release

PR 26 is merged as `ae2cfbb48c672a5c960bce3910b526663f52734b`, from candidate
`36b632fb5a1ac26189e2caa2e232591498522dea`, with tree
`a875a56a830f173fbfaa54cca67c4f18263fafa7`. Exact-main checks, original source-proof
artifact and nine-case native evidence were accepted. These are source and
synthetic-runtime evidence; delivery was accepted separately below.

| Surface                   | Accepted outcome                                                                                                                                                                               | Limits                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Managed API               | Deployment `6ac0621a276fa6041126`; authenticated catalog/watchlist/Annual/EOD routes, private storage and shared request budgets; anonymous origin/authentication checks passed                | A receipt records activation at its observation time. Account-wide external provider consumption and continuing availability are not known |
| Managed website           | `https://app.investingpro.app`; deployment `6ac06b4e795ae249dc41`; exact staging archive promoted after the configured normal approval                                                         | Staging BrowserStack is an inert preview and does not exercise authenticated research                                                      |
| Signed Android artifact   | Investment 1.2.0, code 3, package `app.investingpro.android`; same production signer; independently accepted assets/manifest and delivered exact APK                                           | The 1.2 in-place installation and physical-phone behavior remain unverified                                                                |
| Automated Android         | Nine passing API-36 emulator cases, with original reports and images; managed fixture exercises catalog recovery, Annual refresh, EOD chart/table, Back, cancellation and same-Activity resume | Invented data, debug test fixture; no production sign-in, process-death persistence or physical-device claim                               |
| Previous physical Android | Owner-reported 1.1 in-place upgrade and supplied checklist passed on Pixel 10 Pro XL / Android 17                                                                                              | No per-step logs; this report does not accept 1.2                                                                                          |
| Local research app        | Preserved local release and encrypted vault, with broader research/portfolio tools                                                                                                             | No automatic migration or claim that these panels are available in the managed product                                                     |

The accepted 1.2 APK is 6,626,936 bytes, SHA-256
`5b9b27bf3384834f3725227b77b7aa8142e4d948dbbe567a1c0a98a3a1b5d958`.
Its prior 1.1 artifact and service rollback identities remain preserved. Signed
packages and operational evidence are not part of the public source tree.

## What works in the managed product

The fixed catalog contains AAPL, GOOG and GOOGL, preserving separate listing and
share-class identities. Discover and My Watchlist support shared notes, order,
removal, explicit saves, conflicts and uncertain-save reconciliation. Catalog
startup and search failures name their explicit recovery action.

An explicit [Annual report](MANAGED_SEC_ANNUAL.md) panel uses bounded SEC evidence.
A refresh keeps the prior validated report visible through supported transient
failure, cooldown and Cancel, with its original dates. The separate
[EOD close history](MANAGED_EOD_HISTORY.md) panel loads one calendar month of raw
USD closes only for AAPL. EOD refresh, Cancel, Back and retirement clear prices;
there is no automatic request or persistent price cache. Both panels preserve
the mounted watchlist draft and use the same close/focus action for Android Back.

At 03:55 UTC on October 3, one explicit authenticated AAPL `1m` UI load succeeded.
It showed Tiingo/raw USD history with 21 unique increasing dates from September 3
through October 2, within the requested September 3 to October 3 window. Back
restored focus; saved state was unchanged. No Refresh or watchlist write was
performed. This one case establishes a bounded live journey, not broader symbol,
field, entitlement, repeat reliability or physical-phone coverage.

## Current task and next acceptance

The active source task is a portable documentation and Repomix handoff. It changes
neither product behavior nor deployment. Start with [AI context](AI_CONTEXT.md)
for the overview and optional source exports, with their coverage limits.

The next device acceptance is a separately selected, brief 1.2 in-place upgrade
and normal navigation/background-resume observation. Preserve the installed
account and data; do not uninstall or clear data. Do not repeat passing native
checks or the live AAPL request merely to produce another pass. A broader product
slice must be selected from the [roadmap](PRODUCT_ROADMAP.md) with a concrete
user-visible outcome and available data.

## Open limits

- Managed EOD admission is AAPL only. GOOG/GOOGL remain catalog/Annual listings;
  no complete market or adjusted-return coverage follows from the one live case.
- Shared quota enforcement covers this application. It cannot measure other
  clients' account consumption; provider rate limits still apply.
- Unsaved drafts live in the mounted session. Same-Activity resume is covered;
  durable offline editing and process-death draft restoration are not implemented.
- Managed storage is not the local vault's application-layer encryption. Owner
  data migration and a managed data-recovery design require separate acceptance.
- Full local financials, comparisons, valuation, screening, portfolio and updates
  are not yet integrated into the managed browser/Android surface.
- Native iOS, public app-store distribution, a full accessibility audit, broad
  performance coverage and sustained daily-use reliability remain separate work.
- Existing CodeScene findings are advisory, source-reviewed maintenance evidence;
  a score is not a correctness or product-coverage result.

## Working loop

Read [AGENTS.md](../AGENTS.md), this status and the feature guide. Reuse existing
contracts, providers and state owners; choose a bounded change. Verify affected
behavior and required types/lint/format/boundaries, then the applicable hosted
checks for the actual candidate. Preserve failures and existing deployments.

A source merge does not deploy the API, promote the website or update Android.
Website delivery promotes the same accepted archive. API and Android have their
own configuration, artifact and acceptance gates. See
[website delivery](APPWRITE_DELIVERY.md), [Android](ANDROID_CLIENT.md) and
[delivery source checks](APPWRITE_DELIVERY.md#release-sequence).

Earlier local coverage is retained in [capability status](CAPABILITY_STATUS.md),
[historical README](history/README-2026-10-03.md), [build history](BUILD_ROADMAP.md)
and [ADRs](adr/). Their dated profiles and pending claims are historical, not
instructions to repeat an operation or override this status.
