# Personal market platform roadmap

Updated September 24, 2026 from the owner's explicit goal reset. This is the
authority for current product goals and delivery order. The older Sprint 0 brief,
build history and personal breadth roadmap preserve history; their narrower
notebook, U.S.-stocks-only and competitor-layout exclusions no longer define the
target. Existing correctness, privacy and release requirements still apply.

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
[homepage](https://www.investing.com/) also surfaces those daily tasks. Our current
default page starts with company search, which serves a much narrower purpose.

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

The accepted selected-quarter assessment remains running. The later compact
evidence transport work is preserved and unreleased; its four retained real-file
checks yielded no complete primary graph. Further structural parsing work is an
optional deeper-evidence track, not a prerequisite for a market homepage, news,
calendar or correctly labelled provider financials. Never label an unverified
provider value as independently filing-verified or silently relax a calculation.

## Delivery sequence

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

### First implementation outcome

Deliver M1 together with the minimum company-page connection needed to use it.
Build a small version that works end to end and supports later layers through
clear module boundaries. Keep the working release available while adding each
capability. Choose durable architecture for the full goal; a small initial data
cohort is a supported product scope, not a throwaway implementation to replace.
Start with the existing permitted equity sources and a small declared market board.
Confirm benchmark/index or ETF access and identity handling before adding those
cards. ETF proxies must be named as ETFs, not presented as index values. If a
benchmark feed is unavailable, disclose that scope rather than fabricate a card.

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
research lead, not proof that our account can use every product. No provider
account, key or private configuration was inspected during the reset.

InvestingPro identifies S&P Global Market Intelligence and analyst consensus as
inputs to its [fair-value service](https://www.investing-support.com/hc/en-us/articles/5921093968657-InvestingPro-s-Fair-Value).
Equivalent global analyst coverage is not promised under the current budget.
Classify a feed-limited feature explicitly and deliver the independent useful work.

## Design direction

Use the owner's screenshot as the market-portal information-architecture target:
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
actual code and workflow findings. The next outcome is tracked in the adapted
Spec Kit [Markets-home specification](../specs/001-markets-home/spec.md), with its
plan and tasks. Use that bounded feature workflow; do not recreate setup,
authentication or an entire project specification.

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
After M0/M1, estimate the next milestones from measured delivery time and confirmed
feeds. Full global premium-data parity may remain unavailable at zero added spend;
that does not prevent a useful personal market platform.
