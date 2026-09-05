# ADR 0058: offline `sec_openfigi_v1` source preparation

Status: **Recorded public engineering Pass only for exact merge-free source
revision `0cf87021648e05c191eebbeb95aee6742c4c0f09` and routing closure
`5e27bed1a11956bb207f523739083131aea254f0`. No real source artifact, provider
credential, network request, generated real snapshot, owner authorization, or
private activation is recorded. Cycle 3e-a2 records a public engineering Pass
only for exact source `8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and routing
closure `0374becdf96c1e9891d80e73024c8be0440fd812`. Cycle 3e-a remains not
accepted or promoted.**

## Context

The recorded Cycle 3e-a engine can admit and search one exact canonical
security-master snapshot, but it deliberately does not fetch or reconcile
provider data. The selected `sec_openfigi_v1` profile names the later source
families, yet source selection alone does not define a safe executable handoff
to snapshot admission.

A real owner-local preparation needs a narrow boundary between separately
acquired private material and the already verified admission engine. That
boundary must not put an OpenFIGI key, provider response, local path, rejected
row, or rights-restricted metadata in Git or public CI. It must also prevent
input order, an ambiguous match, or a provider identifier from silently
choosing internal identity.

## Decision

Add a zero-network, memory-only source-preparation entry point to
`@research-cockpit/personal-security-master`:

```ts
prepareSecOpenFigiV1Source({ expectedSha256, artifacts });
```

Both input maps have exactly the same six properties. `expectedSha256` binds
each property to an exact lowercase SHA-256 value and `artifacts` supplies the
corresponding canonical `Uint8Array` document:

| Property                     | Canonical `artifactRole`        | Purpose                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preparationPlan`            | `preparation_plan`              | Binds this profile, the five non-plan artifact digests, source-policy and provenance declarations, output identity, `asOf`, `generatedAt`, and `staleBefore`; evaluation remains under fixed implementation limits. |
| `secCandidates`              | `sec_candidates`                | Supplies the pinned current SEC CIK/name/ticker/exchange candidate set.                                                                                                                                             |
| `normalizedSecCoverEvidence` | `normalized_sec_cover_evidence` | Supplies already normalized issuer-filed submissions/Inline XBRL cover evidence used for common-stock/ADR classification and observed ticker chronology.                                                            |
| `aggregatedOpenFigiMappings` | `aggregated_openfigi_mappings`  | Supplies the exact owner-prepared aggregate of OpenFIGI v3 candidate mappings, with request credentials absent.                                                                                                     |
| `isoMicRegistry`             | `iso_mic_registry`              | Supplies the pinned ISO 10383 operating-MIC declarations used for exchange reconciliation.                                                                                                                          |
| `opaqueIdentityAssignments`  | `opaque_identity_assignments`   | Supplies exact stable internal issuer, security, share-class, listing, and mapping identities independently of ticker, CIK, FIGI, or another provider key.                                                          |

Every root document declares `profile: "sec_openfigi_v1"`,
`schemaVersion: "1.0.0"`, and its one exact `artifactRole`. The preparation
plan binds all five non-plan role digests. Role substitution, duplicate or
missing material, a digest mismatch, or a plan-to-artifact mismatch therefore
fails before any snapshot can be released.

This is an offline preparation boundary, not an acquisition adapter. The SEC,
OpenFIGI, ISO, policy-review, and identity-assignment documents must already
have been prepared and pinned by an owner-controlled process. The module has no
HTTP client, DNS, provider SDK, credential input, environment lookup, filesystem
path, clock, randomness, scheduler, or persistence surface.

## Canonical and deterministic execution

The preparer takes intrinsic owned copies of all six byte carriers, verifies
their expected digests, decodes strict UTF-8, and admits only closed, bounded,
canonical JSON documents terminated by one LF. Unknown keys, noncanonical
numbers or strings, invalid chronology, duplicate identities, role swap,
carrier aliasing, mutation, and trailing data fail closed. Input row order
cannot choose reconciliation or admission ordering, and emitted records are
sorted deterministically. Exact-byte differences remain intentionally visible
through each artifact digest, the bundle digest, provenance, and output source
revision, so reordered artifact bytes do not claim byte-identical output.

Preparation is deterministic for the same six canonical documents:

1. validate the plan and its five role bindings;
2. validate each role-specific schema and canonical order;
3. join SEC candidates to issuer-filed cover evidence without inventing a
   classification, with cover `observedAt` no later than plan provenance
   `acquiredAt`;
4. reconcile an admitted SEC classification with exactly one compatible
   OpenFIGI candidate and one admitted operating MIC;
5. apply only the supplied opaque internal identity assignment for every
   emitted entity and provider mapping;
6. quarantine any row that cannot satisfy the entire join, classification,
   identity, chronology, or uniqueness contract;
