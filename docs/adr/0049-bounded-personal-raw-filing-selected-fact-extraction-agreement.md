# ADR 0049: bounded personal raw filing selected-fact extraction agreement

Status: Accepted and **Pass only for exact source revision
`1f7ff096c9187386cad9ae60e1e44861e6e5f842`, the direct child of promoted
Cycle 2v documentation baseline
`ad5e3003d3670c84021dabe47c4fb3976274bb23`.**

## Context

Cycle 2v established byte-exact agreement between distinct repository-pinned
TypeScript and Python implementations of the complete Cycle 2u normalization
record. Both paths deliberately consumed the same parser-result documents, so
they could agree while sharing a parser-result error. The next bounded step
must reconstruct selected values from raw filing bytes without passing the
primary parser result or normalized material to the secondary implementation.

The step must remain narrower than a claim of complete or generally correct
XBRL/iXBRL parsing. The exact private plan still defines the target QNames and
primary-selected coordinates, additional raw coordinates may exist, and
dimensional facts fall outside the current dimensionless launch projection.
The private run is represented only as **owner-approved private raw-extraction
comparison Pass for one owner-selected corpus**; private selection and operation
material remain outside Git and logs.

## Decision

Add `comparePersonalFilingRawFactExtraction` to the disconnected,
zero-production-dependency `@research-cockpit/personal-filing-corpus` package.
One exact input owns bounded disjoint byte snapshots for:

- the owner declaration;
- its manifest;
- the canonical private normalization plan;
- one parser-result source document, or the exact manifest-linked root and
  amendment parser-result documents; and
- the corresponding one or two raw filing documents.

The operation first requires the declaration, manifest, plan, and parser-result
scope to produce the exact Cycle 2v TypeScript/Python complete-record
agreement. It independently reconstructs the local Cycle 2u record and requires
that record to match the prerequisite agreement binding. It then requires the
raw document array to match the manifest entries exactly in count, order, byte
length, and SHA-256 value. A missing prerequisite or raw-scope mismatch fails
closed before raw extraction can agree.

For each admitted source document, the local operation derives exactly ten
unique primary-selected dimensionless raw coordinates. Nine normalized facts
are direct source coordinates. The derived free-cash-flow fact contributes its
minuend and subtrahend, while the minuend deliberately reuses the direct mapped
`operating_cash_flow` coordinate. Each selected coordinate binds the source
QName, period, simple `USD` or `shares` unit, empty dimension scope, and exact
expected canonical decimal value. This projection is derived from the primary
record and is not an independent fact-selection decision.

After verifying its canonical-LF source digest, the TypeScript operation
launches the repository-pinned zero-dependency Python structural HTML/iXBRL
extractor. Its standard input has exactly two fields: the raw filing documents
and the sorted ten target QNames. It receives no declaration, manifest,
normalization plan, parser-result document, normalized record, expected
coordinate, expected value, or digest.

The Python path structurally resolves bound namespace prefixes, target concept
QNames, direct contexts and periods, empty/nonempty dimension classification,
and bounded simple units. For selected dimensionless candidates, it applies its
bounded allowlist of inline transformation, sign, scale, and exact canonical
decimal rules without binary floating point. Unsupported, unbound, malformed,
ambiguous, or complex selected material fails closed. The path has no network,
database, API, web, queue, temporary-file, or running-application composition.

Equivalent facts at one exact coordinate collapse. Conflicting values at one
coordinate quarantine. Additional distinct coordinates for a target QName may
remain in the bounded canonical worker output and are outside the selected
projection. Dimensional target facts are classified and excluded before their
unit, transform, or value semantics are evaluated. Those excluded semantics
are not accepted or rejected as part of this decision.

Agreement requires exact canonical decimal value identity without tolerance at
all ten primary-selected dimensionless coordinates per document. The operation
does not require the secondary output to contain no other distinct coordinate,
infer a better primary selection, or repair a disagreement.

## Success and failure decision

