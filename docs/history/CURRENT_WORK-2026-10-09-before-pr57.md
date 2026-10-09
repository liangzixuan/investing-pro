# Current work

Updated October 9, 2026. This is the portable status summary for the public
repository. [Product roadmap](../PRODUCT_ROADMAP.md) owns goals and delivery order;
[architecture](../ARCHITECTURE.md) explains runtime boundaries. Private operational
receipts remain outside Git. Earlier releases and bounded live journeys are in
the [dated status archive](../history/CURRENT_WORK-2026-10-09-before-pr55.md).

## Accepted release

[PR 55](https://github.com/liangzixuan/investing-pro/pull/55) is merged as
`e19829e9e06e604daa3a83ec04d8eba46641e763`, from candidate
`8656d077908e01dea67d307a8cfdc64700861ce4`, with tree
`283a418be8573b41d11bd79f202476250b346dcc`. Five required actual-main workflows
and six jobs, the original producing-CI source proof and seventeen invented-data
native cases are accepted. The original failed viewport capture and its original
report remain preserved; the corrected capture sequence passed.

An eligible Annual report can compare current revenue and NetIncomeLoss with
the adjacent annual period from the same filing and named revenue basis. Exact
USD amounts, both period ranges, differences and provenance remain inspectable.
Percentage change is unavailable for a zero or negative prior amount. An
available comparison joins the existing Annual note draft action, followed by
review and explicit Save watchlist. The 2,000-character limit remains. It uses
the loaded report without another provider request or a new API field. See
[managed Annual](../MANAGED_SEC_ANNUAL.md#reported-annual-comparison) for admission
and calculation limits. This completes the selected comparison outcome, not M2.

The managed API bundle was rebuilt from this accepted source. Deployment
`6ac86cc425ba09b3b95b` replaced `6ac20862d12fe7560852`; its original receipt
verified activation on October 9 at 04:29:00 UTC. Provider admission, quotas and
authentication settings remain unchanged. Release verification made no live
provider request or owner-record write.

Website release
[37884549554](https://github.com/liangzixuan/investing-pro/actions/runs/37884549554),
attempt 1, promoted the same accepted archive after normal production approval.
Staging `6ac86f1a45d1f95f6ec9` and production `6ac872c27121e99166b4` used the
829,313-byte archive, SHA-256
`3e06939f702033882303fda54d6b84475a5d79dce51db45bdb413773147d7070`.
Production replaced `6ac7297176077331c655`; its receipt verified activation on
October 9 at 04:51:45 UTC. These dates record finite observations rather than
continuing availability.

Signed Android 1.15.0, code 16, passed build, complete artifact and delivery
review with package `app.investingpro.android` and the existing production
signer. The delivered APK is 6,657,012 bytes, SHA-256
`e21eeacafeb8b6db2b1ad827cc6dc42d08bffc69651a1e06876a541bdeaa5770`.
Its source is the PR 55 main commit above. All 510 APK members, five declared
managed assets and fourteen merged native component declarations were checked.
Earlier APKs and rollback identities remain preserved. No physical 1.15
installation or use is accepted here.

The seventeen-case API-36 emulator report covers three disconnected and fourteen
managed journeys. Seven of forty-three original PNGs received scoped visual
review. Forty capture callbacks, thirty-nine phase diagnostics and the full
867-character invented saved-note assertion are separate native evidence;
scoped screenshots do not establish the full note or chart visually.
BrowserStack covered the exact staging build's inert shell at desktop and
narrow widths. Authenticated browser use, physical Pixel 1.14/1.15, separate
screen-reader and backup/restore acceptance remain open. The owner reported
Pixel use of 1.13 without issues, without per-step logs.

## Delivery status

| Surface                 | Accepted scope                                           | Remaining acceptance                                               |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Managed API and website | PR 55 release and finite activation receipts above       | Continuing availability and authenticated browser comparison use   |
| Signed Android 1.15     | Build, complete artifact and exact delivered bytes       | Physical upgrade and use                                           |
| Synthetic native tests  | Seventeen invented-data journeys and seven scoped frames | Production sign-in, live-provider use and physical-device behavior |
| Physical Pixel          | Owner reported issue-free Android 1.13 use               | Separate 1.14/1.15, screen-reader and backup/restore acceptance    |
| Local research app      | Preserved local release and encrypted vault              | No migration or managed feature-parity claim                       |

## What works in the managed product

[Markets](../MANAGED_MARKETS_HOME.md) is the initial managed view on the website
and in signed Android 1.15. An explicit board load requests AAPL, GOOG and GOOGL
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

PR 56 published this release's portable documentation and passed its required
actual-main checks. The selected next candidate is a saved-version and retained-draft
watchlist review after a conflict or reconciliation of the original save command.
It shows changed notes, membership, order and exact listing identities before the
explicit whole-version choice. A pending or failed repeat read withdraws old choice
eligibility while preserving the draft. No automatic merge, save or provider request
is added. See [watchlist recovery](../APPWRITE_WATCHLIST.md#review-the-saved-version-and-retained-draft).

Affected tests and an invented-data Android interruption/recovery journey are being
verified. Candidate/main gates, deployment and signed delivery remain pending;
PR 55 and Android 1.15 remain the accepted product baseline. Synthetic coverage
does not establish production two-device editing, physical upgrade, session-expiry
recovery or cloud restore.

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
