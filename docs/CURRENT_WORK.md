# Current work

Updated September 25, 2026. Build a personal Investing.com-style platform, then
Pro-style research and personal improvements, using existing subscriptions/free
sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns scope and delivery order;
workspace [CURRENT.md](../../CURRENT.md) owns live source/runtime checkpoints.

## Active outcome: annual company key statistics

Use the manual Spec Kit [specification](../specs/003-company-key-statistics/spec.md),
[plan](../specs/003-company-key-statistics/plan.md) and
[tasks](../specs/003-company-key-statistics/tasks.md). Work in `markets-home/` from
accepted `b25a05e`. Source and focused verification are complete; browser and
new-release acceptance are pending.
Evidence belongs in workspace `tmp/company-key-statistics/`.

Add operating margin, net margin, operating cash-flow margin, net debt, debt/assets
and revenue year-over-year growth from the existing annual analytics. Reuse the
loaded annual result; the new panel adds no acquisition or request owner. Preserve
latest-year unknown reasons, actual consecutive growth periods, formula/input
references and fiscal/source dates. Six-metric availability is distinct from
returned annual-year coverage.

Also repair the existing Financial quality and manual peer-quality ratio displays.
A shared formatter uses the installed Decimal dependency; short rounded labels
retain full calculation strings in keyboard-accessible details. Check statuses,
comparisons, source strings and engine precision remain unchanged. Root owns page
composition/CSS/integration; data owns the pure projection/tests; UI owns the
component/tests and display formatter/quality tables; spec owns these guides.

One bounded AAPL daily valuation call returned HTTP 502 / `provider_unavailable`
on September 25. This proves neither access nor denied entitlement. Its consumed
[receipt](../../tmp/company-key-statistics/valuation-source-probe.json) is preserved;
do not repeat the probe. Daily valuation summary and loader migration are deferred.
The current hook, API/schema, dependencies, valuation behavior, local-access/vault/
origin boundaries and owner records stay within the existing product behavior.

Acceptance covers exact/missing/zero/signed values, quarantine, growth periods,
readable desktop/390px and keyboard details, source focus and no extra requests.
Retained checks passed 16 projection cases, 78 distinct formatter/UI cases and
314 workspace integration cases, plus scoped lint and web/analytics typechecks.
The [source reviews](../../tmp/company-key-statistics/ui-integration-independent-review.json)
record evidence and limits. Complete source-bound synthetic/permitted live Brave
and the unchanged full release workflow before claiming release acceptance.

## Accepted runtime and parked work

Connected company overview `b25a05e735ab6d095023a22f427ff75be66af414` is accepted,
normally pushed and running; feature `4cc9946`, build `_TaRVEPpgM-yDGGOd068H`.
It provides one explicit missing-price/annual load, shared results/pacing, dates,
partial-result retention and Back/draft continuity. Native acceptance passed
9,183 tests with nine existing skips, 25 typechecks and 24 builds; all five hosted
workflows/six jobs, guarded activation, smoke and seven limited live Brave groups
passed. The [final matrix](../../tmp/company-overview/m2-acceptance-matrix-v3.json)
and [independent review](../../tmp/company-overview/final-acceptance-independent-review-v3.json)
record exact evidence and limits. M1 Markets remains part of that accepted product.

Live AAPL returned FY2023–2025, three of ten years and three known summary fields.
That verifies one operation, not universal coverage or complete M2. The 358 native
health samples concern preservation of the predecessor during verification;
candidate runtime evidence is separate. Keep rollback and both failed M2 candidate
refs/evidence. Never reuse historical process IDs or terminal/consumed helpers.

The original `research-cockpit/` checkout contains parked, unreleased SEC quarter
work. Its four retained filings had zero complete primary graphs/quarter admissions;
do not resume that queue unless a later task selects it. The new slice does not
change that work. [Quarter guide](./PERSONAL_SEC_QUARTER_ASSESSMENT.md).

## Working loop

1. Read applicable AGENTS.md, workspace CURRENT.md, this guide and the active spec.
   Inspect source state and choose one bounded, independently useful outcome.
2. Assign file ownership; use existing libraries/formulas and separate concerns.
   Coordinate shared interfaces before edits; preserve unrelated user changes.
3. Verify meaningful behavior, types/lint and existing component-owner/style setup
   early. [Recorded lessons](../../tmp/company-overview/verification-order-lessons-v3.md)
   explain the prior boundary/mocked-CSS failures without weakening any gate.
4. Review source and explicit files; follow the separate feature/generated closure
   procedure and unchanged isolated native gate. Preserve failures and rollback.
5. Push the verified candidate normally; accept actual required hosted-job success
   at its exact revision. Do not replay terminal observers or unchanged passed gates.
6. Demonstrate desktop/narrow Brave behavior, perform guarded activation/smoke and
   record actual acceptance outside Git and in CURRENT.md. Report source coverage
   separately from complete-page coverage; keep the next outcome bounded.

[Release classification](./RELEASE_CLASSIFICATION.md) governs releases. The
[engineering audit](./ENGINEERING_AUDIT.md) and [Spec Kit adaptation](../specs/README.md)
do not replace it. Use configured local access and external Brave; preserve owner
records/tabs and keep credentials/private payloads out of source and handoffs.
