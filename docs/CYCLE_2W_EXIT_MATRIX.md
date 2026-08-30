# Cycle 2w exit matrix

Scope: add a bounded personal-use comparison between the primary-selected
dimensionless raw coordinates represented by the exact Cycle 2v agreed record
and a repository-pinned zero-dependency Python structural HTML/iXBRL extractor.
The secondary worker receives only raw filing bytes and target QNames. It does
not receive the normalization plan, primary parser result, normalized record,
expected coordinate, expected value, or digest. Agreement is exact value
identity at ten primary-selected dimensionless coordinates per document. The
decision is recorded in
[ADR 0049](./adr/0049-bounded-personal-raw-filing-selected-fact-extraction-agreement.md).

Source status: **Pass only for exact source revision
`1f7ff096c9187386cad9ae60e1e44861e6e5f842`, the direct child of promoted
Cycle 2v documentation baseline
`ad5e3003d3670c84021dabe47c4fb3976274bb23`.**

Private comparison status: **owner-approved private raw-extraction comparison
Pass for one owner-selected corpus**. No selected-corpus characteristic,
private input, extracted fact, value, coordinate, mapping, digest, timestamp,
receipt, path, identifier, or execution mode belongs in Git or logs.

| Gate                            | Required result                                                                                                                                                               | Current status                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Cycle 2v prerequisite           | The exact declaration, manifest, plan, and parser-result snapshot first produces the pinned complete-record agreement                                                         | Pass at exact source revision |
| Owned disjoint snapshots        | Declaration, manifest, plan, parser results, and raw filing documents are bounded, intrinsically owned, and do not alias backing buffers                                      | Pass at exact source revision |
| Raw manifest scope              | Raw documents match manifest entry count, order, byte length, and SHA-256 exactly                                                                                             | Pass at exact source revision |
| Pinned secondary implementation | A canonical-LF digest-pinned zero-dependency Python structural HTML/iXBRL extractor runs as the secondary raw-value path                                                      | Pass at exact source revision |
| Restricted worker input         | Worker standard input contains only raw filing documents and exactly ten sorted target QNames                                                                                 | Pass at exact source revision |
| No primary material to worker   | No plan, parser-result document, normalized record, expected coordinate, expected value, or digest crosses the worker boundary                                                | Pass at exact source revision |
| Structural reconstruction       | The worker independently resolves bound concept QNames, direct context periods, dimension class, bounded simple units, and allowlisted transform/sign/scale decimal values    | Pass at exact source revision |
| Exact selected projection       | Each document compares ten unique primary-selected dimensionless coordinates, including both free-cash-flow operands with the operating-cash-flow coordinate reused           | Pass at exact source revision |
| Exact value agreement           | Every selected coordinate has byte-exact canonical decimal value agreement without tolerance or binary floating point                                                         | Pass at exact source revision |
| Duplicate handling              | Equivalent duplicates collapse and conflicting duplicates quarantine                                                                                                          | Pass at exact source revision |
| Additional-coordinate boundary  | Additional distinct raw coordinates for target QNames may remain outside the selected projection and are not treated as evidence of primary-selection completeness            | Pass at exact source revision |
| Dimensional exclusion boundary  | Dimensional target facts are classified and excluded before unit, transform, or value semantics; those semantics are not claimed                                              | Pass at exact source revision |
| Atomic conflict boundary        | Every input, prerequisite, scope, source, execution, output, extraction, or comparison failure returns one immutable value-free aggregate quarantine                          | Pass at exact source revision |
| No preference or repair         | A conflict exposes no diff, chooses no side, accepts no tolerance, and performs no fallback, merge, coercion, repair, retry into acceptance, or partial success               | Pass at exact source revision |
| Determinism and confidentiality | Exact replay is deterministic; success is metadata-only; quarantine returns zero facts and bindings; private material stays outside Git/logs                                  | Pass at exact source revision |
| Private operation               | Only the coarse owner-approved comparison status may become repository-visible                                                                                                | Owner-approved private Pass   |
| Owner-reviewed quality          | A frozen reference set establishes document success, fact precision/recall, unit/date tolerance, silent-failure, and quarantine thresholds with zero silent critical failures | Closed separately by Cycle 2x |
| Enterprise/shared service       | Organizational approval, tenancy, B15/V15, commercial redistribution, and production controls                                                                                 | Out of scope                  |

## Prerequisite and raw-scope boundary

One invocation snapshots the exact Cycle 2u declaration, manifest,
normalization plan, and parser-result documents plus the corresponding raw
filing documents. It recomputes the Cycle 2v TypeScript/Python agreement over
the primary scope and reconstructs the local normalized record. The normalized
record must match the Cycle 2v binding. Raw filing documents must then match
the verified manifest in exact count and order and match each entry's declared
byte length and SHA-256. A primary disagreement or raw-scope mismatch cannot
reach an agreement result.

For each admitted source document, the local comparator derives the exact
primary-selected dimensionless projection. Nine normalized facts have direct
source coordinates. The derived free-cash-flow fact contributes its operating-
cash-flow minuend and capital-expenditures subtrahend, while the minuend reuses
the existing operating-cash-flow coordinate. The result is exactly ten unique
coordinates per document. Each binds target QName, period, simple `USD` or
`shares` unit, empty dimension scope, and canonical decimal value.

## Secondary extraction and comparison boundary

The pinned Python worker receives a canonical request containing only the raw
filing documents and sorted target QNames. It does not receive the declaration,
manifest, plan, parser-result documents, normalized record, selected periods or
units, expected values, or any primary digest. The worker structurally resolves
namespace-qualified target elements, context references, direct instant or
duration periods, dimension presence, and bounded simple unit references. It
independently applies its allowlisted inline transform, sign, scale, and exact
decimal rules for selected dimensionless candidates.

