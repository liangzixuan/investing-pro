# ADR 0059: package-owned security-master measurement clock

Status: **Prepared public engineering correction only. The exact source and
routing transitions, terminal local result, independent review, and CI evidence
have not yet been frozen or recorded as Pass. No real source, snapshot,
declared-hardware latency result, owner authorization, acceptance, or promotion
is recorded.**

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

## Evidence stage and stop conditions

This ADR records a prepared source-stage correction, not a successful gate. A
later evidence-routing transition may record Cycle 3e-a2 as a public engineering
Pass only after all of the following are bound to exact revisions:

1. focused package behavior and hostile-input tests pass;
2. the static measurement boundary and its mutation coverage pass;
3. full repository verification passes with exact test and intentional-skip
   counts;
4. independent review finds no concrete blocker;
5. the source-to-routing topology and changed paths are exact and merge-free;
   and
6. required Windows/Linux CI and acceptance workflows pass at the terminal
   routing tip.

Stop without recording a Pass if the public function accepts any arity other
than two, an extra callback can run, time can be supplied or mutated by the
caller, the clock is not the captured `node:perf_hooks` monotonic source, the
timed region moves, either receipt binding is absent or mutable, the static
guardrail does not detect a representative regression, or exact terminal
evidence is incomplete.

## Exact nonclaims

This prepared correction does not establish:

1. a recorded Cycle 3e-a2 public engineering Pass;
2. any real SEC, OpenFIGI, ISO, or other source material;
3. a real owner-local snapshot, source-policy approval, private operation, or
   owner authorization;
4. at least 3,000 real eligible active U.S.-listed common stocks/ADRs;
5. any real, declared-hardware, production, or below-200-ms latency result;
6. correctness, completeness, currency, rights, or authenticity of a source;
7. browser search, watchlists, persistence, refresh, market data, or another
   product feature;
8. remote, multi-user, enterprise, commercial, redistribution, or production
   safety;
9. Cycle 3e-a acceptance or promotion; or
10. competitor feature parity.

Synthetic timing remains engineering-only even after this correction. The real
Cycle 3e-a exit still requires the separately owner-approved exact source,
admission and breadth result, plus a fresh measurement on declared owner
hardware using the accepted package-owned-clock implementation and exact loaded
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
