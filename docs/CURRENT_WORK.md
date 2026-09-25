# Current work

Updated September 24, 2026. The owner is building a personal Investing.com-style
platform, then Pro-style research and personal improvements, using existing
subscriptions/free sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns the
scope and delivery order; [capability status](./CAPABILITY_STATUS.md) records
what is actually delivered. Workspace CURRENT.md owns current runtime and
unfinished-source checkpoints.

## Active outcome: Markets home and direct company entry

Use the manual, adapted Spec Kit pilot:

- [Specification](../specs/001-markets-home/spec.md): user journeys and acceptance.
- [Implementation plan](../specs/001-markets-home/plan.md): existing dependencies,
  source limits, module responsibilities and actual open evidence.
- [Tasks](../specs/001-markets-home/tasks.md): ordered work and verification state.

Implementation is in the isolated `markets-home` checkout. T001 source decisions,
T002 prototype, T003 independent feeds and T004 arithmetic have focused evidence.
The Markets loader/view and shared routes have passed focused checks and source
review. Integrated synthetic Brave checks passed; actual Next routing and permitted live-data acceptance remain open. The candidate is
uncommitted and has not completed native/hosted release gates.
Read workspace `tmp/markets-home/` for actual evidence and interrupted-work handoffs.

The bounded outcome is a populated market board, one chart, scoped movers and direct
company navigation. Keep the first source check and desktop/narrow design tied
to that working outcome. Reuse the current React application, market adapters,
ECharts, calculations and company panels. New layers must preserve a usable app.
News/calendar source work can proceed independently as feeds become available.

Do not append another orchestration layer to the large discovery component.
Use the existing Next routing and a shared workspace lifetime with separate
market-page, company-page and data-coordination modules. Separate quote and
history availability so a quote entitlement failure cannot erase usable EOD
history. Exact interfaces and callers change together; no compatibility layer
is required for a superseded API.

FinanceDatabase is a future instrument-directory input, not a quote feed or an
admitted common-stock catalog. Its import does not block the initial market board.
See the [engineering audit](./ENGINEERING_AUDIT.md) and
[Spec Kit adoption note](../specs/README.md).

## Accepted runtime and parked work

Accepted source is `2b2510bc677173d1c9700e9f13c5012a7a0c8a88`, including Research
Desk, financial-result price screening and the bounded selected-quarter SEC
assessment. Workspace CURRENT.md and outside-Git handoffs record actual native,
hosted and Brave verification, source/build identity and rollback state.

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
