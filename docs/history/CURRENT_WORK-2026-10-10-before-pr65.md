# Current work

Updated October 10, 2026 (UTC). This is the portable status summary for the public
repository. [Product roadmap](../PRODUCT_ROADMAP.md) owns goals and delivery order;
[architecture](../ARCHITECTURE.md) explains runtime boundaries. Private operational
receipts remain outside Git. Earlier releases and bounded live journeys are in
the [dated status archive](../history/CURRENT_WORK-2026-10-10-before-pr63.md).

## Accepted release

[PR 63](https://github.com/liangzixuan/investing-pro/pull/63) is merged as
`7d75eb2e015f943241ed099e4c4d5c0684f291e7`, from candidate
`ffae49b0d5e10145849e4a5cf95f75b6ab5e5c9c`, with tree
`5147bee5f8a7f23f7c1a489a6e6eb294f3444e14`. Three required actual-main workflows and
four jobs, the original producing-CI source proof and twenty invented-data native
cases are accepted. Original failures and earlier release evidence remain retained.

[Read full note](../MANAGED_RESEARCH_NAVIGATION.md#read-a-full-note) opens the complete
current watchlist draft as wrapped plain text in company research and My Watchlist.
Unsaved changes appear immediately, and the note remains readable while editing
is paused during recovery. Closing the reader keeps the draft. Opening it sends
no provider or save request. Save watchlist remains explicit, with the existing
field validation and session-retirement rules. Intentional sign-out review and
earlier Annual and Price workflows remain available. Full M1 and M2 remain open.

The API remains at deployment `6ac93c888eb42e76a4e5`, built from
PR 59's `c2fe66ca102da0d5a751f610772cffa04b874701`. Current source, tool,
configuration hashes and bundle inputs matched before and after one finite
production-pointer read. No new API build or activation was needed. Authentication,
entitlement and quota boundaries remain unchanged. Verification made no live
provider request or owner-record write.

Website release
[38021822858](https://github.com/liangzixuan/investing-pro/actions/runs/38021822858),
attempt 1, promoted the same accepted archive after normal production approval.
Staging `6ac9b59a1472e7aeba13` and production
`6ac9b8b5853ab9a46dff` used the 830,635-byte archive,
SHA-256 `616e1a7e2b9b7c79f3e566ff430e815aa6b1960c4f6c430b0720468634dbf77b`.
Production replaced `6ac98282697ead2c30bc`; its receipt
verified activation at `2026-10-10T04:02:28.131Z`. These are finite
observations, without a continuing availability claim.

Signed Android 1.19.0, code 20, passed build, complete artifact and delivery review
with package `app.investingpro.android` and the existing production signer.
The delivered APK is 6,658,868 bytes, SHA-256
`fc1e9d494ee07f9b77f6003dc688d2cc898a163d8eb8c4382d4d38d42bcf97b3`. Its source is the PR 63 main commit above.
Earlier APKs and rollback identities remain preserved. On October 10 the owner
reported that the requested Android 1.19 and Brave checklist passed on a Pixel
10 Pro XL running Android 17. This is owner-reported acceptance without per-step
device logs, browser version or viewport measurements.

The twenty-case API-36 emulator report covers three disconnected and seventeen
managed journeys. Twenty-two of fifty-eight original PNGs received scoped visual
review. Fifty-five capture callbacks, fifty-two phase diagnostics and the full
964-character invented saved-note assertion are separate native evidence;
scoped screenshots do not establish the full note or chart visually. BrowserStack
covered the exact staging build's inert shell at desktop and narrow widths.
The owner's checklist covers upgrade without wiping saved data, full current-note
reading, unsaved drafts and sign-out cancellation, and background/resume and
reopening. The requested Brave visit covered saved data and note reading with
unsaved drafts and cancellation at desktop and narrow widths. Agent-controlled
authenticated browser checks remain separate. Physical 1.14 through 1.18,
screen-reader and backup/restore acceptance remain open. The earlier issue-free
Pixel 1.13 report retains its original scope.

## Delivery status

| Surface                 | Accepted scope                                                                             | Remaining acceptance                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Managed API and website | PR 63 API continuity, same-archive promotion and owner-reported Brave checklist            | Continuing availability and controlled authenticated recovery           |
| Signed Android 1.19     | Build, complete artifact, delivered bytes and owner-reported Pixel checklist               | Screen-reader and backup/restore acceptance                             |
| Synthetic native tests  | Twenty invented-data journeys and 22 scoped frames                                         | Production sign-in, live-provider use and physical-device behavior      |
| Physical Pixel          | Owner-reported 1.19 checklist on Pixel 10 Pro XL / Android 17; earlier issue-free 1.13 use | Separate 1.14 through 1.18, screen-reader and backup/restore acceptance |
| Local research app      | Preserved local release and encrypted vault                                                | No migration or managed feature-parity claim                            |

## What works in the managed product

[Markets](../MANAGED_MARKETS_HOME.md) is the initial managed view on the website
and in signed Android 1.19. An explicit board load requests AAPL, GOOG and GOOGL
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

An explicit [Annual report](../MANAGED_SEC_ANNUAL.md) panel uses bounded SEC evidence.
A refresh keeps the prior validated report visible through supported transient
failure, cooldown and Cancel, with its original dates. The separate
[EOD close history](../MANAGED_EOD_HISTORY.md) panel loads one calendar month of raw
USD closes for AAPL, GOOG and GOOGL. Explicit refresh, Cancel, checked cooldowns
and supported transient failures retain the previous validated history with its
original dates. Back, retirement and fatal validation failures clear prices.
There is no automatic request or persistent price cache.
Both sections share a [company research visit](../MANAGED_RESEARCH_NAVIGATION.md)
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

The [Annual comparison](../MANAGED_SEC_ANNUAL.md#reported-annual-comparison) uses
the selected filing's reported comparatives, without adjusting period length,
accounting changes or restatements. Missing or conflicting prior evidence stays
unavailable; it is not replaced with another filing or revenue basis.

Earlier authenticated live reads established bounded AAPL, GOOG/GOOGL and
Markets journeys without watchlist mutation. Their original dates and limits
remain in the linked status archive; the new release does not repeat or broaden
that acceptance.

## Current task and next acceptance

Reading the complete current note draft is delivered through PR 63 on the website
and in signed Android 1.19. Local checks, actual-main source proof, twenty
invented-data native cases, 22 scoped original images, API continuity,
same-archive website promotion and signed delivery passed. The disclosure retains
the current draft and explicit Save. Synthetic coverage does not establish
physical upgrade, authenticated recovery or cloud restore.

The selected next company outcome is [reported annual history](../MANAGED_SEC_ANNUAL.md#reported-annual-history):
up to three adjacent periods from an already loaded, admitted filing packet,
with exact amounts, available net margins and an explicit third-period note
excerpt. Missing older evidence stays visible as unavailable. Implementation
and release acceptance are pending; production remains the PR 63 release above.
Controlled browser/session recovery, screen-reader and backup coverage remain
separate work. Broader fields or cohorts require a source, rights, cost and quota
review.

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

Read [AGENTS.md](../../AGENTS.md), this status and the feature guide. Reuse existing
contracts, providers and state owners; choose a bounded change. Verify affected
behavior and required types/lint/format/boundaries, then the applicable hosted
checks for the actual candidate. Preserve failures and existing deployments.

A source merge does not deploy the API, promote the website or update Android.
Website delivery promotes the same accepted archive. API and Android have their
own configuration, artifact and acceptance gates. See
[website delivery](../APPWRITE_DELIVERY.md), [Android](../ANDROID_CLIENT.md) and
[delivery source checks](../APPWRITE_DELIVERY.md#release-sequence).

Earlier local coverage is retained in [capability status](../CAPABILITY_STATUS.md),
[historical README](../history/README-2026-10-03.md), [build history](../BUILD_ROADMAP.md)
and [ADRs](../adr/). Their dated profiles and pending claims are historical, not
instructions to repeat an operation or override this status.
