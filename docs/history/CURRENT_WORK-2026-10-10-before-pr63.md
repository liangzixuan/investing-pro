# Current work before PR 63

Updated October 10, 2026 (UTC). This is the portable status summary for the public
repository. [Product roadmap](../PRODUCT_ROADMAP.md) owns goals and delivery order;
[architecture](../ARCHITECTURE.md) explains runtime boundaries. Private operational
receipts remain outside Git. Earlier releases and bounded live journeys are in
the [dated status archive](../history/CURRENT_WORK-2026-10-10-before-pr61.md).

## Accepted release

[PR 61](https://github.com/liangzixuan/investing-pro/pull/61) is merged as
`ed3e342f8223eff9ff589e39c74b015e45217fe7`, from candidate
`da6dad8dd3728bda7d23666c485f01fdd98cc8cf`, with tree
`31079cbfb809e8f913b21e6b6b43bb5f1e69ec0d`. Three required actual-main workflows and
four jobs, the original producing-CI source proof and twenty invented-data native
cases are accepted. Original failures and the unchanged-job capture retry remain
preserved; the passing retry does not establish the original failure's cause.

[Intentional sign-out review](../APPWRITE_WATCHLIST.md#review-an-intentional-sign-out)
lets the user keep editing or confirm sign-out when the draft is unsaved, a save
is running or its result is uncertain. The save review explains that the server
may already have committed it. Staying preserves the original command; confirming
clears local command details through the existing session operation. A later
sign-in and saved-version read is needed to check the outcome. Clean sign-out
remains direct. Expiry, authentication rejection and session replacement still
retire the workspace immediately and fence stale confirmations and late responses.
This completes the selected sign-out outcome without changing authentication,
storage, providers or dependencies. Earlier Annual comparisons and recovery remain
available; full M1 and M2 remain open.

The API remains at deployment `6ac93c888eb42e76a4e5`, built from
PR 59's `c2fe66ca102da0d5a751f610772cffa04b874701`. Current source, tool,
configuration hashes and bundle inputs matched before and after one finite
production-pointer read. No API build or activation was needed. Authentication,
source entitlement and quota boundaries remain unchanged. Verification made no
live provider request or owner-record write.

Website release
[38006849982](https://github.com/liangzixuan/investing-pro/actions/runs/38006849982),
attempt 1, promoted the same accepted archive after normal production approval.
Staging `6ac97f6adc9be5748522` and production
`6ac98282697ead2c30bc` used the 831,131-byte archive,
SHA-256 `26f50e270ad43204e26311b22f675be2036cf8b2e5d3a7ec1ef289abd920badc`.
Production replaced `6ac9440624fa2932a6da`; its receipt
verified activation at `2026-10-10T00:11:13.402Z`. These are finite
observations, without a continuing availability claim.

Signed Android 1.18.0, code 19, passed build, complete artifact and delivery review
with package `app.investingpro.android` and the existing production signer.
The delivered APK is 6,658,748 bytes, SHA-256
`7345027fc962a412492b6ddf49799cab4eec78a50eed21702a32cf79df983d75`. Its source is the PR 61 main commit above.
Earlier APKs and rollback identities remain preserved. Physical 1.18 installation
or use is not accepted here.

The twenty-case API-36 emulator report covers three disconnected and seventeen
managed journeys. Twenty of fifty-six original PNGs received scoped visual review.
Fifty-three capture callbacks, fifty-two phase diagnostics and the full
964-character invented saved-note assertion are separate native evidence;
scoped screenshots do not establish the full note or chart visually. BrowserStack
covered the exact staging build's inert shell at desktop and narrow widths.
Authenticated browser use, physical Pixel 1.14 through 1.18, separate screen-reader
and backup/restore acceptance remain open. The owner reported Pixel use of 1.13
without issues, without per-step logs.

## Delivery status

| Surface                 | Accepted scope                                          | Remaining acceptance                                                    |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Managed API and website | PR 61 API continuity and same-archive website promotion | Continuing availability and authenticated browser recovery use          |
| Signed Android 1.18     | Build, complete artifact and exact delivered bytes      | Physical upgrade and use                                                |
| Synthetic native tests  | Twenty invented-data journeys and twenty scoped frames  | Production sign-in, live-provider use and physical-device behavior      |
| Physical Pixel          | Owner reported issue-free Android 1.13 use              | Separate 1.14 through 1.18, screen-reader and backup/restore acceptance |
| Local research app      | Preserved local release and encrypted vault             | No migration or managed feature-parity claim                            |

## What works in the managed product

[Markets](../MANAGED_MARKETS_HOME.md) is the initial managed view on the website
and in signed Android 1.18. An explicit board load requests AAPL, GOOG and GOOGL
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

The selected next outcome is [reading a complete current note
draft](../MANAGED_RESEARCH_NAVIGATION.md#read-a-full-note) in company research and
My Watchlist. The inline disclosure reuses the shared editor and wrapped plain
text. It retains explicit Save, validation and session retirement. Source,
invented-data native acceptance, website and Android delivery remain pending;
PR 61 and signed Android 1.18 remain the accepted product release above.

The next useful acceptance is a physical upgrade and controlled recovery visit,
with separate browser/session and backup coverage. Select further product work
from the roadmap after preserving this release and its limits. Broader fields or
cohorts require a separate source, rights, cost and quota review.

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
