# Current work

Updated October 4, 2026. This is the portable status summary for the public
repository. [Product roadmap](PRODUCT_ROADMAP.md) owns the goals and delivery
order; [architecture](ARCHITECTURE.md) explains the runtime boundaries. Private
operational receipts are retained separately and are not required to understand
or develop the repository.

## Accepted release

PR 30 is merged as `ecc6a725087d9680e0626a095a62ace0942399e5`, from candidate
`d7b7b898830c8e9f446611a4e2ca48f0645efd12`, with tree
`55f5b7608bf845fa33306ffcf513d9115d4013b5`. Exact-main checks, the original
source-proof artifact and ten-case native evidence were accepted. Its direct
Annual/price-history navigation and retained EOD refresh history are delivered on
the website. The API's reviewed configuration expanded to GOOG and GOOGL on
October 4. The signed Android package remains the separately accepted PR 26 release.

| Surface                   | Accepted outcome                                                                                                                                                                                     | Limits                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Managed API               | Deployment `6ac20862d12fe7560852`; authenticated catalog/watchlist/Annual/EOD routes, private storage and shared request budgets; anonymous origin/authentication checks passed                      | A receipt records activation at its observation time. Account-wide external provider consumption and continuing availability are not known |
| Managed website           | `https://app.investingpro.app`; deployment `6ac1eea5994b1cfedc10`; PR 30 staging archive promoted after the configured normal approval                                                               | Staging BrowserStack is an inert preview and does not exercise authenticated research                                                      |
| Signed Android artifact   | Investment 1.2.0, code 3, package `app.investingpro.android`; same production signer; independently accepted assets/manifest and delivered exact APK                                                 | The 1.2 in-place installation and physical-phone behavior remain unverified                                                                |
| Automated Android         | Ten passing API-36 emulator cases, with original reports and images; includes direct research switching alongside catalog recovery, Annual refresh, EOD, Back, cancellation and same-Activity resume | Invented data, debug test fixture; no production sign-in, process-death persistence or physical-device claim                               |
| Previous physical Android | Owner-reported 1.1 in-place upgrade and supplied checklist passed on Pixel 10 Pro XL / Android 17                                                                                                    | No per-step logs; this report does not accept 1.2                                                                                          |
| Local research app        | Preserved local release and encrypted vault, with broader research/portfolio tools                                                                                                                   | No automatic migration or claim that these panels are available in the managed product                                                     |

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
USD closes for AAPL, GOOG and GOOGL. Explicit refresh, Cancel, checked cooldowns
and supported transient failures retain the previous validated history with its
original dates. Back, retirement and fatal validation failures clear prices.
There is no automatic request or persistent price cache.
Both panels preserve the mounted watchlist draft and use the same close/focus action
for Android Back. The website now switches directly between these panels for the
same listing and returns to the original workspace opener. Signed Android 1.2
predates that navigation update.

At 03:55 UTC on October 3, one explicit authenticated AAPL `1m` UI load succeeded.
It showed Tiingo/raw USD history with 21 unique increasing dates from September 3
through October 2, within the requested September 3 to October 3 window. Back
restored focus; saved state was unchanged. No Refresh or watchlist write was
performed. On October 4, one explicit GOOG load and one GOOGL load each returned
20 unique increasing dates from September 4 through October 2, within their
September 4 to October 4 window. Each Back preserved the saved workspace.
These cases establish their bounded live journeys, not other fields, ongoing
availability, repeat reliability or physical-phone coverage.

## Current task and next acceptance

The portable documentation update in PR 28 is accepted on main
`f18d80153e94dcb6236e31fd8324ee3e23a3bde0`. Its original source proof, applicable
main jobs and nine-case synthetic native report were accepted. It changed no
application behavior and required no deployment. Repomix remains unmerged in
[PR 27](https://github.com/liangzixuan/investing-pro/pull/27): its required
Dependency Review failed on `braces@3.0.3`,
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
As of October 3, the upstream investigation found no suitable mature released fix.
The security check stays unchanged. The Repomix package and workflow remain in
the unmerged PR. [AI context](AI_CONTEXT.md) gives a manual reading guide and
distinguishes its reviewed artifact from the source in this documentation tree.

The selected product slice is the [three-listing Markets home](MANAGED_MARKETS_HOME.md).
It uses the accepted AAPL/GOOG/GOOGL mappings, explicit sequential price loading,
dated per-row histories, a selected chart and direct research/watchlist navigation.
Its visit-scoped prices and shared EOD cooldown preserve the mounted watchlist
draft. It has no percentage movers or unsupported market feeds. Implementation is
merged in [PR 31](https://github.com/liangzixuan/investing-pro/pull/31) as
`47f29cd91cf239224b0cc0f1e1a743c2d03d2a3e`. Applicable main checks, the original
source proof and eleven-case synthetic native evidence were accepted. The first
PR run's stale staging heading assertion and catalog screenshot framing failure
remain in the verification record.

Website release [37200994777](https://github.com/liangzixuan/investing-pro/actions/runs/37200994777)
deployed to staging, then failed its BrowserStack step; production was skipped.
The smoke test still expected the previous managed heading and description. The
follow-up corrects those two expectations while preserving exact-build identity,
request isolation, error checks and desktop/narrow layout assertions. The source
mismatch is confirmed; the remote failure's specific assertion has not been
observed. Fresh hosted verification and website delivery remain pending. This
does not change the accepted website or signed Android baseline above.

The next device acceptance is a separately selected, brief 1.2 in-place upgrade
and normal navigation/background-resume observation. Preserve the installed
account and data; do not uninstall or clear data. Do not repeat passing native
checks or the live AAPL request merely to produce another pass. A broader product
slice must be selected from the [roadmap](PRODUCT_ROADMAP.md) with a concrete
user-visible outcome and available data.

## Open limits

- Managed EOD admission covers three exact listings for two issuers. No complete
  market, adjusted-return or index coverage follows from those bounded reads.
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
