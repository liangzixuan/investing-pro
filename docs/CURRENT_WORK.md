# Current work

Updated October 11, 2026 (UTC). This is the public repository's portable status.
[Product roadmap](PRODUCT_ROADMAP.md) owns goals and delivery order;
[architecture](ARCHITECTURE.md) explains runtime boundaries. Private operational
receipts remain outside Git. Earlier releases and bounded live journeys retain
their dates and limits in the [status archive](history/CURRENT_WORK-2026-10-10-before-pr65.md).

## Accepted release

[PR 69](https://github.com/liangzixuan/investing-pro/pull/69) is merged as
`cd285576508a3da59610b6e87730b2d0a598ed2d`, from candidate
`14beff5acacd4950a984161465d0796c8e48060f`, with tree
`e6cdd0a080680c952013119e74714ccf676550f6`. All five required actual-main workflows and six jobs passed.
The original Windows CI attempt failed at the unchanged 5,000 ms dossier test
limit; one unchanged Windows retry passed. A fresh Linux execution produced
source proof for CI attempt 3. Its carried Windows metadata retains the attempt 2
execution; it does not represent a third Windows run. The original failure
remains retained and its cause is unproven.

Reported annual history now shows the earlier adjacent revenue and net-income
comparison when all three periods are admitted. Both date ranges, exact raw USD
amounts, changes, available percentages and original observations remain visible.
The dated excerpt joins the explicit Annual note-draft action under the unchanged
2,000-character whole-note limit. Reading and appending make no source request or
save. Missing or conflicting third-period evidence leaves the two-period view
and note unchanged. Same-filing, period, revenue-basis and accounting limits
remain in the [Annual guide](MANAGED_SEC_ANNUAL.md#earlier-reported-changes).

The website retains PR67's standard leave-confirmation request for unsaved or
uncertain watchlist work. Browsers can suppress the dialog; actual dialog
acceptance remains separate. Native Android and disconnected sessions omit it.
Full-note reading, draft-aware sign-out and the Price workflows remain available.
Full M1 and M2 remain open.

A fresh PR69 API build matched every executable and package byte of the accepted
prior bundle. One finite production-pointer read verified deployment
`6ac93c888eb42e76a4e5`; no API activation was needed. Its original build source
remains `c2fe66ca102da0d5a751f610772cffa04b874701`. Authentication,
entitlement and quotas are unchanged. Verification made no live provider request
or owner-record write.

Website release
[38108523911](https://github.com/liangzixuan/investing-pro/actions/runs/38108523911),
attempt 1, promoted the same accepted archive after normal approval.
Staging `6acb02a7be2e811dcde7` and production `6acb05c91d08729f1b03`
used the 832,057-byte archive, SHA-256
`3e393efffff611190bc95814e12c143ae8a10e8a72422162821654aad9c6dfa6`.
Production replaced `6acac6ae6f819df0aa99`; its original
receipt verified activation at `2026-10-11T03:43:35.617Z`.
This is finite receipt evidence without a continuing availability claim.

Signed Android 1.21.0, code 22, passed build, complete artifact and exact delivery
review with package `app.investingpro.android` and the existing production signer.
Its source is the PR69 main commit above. The APK is 6,660,096 bytes,
SHA-256 `e4b185cb5b08f30489d461eca1292fa65b63d355eec436791cb06089e05e85ce`.
Android 1.20 and earlier APKs, signing custody and rollback identities remain
preserved. Physical use of Android 1.20 and 1.21 remains open.

The twenty-case API-36 emulator report covers three disconnected and seventeen
managed journeys. Twenty-eight of sixty-four original PNGs received scoped visual
review. Sixty-one callbacks, fifty-two phase diagnostics and the exact
1,274-character saved-note assertion are separate evidence; scoped frames do not
establish the entire note or chart visually. BrowserStack covered the exact
staging build's inert shell at desktop and narrow widths.

On October 10 the owner reported the requested Android 1.19 and Brave checklist
passed on a Pixel 10 Pro XL running Android 17. It covered upgrade without wiping
saved data, company/watchlist full-note reading, unsaved drafts, sign-out
cancellation, and background/resume and reopening. The Brave visit covered saved
data, note reading, drafts and cancellation at desktop and narrow widths. The
report has no per-step logs, browser version or viewport measurements. It retains
its 1.19 scope. Controlled authenticated browser recovery, physical 1.20 and 1.21,
screen-reader and backup/restore acceptance remain separate. The earlier
issue-free Pixel 1.13 report remains historical.

The [previous status](history/CURRENT_WORK-2026-10-11-before-pr69.md) preserves
PR65/PR67 delivery details and prior failures with their original scope.

## Delivery status

| Surface                              | Accepted scope                                                                             | Remaining acceptance                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Managed API and website              | Fresh complete byte-identical API build, finite pointer and same-archive PR69 promotion    | Continuing availability and controlled authenticated recovery |
| Signed Android 1.21                  | Build, complete artifact and exact delivered bytes                                         | Physical upgrade/use, screen-reader and backup/restore        |
| Synthetic native tests               | Twenty invented-data journeys and 28 scoped original frames                                | Production sign-in, live provider use and physical behavior   |
| Physical Pixel and owner Brave visit | Owner-reported 1.19 checklist on Pixel 10 Pro XL / Android 17; earlier issue-free 1.13 use | Separate 1.20/1.21, controlled recovery and backup/restore    |
| Local research app                   | Preserved local release and encrypted vault                                                | No migration or managed feature-parity claim                  |

## What works in the managed product

[Markets](MANAGED_MARKETS_HOME.md) is the initial managed view on the website
and in signed Android 1.21. An explicit board load requests AAPL, GOOG and GOOGL
sequentially. Each row keeps its own trading dates and shows the raw USD difference
and four-decimal percentage between its final two observations, with both dates
and a split/dividend disclosure. One-row history reports an unavailable change.
Selecting a row reuses its chart and exact-value table. Load or Refresh for the
named selection requests only that listing. Changing selection
while it runs does not retarget the request; the other rows stay unchanged.
Research opens without another price load, and Back returns to the board opener.
Leaving Markets clears prices without changing the mounted watchlist draft.
The board covers three listings for two issuers; it has no mover rankings,
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
Both sections share a [company research visit](MANAGED_RESEARCH_NAVIGATION.md)
with a stable listing header. Switching cancels pending local work and retains
validated results and provenance; returning sends no request. Back returns to
the original opener, or Markets for a direct link, and preserves the mounted
watchlist draft. Leaving the visit,
selecting another listing, or catalog, session or watchlist-identity invalidation
clears both sections. Reopening through a URL starts unloaded; PR 53 carries
validated history from loaded Markets rows. Android Back uses the same
close/focus action. Markets board snapshots remain separate from company Price.

A bookmarkable root URL identifies the exact listing and its Price or Annual
section. Opening it resolves current catalog metadata and starts research
unloaded. Section changes replace the company history entry; browser
Back/Forward and Android Back use the same visit lifecycle. Review in My
Watchlist closes the research URL without saving the draft.

The [Annual comparison](MANAGED_SEC_ANNUAL.md#reported-annual-comparison) uses
the selected filing's reported comparatives, without adjusting period length,
accounting changes or restatements. Missing or conflicting prior evidence stays
unavailable; it is not replaced with another filing or revenue basis.

Earlier authenticated live reads established bounded AAPL, GOOG/GOOGL and
Markets journeys without watchlist mutation. Their original dates and limits
remain in the linked status archive; the new release does not repeat or broaden
that acceptance.

## Current task and next acceptance

PR69's earlier reported annual changes are delivered on the website and in signed
Android 1.21. Source checks, producing source proof, twenty native cases, scoped
pixels, complete API bytes, same-archive promotion and signed delivery passed.
Physical 1.20/1.21, the actual browser leave dialog, controlled authenticated
recovery, screen-reader and backup/restore acceptance remain open. The owner's
1.19 report retains its scope. Original CI/native failures remain preserved;
later successful executions do not establish their causes or exclude regressions.

Prioritize useful daily workflows and recovery using the existing modules and
permitted sources. Controlled
session conflicts, physical upgrade/use, screen-reader and backup/restore coverage
retain their separate acceptance requirements. Broader fields or cohorts need a
source, rights, cost and quota review.

Keep authenticated-browser coverage separate from the inert BrowserStack shell.
Use narrowly controlled identities and invented records when that work is
authorized. Preserve origin, authentication, request and owner-data boundaries.
Supported browser availability is an operational prerequisite; a startup failure
does not justify changing authentication or substituting an unsupported browser.

Repomix PR 27 remains held under the resolved Option A. Do not reopen that
decision as part of this release. Broader company fields, cohorts and sources
require their own declared availability, rights, cost and quota review.

## Open limits

- Managed EOD admission covers three exact listings for two issuers. No complete
  market, adjusted-return or index coverage follows from those bounded reads.
- Shared quota enforcement covers this application. It cannot measure other
  clients' account consumption; provider rate limits still apply.
- Unsaved drafts live in the mounted session. Same-Activity resume is covered;
  durable offline editing and process-death draft restoration are not implemented.
  Bookmarkable URLs do not register external Android app links or establish
  process-death restoration.
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
