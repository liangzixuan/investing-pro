# Current work

Updated October 4, 2026. This is the portable status summary for the public
repository. [Product roadmap](PRODUCT_ROADMAP.md) owns the goals and delivery
order; [architecture](ARCHITECTURE.md) explains the runtime boundaries. Private
operational receipts are retained separately and are not required to understand
or develop the repository.

## Accepted release

PR 32 is merged as `9f1cc5fd3c0f651dcb77562721640ec5180fead5`, from candidate
`8db89fa3b677cbc4751898ab130f69a07a5c2fbb`, with tree
`947aef84ea1df5cdbe8d0ce315c52d872b28a0b0`. Exact-main source checks, the original
source proof and eleven-case native evidence were accepted. The website now opens
on the three-listing Markets board, with direct research navigation and retained
refresh histories. Staging passed the exact-build BrowserStack gate, followed by
normal production approval and promotion of the same archive. Signed Android
1.3 packages that accepted source with the existing production signer.

| Surface                   | Accepted outcome                                                                                                                                                                                | Limits                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Managed API               | Deployment `6ac20862d12fe7560852`; authenticated catalog/watchlist/Annual/EOD routes, private storage and shared request budgets; anonymous origin/authentication checks passed                 | A receipt records activation at its observation time. Account-wide external provider consumption and continuing availability are not known |
| Managed website           | `https://app.investingpro.app`; deployment `6ac270590470af29a5a5`; PR 32 staging archive promoted after the configured normal approval                                                          | Staging BrowserStack is an inert preview and does not exercise authenticated research                                                      |
| Signed Android artifact   | Investment 1.3.0, code 4, package `app.investingpro.android`; same production signer; independently accepted assets/manifest and delivered exact APK                                            | The 1.3 in-place installation and physical-phone behavior remain unverified                                                                |
| Automated Android         | Eleven passing API-36 emulator cases, with original reports and images; includes Markets and direct research switching alongside recovery, refresh, Back, cancellation and same-Activity resume | Invented data, debug test fixture; no production sign-in, process-death persistence or physical-device claim                               |
| Previous physical Android | Owner-reported 1.1 in-place upgrade and supplied checklist passed on Pixel 10 Pro XL / Android 17                                                                                               | No per-step logs; this report does not accept 1.2 or 1.3                                                                                   |
| Local research app        | Preserved local release and encrypted vault, with broader research/portfolio tools                                                                                                              | No automatic migration or claim that these panels are available in the managed product                                                     |

The accepted 1.3 APK is 6,631,716 bytes, SHA-256
`d8b68ba6575157dae226cf686b7c6b283f8e981936cbab37aa77ecb3085cd09f`.
It records candidate `8db89fa3b677cbc4751898ab130f69a07a5c2fbb`, whose tree matches
the accepted main above. Prior 1.2 and 1.1 artifacts and service rollback
identities remain preserved; physical 1.2 use is also unverified. Signed
packages and operational evidence are not part of the public source tree.

## What works in the managed product

[Markets](MANAGED_MARKETS_HOME.md) is the initial managed view on the website
and in signed Android 1.3. An
explicit board load requests AAPL, GOOG and GOOGL sequentially. Each row keeps
its own trading date; selecting a row reuses its chart and exact-value table.
Research opens without another price load, and Back returns to the board opener.
Leaving Markets clears prices without changing the mounted watchlist draft.
The board covers three listings for two issuers; it has no percentage movers,
live quotes, index or whole-market coverage.

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
for Android Back. The website and signed Android 1.3 switch directly between these panels for the
same listing and return to the original workspace opener.

At 03:55 UTC on October 3, one explicit authenticated AAPL `1m` UI load succeeded.
It showed Tiingo/raw USD history with 21 unique increasing dates from September 3
through October 2, within the requested September 3 to October 3 window. Back
restored focus; saved state was unchanged. No Refresh or watchlist write was
performed. On October 4, one explicit GOOG load and one GOOGL load each returned
20 unique increasing dates from September 4 through October 2, within their
September 4 to October 4 window. Each Back preserved the saved workspace.
At 15:46 UTC on October 4, one production Markets board load returned 20 dated
rows for each listing, from September 4 through October 2. GOOG and GOOGL stayed
separate. Back preserved the loaded board and focused its opener; My Watchlist
was unchanged. Returning to Markets cleared prices without reloading. This
journey used no Refresh, separate panel Load or watchlist mutation.
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

The [three-listing Markets home](MANAGED_MARKETS_HOME.md) implementation is
merged in [PR 31](https://github.com/liangzixuan/investing-pro/pull/31), followed
by the staging smoke-copy correction in
[PR 32](https://github.com/liangzixuan/investing-pro/pull/32). Website release
[37210783945](https://github.com/liangzixuan/investing-pro/actions/runs/37210783945)
passed staging and promoted the same archive to production.

The prior website run
[37200994777](https://github.com/liangzixuan/investing-pro/actions/runs/37200994777)
failed its BrowserStack step and skipped production. Its original failure is
retained. The source mismatch in two expected text strings was confirmed; that
remote failure's specific assertion remains unobserved. Earlier PR failures in
the staging heading and native screenshot framing also remain in the record.

Signed Android 1.3.0/code 4 has passed build and artifact review and was copied
with its original acceptance receipts to a fresh delivery folder. It carries
Markets, direct research switching and retained refresh histories in the existing
production package with the same signer. Preserve the installed account and data;
do not uninstall or clear storage. Physical-device acceptance remains separate
from source, emulator, website and signed-artifact checks.

Next, select one bounded company-page workflow from the roadmap using existing
contracts and dependencies. No broader provider coverage is implied by this
release. Physical-phone checks remain open until actual device evidence exists.

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
