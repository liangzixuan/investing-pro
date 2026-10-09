# Current work

Updated October 9, 2026. This is the portable status summary for the public
repository. [Product roadmap](PRODUCT_ROADMAP.md) owns goals and delivery order;
[architecture](ARCHITECTURE.md) explains runtime boundaries. Private operational
receipts remain outside Git. Earlier releases and bounded live journeys are in
the [dated status archive](history/CURRENT_WORK-2026-10-09-before-pr59.md).

## Accepted release

[PR 59](https://github.com/liangzixuan/investing-pro/pull/59) is merged as
`c2fe66ca102da0d5a751f610772cffa04b874701`, from candidate
`3f938bf0da918bf9bec5a2cbae1aadb588cd960a`, with tree
`9a01034cf6a7539afeeb259c8d03b82321d7eea5`. Five required actual-main workflows
and six jobs, the original producing-CI source proof and eighteen invented-data
native cases are accepted. The first native capture could not show the margin
and full disclosure together; separate viewports passed with the value,
visibility and complete-note assertions retained. Original failures are preserved.

The [reported net-margin comparison](MANAGED_SEC_ANNUAL.md#reported-net-margin-comparison)
shows prior and current `NetIncomeLoss / revenue * 100` for each eligible named
revenue basis in the same filing. Its change is in percentage points, computed
from unrounded ratios and rounded once. Nonpositive prior revenue makes that
margin and change unavailable; the reported amounts and differences stay visible.
The comparison joins the Annual note excerpt without another provider request.
Appending preserves the latest draft and the 2,000-character limit. Review and
explicit **Save watchlist** remain required. This completes the selected margin
outcome; full M2 remains open.

[Watchlist recovery](APPWRITE_WATCHLIST.md#review-the-saved-version-and-retained-draft)
retains PR 57's saved-version and draft review. A fresh successful read is required
before choosing either complete version after a failed repeat read. The current
release preserves that behavior and the existing source, quota and identity limits.

A fresh API build and normal activation accepted deployment
`6ac93c888eb42e76a4e5`, replacing retained rollback identity
`6ac86cc425ba09b3b95b`. Complete bundle review found only two identifier renames
against the prior accepted bundle. Compiled admission checks and ten finite
anonymous production checks passed. Authentication and provider configuration
are unchanged. Release verification made no live provider request or owner write.

Website release
[37980363346](https://github.com/liangzixuan/investing-pro/actions/runs/37980363346),
attempt 1, promoted the same accepted archive after normal production approval.
Staging `6ac9404d0a91d69e0210` and production `6ac9440624fa2932a6da` used the
830,646-byte archive, SHA-256
`009392f489851fb22289e5dff910627fb738300947ca6756488a78924fbc5a10`.
Production replaced `6ac8fa1dca9788d5bca3`; its receipt verified activation on
October 9 at 19:44:37 UTC. These are finite observations, without a continuing
availability claim.

Signed Android 1.17.0, code 18, passed build, complete artifact and delivery
review with package `app.investingpro.android` and the existing production
signer. The delivered APK is 6,658,308 bytes, SHA-256
`2935f134eef78ab139d66a83f0b9f93296c2397192af072ebfebd930ae30124a`.
Its source is the PR 59 main commit above. All 510 APK members, five declared
managed assets and fourteen merged native component declarations were checked.
Earlier APKs and rollback identities remain preserved. Physical 1.17 installation
or use is not accepted here.

The eighteen-case API-36 emulator report covers three disconnected and fifteen
managed journeys. Thirteen of forty-nine original PNGs received scoped visual
review. Forty-six capture callbacks, forty-two phase diagnostics and the full
964-character invented saved-note assertion are separate native evidence;
scoped screenshots do not establish the full note or chart visually.
BrowserStack covered the exact staging build's inert shell at desktop and
narrow widths. Authenticated browser use, physical Pixel 1.14 through 1.17,
separate screen-reader and backup/restore acceptance remain open. The owner
reported Pixel use of 1.13 without issues, without per-step logs.

## Delivery status

| Surface                 | Accepted scope                                             | Remaining acceptance                                                    |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Managed API and website | PR 59 API activation and same-archive website promotion    | Continuing availability and authenticated browser recovery use          |
| Signed Android 1.17     | Build, complete artifact and exact delivered bytes         | Physical upgrade and use                                                |
| Synthetic native tests  | Eighteen invented-data journeys and thirteen scoped frames | Production sign-in, live-provider use and physical-device behavior      |
| Physical Pixel          | Owner reported issue-free Android 1.13 use                 | Separate 1.14 through 1.17, screen-reader and backup/restore acceptance |
| Local research app      | Preserved local release and encrypted vault                | No migration or managed feature-parity claim                            |

## What works in the managed product

[Markets](MANAGED_MARKETS_HOME.md) is the initial managed view on the website
and in signed Android 1.17. An explicit board load requests AAPL, GOOG and GOOGL
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

The selected reported net-margin outcome is delivered through PR 59 on the
website and in signed Android 1.17. Affected calculation, rendering and note
checks passed, followed by actual-main source checks, the original native report,
fresh API activation, same-archive website promotion and signed delivery reviews.
The earlier watchlist recovery outcome remains available. Synthetic coverage does
not establish production two-device editing, physical upgrade, session-expiry
recovery or cloud restore.

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
