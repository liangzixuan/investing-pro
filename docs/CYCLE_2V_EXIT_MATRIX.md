# Cycle 2v exit matrix

Scope: add a bounded personal-use comparison between the repository-pinned
TypeScript Cycle 2u normalizer and a distinct repository-pinned,
zero-dependency Python validator. Both receive the same owned declaration,
manifest, normalization-plan, and parser-result byte snapshots. The Python
implementation independently reconstructs the exact complete Cycle 2u record;
the TypeScript comparator invokes the local normalizer and requires byte-exact
agreement with the canonical Python record. The decision is recorded in
[ADR 0048](./adr/0048-bounded-personal-typescript-python-normalization-record-agreement.md).

Source status: **Pass only for exact source revision
`76bd8a1319d6b5feb05da412ca30fe6507c5bdbb`, the direct child of promoted Cycle
2u documentation baseline
`90c20e6eeb6c387015af81f74ba4b8e7aebc444b`.**

Private comparison status: **owner-approved private TypeScript/Python validator
comparison Pass for one owner-selected corpus**. No selected-corpus
characteristic, private input, comparison output, conflict detail, path,
identifier, value, mapping, digest, timestamp, or record belongs in Git or
logs.

| Gate                         | Required result                                                                                                                                                                                        | Current status                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Cycle 2u prerequisite        | The repository-pinned TypeScript normalizer retains the exact complete Cycle 2u record contract                                                                                                        | Pass at promoted baseline     |
| One owned input snapshot     | Both implementations receive the same bounded declaration, manifest, plan, and parser-result bytes                                                                                                     | Pass at exact source revision |
| Distinct implementation      | A repository-pinned zero-dependency Python validator reconstructs the record without calling the TypeScript normalizer                                                                                 | Pass at exact source revision |
| Local TypeScript result      | The comparator calls the Cycle 2u TypeScript normalizer over the owned snapshots                                                                                                                       | Pass at exact source revision |
| Complete-record agreement    | Canonical bytes for the entire TypeScript and Python Cycle 2u records are identical, not merely digests or selected fields                                                                             | Pass at exact source revision |
| Exact record coverage        | Status, claim, schema, bindings, parser/taxonomy metadata, fact identities, fact versions, operands, lineage, scopes, and correction status all agree                                                  | Pass at exact source revision |
| Root-only shape              | The complete agreed record has 10 versions and 0 edges, with the manifest-qualified open end                                                                                                           | Pass at exact source revision |
| Optional linked-pair shape   | The complete agreed record has 20 versions and 10 key-matched edges                                                                                                                                    | Pass at exact source revision |
| Fixed free-cash-flow rule    | Both paths independently enforce exact OCF-minus-capex derivation and preserve both operands                                                                                                           | Pass at exact source revision |
| Atomic conflict boundary     | Invalid input, normalization quarantine, Python source/execution failure, invalid secondary record, or any byte difference produces one immutable value-free quarantine                                | Pass at exact source revision |
| No preference or repair      | A disagreement does not select a winner, expose a detailed diff, tolerate a mismatch, or repair either result                                                                                          | Pass at exact source revision |
| Determinism and immutability | Exact replay yields the same metadata-only success or quarantine record and nested output is frozen                                                                                                    | Pass at exact source revision |
| Private operation            | Only the coarse owner-approved comparison status may become repository-visible                                                                                                                         | Owner-approved private Pass   |
| Independent raw extraction   | A repository-pinned secondary worker reconstructs exact values from raw filing bytes for ten primary-selected dimensionless coordinates without receiving primary parser-result or normalized material | Staged as Cycle 2w            |
| Quality evidence             | Owner-reviewed fact and document quality thresholds over a frozen reference set                                                                                                                        | Next blocker after Cycle 2w   |
| Enterprise/shared service    | Organizational approval, tenancy, B15/V15, commercial redistribution, and production controls                                                                                                          | Out of scope                  |

## Comparison boundary

One invocation snapshots the exact input byte scope, runs the local TypeScript
normalizer, verifies the canonical-LF Python source digest, and sends only the
same snapshots to the separate Python validator over standard input. Python
emits only its canonical record bytes. The comparator owns the declaration,
manifest, plan, parser-result, and secondary-record snapshots before deciding
agreement. The Python path must implement the complete Cycle 2u validation,
decimal arithmetic, identity, lineage, and serialization rules itself. It may
not delegate reconstruction to the TypeScript implementation or accept the
TypeScript record or its digest as input.

Agreement means byte identity of the full canonical record. It includes every
Cycle 2u field and nested element: record status and claim; schema and source
bindings; parser and taxonomy declarations; deterministic fact and pointer
identities; values and fixed free-cash-flow operands; known windows; lineage
scope and status; `nullKnownToScope`; `ownerCorrectionStatus`; fact versions;
and supersession edges. A digest-only, field-subset, reordered, tolerant, or
semantic-projection match is not agreement.

