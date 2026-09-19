# Capability status

Updated 2026-09-19. Accepted source:
`690c0c1565e698a4819f47a0c188e55247ca9f18` (annual business trends).
This is the current capability scoreboard. [Current work](./CURRENT_WORK.md)
owns delivery priorities; the [breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
owns full targets. Historical exit matrices and release claims remain unchanged.
The workspace checkpoint and release handoff own actual runtime and acceptance
receipts. Preparing a later change does not advance this accepted baseline.

## Delivered functionality and remaining targets

These are bounded user capabilities, not completion of whole roadmap cycles or
Investing.com Pro+ parity. There is no meaningful overall percentage: source
pipelines, small controls and multiweek reliability requirements have different
scope. Test and release counts are supporting evidence, not capability coverage.

| User job                         | Delivered at the accepted source                                                                                                                                                                                                 | Important full-target gaps                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find and organize companies      | Admitted U.S. common-stock/ADR catalog, search, one encrypted watchlist, shared notes, ordering/filtering/paging and sequential research navigation                                                                              | Catalog refresh breadth, multiple lists, tags, watchlist import/export                                                                                                 |
| Inspect prices                   | Explicit Tiingo quote/history loads, six ranges, raw/adjusted charts and action observations, price analytics, shared-date company comparison                                                                                    | Declared 100-symbol validation, independent corporate-action reconciliation, broader benchmark/technical analysis                                                      |
| Understand financials            | Up to ten annual years and sixteen quarters, 30 reported fields, derived metrics, annual trend chart/exact table, SEC observations and filing-context inspection                                                                 | Admitted standalone quarters/TTM, revision selection, point-in-time history and independently validated shared core metrics                                            |
| Screen for ideas                 | 28 SEC annual/Q4 fields, filters, sort/paging, coverage/source inspection, watchlist scope, three sparse starter screens and saved criteria/columns                                                                              | Integrated price/valuation filters, shared-core coverage gate, starter breadth and look-ahead-safe historical screens                                                  |
| Compare and value companies      | One primary plus up to three manual peers; 15 measures and twelve annual quality checks; saved/reordered groups; P/E/P/B bands; mechanical unlevered-FCF-proxy forward/reverse DCF, scenarios, sensitivity and saved assumptions | Automatic/sector-relative peers, direct audited FCFF inputs, additional justified model families, independent golden-case breadth and point-in-time fair-value history |
| Track holdings                   | One encrypted USD portfolio, transactions/CSV import, FIFO/opening-pool estimates, manual splits, allocation, historical values and endpoint/Modified Dietz/EOD-linked returns                                                   | Multiple portfolios, XIRR, benchmarks, broader corporate actions/FX and owner recovery validation; EOD-linked returns do not establish measured intraday TWR           |
| Follow changes                   | Explicit recent SEC-filing checks for selected watchlist companies                                                                                                                                                               | Upcoming calendars/news, estimates/revisions/ownership/transcripts as sources permit; persistent monitoring and delivered notifications                                |
| Reuse or share research          | Saved notes, up to twenty named financial views, saved comparison/peer groups and company DCF assumptions                                                                                                                        | General saved-widget layouts and evidence-bearing CSV/JSON/PDF/XLSX reports; saved definitions do not preserve result snapshots                                        |
| Depend on daily operation        | Local-access mode, encrypted storage, isolated releases/rollback, focused keyboard/narrow-layout checks and extensive verification                                                                                               | Installable PWA/offline mode, full WCAG 2.2 AA audit, app-wide latency acceptance, owner backup/restore drill and 30-day workflow soak                                 |
| Ask questions or test strategies | Deterministic research/evidence foundations; no end-user AI or strategy workflow                                                                                                                                                 | Opt-in cited AI and original point-in-time, cost-aware, reproducible strategy research                                                                                 |

Feature details: [company research](./PERSONAL_COMPANY_RESEARCH.md),
[financial screening](./SEC_ANNUAL_FINANCIAL_SCREENING.md),
[saved financial views](./PERSONAL_FINANCIAL_VIEWS.md),
[watchlist filings](./WATCHLIST_SEC_FILINGS.md),
[portfolio ledger](./PERSONAL_PORTFOLIO_LEDGER.md) and
[portfolio history/returns](./PERSONAL_PORTFOLIO_VALUATION_HISTORY.md).

## Measured denominators and open acceptance

| Measure            | Recorded observation or delivered bound                                                                                                                                                   | What it does not establish                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity breadth   | Dated admitted snapshot: 3,227 listings against the at-least-3,000 objective                                                                                                              | Complete financial inputs or current provider coverage for every listing                                                                            |
| Financial coverage | Shared 30-core registry / at least 500 securities / 90% known, non-stale eligible security-metric pairs remains open                                                                      | The 30 statement fields and 28 screen fields are different registries, not “28 of 30 completed”                                                     |
| Real SEC evidence  | September 17 measurement: 3,227 listings / 3,209 issuers over 23 Frames; interest payments known for 2,156 listings, tax payments for 2,129, both for 1,688; five primary filings sampled | Shared-core coverage, joint eligibility for other screens, the full 20-issuer/five-industry validation target or unchanged future observations      |
| Starter screens    | Three explicitly sparse, editable examples against the initial target of 24; expansion toward 60 is conditional                                                                           | Non-sparse screens require at least 90% required-input knownness and at least 500 eligible securities; adding templates alone does not satisfy this |
| Price and models   | 100-symbol history/action validation remains open; at least eight model families / twelve variants and independent golden-case breadth remain open                                        | A 10Y selector is not ten-year observed coverage; scenario controls are not independently justified model families                                  |
| Portfolio bounds   | One USD portfolio; twenty registered identities, 250 activities and up to 100 CSV rows per import                                                                                         | Multi-account consolidation, tax accounting or complete corporate-action coverage                                                                   |
| Daily reliability  | Seven-day alert-delivery soak and thirty-day personal-workflow soak remain open; no full app-wide p95 below two seconds or WCAG audit is claimed                                          | Short health samples, security-master search measurements or individual keyboard checks do not close these targets                                  |

Known, unknown, stale, inapplicable, unsupported and quarantined results must keep
their declared denominators. Required-input coverage for a complete research job
is separate from per-field coverage. No fresh provider measurement was made for
this scoreboard; dated observations retain their original scope.

## Verification is separate from breadth

Release `690c0c1` passed 100 focused tests; 7,660 Vitest plus ten worker tests
(7,670 total), nine existing skips, 25 typechecks, 24 builds and all five required
jobs across four applicable hosted workflows. Seven source-bound synthetic Brave
groups covered populated annual trends; five limited live groups covered
readiness, unloaded Financials/navigation and keyboard return. Live checks did
not acquire new fundamentals for a broad real-company cohort.

Configured provider status does not establish every entitlement. Existing
request, credential and retention controls do not by themselves complete the
declared source-policy control-plane integration. Provider inputs and calculated
research usually remain in active-session memory; exporting or retaining them
needs permitted-source scope. Encrypted backup/restore package primitives do not
prove an owner-facing recovery drill.

The Codex development/health heartbeat is separate from the product and was
paused at the end of the authorized work window. It is not a persistent app
scheduler, OS notification service or alert-delivery soak. The older synthetic
threshold evaluator likewise provides no background delivery.

## Approved delivery order

1. Establish a bounded, independently reviewed release-capacity path beyond a64
   and keep this scoreboard current. Preserve existing checks and historical
   evidence; do not turn the prerequisite into an open-ended infrastructure effort.
2. Deliver measured data and discovery coverage: define the actual shared core,
   measure eligible security/metric and complete-job coverage, and independently
   validate the declared issuer cohort. Prioritize useful price/valuation
   screening and source-backed quarterly/TTM admission over count-only expansion.
3. Close one daily filing follow-up loop using existing SEC metadata: opt-in
   scheduling, restart-safe refresh, change detection, notifications and
   duplicate-safe receipts. Add useful outputs only within retention/export rights.
4. Expand models, peers and portfolio features according to actual use and
   verified inputs. Keep AI, backtests and broader event feeds behind their source
   prerequisites. Another DCF display increment is lower priority than these gaps.

These priorities do not imply that later work has been implemented or accepted.
Multi-user enterprise operations, trading, global multi-asset coverage, native
app stores and cloud sync remain outside the current personal common-stock goal.
