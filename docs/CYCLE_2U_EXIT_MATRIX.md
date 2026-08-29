# Cycle 2u exit matrix

Scope: add a bounded personal-use normalization boundary for the exact ten
launch facts in one manifest-bound 10-K root or one manifest-linked 10-K and
10-K/A pair. The boundary consumes canonical normalization-plan and
parser-result bytes supplied by the owner; it neither parses raw filing bytes
nor establishes that the supplied facts are true. The decision is recorded in
[ADR 0047](./adr/0047-bounded-personal-ten-fact-normalization-and-root-lineage.md).

Source status: **Pass only for exact source revision
`4df5549087660b5b5d473c478b03b17576fd4784`, the direct child of promoted
Cycle 2s documentation baseline
`39f0ce974f84e278ec9d12193b284876c928110e`.**

Cycle 2t is recorded only as **owner-approved private operation Pass for one
owner-selected corpus**. The selection and every private operation input and
output remain outside Git and logs. This coarse status is not independent
review and proves neither SEC authenticity nor fact truth.

| Gate                                | Required result                                                                                                                                                    | Current status                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Cycle 2t prerequisite               | No selection or private operation input/output is repository-visible                                                                                               | Owner-approved private operation Pass for one owner-selected corpus |
| Owned input snapshots               | Declaration, manifest, normalization plan, and one or two parser-result documents are boundedly copied before validation                                           | Pass                                                                |
| Existing corpus verification        | Cycle 2q declaration/manifest verification succeeds over the owned snapshots                                                                                       | Pass                                                                |
| Canonical private plan              | Exact canonical plan binds the verified corpus, parser version, taxonomy, ten ordered mappings, unique direct source QNames, and the one allowed OCF-minuend reuse | Pass                                                                |
| Closed source set                   | Input is exactly one manifest root 10-K or exactly that root plus its manifest-linked 10-K/A                                                                       | Pass                                                                |
| Manifest binding                    | Every parser-result document exactly matches its manifest entry and the verified plan metadata                                                                     | Pass                                                                |
| Exact fact contract                 | Every document contains each of the ten fixed keys exactly once, in order, with the fixed unit/period contract and empty dimensions                                | Pass                                                                |
| Decimal boundary                    | Canonical bounded decimals are validated without binary floating-point conversion or implicit unit conversion                                                      | Pass                                                                |
| Free-cash-flow derivation           | Free cash flow is accepted only as the fixed operating-cash-flow-minus-capital-expenditures subtraction with both bound operands and exact decimal recomputation   | Pass                                                                |
| Root-only lineage                   | One 10-K yields 10 versions, zero edges, null predecessor/successor links, and an open end qualified to the exact frozen manifest                                  | Pass                                                                |
| Amendment lineage                   | A manifest-linked 10-K/A pair yields 20 versions and exactly 10 one-to-one supersession edges with half-open known windows                                         | Pass                                                                |
| Determinism and immutability        | Exact replay produces the same record; success and all nested result graphs are immutable                                                                          | Pass                                                                |
| Atomic confidentiality              | Any input failure returns one immutable value-free quarantine with zero fact versions and zero lineage edges                                                       | Pass                                                                |
| Owner operation                     | No private run data or selected-corpus characteristic is repository-visible                                                                                        | Owner-approved private operation Pass for one owner-selected corpus |
| Raw parsing and authenticity        | Raw XBRL/iXBRL parsing, extraction, taxonomy authority, SEC authenticity, and complete provenance                                                                  | Unproven                                                            |
| Fact and accounting truth           | Accounting correctness, fact truth, free-cash-flow interpretation, amendment discovery, and global currentness                                                     | Unproven                                                            |
| Independent comparison              | Distinct repository-pinned TypeScript/Python reconstruction of the same complete Cycle 2u record with byte-exact agreement and conflict quarantine                 | Staged as Cycle 2v                                                  |
| Independent raw parsing             | A separate parser/extraction path reconstructs facts from raw filing bytes                                                                                         | Next blocker after Cycle 2v                                         |
| Quality evidence                    | Owner-reviewed reference set, precision/recall, tolerance, and silent-failure thresholds                                                                           | Pending after independent raw parsing                               |
| Running composition                 | Database, API, web, queue, fetcher, and production application integration                                                                                         | Unproven                                                            |
| Enterprise and shared-service gates | Organizational approval, tenant/multi-user controls, B15/V15, and production operations                                                                            | Out of scope                                                        |

## Bounded normalization conclusion

`normalizePersonalFilingFacts` accepts exactly one closed input object holding
the declaration, manifest, normalization plan, and one or two parser-result
byte documents. It first owns bounded snapshots, reuses the existing personal
manifest verifier, and then requires canonical JSON and exact binding between
the corpus, plan, manifest entries, and source documents.

