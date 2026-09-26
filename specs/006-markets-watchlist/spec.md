# Markets for My Watchlist

Created September 26, 2026. Implementation and focused verification are complete;
release acceptance is pending. Workspace CURRENT records later verification.
Base: accepted a84 `9c3dee7bacdbb6799925e5b4d04e2675ade6be48`.
This extends [roadmap M1/M2](../../docs/PRODUCT_ROADMAP.md).

Let the owner choose up to six U.S. common-stock listings from My Watchlist,
load their dated prices, inspect a one-month chart and compare changes within
that cohort. Company research and Back retain the matching snapshot. Annual
financials are not a prerequisite.

## Scope

Keep the existing default AAPL/MSFT/WMT suggestions and add a My Watchlist mode.
Both modes use explicit Load/Refresh. This supersedes the automatic entry load
in the original Markets specification; its historical release evidence remains
valid for that earlier behavior. Rendering, mode switches, checkbox edits,
StrictMode replay and navigation do not acquire prices.

Use one draft containing mode and selected watchlist identities. Begin in default
mode with an empty watchlist selection. Native checkboxes follow saved watchlist
order, allow one to six companies, and preserve their selection across mode
switches. Selection does not modify the saved watchlist. An empty, unavailable
or stale list explains the state and offers the existing discovery/watchlist path.

Keep one accepted price snapshot, identified by its exact cohort and catalog.
Display it only when its cohort matches the current draft and remains authorized.
A changed draft cannot relabel an earlier cohort's prices. There is no saved
board schema, per-cohort price cache, new route, dependency or provider operation.
The BEA agenda remains independent.

## Admission and request budget

Resolve default suggestions through existing catalog search. Resolve each saved
member through the exact-listing client, with no ticker substitution. Compare
all eleven identity fields, require the current catalog digest and U.S. common
stock, and reject duplicate listing IDs or venue/symbol pairs. Complete bounded
local admission before the one sequential EOD acquisition loop. Missing and
unsupported listings stay explicit rather than receiving another listing's data.

Each admitted company uses one existing overview request with range `1m` and
`includeQuote: false`. Preserve provider mapping, cancellation and shared-failure
stops, without retries or quote, financial, valuation or SEC acquisition.

One Markets budget applies across modes, cohorts, routes and state resets within
the mounted workspace: at least fifteen minutes between starts and no more than
four starts per rolling hour. Charge immediately before the first EOD request,
after local admission and a fresh authority check. Wholly inadmissible selections
consume no provider slot; a started batch keeps its slot after failure or abort.
The six-company ceiling permits at most twenty-four EOD GETs per rolling hour for
this board. Other tools share the provider account; this is not an entitlement
claim. Count local admission work separately from upstream requests.

## Identity, lifetime and retained data

Pass only identity fields from the workspace. Notes, saved versions and workspace
object replacement do not define authority. Removing or changing a selected
member, stale reconciliation, catalog replacement or session loss retires the
affected cohort. Unselected member edits and note saves preserve valid drafts,
completed data and pending requests.

Check captured and current session/catalog/activity callbacks at request start,
after admission and at completion. The existing synchronous view epoch prevents
an old callback or response from reviving after immediate hide/return. Hiding
Markets cancels pending work while retaining valid completed data. Keep budget
history outside these resets.

A same-cohort refresh with no usable history keeps the previous accepted snapshot
and original dates with a failure message. This includes row errors and empty
available histories. One valid observation can provide a close while its change
remains unavailable. Any usable partial result replaces the previous result as
one dated snapshot; never merge new and old rows. A different cohort's failed
load cannot display the prior cohort as its result.

Reuse exact decimal calculations, date-compatible ranking, chart and company
snapshot admission. Every heading, caption and mover label names the loaded
cohort. Company handoff and pending chart focus require a currently accepted
matching identity/history and current activity.

## Acceptance

- Zero provider calls before explicit Load, including mode/selection/route changes.
- Sequential one-, three- and six-company fixtures; full identity admission and
  duplicate, stale, unsupported, cancellation and provider-refusal cases.
- Shared cadence/hourly budget, no charge for wholly inadmissible selections,
  and no refund after an EOD batch starts.
- Draft retention, same-cohort failure retention, whole partial replacement,
  mixed dates, one observation and no stale prices under changed labels.
- Selected-identity retirement and synchronous hide/return guards; note-only and
  unrelated member changes preserve valid data. No notes enter the bridge.
- Keyboard and 390px picker/board/chart navigation, cached company entry and Back,
  and independent BEA state in a source-bound synthetic Brave fixture.
- Existing focused checks, source review, feature/generated closure, unchanged
  isolated native gate, exact required hosted-job success and guarded activation.
- Limited live QA uses at most one existing admitted cohort and one explicit
  price load. Do not create owner memberships or change saved records for QA.
  If the real watchlist is empty or unavailable, retain that explicit coverage
  limit rather than manufacturing a populated result.

Global assets, market-wide movers, news, additional calendars, daily valuation
access and SEC parser expansion are outside this outcome.
