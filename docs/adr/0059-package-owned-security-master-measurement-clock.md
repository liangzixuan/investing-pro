# ADR 0059: package-owned security-master measurement clock

Status: **Recorded public engineering Pass only for exact merge-free source
revision `8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and routing closure
`0374becdf96c1e9891d80e73024c8be0440fd812`. No real source, snapshot,
breadth, declared-hardware latency result, owner authorization, Cycle 3e-a
acceptance/promotion, or parity is recorded.**

## Context

The recorded Cycle 3e-a engine fixes the sample count, query population, result
limit, digest binding, and nearest-rank calculation for local search timing. Its
measurement entry point nevertheless accepted an optional third callable that
supplied timestamps. That seam was useful to deterministic tests, but a caller
could also choose elapsed durations and therefore manufacture a result that
looked like a declared-hardware measurement.

The existing public engineering record remains evidence for its exact
historical source chain. It does not make a later real latency result trustworthy
through the caller-controlled clock seam. Cycle 3e-a2 closes only this bounded,
repository-controlled measurement-integrity gap before any owner-only real
measurement may be used as exit evidence.

## Decision

The sole public measurement entry has exactly two parameters:

```ts
measurePersonalSecurityMasterSearchP95(
  catalog: PersonalSecurityMasterCatalog,
  input: PersonalSecurityMasterMeasurementInput,
): PersonalSecurityMasterMeasurement;
```

Runtime arity is also exact. Any missing, extra, or hostile third argument fails
immediately with
`PersonalSecurityMasterError.code === "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID"`.
An extra callback is never invoked, and no overload, options member, test-only
export, global lookup, or dependency-injection path may replace the clock.

The package imports `performance` from `node:perf_hooks` and captures its bound
`now` callable once in the private module constant
`READ_MONOTONIC_MILLISECONDS`. The
measurement loop uses only that package-owned monotonic callable. The constant
is not exported and the caller cannot select a wall clock, synthetic clock, or
alternate timer.

`PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN` and every
`PersonalSecurityMasterMeasurement` receipt bind these exact literals:

| Property      | Exact value                                                 |
| ------------- | ----------------------------------------------------------- |
| `clock`       | `module_captured_node_perf_hooks_performance_now_monotonic` |
| `timedRegion` | `normalize_request_and_search_in_memory_catalog`            |

The receipt property types are tied to the corresponding plan members with
`typeof PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.clock` and
`typeof PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.timedRegion`. This prevents a
result from silently describing another clock or another measured region.

## Timed-region contract

Each of the fixed 3,200 samples starts immediately before request normalization
and finishes immediately after the in-memory catalog search. It therefore
includes `normalizeSearchRequest` and `searchState` for one raw query and fixed
limit, matching the receipt literal
`normalize_request_and_search_in_memory_catalog`.

Snapshot admission, measurement-input capture and validation, ordered-query-set
digesting, sample-array sorting, percentile selection, and receipt construction
remain outside an individual timed region. The correction does not change the
fixed 100 iterations, 32 ordered normalization-distinct queries, result limit
25, nearest-rank p95 method, maximum-duration result, or canonical-JSON-plus-LF
raw-query-set digest.

Every start and finish reading must be finite and nondecreasing. A nonfinite,
backward, or nonfinite-elapsed reading fails closed with the same fixed public
measurement error. That validation is defense in depth; callers cannot supply
the readings.

## Verification guardrail

Focused runtime tests establish the exact two-argument API, receipt bindings,
synthetic measurement behavior, and rejection of a hostile third callback
without invoking it. Deterministic tests may test pure percentile semantics
separately, but they may not reintroduce a public clock seam.

The existing Cycle 3e-a static boundary verifier adds
`personalSecurityMasterMeasurementBoundaryViolation`. Its AST checks pin the
`node:perf_hooks` import, private `READ_MONOTONIC_MILLISECONDS` module capture, exact
two-parameter function and runtime arity, clock use around the declared timed
region, receipt bindings, and absence of an alternate injectable timing path.
Boundary-verifier mutation coverage must show that representative changes to
those invariants are rejected.

## Recorded evidence and stop conditions

Cycle 3e-a2 is recorded as a public engineering Pass only for exact merge-free
source revision `8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and its sole
routing-closure child `0374becdf96c1e9891d80e73024c8be0440fd812`. The source is
the 35/35 successor of the Cycle 2z baseline and has an exact 34-path transition
(32 modified, 2 added). The routing closure is the 36/36 successor and has an
exact five-path modified-only transition.