The worker emits bounded canonical output. Equivalent values at the same
coordinate collapse. Conflicting values at the same coordinate fail closed.
The comparator requires exact value equality at every selected coordinate; it
does not use numeric tolerance, binary floating point, implicit conversion, or
semantic repair.

Additional distinct raw coordinates for a target QName do not by themselves
cause a mismatch and are not evidence that the primary selected the right or
complete coordinate set. Dimensional target facts are structurally classified
as nonempty and excluded before unit, transform, or value evaluation. Their
semantics remain outside the projection. A selected dimensionless fact with an
unsupported or complex context, unit, transform, or value fails closed.

## Conflict and confidentiality boundary

Invalid input, missing Cycle 2v agreement, raw manifest-scope mismatch, Python
source or execution failure, malformed or noncanonical output, selected-
coordinate absence or value conflict, and internal comparison failure each
collapse to one stable aggregate quarantine category. The result has zero
facts and extractor bindings and reveals no private value, coordinate, mapping,
identifier, digest, timestamp, side preference, or diff location.

There is no mismatch tolerance, preferred implementation, fallback acceptance,
merge, coercion, input repair, retry into acceptance, or partial success. A
successful return has status `raw_extraction_agreed_for_personal_use`, assurance
`secondary_raw_extractor_receives_no_primary_parser_result_normalized_record_or_digest`,
and claim
`bounded_repository_pinned_python_raw_ixbrl_ten_fact_projection_agreement_with_frozen_primary_parser_result_and_atomic_value_free_conflict_quarantine_for_personal_single_user_local_use`.
Its immutable metadata receipt binds the exact input set, prerequisite
normalization agreement, selected projection, agreement, and pinned worker by
SHA-256 without returning private facts or the complete records.

## Independence boundary

The independence claim is deliberately narrow: the secondary implementation
is repository-pinned Python, reads raw filing bytes, reconstructs the selected
values structurally, and receives no primary parser result, normalized record,
expected value, or digest. This removes the common parser-result document from
the secondary value path for the ten selected dimensionless coordinates.

The secondary still receives target QNames derived from the primary projection.
The shared mapping and primary selection are not adjudicated. The paths also
share the written contract, repository, operator, host, and likely failure
domain. Primary parser implementation identity, source binding, and code
lineage are unproven. Common-specification error, coordinated defects,
collusion, or malicious code can therefore make the comparison agree
incorrectly. Python executable identity, process isolation, preflight-to-launch
atomicity, and runtime attestation are outside the claim.

## Verification and promotion record

`1f7ff096c9187386cad9ae60e1e44861e6e5f842` is the frozen source transition;
`ad5e3003d3670c84021dabe47c4fb3976274bb23` is the promoted Cycle 2v
documentation baseline, not this document's self-revision. The source passed
the full local release gate, focused TypeScript and Python extraction tests,
privacy and adversarial checks, both offline boundary verifiers, and every
exact-source workflow. Workflow success is regression health for the bounded
capability, not an independently authenticated private comparison.

The private operation is represented only as
**owner-approved private raw-extraction comparison Pass for one owner-selected
corpus**. Repository wording does not reveal the selected corpus, execution
mode, inputs, facts, values, coordinates, mappings, digests, timestamps, or
receipt.

## Exact nonclaims

Cycle 2w does not prove:

1. correctness of the shared normalization-plan QName mapping or fact-selection
   specification;
2. completeness or correctness of the primary selection among additional raw
   coordinates;
3. unit, transform, or value semantics for excluded dimensional target facts;
4. primary parser implementation identity, source binding, or code-lineage
   independence;
5. general XBRL, iXBRL, HTML, taxonomy, transformation, dimension, or unit
   coverage;
6. SEC authenticity, source authority, or complete filing provenance;
7. accounting, fact, free-cash-flow, or taxonomy truth;
8. amendment discovery, global currentness, or absence of external
   corrections;
9. operator, host, key, repository, process, failure-domain, or runtime
   independence;
10. resistance to common-specification error, coordinated defects, collusion,
    or malicious code;
11. Python executable identity, process isolation, preflight-to-launch
    atomicity, or runtime attestation;
12. independently adjudicated ground truth, precision/recall, or quality
    thresholds;
13. database, API, web, queue, fetcher, or running-application composition; or
14. multi-user, shared-service, commercial, redistributed, or production
    safety.

For `personal_single_user_local`, enterprise approvals, tenant and multi-user
controls, B15/V15, and shared-service/production operations remain Out of
scope—not Pass and not current blockers. They reopen if the profile widens.

## Next blocker

At the Cycle 2w exit, the next blocker was a frozen owner-reviewed reference
set whose labels, selection rules, and thresholds were declared before
measurement. Cycle 2x closes that separate bounded quality-measurement step for
one owner-selected corpus without changing Cycle 2w's historical claim or
making this selected projection and agreement receipt ground truth by itself.
See [ADR 0050](./adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md)
and the [Cycle 2x exit matrix](./CYCLE_2X_EXIT_MATRIX.md).

## Exit rule

Cycle 2w may be promoted only for the exact frozen source capability and coarse
private comparison status above. It closes exact value agreement for ten
primary-selected dimensionless raw coordinates per document against a pinned
secondary worker whose input excludes primary parser-result and normalized
material. It does not close independent selection, primary parser identity,
general raw-parser correctness, authenticity, accounting truth, amendment
discovery, global currentness, owner-reviewed quality, application composition,
or production safety. Cycle 2x later closes only the separately specified
bounded owner-reviewed quality gate; all other Cycle 2w nonclaims remain.
