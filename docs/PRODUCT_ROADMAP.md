# Personal market platform roadmap

Updated October 9, 2026. This document defines the durable product goals and
capability milestones. [Current work](./CURRENT_WORK.md) records the accepted
release and the selected next task. The September market-platform goal remains;
the October delivery sequence first established a usable managed website and
Android client. Older sprint plans preserve their original scope and evidence.

## Goal and constraints

Build our own personal Investing.com-style platform: a useful market overview,
complete instrument pages, news and calendars, discovery, watchlists and portfolio
tools. Add InvestingPro-style research and then improvements that serve the owner's
decisions. Investing.com is a functional and visual-layout reference. Use our own
branding, implementation and permitted data; develop our own models and research.

The owner confirmed personal use first and existing subscriptions/free sources
only. There is no new data-feed, model-service or infrastructure purchase authority.
Multi-user SaaS, billing and public distribution are outside this release sequence.
Broader asset classes remain part of the product goal, with source availability
determining their delivery order.

The core journey is: see markets, find an instrument, understand price and business,
compare and value it, save a thesis, then return to relevant changes.

## What the benchmark means

The supplied Investing.com screenshot combines market tables, movers, charts,
news, calendars, screens and watchlist ideas on one landing page. Its public
[homepage](https://www.investing.com/) also surfaces those daily tasks. The first managed Markets page
now connects a three-listing board, dated chart
and research/watchlist navigation. It remains a small part of that broader goal.

[InvestingPro's plan page](https://www.investing.com/pro/pricing/plans) advertises
advanced screening, financial history, multiple valuation models, health metrics,
earnings/dividends, exports, research reports and AI tools. These are separate
capabilities to build and measure, not a claim that our DCF and test suites already
provide premium-product parity. Vendor feature counts vary; avoid adopting a
number of metrics or models as a substitute for useful coverage.

## Reuse the work we have

Keep the application, U.S. identity/search catalog, charts and price calculations,
financial panels, valuation and peer tools, screening controls, watchlist/notes,
portfolio ledger/returns, filing inbox, local storage and source controls. Improve
their composition and data access instead of starting a replacement codebase.

The local research profile includes the accepted selected-quarter assessment.
The later compact evidence transport work is preserved and unreleased; its four retained real-file
checks yielded no complete primary graph. Further structural parsing work is an
optional deeper-evidence track, not a prerequisite for a market homepage, news,
calendar or correctly labelled provider financials. Never label an unverified
provider value as independently filing-verified or silently relax a calculation.

## Current managed baseline and next selection

The managed website and signed Android 1.15 package share Discover, a private
watchlist with notes and ordering, read-only Annual reports and explicit
one-month EOD close history for AAPL, GOOG and GOOGL. Catalog recovery, report cancellation, Android Back
and same-Activity stop/resume have focused synthetic coverage. One live AAPL
browser request passed on October 3; separate GOOG/GOOGL loads passed on October 4.
Broader provider coverage remains separate work. The owner reported physical
Pixel use of Android 1.13 without issues on October 8 UTC; earlier 1.2 through
1.12 releases retain their recorded physical-acceptance limits. See [Current work](./CURRENT_WORK.md)
for the exact source, delivery status and limits.

Portable contributor documentation is published, and direct Annual/price-history
navigation and retained close history during refresh are delivered on the website
and in signed Android 1.14. Previous histories keep their original dates. Physical
Android acceptance remains separate from packaging.

The first [Markets home](MANAGED_MARKETS_HOME.md) is delivered on the website
and in signed Android 1.14. It uses the three accepted
listings in a compact board and selected chart, with explicit sequential loads and
direct research/watchlist access. Its raw-close contract supplies no adjusted
returns, mover rankings or benchmarks. Preserve usable data, unsaved drafts and recoverable
error states as capabilities grow. The broader local research tools remain
available in their separate profile; their existence does not establish managed
delivery.

The [company research visit](MANAGED_RESEARCH_NAVIGATION.md) is delivered through
PR 34 on the website and in signed Android 1.4. A stable listing header connects
Price and Annual sections; returning to a loaded section preserves its exact
validated result and provenance without another request. Switching cancels
pending local work. Leaving or invalidating the visit clears both sections.
Ordinary navigation preserves the mounted watchlist draft; session retirement
clears the workspace. The existing sources and request models supply this behavior.

Signed Android 1.4 uses the existing package and production signer. Build,
artifact and delivery reviews passed; physical-device acceptance remains open.
The selected company-visit step is complete. Key statistics, valuation, peers and
full M2 remain open.

PR 35 and signed Android 1.5 bring the shared watchlist research-note draft into the
company visit. Existing members show their current note; other listings require
an explicit Add to watchlist draft action. Review in My Watchlist closes research
and uses the existing full-list save and reconciliation flow. Focused local checks,
required actual-main checks, website promotion and signed-artifact delivery passed.
This step adds no automatic save or source request and
reuses the existing schema, API and dependencies.

PR 36 and signed Android 1.6 deliver a dated raw-close comparison on each Markets
row. It uses the final two observations already loaded for that listing, with
both dates, exact USD change, a rounded percentage and an unadjusted-price
disclosure. One observation cannot supply a change. Required actual-main checks,
twelve isolated Android cases, website promotion and signed-artifact delivery
passed. A separate bounded live board check verified all three comparisons,
Back navigation and clearing on exit. An initial saved-watchlist read failed and
recovered through an explicit reload; its cause and repeat reliability remain
unknown. This step adds no feed, request or persistent state.

PR 38 and signed Android 1.7 deliver bookmarkable company visits for the existing
Price and Annual sections. The root URL keeps exact listing identity; section
changes preserve the visit's validated results, and Back returns to the opener
or Markets for a direct link. Opening a link resolves catalog metadata and leaves
research unloaded. Required actual-main checks, the original thirteen-case native
report, website promotion and signed-artifact delivery passed. External Android
app links, process-death restoration and physical-device acceptance remain outside
this delivered scope.

PR 40 and signed Android 1.8 deliver exact dated close inspection on the shared
Markets and company Price chart. Point to or tap an observed date to read its
original raw USD decimal from the loaded response; the full semantic table
remains available without a pointer. Required source and hosted checks, scoped
isolated browser/native evidence, website promotion and signed-artifact delivery
passed. This step adds no entitlement, source, request, dependency or persistent
data. See [Current work](./CURRENT_WORK.md) for the evidence limits.

PR 42 and signed Android 1.9 deliver explicit Load/Refresh for one selected
Markets listing. One action requests that admitted listing while preserving the
other board histories; selection alone makes no price request. The full-board
action remains available. Source checks, synthetic native checks, website
promotion and signed-package delivery are accepted. One bounded live selected-AAPL
journey passed on October 5; the physical Android update check remains open.
PR 44 and signed Android 1.10 connect Annual evidence to the existing
watchlist-note draft. One explicit action retains a chosen eligible pair's exact
values, named basis, original dates and filing link while preserving the latest
user prose. Main checks, original source proof, synthetic native evidence,
same-archive website promotion and signed-package delivery are accepted.
The existing Save watchlist action saves the whole draft. Live Annual-to-note,
physical-device and backup/restore acceptance remain open.
[Current work](./CURRENT_WORK.md) records the exact release and limits. Full M1/M2
and broader data coverage remain open.

PR 46 and signed Android 1.11 deliver an earlier-date raw-close comparison in
Markets and company Price. It reuses loaded rows and exact decimal calculation,
shows both dated endpoints and sends no request or save. Source checks, isolated
browser checks, sixteen actual-main native cases, website promotion and signed
package delivery passed. Feed coverage and the unadjusted-price contract are
unchanged. [Current work](CURRENT_WORK.md) records the first native interaction
failure, accepted rerun and the separate bounded live AAPL comparison on October 6.
Physical-device acceptance remains open.

PR 48 and signed Android 1.12 connect a company Price comparison
to the existing member's latest note draft. One explicit action appends the
observed endpoints, exact change and original provenance while preserving the
user's prose. Review in My Watchlist opens that draft, and Save watchlist saves
all its changes. Main checks, original source proof, seventeen synthetic native
cases, same-archive website promotion and signed-package delivery are accepted.
Provider coverage, requests, API and schema boundaries are unchanged; appending
does not save automatically. [Current work](CURRENT_WORK.md) records delivery,
original failures and remaining live-note, physical-device and backup/restore
limits. Full M1/M2 and broader sources remain open.

PR 50 and PR 51 deliver invalid-note recovery on the website and in signed
Android 1.13. Company and watchlist editors share field feedback, keep the raw
draft and let the user reach the first invalid note before an explicit save.
Actual-main checks, the synthetic Android journey, same-archive website promotion
and signed-package delivery are accepted. [Current work](CURRENT_WORK.md) records
the original failures, scoped image review and physical-device limits. Provider
scope, note policy and the saved-data contract stay unchanged. This outcome is
complete; full M1/M2 and broader sources remain open.

Repomix automation remains held in PR 27 because of its dependency blocker;
[AI context](./AI_CONTEXT.md) records the dependency blocker and the manual
source-reading path. Existing security checks remain unchanged.

## Longer-term capability sequence

| Milestone                                        | User-visible outcome                                                                                                                                                           | Completion evidence                                                                                                                                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0: source and screen contract                   | A short map of which homepage/company fields our existing access can actually supply, plus desktop/narrow page designs using the supplied portal reference                     | Exact feed/operation, identity types, freshness, limits and unknowns for each module; reviewed real examples where already authorized; no unsupported entitlement assumptions                                                                         |
| M1: Markets home                                 | The app opens on useful market information: a compact market board, chart, scoped movers, global search and direct research/watchlist access                                   | Populated permitted data with source/as-of labels; correct percentage periods; every active control works; advertised scope matches the loaded universe; desktop and narrow screenshots                                                               |
| M2: complete stock pages and connected discovery | A bookmarkable local company route with price/chart, key statistics, financials, valuation and peers in one coherent workflow; useful screen results open these pages directly | Representative existing supported companies render correct data; data loading is coordinated instead of repeated per-panel setup; drafts, identity and stale-response guards survive navigation; field and complete-page coverage reported separately |
| M3: daily news and calendars                     | A combined market/company news feed, economic releases, confirmed earnings/dividend events where available, and a relevant personal updates view                               | Source/time/time-zone attribution, working original links, deduplication and freshness; announced dates separated from estimates; missing consensus/actual values remain unknown; no invented articles or events                                      |
| M4: Pro-style research workflow                  | Broader useful screens, saved views/lists, transparent model comparisons, financial health/peer context, research exports and connected portfolio review                       | Each model/filter has verified eligible inputs and defined limits; reports reproduce displayed values; portfolio returns/benchmarks are comparable; a full idea-to-follow-up journey works                                                            |
| M5: broader markets and our improvements         | Add international equities, ETFs, indices, FX, crypto, commodities and rates as feeds permit; personal thesis-change tracking, custom workspaces and cited research assistance | Typed instrument identities and asset-appropriate measures; no equity formulas applied blindly to other assets; source-supported answers/calculations and verified zero-additional-cost model access before AI integration                            |

M0 is a short prerequisite to M1, not another open-ended infrastructure program.
M3 source discovery can run alongside M1/M2. A supported multi-asset feed can enter
earlier; M5 does not permanently defer broader markets. Do not hold an available
calendar or market module hostage to unrelated SEC interpretation work.

### Selecting the next product outcome

PR 55 and signed Android 1.15 deliver same-filing adjacent annual revenue and
net-income comparison, including an available comparison in the existing note
draft. Source checks, invented-data native acceptance, fresh API activation,
same-archive website promotion and signed delivery passed. Physical 1.15 and
authenticated browser acceptance remain separate. See [Current work](CURRENT_WORK.md).

Prioritize daily use and recovery before expanding fields or cohorts:

The current selected candidate compares the saved watchlist with the retained draft
after conflict or original-command reconciliation. Its visible result is an explicit
choice with both notes and order available for review, and safe recovery from a
failed repeat read. Verify the invented interruption journey on Android, then the
required source and delivery gates. This does not establish real two-device editing
or durable draft restoration. [Current work](CURRENT_WORK.md#current-task-and-next-acceptance)
records its acceptance status.

1. Complete the selected interrupted-save or reconciliation journey and prove its visible
   outcome with invented records. Follow with session expiry and two-session
   conflicts where the current acceptance leaves gaps.
2. Complete physical upgrade and screen-reader acceptance when the owner and
   supported controls are available. Design an isolated managed restore exercise
   with controlled records before claiming cloud-data recovery. Signing recovery
   and Clerk-key rotation need their own reviewed procedure and acceptance.
3. Add authenticated browser coverage as a separate, narrow test suite using
   controlled identities and invented data. Keep the exact-build inert
   BrowserStack check, CORS protections and synthetic native coverage distinct.
4. Expand one useful company field or cohort only after confirming source fields,
   provider rights, cost and quotas. AAPL, GOOG and GOOGL remain three listings
   for two issuers; their raw USD EOD closes supply no adjusted-return universe.

Maintenance should shorten repeated work that obstructs these outcomes. Reviewed,
parameterized release helpers and one release manifest can reduce copied scripts
while retaining exact source/artifact pins, normal approvals, finite observations,
output caps, original failures and safe cleanup. Any reusable artifact-policy
proposal needs separate review; it is not permission to relax current limits.

Doppler adoption remains an unverified integration proposal. Start with an
inventory of this application's GitHub, Appwrite and private runtime consumers,
stores, environments and rotation owners. Keep its project separate from other
applications. Any later synchronization must define ownership and propagation of
removals before changing secrets; a roadmap entry grants no credential operation.
The managed Vite/React, Capacitor, Clerk and Appwrite boundaries remain in place.

Select a bounded end-to-end outcome before implementation. The milestones above
remain the expansion plan; they do not authorize all features or replace the
current task recorded in Current work. A Markets-home slice should connect to a
usable company page and start with existing permitted sources and a declared
market board. Confirm benchmark/index or ETF access and identity handling before
adding those cards. Label ETF proxies as ETFs. An unavailable benchmark feed
must not produce a fabricated card.

Movers calculated from a small board must say which board they cover. Whole-market
gainers, sector performance and breadth need the corresponding complete cohort;
they cannot be inferred from a handful of loaded companies. Preserve current
request bounds until an explicit feature change has been reviewed and tested.

A mockup proves design only. A release must show real permitted data, working
navigation and useful results. Omit unfinished modules from the delivered flow or
state their unavailable status clearly; do not ship a wall of decorative empty cards.

## Data strategy within the confirmed budget

Prefer supported normalized datasets for normal product views. Use our SEC tools
for citations, verification, filing changes and cases where that evidence is
required. One source may support price/history while another supports events.
Failure of an optional verification panel must not erase unrelated usable data.

| Need                                            | Starting point                                                                                                             | Constraint to resolve                                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Equity quotes/history and existing fundamentals | Current Tiingo adapters for IEX quotes, EOD, normalized statements and daily fundamentals                                  | Verify the configured plan's actual operations, limits and field coverage; an installed token alone proves none of those                                                          |
| Filing updates and company facts                | Existing SEC integration and [public SEC APIs](https://www.sec.gov/about/developer-resources)                              | Keep raw observations distinct from admitted calculations; avoid making a universal custom filing parser a front-door dependency                                                  |
| Economic events                                 | Official release schedules, such as [BEA](https://www.bea.gov/news/schedule/full), and other official agencies             | A release schedule supplies event timing, not automatically market consensus or all global releases                                                                               |
| Macro series                                    | Existing free access or a separately configured official source such as [FRED](https://fred.stlouisfed.org/docs/api/fred/) | FRED requests require an [application API key](https://fred.stlouisfed.org/docs/api/api_key.html); do not assume setup exists or create credentials as part of this planning task |
| News and company events                         | Existing entitled news access or permitted public feeds/issuer announcements                                               | Confirm access and allowed display/cache behavior; link to originals and retain attribution; a stock-data subscription does not establish news rights                             |
| Other asset classes                             | Check existing entitlements and suitable free official/public feeds                                                        | No assumed real-time global coverage; keep feed-specific delay, asset identity and incomplete scope visible                                                                       |
| AI assistance                                   | Only an existing usable entitlement or feasible local model with no added spending                                         | Verify integration and resource needs separately; an existing chat tool is not proof of an application API entitlement                                                            |

Tiingo documents multiple feed families in its
[API overview](https://www.tiingo.com/documentation/general) and
[changelog](https://www.tiingo.com/documentation/general/changelog). This is a
research lead, not proof that our account can use every product. The original
goal reset did not inspect provider credentials; later delivery acceptance is recorded separately in Current work.

InvestingPro identifies S&P Global Market Intelligence and analyst consensus as
inputs to its [fair-value service](https://www.investing-support.com/hc/en-us/articles/5921093968657-InvestingPro-s-Fair-Value).
Equivalent global analyst coverage is not promised under the current budget.
Classify a feed-limited feature explicitly and deliver the independent useful work.

## Design direction

Use the market-portal reference as the information-architecture target:
compact navigation/global search, dense readable data tables, a central chart/news
area and a useful secondary rail. Market content should be visible immediately.
There is no need to reproduce the advertising, broker promotions or sales hero.

Keep the selected Research Desk's useful controls and financial components. Move
transport, local-storage and operator details into Settings/Data sources or concise
disclosures. The first screen should explain the market and the next useful action.
Data-source configuration should not dominate each company page.

Use Bootstrap Studio's existing templates, Bootswatch themes and reusable blocks
as design accelerators where they fit this layout. Keep editable design artifacts
and an HTML/CSS handoff outside the application source. Implement the chosen layout
in the existing React application and retain its behavior. Template selection alone
does not establish feature completion or data quality.

## Improvements we will build toward

- Connect a saved thesis to filing, earnings, price and valuation changes so the
  owner sees what matters to that thesis.
- Make assumptions, periods and source links easy to inspect without burying the
  normal research view in parser/operator details.
- Support personal layouts, comparison sets, notes and reproducible exports in one
  workflow, with a private local workspace and no advertising.
- Add evidence-cited questions and original research screens when their data and
  computation are available. Validate strategy results separately; do not promise
  that AI picks or any model will outperform.

These are intended advantages for this owner's workflow, not assertions that
competitors lack every similar feature.

## Engineering audit and feature specifications

The [engineering audit](./ENGINEERING_AUDIT.md) maps the owner's principles to
actual code and workflow findings. The adapted Spec Kit
[Markets-home specification](../specs/001-markets-home/spec.md) preserves that
feature's plan and tasks for later selection. Check Current work before resuming it;
it is not the active task merely because its specification exists. Reuse the
established setup and authentication boundaries.

FinanceDatabase is a selected future directory source for broader instrument
discovery. Use pinned, classified records and explicit provider mappings. Its
metadata does not supply live quotes/fundamentals or establish entitlement, and
its equity category is not an admitted common-stock universe. The initial Markets
home can use existing supported listings without waiting for a whole-directory import.

## Working rules and progress reporting

1. Choose one coherent user outcome, its data source and a visible acceptance demo
   before coding. Design the page and its loading/empty/error states together.
2. Reuse existing components and source adapters. Parallelize independent UI and
   data work. Choose the simplest implementation that meets current requirements
   and prefer established, maintained libraries over custom machinery. Study
   proven market-platform patterns before designing. Do not preserve obsolete
   interfaces or add backward-compatibility layers; protect the owner's saved
   data and current requirements. Reusing useful code does not require retaining
   every old abstraction. Check existing dependency documentation and types before
   adding a package or writing a replacement. Keep UI, data adapters, calculations
   and storage modular with clear responsibilities.
3. Keep required correctness/security checks. Run focused checks while iterating
   and the existing complete release gates for a coherent candidate; avoid repeated
   unchanged runs and release-only churn. Gate changes require a separate reviewed
   maintenance task, not an unnoticed shortcut.
4. A parser/data investigation gets a bounded question and a stop/go decision.
   If it yields no useful coverage, record it and move the independent product
   work forward. Do not chain indefinite infrastructure slices under "next."
5. Report what the owner can now do, real-data coverage, important limits and the
   next visible result. Commit/test counts are engineering evidence, not progress
   toward feature parity. Show screenshots at visible milestones.

No reliable overall completion percentage or full-parity date exists yet. Forty
calendar days of history do not establish engineering hours or a delivery velocity.
Estimate each selected milestone from measured delivery time and confirmed
feeds. Full global premium-data parity may remain unavailable at zero added spend;
that does not prevent a useful personal market platform.
