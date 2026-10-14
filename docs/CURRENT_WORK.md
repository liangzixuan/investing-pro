# Current work

Updated October 14, 2026. The [product roadmap](PRODUCT_ROADMAP.md) owns delivery
order; [architecture](ARCHITECTURE.md) defines runtime boundaries. The
[preceding source status](https://github.com/liangzixuan/investing-pro/blob/586ea17d1529c3f03eeca11a7a2b88c186043358/docs/CURRENT_WORK.md)
retains earlier candidate detail. Operational receipts remain outside this public
repository. Implementation, CI, source integration and live delivery are separate.

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

| Surface         | Accepted status                                         | Limits                                                                                     |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Website and API | Release `5b2715e` active; previous deployments retained | Inert staging and bounded live checks do not establish sustained authenticated reliability |
| Android         | Signed 1.26.0, code 27, delivered                       | No physical installation or upgrade acceptance for this version                            |
| Main source     | PR100 then PR101 merged; main is `9cc3423`              | All six actual-main Actions passed; published release stays unchanged                      |
| Chart candidate | PR99 source and original hosted checks accepted         | Live chart delivery and physical Android use remain unaccepted                             |

## Current task and next acceptance

The owner requested useful ideas from easy-stock alongside the full InvestingPro
goal. The [source review](EASY_STOCK_REVIEW.md) maps those ideas onto M2–M5.
The new [loaded company snapshot](MANAGED_COMPANY_SNAPSHOT.md) puts already-loaded
Price and Annual evidence in one optional disclosure. Each source keeps its own
dates, basis and availability. All revenue bases remain separate; cash and
liquidity keep independent qualifications. Existing section navigation opens the
full evidence without making an automatic request. Company/catalog/session
lifetime guards prevent another visit's data from appearing. Notes and Save
remain unchanged. No new calculation, source, entitlement or AI verdict is added.

All 647 affected and composed cases pass. Web types and Java syntax pass.
An additive native journey checks the disclosure, separate explicit loads,
unchanged source dates and draft, and a fresh visit; all 29 existing required
cases remain, for 30 total. Chrome on the first exact build confirms keyboard
disclosure, independent explicit loads, both revenue bases, cash/liquidity,
failed-refresh retention, unchanged notes, company reset and retirement of a late
response at actual 1440/390/320 widths, without horizontal overflow or console
warnings. It found an unsupported listing's misleading load prompt; the snapshot
now uses the existing coverage message, with a regression case. The corrected
build and final browser check, plus original producing-head hosted execution,
remain required before acceptance.

## Preceding thesis review candidate

The thesis-review composer is implemented in My Watchlist and company notes.
It previews six authored fields before explicit Add, preserves existing note
text and its 2,000-character policy, refuses invalid/oversized/duplicate appends
and fences stale edits. The existing whole-draft Save, search and export remain
the persistence path. Unadded fields are temporary and reset with listing/editor
lifetime. Source links and dates typed by the owner are not verified citations.

All 811 affected/composed and fixture cases, types, scoped lint/format and source
boundaries pass. Chrome checks cover actual 1440/390/320 widths and corrected
360×600 company composition, Save/reload, full-note reading and retirement fences
using invented RAM data. Original current-head Actions pass on Ubuntu, Windows,
parser isolation, dependency review and Android. All 29 synthetic native cases
pass with exact producing-source markers, 81 pictures and unchanged APK gates.
CodeScene remains failed with seven reviewed maintainability findings in test
setup, fixture Save and the existing workspace method. The earlier Android24/29
failures and cancelled Windows run remain recorded. No retry erased an outcome.

The preceding BEA Release view candidate's original native run failed focus and
readiness checks; its four other Actions passed. That failure remains separate
from the accepted thesis review execution. Older accepted checks retain their
source and environment scopes; none establishes current production or phone use.

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

Complete the loaded company snapshot browser and original producing-head checks.
Source integration remains subject
to its existing permission boundary.
Preserve explicit source requests,
same-company identity and the existing research-note workflow. PR100 and PR101
merged in order after owner approval and verification of both bases and applicable
checks. The final merged source has the reviewed PR101 tree; its original
actual-main checks all passed. PR100's actual-main runs were cancelled when
PR101 advanced main; those cancellations remain recorded. Later candidates and
live delivery remain separate actions.
Continue meaningful roadmap
work with existing subscriptions and permitted free sources; broader fields and
cohorts need verified source rights, cost, quotas and identity handling.

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
