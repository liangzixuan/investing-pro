# Current work

Updated October 10, 2026 (UTC). This is the public repository's portable status.
[Product roadmap](PRODUCT_ROADMAP.md) owns goals and delivery order;
[architecture](ARCHITECTURE.md) explains runtime boundaries. Private operational
receipts remain outside Git. Earlier releases and bounded live journeys retain
their dates and limits in the [status archive](history/CURRENT_WORK-2026-10-10-before-pr65.md).

## Accepted release

[PR 65](https://github.com/liangzixuan/investing-pro/pull/65) is merged as
`3658cf15b3576d600274e50d9733a70cf347130e`, from candidate
`fff45b99e2ff86731fbf4847d8a1d9eb73acd25f`, with tree
`17d1e5177bc207b17798393186b292818a670b4e`. Five required actual-main workflows and
six jobs, the original producing-CI source proof and twenty invented-data native
cases are accepted. All original failures and earlier releases remain retained.

[Read reported annual history](MANAGED_SEC_ANNUAL.md#reported-annual-history)
opens up to three adjacent periods for an eligible named revenue basis from the
already loaded filing packet. It retains exact period ranges, unscaled revenue
and NetIncomeLoss, available net margin and inspectable observations. History
stops at the first missing, conflicting or invalid period; it keeps the selected
accession and basis. Accounting changes and restatements remain unadjusted.

An admitted third period joins the explicit Annual note-draft action. The complete
note must fit the existing 2,000-character limit. Reading and appending send no
source or save request. Review and Save watchlist remain explicit. Full current-note
reading, draft-aware sign-out and the earlier Price workflows remain available.
Full M1 and M2 remain open.

The API remains at deployment `6ac93c888eb42e76a4e5`. A fresh PR65 bundle built
after two consumed shared production inputs changed; its complete executable and
package bytes matched the accepted PR59 build from
`c2fe66ca102da0d5a751f610772cffa04b874701`. Source, tool and configuration hashes
were checked before and after, and one finite production-pointer read passed.
No API activation was needed. Authentication, entitlement and quotas are unchanged;
verification made no live provider request or owner-record write.

Website release
[38073652461](https://github.com/liangzixuan/investing-pro/actions/runs/38073652461),
attempt 1, promoted the same accepted archive after normal production approval.
Staging `6aca7c036f244f1b584d` and production `6aca7f3258ff62ec7f9d`
used the 831,924-byte archive, SHA-256
`c7aa4629e0b5191c23872b6fb2ce0a3f4c76e34de1e6665779d2acb1527082a7`.
Production replaced `6ac9b8b5853ab9a46dff`; its original
receipt verified activation at `2026-10-10T18:09:21.478Z`.
This is finite receipt evidence without a continuing availability claim.

Signed Android 1.20.0, code 21, passed build, complete artifact and delivery review
with package `app.investingpro.android` and the existing production signer.
The delivered APK is 6,659,632 bytes, SHA-256
`a10f067def8574eb191ae86a07b958997a90190cba8d46c7f0987936745c7d85`. Its source is the PR65 main commit above.
All prior APKs and rollback identities remain preserved. Physical Android 1.20
acceptance remains open.

The twenty-case API-36 emulator report covers three disconnected and seventeen
managed journeys. Twenty-six of sixty-two original PNGs received scoped visual
review. Fifty-nine callbacks, fifty-two phase diagnostics and the exact
1,091-character invented saved-note assertion are separate evidence; scoped
frames do not establish the entire note or chart visually. BrowserStack covered
the exact staging build's inert shell at desktop and narrow widths.

On October 10 the owner reported that the requested Android 1.19 and Brave
checklist passed on a Pixel 10 Pro XL running Android 17. It covered upgrade
without wiping saved data, company/watchlist full-note reading, unsaved drafts,
sign-out cancellation, and background/resume and reopening. The Brave visit
covered saved data and note reading with drafts and cancellation at desktop and
narrow widths. The report has no per-step logs, browser version or viewport
measurements. It retains its 1.19 scope; controlled authenticated browser recovery,
physical 1.20, screen-reader and backup/restore acceptance remain separate.
The earlier issue-free Pixel 1.13 report remains historical.

## Delivery status

| Surface                              | Accepted scope                                                                                 | Remaining acceptance                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Managed API and website              | Fresh complete byte-identical API build, finite pointer review and same-archive PR65 promotion | Continuing availability and controlled authenticated recovery |
| Signed Android 1.20                  | Build, complete artifact and exact delivered bytes                                             | Physical upgrade/use, screen-reader and backup/restore        |
| Synthetic native tests               | Twenty invented-data journeys and 26 scoped original frames                                    | Production sign-in, live provider use and physical behavior   |
| Physical Pixel and owner Brave visit | Owner-reported 1.19 checklist on Pixel 10 Pro XL / Android 17; earlier issue-free 1.13 use     | Separate 1.20, controlled recovery and backup/restore         |
| Local research app                   | Preserved local release and encrypted vault                                                    | No migration or managed feature-parity claim                  |

## What works in the managed product

[Markets](MANAGED_MARKETS_HOME.md) is the initial managed view on the website
and in signed Android 1.20. An explicit board load requests AAPL, GOOG and GOOGL
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

PR65 reported annual history is delivered on the website and in signed Android
1.20. Local calculation, rendering and note checks, actual-main source proof,
twenty native cases, 26 scoped frames, fresh byte-identical API build, same-archive
website promotion and signed delivery passed. Three-period availability depends
on the admitted packet; the release adds no feed, cohort, response field or request.

The next product outcome has not yet been selected. Prioritize useful daily
workflows and recovery using the existing modules and permitted sources. Controlled
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
