# Current work

Updated October 13, 2026. The [product roadmap](PRODUCT_ROADMAP.md) owns delivery
order; [architecture](ARCHITECTURE.md) defines runtime boundaries. The
[preceding status](https://github.com/liangzixuan/investing-pro/blob/997685543b701e30a9e6a3f4c894428746025aa9/docs/CURRENT_WORK.md)
retains earlier increments, original failures and dated acceptance. Operational
receipts remain outside this public repository.

## Accepted release

Release `5b2715e` is published on the managed website and API. Android 1.26.0
(code 27) is delivered with the existing production signer. Previous website,
API and Android 1.25 releases remain preserved. Physical installation of 1.26
was not performed.

The release includes watchlist note search, an explicit comparison-to-note
action and the compact workspace footer. Software licenses follow the main
content; session scope appears with the sign-out review. Private fixture controls
are excluded from production. Source, exact-build staging and Android package
checks passed before the approved release.

A separate Chrome check confirmed the signed-in Markets layout and compact footer.
An initial catalog failure recovered after one explicit refresh. The three board
listings then rendered with prices unloaded. No provider read, note inspection or
owner write was performed, and the initial failure's cause is unknown.

### Delivery status

| Surface         | Accepted status                                         | Limits                                                                                                            |
| --------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Website and API | Release `5b2715e` active; previous deployments retained | Inert staging and bounded live checks do not establish sustained authenticated reliability                        |
| Android         | Signed 1.26.0, code 27, delivered                       | No physical installation or upgrade acceptance for this version                                                   |
| Main source     | PR98 merged as `f277392` after approval                 | Its timestamp layout refinement is outside the published release; actual-main Android failed a system-picker test |
| Chart candidate | PR99 remains a draft                                    | Updated source, hosted acceptance and delivery are separate from the published release                            |

## Current task and next acceptance

[PR99](https://github.com/liangzixuan/investing-pro/pull/99) adds an optional
indexed raw-price path to the existing two-listing watchlist comparison. It uses
only currently loaded shared observations and the chosen interval. Each series
starts at 100; exact source closes, rounded indices, complete listing identities
and original provenance remain available in a semantic table. The chart adds no
request, saved state or broader coverage. See the
[watchlist guide](APPWRITE_WATCHLIST.md#inspect-raw-price-paths).

A short guide stays above the chart. Its complete calculation explanation is in
the initially closed **Chart method and limits** disclosure, after the plot and
before exact data. The explanation remains available when data is unavailable.
This presentation change preserves the renderer, calculations and data lifetime.

Focused model and component checks, web types, lint, formatting, source boundaries
and independent source review pass. Chrome checks at 1440, 390 and 320 CSS pixels
accept the chart, readable endpoint labels, full method, keyboard controls and
contained table scrolling. Missing data, retained responses, cancellation, late
completion, navigation and session retirement retain their tested contracts.
The latest native fixture build remains within the unchanged asset limit.

The original PR99 hosted attempt passed five Actions jobs. Android passed 24 of
25 cases: the export test rejected one accessibility click on its invented root
in the system file picker, after earlier Save and exact-byte checks passed.
Screenshot cleanup then failed while the picker covered the app. A separate
actual-main attempt had failed a root click earlier in the same export journey.
Neither attempt establishes a production export defect or the rejection's cause.
Original failures remain retained; CodeScene's failed advisory was reviewed
without an actionable correctness finding.

The test-only repair replaces that root interaction with one checked native
touch through AndroidX UI Automator, using a freshly resolved and bounded target.
The existing readiness deadline, actual system Save, provider output, exact bytes,
permissions, cancellation and recreation assertions remain required. Updated
native execution and all applicable current-head checks are pending. Main merge
and live delivery are not accepted for PR99.

## Product scope

The managed website and Android client share the Precision Desk presentation,
Discover, a private watchlist with notes and ordering, company research and a
small Markets board. [Price history](MANAGED_EOD_HISTORY.md) covers AAPL, GOOG and
GOOGL, three listings for two issuers, with explicit reads and dated raw USD
closes. It supplies no adjusted returns or whole-market ranking.

[Annual research](MANAGED_SEC_ANNUAL.md) shows admitted same-filing evidence and
available adjacent annual comparisons. [Recent filings](MANAGED_SEC_FILINGS.md)
provides explicit metadata reads, original links, local paging and exact form
filtering. Both connect eligible evidence to the current research-note draft.
The [BEA agenda](MANAGED_MARKETS_HOME.md#bea-release-agenda) supplies an explicitly
loaded 30-day official release schedule, with source and Eastern timezone labels.
Forecasts, reported values and non-BEA events remain outside that schedule.

[Watchlist](APPWRITE_WATCHLIST.md) changes use explicit whole-draft Save and conflict
recovery. Ordinary navigation preserves the mounted draft; session retirement
clears it. The local research profile and encrypted vault remain separate from
managed storage. These increments advance the roadmap without completing M1,
M2 or M3.

## Next acceptance and open limits

Complete the chart candidate's current-head native and source acceptance before
requesting its main merge or release. Select the next complete product outcome
from the roadmap and relevant feature guide, using existing subscriptions and
permitted free sources. Broader fields and cohorts need verified source rights,
cost, quotas and identity handling.

Controlled real-account expiry and two-session conflict acceptance, authenticated
browser coverage, screen-reader review, physical upgrades and an isolated managed
backup/restore exercise remain separate work. The owner's October 10 report
covers the requested Android 1.19 and Brave checklist on Pixel 10 Pro XL/Android
17; it does not establish later physical acceptance or per-step measurements.
Mounted-session retention does not establish offline editing, process-death
restoration or cloud-data recovery.

The existing synthetic recovery suites, inert BrowserStack checks and native
journeys retain their individual scopes. Broader company fields, valuation,
peers, news, asset classes and daily reliability remain roadmap work. Native iOS,
store distribution and owner-data migration are not accepted. Repomix PR27 stays
held under Option A; CodeScene remains advisory.

Read [AGENTS.md](../AGENTS.md) and the relevant guide before each bounded increment.
[Website delivery](APPWRITE_DELIVERY.md) and [Android delivery](ANDROID_CLIENT.md)
keep source, configuration, artifacts, activation and physical use separate.