7. use the plan's canonical `staleBefore <= asOf` cutoff to count cover evidence
   with `observedAt < staleBefore` as stale, count one resolved but inactive/
   non-U.S./non-operating MIC as ineligible, and account for every source
   candidate exactly once as admitted, ineligible, unsupported, stale, or
   quarantined; and
8. serialize one canonical `personal-security-master.snapshot.json` document
   and pass its owned bytes and digest through the existing
   `admitPersonalSecurityMasterSnapshot` boundary.

Input order cannot pick a winner. Classification disagreement, multiple
eligible mappings, a missing or invalid MIC, conflicting identity assignment,
duplicate active MIC-symbol, or incomplete ancestry is quarantined rather than
guessed or repaired. The aggregate receipt exposes only fixed status and
bounded `exclusionReasonCounts`; it does not expose source values, symbols,
provider identifiers, rejected rows, paths, or credentials. Mixed success is
`prepared_with_exclusions`, not a claim that excluded records were admitted.

OpenFIGI may validly return a listing `figi` equal to its `compositeFigi`. The
preparer admits that row as one listing mapping plus its distinct share-class
mapping and does not emit a redundant composite mapping. `shareClassFigi` must
remain distinct from both values, and reuse of any provider identifier across
resolved source rows remains ambiguous and is quarantined.

If no candidate is admitted, preparation returns the frozen aggregate receipt
without a snapshot-read capability. Otherwise it returns a frozen aggregate
receipt, one identity-bound single-use `capability`, and
`readSnapshot(capability)`. All six captured source copies are wiped in the
factory's `finally` before either result returns. Only the derived canonical
snapshot copy remains behind the capability. The first read attempt consumes
the capability and wipes that retained derived copy in its own `finally`.
Success returns a fresh caller-owned snapshot copy, its exact digest, and the
admitted catalog; replay, cross-instance capability substitution, or a failed
first attempt cannot release bytes later. Creation failure also releases no
partial output, and public failures use one fixed value-free message.

## Public engineering evidence

Repository and CI tests use only synthetic canonical artifacts. They cover:

- the positive six-role inventory plus representative role, digest, plan-
  binding, schema, canonical-form, and resource-bound rejection;
- mutation, alias, hostile-carrier, and caller-owned-byte isolation behavior;
- replay, cross-instance substitution, and the observable rule that every
  first read attempt consumes the only snapshot-release path;
- deterministic output under equivalent input order;
- explicit quarantine for ambiguous or conflicting reconciliation;
- zero-admitted `quarantined` no-capability behavior;
- one-shot successful handoff into the existing snapshot admission boundary;
  and
- a synthetic universe of at least 3,000 records without converting it into a
  real-universe or performance claim.

The reviewed source and static boundary establish the factory-`finally` wipe
of its six captured input copies and the read-`finally` wipe of the retained
derived snapshot. Black-box tests cannot directly inspect those private
internal carriers; they instead observe caller isolation and the consuming
one-shot release behavior. The wiping requirements remain normative stop
conditions, not claims inferred only from inaccessible memory.

Public fixtures must remain synthetic and rights-safe. They do not contain or
stand in for actual SEC, OpenFIGI, or ISO source bytes.

## Later owner-only operation

A later private operation may invoke this boundary only after the owner has
separately acquired and reviewed the exact inputs. That operation must keep the
following outside Git, public CI, retained logs, and source fixtures:

- all six private canonical artifacts and their local locations;
- raw SEC, OpenFIGI, and ISO bytes and any intermediate normalized material;
- an OpenFIGI key, request authorization, or credential-bearing locator;
- raw rejected rows, exact row-level mappings, and restricted metadata;
- the full source-policy document and owner review material;
- the generated real snapshot and declared-hardware measurement inputs; and
- any approval, capability, runner, retry, or cleanup artifact that could
  reconstruct the private operation.

The owner must review exact source versions and digests, retrieval metadata,
applicable terms, attribution, cache, retention, deletion, display, search,
export, and redistribution controls. A fresh, exact, single-use authorization
must bind the six artifacts, preparation implementation revision, output plan,
and the exact recorded Cycle 3e-a2 package-owned-clock measurement plan before
the owner-only run. A retry requires a new
authorization and must preserve the failed operation only in value-free,
private audit material. Public evidence may record only an explicitly allowed
coarse, nonsecret outcome after successful preparation, admission, breadth
validation, and measurement.

## Stop conditions

Preparation or promotion stops without fallback when:

1. a role, digest, plan binding, schema, chronology, canonical form, or bound is
   invalid;
2. source classification or OpenFIGI reconciliation is absent, ambiguous, or
   conflicting;
3. an operating MIC, stable opaque identity, ancestry link, provider mapping,
   ticker interval, or active MIC-symbol uniqueness rule fails;