Success returns a frozen metadata-only receipt with status
`raw_extraction_agreed_for_personal_use`, assurance
`secondary_raw_extractor_receives_no_primary_parser_result_normalized_record_or_digest`,
and claim
`bounded_repository_pinned_python_raw_ixbrl_ten_fact_projection_agreement_with_frozen_primary_parser_result_and_atomic_value_free_conflict_quarantine_for_personal_single_user_local_use`.
The receipt binds the exact input set, prerequisite normalization agreement,
selected projection, agreement, and pinned Python implementation by SHA-256.
It returns no extracted fact or complete private record.

Any invalid input, missing prerequisite agreement, raw payload scope mismatch,
Python source or execution failure, malformed or noncanonical secondary output,
selected-coordinate conflict, or comparison failure returns one immutable
aggregate value-free quarantine. It contains zero facts and extractor bindings
and reveals no private coordinate, value, mapping, identifier, digest,
timestamp, preferred side, or diff. There is no tolerant acceptance, fallback,
merge, coercion, repair, retry into acceptance, or partial success.

The exact private filing bytes, plan, parser-result documents, normalized
record, selected coordinates, target QNames, extracted facts and values,
bindings, digests, timestamps, execution mode, and success receipt remain
outside Git and logs. Only the coarse owner-approved private status appears in
repository documentation.

## Independence decision

The supported independence claim is narrow. A repository-pinned secondary
Python implementation reconstructs selected values from raw filing bytes and
receives no primary parser-result document, normalized record, expected value,
or digest. This closes the shared-parser-result assumption only for exact
values at the ten primary-selected dimensionless coordinates per document.

The worker still receives target QNames derived from the primary projection.
Both paths share the written contract, repository, operator, host, and likely
failure domain. The primary parser implementation identity, source binding,
and code lineage are not established here. Agreement can therefore remain
wrong because of a shared selection or mapping error, common specification
error, coordinated defect, collusion, or malicious code. Python executable
identity, process isolation, preflight-to-launch atomicity, and runtime
attestation also remain outside the claim.

## Applicability and exact nonclaims

This decision applies only to one owner performing local, offline,
noncommercial, nonredistributed research. Enterprise approval, tenant and
multi-user controls, B15/V15, shared-service operation, and production are Out
of scope and reopen if the profile widens.

Cycle 2w does not establish:

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
10. absence of common-specification error, coordinated defects, collusion, or
    malicious code;
11. Python executable identity, process isolation, preflight-to-launch
    atomicity, or runtime attestation;
12. independently adjudicated ground truth, precision/recall, or quality
    thresholds; or
13. multi-user, shared-service, database, API, web, queue, application, or
    production readiness.

## Verification and promotion

Source revision `1f7ff096c9187386cad9ae60e1e44861e6e5f842` identifies the frozen
Cycle 2w capability, and
`ad5e3003d3670c84021dabe47c4fb3976274bb23` identifies its promoted Cycle 2v
documentation parent. The exact source passed the full local release gate,
focused TypeScript and Python extraction tests, privacy and adversarial checks,
both offline boundary verifiers, and every exact-source workflow before
promotion. No private agreement record or input is a Git or CI artifact.

The private operation is recorded only as
**owner-approved private raw-extraction comparison Pass for one owner-selected
corpus**. No selected-corpus characteristic, execution mode, private input,
extracted fact, value, mapping, digest, timestamp, or receipt is repository
evidence.

## Consequences

Cycle 2w closes exact value agreement for the ten primary-selected
dimensionless raw coordinates per document against a repository-pinned
secondary worker whose input excludes primary parser-result and normalized
material. It does not close independent selection, general raw-parser
correctness, source authenticity, fact truth, or quality.

The next blocker is a frozen owner-reviewed reference set with labels and
thresholds declared before measurement. That boundary must measure document
success, fact precision and recall, unit/date tolerance, silent-failure rate,
and quarantine rate and must require zero silent critical failures. Cycle 2w
does not pre-accept that reference set, its labels, or its thresholds.

## References

- [Cycle 2w exit matrix](../CYCLE_2W_EXIT_MATRIX.md)
- [Cycle 2v exit matrix](../CYCLE_2V_EXIT_MATRIX.md)
- [ADR 0048](./0048-bounded-personal-typescript-python-normalization-record-agreement.md)
- [ADR 0047](./0047-bounded-personal-ten-fact-normalization-and-root-lineage.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
