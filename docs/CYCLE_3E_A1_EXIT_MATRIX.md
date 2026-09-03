# Cycle 3e-a1 exit matrix

Scope: prepare a deterministic, offline, memory-only `sec_openfigi_v1` handoff
from six exact owner-supplied canonical artifacts into the recorded Cycle 3e-a
snapshot-admission engine. This slice adds no provider acquisition, credential,
network adapter, real source material, private execution, or promotion.

Implementation status: **Prepared public engineering source for exact review;
source and routing transitions are not yet recorded.**

Terminal verification status: **Pending for Cycle 3e-a1.**

Real-source authorization and operation status: **Pending separate exact owner
review and fresh authorization; no private operation has occurred.**

Acceptance/promotion status: **Cycle 3e-a remains not accepted or promoted.**

## Gate matrix

| Gate                         | Exact requirement                                                                                                                                                                                                                                                   | Status                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Prior engine boundary        | Recorded Cycle 3e-a engineering chain remains exact from `5186103977b906d3c035599b3b2b00793926fca3` through `fda5148a4251a36861196029bbc6df6b7d1a84d0`                                                                                                              | Recorded public engineering Pass only |
| Exact public entry           | `prepareSecOpenFigiV1Source({expectedSha256,artifacts})` is the sole preparation entry                                                                                                                                                                              | Prepared; terminal evidence pending   |
| Exact six roles              | Both maps contain only `preparationPlan`, `secCandidates`, `normalizedSecCoverEvidence`, `aggregatedOpenFigiMappings`, `isoMicRegistry`, and `opaqueIdentityAssignments`                                                                                            | Prepared; terminal evidence pending   |
| Root identities              | Roles are exactly `preparation_plan`, `sec_candidates`, `normalized_sec_cover_evidence`, `aggregated_openfigi_mappings`, `iso_mic_registry`, and `opaque_identity_assignments`, each under profile `sec_openfigi_v1` and schema `1.0.0`                             | Prepared; terminal evidence pending   |
| Plan closure                 | The preparation plan binds the five non-plan role digests plus exact output identity, provenance, policy, `asOf`, `generatedAt`, and `staleBefore`; fixed implementation limits are not caller-selectable                                                           | Prepared; terminal evidence pending   |
| Byte ownership               | Six source documents are intrinsically copied; exact SHA-256 is checked before interpretation and all captured copies are wiped in the factory `finally` before return                                                                                              | Prepared; terminal evidence pending   |
| Canonical input              | Strict UTF-8, one-LF canonical JSON, closed role-specific schemas, and bounded bytes/records/depth/nodes/strings/arrays fail closed                                                                                                                                 | Prepared; terminal evidence pending   |
| Deterministic reconciliation | Input row order cannot select reconciliation/admission ordering and emitted records are sorted; exact-byte reorder remains visible through artifact/bundle digests, provenance, and output source revision                                                          | Prepared; terminal evidence pending   |
| Classification agreement     | Common-stock/ADR classification must be supported by normalized issuer-filed cover evidence observed no later than plan provenance acquisition and the one compatible mapping                                                                                       | Prepared; terminal evidence pending   |
| Stable internal identity     | Only supplied opaque issuer/security/share-class/listing/mapping assignments become internal identities; CIK, ticker, FIGI, and provider identifiers remain attributes/mappings                                                                                     | Prepared; terminal evidence pending   |
| Honest ticker history        | Only `sec_filing_observed` and `prospective_snapshot_observed` intervals are emitted; exchange-effective or complete history is not inferred                                                                                                                        | Prepared; terminal evidence pending   |
| Atomic disposition           | Missing/ambiguous/conflicting candidates are quarantined, unsupported classifications are unsupported, cover evidence older than plan `staleBefore` is stale, and one resolved inactive/non-U.S./non-operating MIC is ineligible                                    | Prepared; terminal evidence pending   |
| Coverage accounting          | Every source candidate is accounted for exactly and aggregate `exclusionReasonCounts` disclose no source values or rejected rows                                                                                                                                    | Prepared; terminal evidence pending   |
| Existing admission           | Output is one canonical snapshot whose exact bytes and digest pass `admitPersonalSecurityMasterSnapshot` before release                                                                                                                                             | Prepared; terminal evidence pending   |
| One-shot release             | Nonempty success returns a frozen receipt, identity-bound single-use capability, and synchronous `readSnapshot`; replay/cross-instance use fails                                                                                                                    | Prepared; terminal evidence pending   |
| No-admission result          | Any zero-admitted result has status `quarantined`, returns only the frozen aggregate receipt, and has no read capability                                                                                                                                            | Prepared; terminal evidence pending   |
| Confidential failure         | One fixed value-free public failure discloses no path, symbol, provider value, digest detail, rejected row, credential, or partial output                                                                                                                           | Prepared; terminal evidence pending   |
| Static isolation             | Production preparation source has no network, DNS, provider SDK, credential, environment, filesystem-path, scheduler, persistence, clock, or randomness dependency                                                                                                  | Prepared; terminal evidence pending   |
| Public synthetic evidence    | Positive six-role coverage; representative role/digest/schema/canonical/resource-bound rejection; hostile-carrier, caller-isolation, replay, first-attempt consumption, quarantine, and at-least-3,000 synthetic tests exercise mechanics without a real-data claim | Prepared engineering evidence only    |
| Exact source topology        | Cycle 3e-a1 source and routing revisions, changed-path transitions, and merge-free ancestry are frozen                                                                                                                                                              | Pending                               |
| Terminal public verification | Focused tests, full local verification, independent review, and exact-tip Windows/Linux CI pass                                                                                                                                                                     | Pending                               |
| Owner source review          | Exact inputs, versions, digests, retrieval metadata, terms, attribution, cache/retention/deletion/export/redistribution controls, and policy record are approved                                                                                                    | Pending owner-only operation          |
| Real snapshot breadth        | Exact admitted snapshot contains at least 3,000 eligible active U.S.-listed common stocks/ADRs after explicit exclusions                                                                                                                                            | Pending owner-only operation          |
| Real search latency          | Fixed 100-iteration, 32-distinct-query, limit-25 measurement is below 200 ms p95 on declared owner hardware and exact snapshot                                                                                                                                      | Pending owner-only operation          |
| Public evidence minimization | Only an expressly allowed coarse nonsecret result may become public; private artifacts and operation details remain outside Git and logs                                                                                                                            | Required for later operation          |
| No promotion by preparation  | Public preparation source, synthetic scale, or a prepared snapshot cannot alone accept or promote Cycle 3e-a                                                                                                                                                        | Explicit nonclaim                     |