The source revision passed 2,058 local tests with 9 intentional skips. Its
attempt-1 CI run `33816810188` passed Windows job `100850647775` and Ubuntu job
`100850648064`; custody run `33816810200`/job `100850647942`, normalization run
`33816810227`/job `100850647938`, cross-engine run `33816810267`/job
`100850648210`, and parser-isolation run `33816810173`/job `100850647900` also
passed. Independent source review initially found a timed-region AST-order
blocker; it was fixed before commit, and final review was clean.

The routing closure passed 2,060 local tests with 9 intentional skips and clean
independent review. Its attempt-1 CI run `33823588896` passed Windows job
`100871341851` and Ubuntu job `100871342201`; custody run `33823588891`/job
`100871342729`, parser-isolation run `33823588916`/job `100871341920`, and
cross-engine run `33823588901`/job `100871342184` also passed. No routing-tip
normalization run was triggered or required because the exact five-path routing
transition did not match that workflow's path filters; source normalization run
`33816810227` is the applicable normalization evidence.

This exact record establishes that:

1. focused package behavior and hostile-input tests passed;
2. the static measurement boundary and its mutation coverage passed;
3. full repository verification passed with the exact test and intentional-skip
   counts above;
4. final independent review found no concrete blocker;
5. the source-to-routing topology and changed paths are exact and merge-free;
   and
6. required Windows/Linux CI and acceptance workflows passed at the terminal
   routing tip.

The recorded Pass does not carry forward across a change. Stop without a new
exact record if the public function accepts any arity other than two, an extra
callback can run, time can be supplied or mutated by the caller, the clock is
not the captured `node:perf_hooks` monotonic source, the timed region moves,
either receipt binding is absent or mutable, the static guardrail does not
detect a representative regression, or exact terminal evidence is incomplete.

## Exact nonclaims

This recorded public engineering correction does not establish:

1. any real SEC, OpenFIGI, ISO, or other source material;
2. a real owner-local snapshot, source-policy approval, private operation, or
   owner authorization;
3. at least 3,000 real eligible active U.S.-listed common stocks/ADRs;
4. any real, declared-hardware, production, or below-200-ms latency result;
5. correctness, completeness, currency, rights, or authenticity of a source;
6. browser search, watchlists, persistence, refresh, market data, or another
   product feature;
7. remote, multi-user, enterprise, commercial, redistribution, or production
   safety;
8. Cycle 3e-a acceptance or promotion; or
9. competitor feature parity.

Synthetic timing remains engineering-only even after this correction. The real
Cycle 3e-a exit still requires the separately owner-approved exact source,
admission and breadth result, plus a fresh measurement on declared owner
hardware using the exact recorded package-owned-clock implementation and exact loaded
real universe.

## References

- [Cycle 3e-a2 exit matrix](../CYCLE_3E_A2_EXIT_MATRIX.md)
- [ADR 0057](./0057-owner-local-security-master-snapshot-and-search.md)
- [Cycle 3e-a exit matrix](../CYCLE_3E_A_EXIT_MATRIX.md)
- [ADR 0058](./0058-offline-sec-openfigi-v1-source-preparation.md)
- [Cycle 3e-a1 exit matrix](../CYCLE_3E_A1_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](../PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
