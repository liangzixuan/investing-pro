# Cycle 3e-a2 exit matrix

Scope: close the package-owned measurement-integrity gap in the recorded Cycle
3e-a local-search engine. This bounded repository-only correction removes the
caller clock, pins the exact two-argument API and monotonic timed region, binds
both facts into the measurement receipt, and adds a static regression guard. It
does not acquire or operate on real source material.

Implementation status: **Recorded public engineering Pass only for exact
merge-free source revision `8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and its
sole routing-closure child `0374becdf96c1e9891d80e73024c8be0440fd812`.**

Terminal verification status: **Pass. The source revision passed 2,058 local
tests with 9 intentional skips and all required source workflows; the routing
closure passed 2,060 local tests with 9 intentional skips, clean independent
review, and all required routing workflows on attempt 1.**

Real-source and measurement status: **No real snapshot, private operation,
owner authorization, real-universe breadth result, or declared-hardware latency
result is recorded.**

Acceptance/promotion status: **Recorded Cycle 3e-a2 public engineering Pass
only. Cycle 3e-a remains not accepted or promoted.**

## Gate matrix

| Gate                            | Exact requirement                                                                                                                                                                                | Current status                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Prior engine record             | The historical Cycle 3e-a engine/API chain remains recorded only for its exact revisions; that record does not validate a future result through a caller-controlled clock                        | Preserved recorded public engineering Pass only |
| Prior source-preparation record | Cycle 3e-a1 remains recorded only for its exact offline public engineering chain and does not authorize a real operation                                                                         | Preserved recorded public engineering Pass only |
| Exact public API                | `measurePersonalSecurityMasterSearchP95(catalog, input)` has exactly two TypeScript parameters and requires exactly two runtime arguments                                                        | Recorded public engineering Pass                |
| Hostile third argument          | Any third argument fails with `PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID` before input processing or timing, and a supplied callback is never invoked                                         | Recorded public engineering Pass                |
| Package-owned clock             | The package privately captures bound `performance.now` from `node:perf_hooks` once as `READ_MONOTONIC_MILLISECONDS`; no caller, global, option, overload, or test seam can replace it            | Recorded public engineering Pass                |
| Monotonic validation            | Every reading is finite and nondecreasing and every elapsed sample is finite; violation fails through the fixed public measurement error                                                         | Recorded public engineering Pass                |
| Clock receipt binding           | Plan and receipt contain `clock: "module_captured_node_perf_hooks_performance_now_monotonic"`, with the receipt type bound to the plan member                                                    | Recorded public engineering Pass                |
| Timed-region receipt binding    | Plan and receipt contain `timedRegion: "normalize_request_and_search_in_memory_catalog"`, with the receipt type bound to the plan member                                                         | Recorded public engineering Pass                |
| Exact timed region              | Each sample starts immediately before `normalizeSearchRequest` and ends immediately after `searchState`; admission, input capture, digesting, sorting, percentile, and receipt work stay outside | Recorded public engineering Pass                |
| Fixed plan preserved            | 100 iterations, 32 ordered normalization-distinct queries, limit 25, 3,200 samples, nearest-rank p95, maximum latency, and ordered raw-query digest remain unchanged                             | Recorded public engineering Pass                |
| Content-kind honesty            | Synthetic measurement is still labeled `synthetic_engineering_only_not_production_slo` and cannot become real latency evidence                                                                   | Recorded public engineering Pass only           |
| Runtime regression tests        | Focused tests cover the exact API, bound receipt, successful synthetic measurement, malformed input, and hostile third-argument noninvocation                                                    | Recorded public engineering Pass                |
| Static guardrail                | `personalSecurityMasterMeasurementBoundaryViolation` pins clock import/capture, API arity, timed region, receipt fields, and the absence of another timing seam                                  | Recorded public engineering Pass                |
| Mutation coverage               | Representative clock, arity, region, and receipt-binding mutations cause the static boundary verifier to fail                                                                                    | Recorded public engineering Pass                |
| Full repository verification    | The exact source revision passes formatting, lint, types, unit/integration/security tests, boundary verification, and the repository's declared skip policy                                      | Pass: source 2,058/9; routing 2,060/9           |
| Exact source topology           | The source correction and later evidence-routing closure have exact changed-path inventories and merge-free ancestry                                                                             | Pass: `8c2166f` -> `0374bec`                    |
| Terminal public verification    | Independent review plus exact-tip Windows/Linux CI and required acceptance workflows pass                                                                                                        | Pass at `0374bec`                               |
| Real breadth                    | One owner-approved exact snapshot contains at least 3,000 eligible active U.S.-listed common stocks/ADRs after explicit exclusions                                                               | Pending separate owner-only operation           |
| Real latency                    | The exact recorded package-owned-clock implementation measures below 200 ms p95 on declared owner hardware with that exact loaded real universe and fixed plan                                   | Pending separate owner-only operation           |
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

## Recorded public engineering evidence

The exact merge-free source revision
`8c2166fa01f5e1f471887ccdeb9484b132a02bb0` is the sole child of the recorded
Cycle 3e-a1 evidence tip `d34266037ca997d72bea440e9be942cddd223da9` and is the
35/35 successor of the Cycle 2z baseline. Its exact transition contains 34
paths: 32 modified and 2 added. Full local verification passed 2,058 tests with
9 intentional skips. Independent review initially identified a timed-region
AST-order blocker; it was fixed before the source commit, and final source
review was clean. All source workflows passed on attempt 1:

- CI [run `33816810188`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810188): [Windows job `100850647775`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810188/job/100850647775) and [Ubuntu job `100850648064`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810188/job/100850648064);
- custody [run `33816810200`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810200), [job `100850647942`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810200/job/100850647942);
- normalization [run `33816810227`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810227), [job `100850647938`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810227/job/100850647938);
- cross-engine [run `33816810267`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810267), [job `100850648210`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810267/job/100850648210); and
- parser isolation [run `33816810173`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810173), [job `100850647900`](https://github.com/liangzixuan/investing-pro/actions/runs/33816810173/job/100850647900).

The sole routing-closure child
`0374becdf96c1e9891d80e73024c8be0440fd812` is the merge-free 36/36 successor
of the Cycle 2z baseline. Its exact transition modifies only the workflow and
four parser/custody verifier files. Full local verification passed 2,060 tests
with 9 intentional skips, and independent review was clean. All required
routing workflows passed on attempt 1:

- CI [run `33823588896`](https://github.com/liangzixuan/investing-pro/actions/runs/33823588896): [Windows job `100871341851`](https://github.com/liangzixuan/investing-pro/actions/runs/33823588896/job/100871341851) and [Ubuntu job `100871342201`](https://github.com/liangzixuan/investing-pro/actions/runs/33823588896/job/100871342201);
- custody [run `33823588891`](https://github.com/liangzixuan/investing-pro/actions/runs/33823588891), [job `100871342729`](https://github.com/liangzixuan/investing-pro/actions/runs/33823588891/job/100871342729);
- parser isolation [run `33823588916`](https://github.com/liangzixuan/investing-pro/actions/runs/33823588916), [job `100871341920`](https://github.com/liangzixuan/investing-pro/actions/runs/33823588916/job/100871341920); and
- cross-engine [run `33823588901`](https://github.com/liangzixuan/investing-pro/actions/runs/33823588901), [job `100871342184`](https://github.com/liangzixuan/investing-pro/actions/runs/33823588901/job/100871342184).

No routing-tip normalization run was triggered or required: the exact five-path
routing transition did not match that workflow's path filters. The source-tip
normalization run above is the applicable normalization evidence.

All fixtures remain synthetic. A synthetic duration can find a regression but
cannot satisfy the real latency gate. The earlier Cycle 3e-a and Cycle 3e-a1
records stay limited to their exact historical chains and do not pre-approve
this correction.

## Stop conditions and nonclaims

The recorded Pass does not carry forward across a change. Stop without a new
exact public engineering record on any alternate clock source, caller injection
seam, nonexact arity, movable or inaccurately labeled timed region, missing or
mutable receipt binding, ineffective static/mutation guard, focused test
failure, repository-gate failure, review blocker, topology mismatch, or terminal
workflow failure.

This recorded public engineering slice proves no real source acquisition,
rights, authenticity, completeness, private run, owner authorization, real
3,000-security breadth, real latency, below-200-ms result, browser or watchlist
feature, production safety, Cycle 3e-a acceptance/promotion, or competitor
parity.

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
