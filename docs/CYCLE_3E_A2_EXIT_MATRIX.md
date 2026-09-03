# Cycle 3e-a2 exit matrix

Scope: close the package-owned measurement-integrity gap in the recorded Cycle
3e-a local-search engine. This bounded repository-only correction removes the
caller clock, pins the exact two-argument API and monotonic timed region, binds
both facts into the measurement receipt, and adds a static regression guard. It
does not acquire or operate on real source material.

Implementation status: **Prepared public engineering correction only. No exact
source or routing revision has been frozen or recorded as Pass.**

Terminal verification status: **Pending exact-source local verification,
independent review, routing closure, and terminal Windows/Linux CI and
acceptance evidence.**

Real-source and measurement status: **No real snapshot, private operation,
owner authorization, real-universe breadth result, or declared-hardware latency
result is recorded.**

Acceptance/promotion status: **Not accepted or promoted. Cycle 3e-a also
remains not accepted or promoted.**

## Gate matrix

| Gate                            | Exact requirement                                                                                                                                                                                | Current status                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Prior engine record             | The historical Cycle 3e-a engine/API chain remains recorded only for its exact revisions; that record does not validate a future result through a caller-controlled clock                        | Preserved recorded public engineering Pass only |
| Prior source-preparation record | Cycle 3e-a1 remains recorded only for its exact offline public engineering chain and does not authorize a real operation                                                                         | Preserved recorded public engineering Pass only |
| Exact public API                | `measurePersonalSecurityMasterSearchP95(catalog, input)` has exactly two TypeScript parameters and requires exactly two runtime arguments                                                        | Prepared source; exact evidence pending         |
| Hostile third argument          | Any third argument fails with `PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID` before input processing or timing, and a supplied callback is never invoked                                         | Prepared source; exact evidence pending         |
| Package-owned clock             | The package privately captures bound `performance.now` from `node:perf_hooks` once as `READ_MONOTONIC_MILLISECONDS`; no caller, global, option, overload, or test seam can replace it            | Prepared source; exact evidence pending         |
| Monotonic validation            | Every reading is finite and nondecreasing and every elapsed sample is finite; violation fails through the fixed public measurement error                                                         | Prepared source; exact evidence pending         |
| Clock receipt binding           | Plan and receipt contain `clock: "module_captured_node_perf_hooks_performance_now_monotonic"`, with the receipt type bound to the plan member                                                    | Prepared source; exact evidence pending         |
| Timed-region receipt binding    | Plan and receipt contain `timedRegion: "normalize_request_and_search_in_memory_catalog"`, with the receipt type bound to the plan member                                                         | Prepared source; exact evidence pending         |
| Exact timed region              | Each sample starts immediately before `normalizeSearchRequest` and ends immediately after `searchState`; admission, input capture, digesting, sorting, percentile, and receipt work stay outside | Prepared source; exact evidence pending         |
| Fixed plan preserved            | 100 iterations, 32 ordered normalization-distinct queries, limit 25, 3,200 samples, nearest-rank p95, maximum latency, and ordered raw-query digest remain unchanged                             | Prepared source; exact evidence pending         |
| Content-kind honesty            | Synthetic measurement is still labeled `synthetic_engineering_only_not_production_slo` and cannot become real latency evidence                                                                   | Prepared source; exact evidence pending         |
| Runtime regression tests        | Focused tests cover the exact API, bound receipt, successful synthetic measurement, malformed input, and hostile third-argument noninvocation                                                    | Prepared source; exact evidence pending         |
| Static guardrail                | `personalSecurityMasterMeasurementBoundaryViolation` pins clock import/capture, API arity, timed region, receipt fields, and the absence of another timing seam                                  | Prepared source; exact evidence pending         |
| Mutation coverage               | Representative clock, arity, region, and receipt-binding mutations cause the static boundary verifier to fail                                                                                    | Prepared source; exact evidence pending         |
| Full repository verification    | The exact source revision passes formatting, lint, types, unit/integration/security tests, boundary verification, and the repository's declared skip policy                                      | Pending exact-source result                     |
| Exact source topology           | The source correction and later evidence-routing closure have exact changed-path inventories and merge-free ancestry                                                                             | Pending freeze                                  |
| Terminal public verification    | Independent review plus exact-tip Windows/Linux CI and required acceptance workflows pass                                                                                                        | Pending routing closure                         |
| Real breadth                    | One owner-approved exact snapshot contains at least 3,000 eligible active U.S.-listed common stocks/ADRs after explicit exclusions                                                               | Pending separate owner-only operation           |
| Real latency                    | The accepted package-owned-clock implementation measures below 200 ms p95 on declared owner hardware with that exact loaded real universe and fixed plan                                         | Pending separate owner-only operation           |
| No promotion by correction      | Source preparation, synthetic scale/timing, or a public engineering Pass for this correction cannot accept or promote Cycle 3e-a                                                                 | Explicit nonclaim                               |

## Exact contract

The public function is exactly:

```ts
measurePersonalSecurityMasterSearchP95(
  catalog: PersonalSecurityMasterCatalog,
  input: PersonalSecurityMasterMeasurementInput,
): PersonalSecurityMasterMeasurement;
```

The private `READ_MONOTONIC_MILLISECONDS` bound callable is captured from
`node:perf_hooks` at module initialization and is the only source of sample
timestamps. The plan and receipt name both the clock and the measured work:

```ts
clock: "module_captured_node_perf_hooks_performance_now_monotonic";
timedRegion: "normalize_request_and_search_in_memory_catalog";
```

For each query, the start reading precedes request normalization and the finish
reading follows the in-memory search. Any extra argument fails before it can be
observed or invoked. The correction changes no search result, ranking, catalog,
source-preparation, API route, or private-data boundary.

## Public evidence stage

Only source-stage engineering is prepared. No test count, skip count, source
revision, routing revision, review result, CI run, workflow job, or public Pass
is recorded here yet. Those facts may be added only after exact-source and
terminal-routing evidence exists.

All fixtures remain synthetic. A synthetic duration can find a regression but
cannot satisfy the real latency gate. The earlier Cycle 3e-a and Cycle 3e-a1
records stay limited to their exact historical chains and do not pre-approve
this correction.

## Stop conditions and nonclaims

Stop without a public engineering Pass on any alternate clock source, caller
injection seam, nonexact arity, movable or inaccurately labeled timed region,
missing or mutable receipt binding, ineffective static/mutation guard, focused
test failure, repository-gate failure, review blocker, topology mismatch, or
terminal workflow failure.

This source-stage slice proves no real source acquisition, rights, authenticity,
completeness, private run, owner authorization, real 3,000-security breadth,
real latency, below-200-ms result, browser or watchlist feature, production
safety, Cycle 3e-a acceptance/promotion, or competitor parity.

## References

- [ADR 0059](./adr/0059-package-owned-security-master-measurement-clock.md)
- [Cycle 3e-a exit matrix](./CYCLE_3E_A_EXIT_MATRIX.md)
- [Cycle 3e-a1 exit matrix](./CYCLE_3E_A1_EXIT_MATRIX.md)
- [ADR 0057](./adr/0057-owner-local-security-master-snapshot-and-search.md)
- [ADR 0058](./adr/0058-offline-sec-openfigi-v1-source-preparation.md)
- [Personal product-breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](./BUILD_ROADMAP.md)
- [Threat model](./THREAT_MODEL.md)
- [Canonical model](./CANONICAL_MODEL.md)
