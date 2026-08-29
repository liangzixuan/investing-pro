# ADR 0047: bounded personal ten-fact normalization and root lineage

Status: Accepted and **promoted only for exact source revision
`4df5549087660b5b5d473c478b03b17576fd4784`, the direct child of promoted
Cycle 2s documentation baseline
`39f0ce974f84e278ec9d12193b284876c928110e`.**

## Context

Cycle 2q established a canonical declaration/manifest verifier for the
`personal_single_user_local` profile. Cycle 2r bound a selected local payload
root to that manifest, and Cycle 2s added bounded custody and owner-deletion
capabilities. The complete repository-visible Cycle 2t status is
**owner-approved private operation Pass for one owner-selected corpus**. Git
and logs retain none of the selection or private operation inputs or outputs.

The next boundary needs to normalize the ten launch facts and model correction
lineage without claiming that this package parses raw XBRL/iXBRL, that supplied
facts are correct, or that one manifest proves no later amendment exists. It
must also avoid copying private plan mappings or fact material into repository
evidence.

## Decision

Extend the zero-production-dependency
`@research-cockpit/personal-filing-corpus` package with
`normalizePersonalFilingFacts`. The operation accepts one exact object with
bounded `Uint8Array` values for:

- the owner declaration;
- its manifest;
- one canonical normalization plan; and
- exactly one parser-result document, or exactly the manifest-linked root and
  amendment parser-result documents.

The operation owns all byte snapshots before parsing or hashing, invokes the
existing personal manifest verifier, and admits only canonical bounded JSON.
The private plan must bind the verified declaration and manifest, corpus
identity, parser version, taxonomy, and ten ordered mappings. Every source
document must bind that plan and exactly match its manifest entry. The package
does not construct either document from raw filing payloads. Direct source
QNames must be unique. The free-cash-flow subtrahend cannot collide with any
direct mapping; the only deliberate coordinate reuse is its minuend matching
the mapped `operating_cash_flow`.

The exact canonical keys are:

1. `assets`;
2. `cash`;
3. `debt`;
4. `diluted_shares`;
5. `free_cash_flow`;
6. `gross_profit`;
7. `net_income`;
8. `operating_cash_flow`;
9. `operating_income`; and
10. `revenue`.

Each document contains each key exactly once and in that order. The plan fixes
the direct source mapping, unit, and instant/duration contract for every key.
Dimensions are empty in this boundary. Numeric values are bounded canonical
decimals and are never converted through binary floating point or an implicit
unit conversion.

Free cash flow is the only derived key. It is accepted only under the fixed
`operating_cash_flow_minus_capital_expenditures` subtraction. The parser-result
document must carry both mapped operands with the same duration and unit as the
derived fact, and the normalizer recomputes the exact canonical decimal result.
The boundary does not claim that this formula is the only or authoritative
accounting definition.

## Lineage decision

The verified manifest may contain exactly one root 10-K or exactly one root
10-K followed by its manifest-linked 10-K/A.

One root produces ten versions, zero supersession edges, and lineage status
`root_only_no_in_corpus_amendment`. Every predecessor and successor link is
null. The open end is explicitly scoped as
`no_later_version_within_exact_frozen_manifest_only`; it makes no claim about
filings outside the frozen manifest.

A linked pair produces twenty versions and ten one-to-one supersession edges,
with lineage status `amendment_supersession_observed`. Root known windows are
half-open at the linked amendment's availability, and successor windows begin
there. An edge exists for every key even when the supplied value is unchanged,
because the later source document creates a later fact version.

Amendment-only, unlinked, reordered, partial, overcomplete, context-mismatched,
or metadata-mismatched input is rejected. The operation neither searches an
external filing index nor infers an amendment from values.

## Success and failure boundary

Success returns an immutable record with status
`normalized_for_personal_use`, `synthetic: false`, deterministic fact
identities, the exact bounded source and plan bindings, and claim
`bounded_private_ten_fact_normalization_and_manifest_linked_lineage_for_personal_single_user_local_use`.
An exact replay over the same bytes returns the same record.

Every failure is atomic and value-free. It returns status `quarantined`, one
stable aggregate code, zero fact versions, zero lineage edges, and no partial
source or fact detail. Quarantine is not repair, adjudication, parser
comparison, or a statement that either the plan or parser output is
authoritative.

The private owner operation is represented in Git only as **owner-approved
private operation Pass for one owner-selected corpus**. The private plan,
parser-result bytes, normalized values, source mappings, identifiers, hashes,
times, and result record remain outside Git and logs.

## Applicability and nonclaims

This decision applies only to one owner performing local, offline,
noncommercial, nonredistributed research. Enterprise rights/steward approvals,
tenant and multi-user controls, B15/V15, and production operations are Out of
scope—not Pass and not personal blockers. They reopen if the profile widens.

Cycle 2u does not prove raw payload identity at normalization time; raw
XBRL/iXBRL parsing or extraction correctness; SEC authenticity or complete
provenance; accounting or fact truth; taxonomy authority or general taxonomy,
dimension, unit, alias, and fiscal-calendar coverage; amendment discovery or
global currentness; free-cash-flow interpretation; independent parser or
validator agreement; conflict adjudication; owner-reviewed precision/recall or
other quality thresholds; database/API/web/queue/fetcher composition; or
shared-service and production safety.

## Verification and promotion

`4df5549087660b5b5d473c478b03b17576fd4784` identifies the frozen source
capability, and `39f0ce974f84e278ec9d12193b284876c928110e` identifies its promoted
Cycle 2s documentation parent. The exact source passed the full local release
gate, focused personal-package tests, both independent offline boundary
verifiers, and every exact-source workflow before promotion. No Cycle 2u
evidence schema or cross-engine artifact is created. The private owner
operation is not independently reviewed through a Git artifact.

## Consequences

Cycle 2u closes the bounded personal ten-fact normalization and
manifest-scoped lineage source boundary. Root-only mode does not assert that no
later external filing exists. The optional linked-pair path is available only
when the frozen manifest itself supplies the correction link. No private
corpus characteristic or selected mode is recorded here.

Cycle 2v next compares this TypeScript normalizer with a distinct
repository-pinned zero-dependency Python validator that independently
reconstructs the same exact complete record from the same owned inputs.
Disagreements must not be silently repaired. This is not independent raw
parsing or extraction; that remains the following blocker, before
owner-reviewed quality.

## References

- [Cycle 2u exit matrix](../CYCLE_2U_EXIT_MATRIX.md)
- [Cycle 2s exit matrix](../CYCLE_2S_EXIT_MATRIX.md)
- [ADR 0046](./0046-personal-local-filing-payload-custody-and-owner-deletion.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