For a root-only manifest, both paths must independently reconstruct exactly ten
versions, no edges, and the same manifest-qualified open end. For the optional
manifest-linked amendment pair, both must reconstruct exactly twenty versions
and ten one-to-one edges. Free cash flow remains only the fixed exact
operating-cash-flow-minus-capital-expenditures derivation with both operands.

## Conflict and confidentiality boundary

Every invalid input, TypeScript normalization quarantine, Python source or
execution failure, malformed or noncanonical secondary record, or record byte
difference collapses to one
immutable aggregate quarantine with no fact, lineage, value, mapping,
identifier, digest, timestamp, side preference, or diff location. The
comparator does not retry into acceptance, apply tolerance, repair input, or
adjudicate which implementation is correct.

A successful return has status `agreed_for_personal_use`, assurance
`distinct_repository_pinned_implementations_over_one_shared_parser_result_scope`,
and claim
`bounded_repository_pinned_typescript_python_validator_exact_record_agreement_and_atomic_value_free_conflict_quarantine_for_personal_single_user_local_use`.
Its bounded metadata-only receipt binds the input set, normalized record,
agreement, and both pinned implementations by SHA-256. It does not return or
log the complete private record. The private record and all input material
remain outside repository evidence.

## Independence boundary

The supported independence claim is narrow: the implementations are pinned in
the repository, use different languages and runtimes, and the zero-dependency
Python validator reconstructs the record independently of the TypeScript
normalizer. They deliberately share the same declaration, manifest, plan,
parser-result bytes, and written record specification.

This is not independent parsing or extraction. A parser-result error, shared
input substitution, specification error, coordinated implementation error, or
collusion can therefore make both paths agree incorrectly. The same operator,
host, repository, keys, and failure domain are also outside the independence
claim, and there is no runtime attestation.

## Verification and promotion record

`76bd8a1319d6b5feb05da412ca30fe6507c5bdbb` is the frozen source transition;
`90c20e6eeb6c387015af81f74ba4b8e7aebc444b` is the promoted Cycle 2u
documentation baseline, not this document's self-revision. The source passed
the full local release gate, focused TypeScript and Python comparison tests,
privacy checks, both offline boundary verifiers, and every exact-source
workflow. Workflow success is regression health for the bounded capability,
not an independently authenticated private comparison.

The private operation is represented only as **owner-approved private
TypeScript/Python validator comparison Pass for one owner-selected corpus**.
Repository wording does not reveal the selection, execution mode, inputs,
outputs, or record characteristics.

## Exact nonclaims

Cycle 2v does not prove:

1. independent raw XBRL/iXBRL parsing or extraction;
2. correctness of the shared declaration, manifest, plan, parser-result bytes,
   or written normalization specification;
3. SEC authenticity, source authority, or complete filing provenance;
4. accounting correctness, fact truth, or authoritative free-cash-flow
   interpretation;
5. taxonomy authority, general taxonomy coverage, or arbitrary dimensions,
   units, aliases, and fiscal calendars;
6. amendment or correction discovery, global currentness, or absence of a
   later filing;
7. independence of operator, host, repository, key material, or failure
   domain;
8. resistance to common-input error, common-specification error, coordinated
   defects, or collusion;
9. runtime, interpreter, process, or host attestation;
10. owner-reviewed ground truth, precision/recall, quality thresholds, or
    representative coverage;
11. database, API, web, queue, fetcher, or running-application composition; or
12. multi-user, shared-service, commercial, redistributed, or production
    safety.

For `personal_single_user_local`, enterprise approvals, tenant and multi-user
controls, B15/V15, and shared-service/production operations remain Out of
scope—not Pass and not current blockers. They reopen if the profile widens.

## Next blocker

Cycle 2w next requires the exact Cycle 2v agreement, rebinds the corresponding
raw documents to the manifest, and launches a repository-pinned secondary
Python extractor with only raw filing bytes and target QNames. It compares
exact values at the ten primary-selected dimensionless raw coordinates per
document. This removes the shared parser-result document from the secondary
selected-value path, but it does not independently establish the shared QName
mapping, the primary selection, completeness among additional coordinates, or
general raw-parser correctness. After Cycle 2w, a frozen owner-reviewed
reference set must establish bounded fact and document quality. Cycle 2v does
not allow record-level agreement to stand in for either boundary.

## Exit rule

Cycle 2v may be promoted only for the exact frozen source capability and the
coarse private comparison status described above. It closes byte-exact
agreement between two repository-pinned Cycle 2u record reconstruction
implementations. It does not close independent parsing/extraction, shared
input/specification correctness, authenticity, accounting truth, amendment
discovery, global currentness, quality, application composition, or production
safety.