## Exact protocol

`prepareSecOpenFigiV1Source` consumes six exact digest-bound canonical byte
documents. The plan transitively binds the other five roles. Validation and
reconciliation are all-or-nothing at the protocol boundary, while unsuitable
candidate rows enter a bounded value-free quarantine aggregate rather than a
partial or guessed identity result.

A nonempty admitted result supplies one identity-bound single-use capability.
The factory wipes all six captured inputs before returning. Only its derived
canonical snapshot copy remains behind the capability.
`readSnapshot(capability)` consumes it synchronously, wipes that retained copy
on the first attempt, and returns a fresh caller-owned snapshot copy, its
digest, and the admitted catalog only after the existing Cycle 3e-a admission
succeeds. A result with no admitted candidate exposes only its frozen aggregate
receipt.

Black-box tests directly observe caller-byte isolation and that every first
read attempt consumes the only release path. The private captured-input and
retained-snapshot carriers are intentionally inaccessible to those tests; their
`finally` wipes are established by reviewed source and the static boundary and
remain normative stop conditions.

## Public/private separation

Public fixtures are synthetic. The public repository contains no actual SEC,
OpenFIGI, or ISO material, key, request, response, local path, policy document,
identity assignment, real snapshot, or owner authorization. The preparer does
not acquire or refresh a source.

A later owner-only operation must privately bind the six exact artifacts,
their acquisition and policy evidence, the exact implementation revision, the
generated snapshot, and the fixed measurement plan under fresh single-use
authorization. Private bytes, credentials, paths, rejected rows, restricted
metadata, full approvals, and runner/retry/cleanup material cannot enter Git,
public CI, fixtures, or retained logs.

## Stop conditions

Stop without output or promotion on any digest, role, canonical-form, schema,
bound, chronology, plan-binding, classification, mapping, MIC, identity,
ancestry, ticker-history, uniqueness, coverage, admission, policy, cleanup, or
confidentiality failure. There is no provider fallback, best-effort record,
automatic retry, partial release, or synthetic substitution for the real
breadth and latency gates.

## Exact nonclaims

This slice proves no real source acquisition, authenticity, rights, currency,
completeness, classification accuracy, mapping accuracy, identity randomness,
exchange-effective history, real 3,000-security breadth, real latency, browser
workflow, watchlist, persistence, market data, enterprise safety, production
readiness, promotion, or competitor parity.

## References

- [ADR 0058](./adr/0058-offline-sec-openfigi-v1-source-preparation.md)
- [ADR 0057](./adr/0057-owner-local-security-master-snapshot-and-search.md)
- [Cycle 3e-a exit matrix](./CYCLE_3E_A_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](./BUILD_ROADMAP.md)
- [Threat model](./THREAT_MODEL.md)
- [Canonical model](./CANONICAL_MODEL.md)