4. candidate coverage cannot be accounted for exactly;
5. the generated snapshot fails existing Cycle 3e-a admission;
6. a source term, attribution, retention, deletion, export, redistribution, or
   revocation condition cannot be reviewed as compatible;
7. a credential, private path, source value, rejected row, or restricted field
   would enter Git, a public artifact, or a log;
8. cleanup or one-shot consumption cannot be established; or
9. the later real snapshot has fewer than 3,000 admitted eligible active U.S.-
   listed common stocks/ADRs or misses the exact declared-hardware latency gate.

There is no best-effort output, partial admission, provider fallback, automatic
retry, default approval, or conversion of quarantine into an eligible record.

## Exact nonclaims

Cycle 3e-a1 public source and tests do not establish:

1. acquisition, authenticity, currency, completeness, or entitlement of any
   real SEC, OpenFIGI, or ISO material;
2. a provider key, request, transport, refresh, retry, scheduler, or fair-access
   implementation;
3. legal advice or compliance with source terms in fact;
4. randomness, secrecy, or external correctness of supplied opaque identities;
5. complete U.S. coverage or correct external classification/mapping;
6. complete or exchange-effective ticker or corporate-action history;
7. at least 3,000 real eligible securities or a real search-latency result;
8. a real snapshot, private activation, browser search, watchlist, persistence,
   price, statement, chart, screener, or portfolio feature;
9. protection from a hostile same-user process, administrator, memory
   inspection, swap, or crash dump;
10. remote, multi-user, commercial, redistribution, enterprise, or production
    safety; or
11. Cycle 3e-a acceptance/promotion or competitor feature parity.

## Evidence and promotion rule

Cycle 3e-a's public engine/API engineering chain is separately recorded from
exact source revision `5186103977b906d3c035599b3b2b00793926fca3` through
terminal stabilization `fda5148a4251a36861196029bbc6df6b7d1a84d0`. That
record does not authorize this source-preparation operation.

Cycle 3e-a1 is recorded as a public engineering Pass only for exact merge-free
source revision `0cf87021648e05c191eebbeb95aee6742c4c0f09` and its sole routing-
closure child `5e27bed1a11956bb207f523739083131aea254f0`. At the routing tip,
the full local gate passed 2,051 tests with 9 intentional skips. Exact-tip CI run
`33806494548` passed Windows job `100818110497` and Ubuntu job `100818110717`;
custody run `33806494300`, normalization run `33806494295`, cross-engine run
`33806494318`, and parser-isolation run `33806494364` also passed.

That record establishes only the public offline source-preparation engineering
boundary. Cycle 3e-a remains not accepted or promoted until the separate owner-
only real source preparation, exact snapshot admission, at-least-3,000 breadth
gate, and fixed declared-hardware p95 measurement all pass.

Cycle 3e-a2 has a recorded public engineering Pass only for exact merge-free
source revision `8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and routing closure
`0374becdf96c1e9891d80e73024c8be0440fd812`. It makes the API exactly
`(catalog, input)`, rejects a hostile third clock callback without invoking it,
privately captures the `node:perf_hooks` monotonic clock, and binds exact clock
and timed-region literals into the receipt.

The source passed 2,058 local tests with 9 intentional skips. Attempt-1 CI run
`33816810188` passed jobs `100850647775` and `100850648064`; custody run
`33816810200`/job `100850647942`, normalization run `33816810227`/job
`100850647938`, cross-engine run `33816810267`/job `100850648210`, and parser-
isolation run `33816810173`/job `100850647900` also passed. Final source review
was clean after the pre-commit timed-region AST-order blocker was fixed.

The routing closure passed 2,060 local tests with 9 intentional skips and clean
independent review. Attempt-1 CI run `33823588896` passed jobs `100871341851`
and `100871342201`; custody run `33823588891`/job `100871342729`, parser-
isolation run `33823588916`/job `100871341920`, and cross-engine run
`33823588901`/job `100871342184` also passed. No routing-tip normalization run
was triggered or required by the exact five-path routing transition. The
correction authorizes no real operation, establishes no real breadth or
latency, and cannot accept or promote Cycle 3e-a or establish parity.

## References

- [Cycle 3e-a1 exit matrix](../CYCLE_3E_A1_EXIT_MATRIX.md)
- [ADR 0057](./0057-owner-local-security-master-snapshot-and-search.md)
- [Cycle 3e-a exit matrix](../CYCLE_3E_A_EXIT_MATRIX.md)
- [ADR 0059](./0059-package-owned-security-master-measurement-clock.md)
- [Cycle 3e-a2 exit matrix](../CYCLE_3E_A2_EXIT_MATRIX.md)
- [ADR 0055](./0055-connected-personal-source-policy-registry.md)
- [Personal product-breadth roadmap](../PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
