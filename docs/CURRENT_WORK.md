# Current work

Updated September 25, 2026. The owner is building a personal Investing.com-style
platform, then Pro-style research and personal improvements, using existing
subscriptions/free sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns the
scope and delivery order; [capability status](./CAPABILITY_STATUS.md) records
what is actually delivered. Workspace CURRENT.md owns current runtime and
unfinished-source checkpoints.

## Active outcome: connected company overview (first M2 slice)

Use the manual Spec Kit [specification](../specs/002-company-overview/spec.md),
[plan](../specs/002-company-overview/plan.md) and
[tasks](../specs/002-company-overview/tasks.md). Work continues in `markets-home/`
from accepted M1 `9c2aa4f`; local implementation and focused checks are recorded,
with synthetic Brave journey/presentation checks complete. Permitted real-page
QA and release acceptance remain pending.
Workspace `tmp/company-overview/` holds current evidence and interrupted work.

One explicit action supplies missing 1M EOD and annual statements, reusing a
matching Markets snapshot. Show latest-year revenue, net income and operating
cash flow with fiscal/source dates and unknown cells. Share the loaded annual
result with Financials, quality and existing valuation inputs. Fresh company entry
stays idle; quarterly, longer valuation history, peers and SEC remain explicit.
This is the first connected-page layer, not the whole M2 milestone.

Market/annual state now lives in one persistent data hook, with separate company
composition/projection modules. Root owns integration/CSS; data owns the hook;
UI owns summary/projection/components; spec work owns these guides.

Overview and panel controls share 15-minute spacing for repeated exact domain
inputs and four request sequences/hour per company authority. A first annual load
or new range remains allowed; Back/selection retains the budget and snapshot
admission costs zero. Missing-domain Load/Retry and explicit complete-data Refresh
preserve successful siblings, dates, drafts and identity/lifetime guards.

A bounded AAPL annual probe on September 25 returned FY2023–2025, three of ten
requested years: 90 known returned cells, zero unknown returned cells and seven
missing years. All three latest summary fields were known. This establishes one
company/operation's observed access, not universal annual entitlement or a working
M2 page. The [plan](../specs/002-company-overview/plan.md#actual-source-probe)
links metadata-only evidence. Focused evidence records 54 hook passes, 73 UI passes
and 339 root integration cases across retained attempts, plus web types/scoped
lint and four targeted catalog-conflict feedback cases. These groups overlap;
do not sum them. [Tasks](../specs/002-company-overview/tasks.md#evidence) retain
the exact counts, failures and repairs.

Synthetic Brave build 2 verified bounded loading, partial failures, source-tab
focus, a 390px layout without horizontal overflow, cached entry, and retained data
and unsaved invented notes through Back and a failed Refresh. The late-response
case also involved local-access revalidation; focused tests cover route-only
retirement. Build 3 passed final busy-copy/disabled-style checks and the settled
636px layout; the [plan](../specs/002-company-overview/plan.md#synthetic-brave-evidence)
links both browser receipts. Guardrails, permitted real-page QA and release
acceptance remain open. No new API, schema, dependency, source purchase or
authentication change is planned. FinanceDatabase remains a future directory input.
See the [engineering audit](./ENGINEERING_AUDIT.md) and
[Spec Kit adaptation](../specs/README.md).

The first native candidate, `db4a9794`, stopped at the boundary guard: five
render checks still targeted the old workspace after composition moved to
`CompanyResearchPage`. Format, lint and classification passed; native typechecks,
tests and builds did not run. The correction must check the actual component
owners and retain every existing requirement. A revised candidate and full
acceptance remain pending; [failure evidence](../specs/002-company-overview/plan.md#native-gate-recovery)
is retained. The added boundary-script path also requires the normalization
hosted workflow, bringing the revised scope to five workflows and six jobs.

## Accepted runtime and parked work

Accepted M1 is `9c2aa4f059a10c6508e1ba8798ac350231d06dce`: a three-listing
real-EOD Markets board, chart/sorting, global search and exact company entry/Back.
[Markets tasks](../specs/001-markets-home/tasks.md) link the independent final review
and acceptance matrix. Existing research, watchlists, drafts and analyses remain
available. Workspace [CURRENT.md](../../CURRENT.md) and `tmp/markets-home/` own
actual source/build/runtime, native/hosted/Brave evidence, limits and rollback.
Never reuse historical process IDs or terminal/consumed observers as new authority.

The later compact quarter-evidence work is preserved and unreleased. Its four
retained real filings returned structural refusals: zero complete primary graphs
and zero quarter admissions. Do not resume that old caption-retention queue
unless a later bounded task selects it. Existing selected-company provider
quarterly history is a different capability; the SEC result does not erase it.
[Quarter assessment guide](./PERSONAL_SEC_QUARTER_ASSESSMENT.md).

The [delivery history](./DELIVERY_HISTORY.md) preserves earlier feature details
and old command examples. Read the relevant feature guide rather than loading
that entire archive for routine work.

## Working loop

1. Read applicable AGENTS.md, workspace CURRENT.md, this page and the feature
   specification. Inspect Git status and unfinished work. Choose one independently
   useful end-to-end outcome, its source input and visible acceptance demonstration.
2. Assign concrete file ownership for parallel UI/data/review work. Check installed
   dependency documentation and types before custom code or a new package. Keep
   concerns modular and choose a durable design for the current requirements.
3. Run focused behavioral tests and typechecks for changed code. Update spec/tasks
   with actual evidence. Do not recreate setup/authentication or run unrelated
   historical test lists because a template includes examples.
4. Review the final diff, format touched files, and run applicable guardrails.
   Use the release-classification guide for the separate feature and routing
   closure commits. Freeze the reviewed candidate before the full `pnpm verify`
   in a fresh independent verification clone; the API build deliberately rejects
   a dirty tree. Keep the serving clone running separately. If an earlier gate
   fails, fix it and rerun the affected checks before the final clean-source
   gate. Do not bypass source identity or remove the full gate to save time.
5. Push only the verified candidate and wait for applicable hosted checks.
   Recheck only changed or failed work during iteration; broaden verification
   when new evidence warrants it. Report actual local and hosted outcomes
   separately. Do not describe a historical passing run as current validation.
6. Compare the implementation to the specification and show the working journey
   in Brave at desktop and narrow widths. A completed document or convergence
   review is not release acceptance. Keep the task list and checkpoint current;
   report user capability, observed coverage, limits and the next visible outcome.

[Release classification](./RELEASE_CLASSIFICATION.md) still governs releases.
The engineering audit identifies concrete simplifications to review separately;
this planning change does not disable tests or modify release policy.

For runtime setup use [the personal workspace instructions](../README.md#personal-discovery-workspace).
Keep credentials and private source payloads out of these documents. Use the
configured local-access app and external Brave; preserve owner records and tabs.