The exact ten keys are `assets`, `cash`, `debt`, `diluted_shares`,
`free_cash_flow`, `gross_profit`, `net_income`, `operating_cash_flow`,
`operating_income`, and `revenue`. Each appears once per source document in
that order. Direct facts must match the plan's unit, period kind, and source
mapping with empty dimensions, and their source QNames must be unique. The
free-cash-flow subtrahend cannot collide with a direct mapping; its minuend
matching the mapped `operating_cash_flow` is the only deliberate coordinate
reuse. Free cash flow is never accepted as an unexplained direct value: it
must carry the fixed subtraction derivation, both operands, the same duration
context and unit, and a canonical decimal result that the boundary recomputes
without binary floating point.

Success has status `normalized_for_personal_use`, `synthetic: false`, and exact
claim
`bounded_private_ten_fact_normalization_and_manifest_linked_lineage_for_personal_single_user_local_use`.
It binds the verified corpus, private plan, source documents, parser and
taxonomy declarations, source metadata, normalized fact versions, and
lineage. Private input bytes and the owner operation record are not committed.

## Lineage boundary

The one-document mode is `root_only_no_in_corpus_amendment`. It creates ten
root fact versions and no edges. Every predecessor and successor is null. A
null known-window end means only that the exact frozen manifest contains no
later version; the result explicitly reports
`no_later_version_within_exact_frozen_manifest_only`. It does not assert that
no amendment, restatement, or correction exists elsewhere.

The two-document mode is `amendment_supersession_observed`. It is available
only when the manifest itself contains one 10-K/A linked to the root 10-K.
That pair produces twenty versions and exactly ten key-matched edges. Each
root version's known window ends when the linked amendment becomes available,
and each successor opens then. Unchanged values still remain distinct source
versions because lineage follows the manifest-linked document event, not a
value-difference heuristic.

An amendment-only input, an unlinked pair, a reordered or partial fact set, a
context mismatch, or an extra source document is quarantined atomically. The
boundary does not search for amendments and cannot establish global
currentness.

## Quarantine and confidentiality boundary

Any invalid input returns only the fixed claim, schema, `synthetic: false`, a
stable aggregate code, an audit showing zero facts and zero lineage, and empty
fact/lineage arrays. No partial normalized result, source value, mapping,
document metadata, identifier, digest, or timestamp crosses that failure
boundary. Quarantine is a deterministic rejection, not an automatic repair or
adjudication path.

## Verification and routing record

The source transition is frozen at
`4df5549087660b5b5d473c478b03b17576fd4784`; its promoted Cycle 2s
documentation parent is `39f0ce974f84e278ec9d12193b284876c928110e`,
not this document's self-revision. The exact source passed the full local
release gate, the focused personal package suite, both independent offline
boundary verifiers, and every exact-source workflow before promotion. The
source route creates no Cycle 2u evidence schema or cross-engine artifact;
workflow success is regression health for the bounded capability.

The private owner operation is not a CI artifact. Its repository-visible
representation is deliberately limited to the coarse owner-approved status
above. That status must not be used to reconstruct, disclose, or imply review
of private inputs or outputs.

## Exact nonclaims

Cycle 2u does not prove:

1. raw filing payload presence or identity during normalization;
2. raw XBRL/iXBRL parser, extraction, or taxonomy-mapping correctness;
3. SEC authenticity, complete filing provenance, or source authority;
4. accounting correctness, fact truth, or the economic interpretation of
   free cash flow;
5. taxonomy authority, general taxonomy coverage, aliases, dimensions, unit
   conversion, or arbitrary fiscal calendars;
6. discovery of amendments or corrections outside the exact frozen manifest;
7. global currentness or absence of a later filing;
8. independent parser/validator agreement, conflict adjudication, or silent
   repair prevention beyond this atomic boundary;
9. independently adjudicated ground truth, precision/recall, quality
   thresholds, or representative-corpus coverage;
10. database, API, web, queue, fetcher, or running-application composition;
11. multi-user, shared-service, commercial, redistributed, or production
    safety; or
12. enterprise rights/steward approval, B15, or V15.

For `personal_single_user_local`, enterprise approvals, tenant and multi-user
controls, B15/V15, and production operations remain Out of scope—not Pass and
not current blockers. They reopen if the profile widens. External law and
source terms remain outside this internal engineering classification.

## Next blocker

Cycle 2v compares the local TypeScript normalizer with a distinct
repository-pinned zero-dependency Python validator. Both consume the same
owned declaration, manifest, plan, and parser-result bytes, and agreement
requires byte identity of the exact complete record. This detects distinct
normalization-implementation disagreement but is not independent raw parsing
or extraction. That raw parser/extraction boundary remains next, followed by
owner-reviewed quality.

## Exit rule

Cycle 2u is Pass only for the exact frozen source capability, the bounded
one-document and optional linked-pair contracts, and the coarse owner-approved
private-operation status described above. It does not promote raw parsing,
authenticity, accounting truth, amendment discovery, global currentness,
independent comparison, quality, application composition, or production
safety.
