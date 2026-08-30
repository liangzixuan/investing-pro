# ADR 0050: bounded personal owner-reviewed filing quality measurement

Status: Accepted and **Pass only for exact source revision
`39ce73760afe0e5d22063b02a60efe64e83f3747`, reached from the promoted Cycle
2w documentation baseline
`716a3f6b7ad5a43c48a6a61d18b59c2cd5645018` through source revision
`c0138a3121361fc06f210e42febe6af4c6fa3e13`, validator-isolation corrective
revision `7f7163d4673360645e332d0b7d28467c15656f8a`, and the final routing-closure
revision.**

Private quality status: **owner-approved private bounded quality-measurement
Pass for one owner-selected corpus; the personal quality threshold was met**.

## Context

Cycle 2w established exact selected-value agreement between the primary path
and a repository-pinned raw extraction path without sending primary parser
results or normalized material to the secondary worker. That comparison did
not make either path ground truth and did not establish owner-reviewed quality.

The next bounded step must freeze an owner-reviewed reference and quality plan
before candidate execution, prevent reference content from crossing the commit
boundary, derive candidate observations internally through the production
normalization and raw-extraction path, and evaluate a fixed metric and threshold
contract. It must fail closed without disclosing reference facts or detailed
candidate disagreements.

The private operation is represented only by the coarse status above. No
selected-corpus characteristic, private reference or quality plan, input or
output, fact, label, value, coordinate, mapping, count, metric, threshold
component outcome, measured numerator or denominator, digest, timestamp, token,
approval, seal, receipt, path, runner material, execution mode, or execution
detail is repository evidence.

## Decision

Add `createPersonalFilingQualityMeasurementProtocol` to the disconnected,
zero-production-dependency `@research-cockpit/personal-filing-corpus` package.
One protocol instance snapshots bounded, disjoint owned bytes for the declared
quality plan, declaration, manifest, normalization plan, primary source
documents, and raw source documents. Intrinsic typed-array ownership, exact
prototype, backing-store separation, byte length, bounded shape, and immutable
result controls apply before any semantic work.

The quality plan binds the frozen owner-reviewed reference identity, the exact
manifest-ordered source scope, the fixed launch-fact selection contract, and
the source contract's predeclared metric and threshold policy. Commit receives
the reference binding only. It does not receive reference content, labels, or
expected values.

Commit executes candidate derivation internally. It verifies the personal
filing scope, runs normalization and raw-extraction agreement, and projects the
candidate observations required by the quality contract. The caller cannot
supply observations, success classifications, counts, metrics, thresholds,
weights, exclusions, or outcomes.

A successful commit freezes the candidate binding and returns an empty,
identity-bound, frozen, single-use capability. Reveal consumes the first
attempt before it validates the capability and reference. Only the same
protocol instance and exact prebound reference may evaluate. Replay,
cross-instance substitution, malformed capabilities, invalid sequencing, and
reference substitution fail closed.

## Metrics and thresholds decision

The fixed metric set is:

- document success;
- fact precision;
- fact recall;
- exact unit/date tolerance;
- silent critical failure; and
- quarantine rate.

The quality plan requires exact document success, precision, and recall; exact
canonical-unit identity; no date tolerance; no silent critical failures; and
no quarantined documents. Ratio comparisons use integer arithmetic. A zero
denominator fails closed. The caller cannot alter weights, exclusions,
thresholds, or assertion accounting.

Candidate-stage disagreement and explicit pipeline quarantine are valid
measured outcomes. They make the quality threshold not met rather than being
silently omitted, repaired, or converted into success. Protocol-invalid input
and failures that cannot produce a valid measurement remain quarantined.

## Success, not-met, and quarantine decision

A completed evaluation returns status `quality_evaluated_for_personal_use`
and a personal quality threshold outcome of `met` or `not_met`. A valid
`not_met` evaluation is terminal measurement evidence, not protocol success by
repair and not an atomic protocol quarantine.

The private operation covered by this decision completed evaluation and met
the predeclared personal quality threshold. Repository documentation records
only the coarse owner-approved private Pass sentence. It does not retain or
summarize the measurement record.

Any invalid input, carrier, prerequisite, binding, sequence, capability,
reference, or internal evaluation failure returns one immutable aggregate
quarantine with empty bindings, counts, and metrics. It reveals no private
fact, label, value, concept, coordinate, identifier, path, timestamp, or diff.
There is no tolerant acceptance, preferred side, fallback, merge, coercion,
repair, retry into acceptance, or partial success.

## Commit/reveal and assurance boundary

The protocol claim is
`bounded_owner_reviewed_frozen_reference_personal_filing_quality_measurement_with_predeclared_zero_tolerance_thresholds_and_atomic_value_free_quarantine_for_personal_single_user_local_use`.
Its assurance is
`candidate_observations_committed_before_owner_reviewed_reference_content_reveal`.

This assurance is intentionally local and in-process. It establishes ordering
inside one consuming protocol instance. It does not authenticate external
chronology, establish actual reference secrecy or blinding, prove that the
caller lacked the reference out of band, or prevent another instance or
process from observing or using the reference.

## Confidentiality decision

Commit and evaluation return immutable aggregate protocol records. Quarantine
is atomic and value-free. Public result shapes disclose no reference fact,
label, value, concept, coordinate, identifier, path, timestamp, or diff.

No private operation record or binding is a Git or CI artifact. The repository
records only **owner-approved private bounded quality-measurement Pass for one
owner-selected corpus; the personal quality threshold was met**. This wording
must not be expanded to reveal or imply a corpus characteristic or any private
measurement component.

## Applicability and exact nonclaims

This decision applies only to one owner performing local, offline,
noncommercial, nonredistributed research. Enterprise approval, tenant and
multi-user controls, B15/V15, shared-service operation, commercial
redistribution, and production are Out of scope and reopen if the profile
widens.

Cycle 2x does not establish:

1. authenticated external chronology, actual reference secrecy, blinding, or
   absence of label leakage;
2. owner identity, independent adjudication, or owner-reviewed label
   correctness;
3. digest hiding, secrecy, salting, zero knowledge, or resistance to guessing
   predictable reference content;
4. reference-set representativeness, statistical threshold adequacy, or
   generalization beyond the exact frozen scope;
5. SEC authenticity, source authority, or complete filing provenance;
6. accounting, fact, free-cash-flow, or taxonomy truth beyond the
   owner-reviewed reference;
7. general XBRL, iXBRL, HTML, taxonomy, alias, transform, dimension, unit, or
   fiscal-calendar coverage;
8. completeness beyond the exact labeled launch-fact scope, including
   additional raw coordinates or excluded dimensional semantics;
9. primary-parser identity, source binding, code lineage, or operator, host,
   process, failure-domain, or runtime independence;
10. absence of common-specification error, coordinated defects, collusion, or
    malicious code;
11. Python executable identity, process isolation, preflight-to-launch
    atomicity, or runtime attestation;
12. amendment discovery, global currentness, or absence of external
    corrections;
13. database, API, web, queue, fetcher, or running-application composition; or
14. multi-user, shared-service, commercial, redistributed, or production
    safety.

## Verification and promotion

The promoted Cycle 2w documentation baseline is
`716a3f6b7ad5a43c48a6a61d18b59c2cd5645018`. Revision
`c0138a3121361fc06f210e42febe6af4c6fa3e13` introduced the bounded Cycle 2x
quality-measurement source. Revision
`7f7163d4673360645e332d0b7d28467c15656f8a` added isolated Python validator
launching. At that correction, hosted CI run `33288897678` and normalization
run `33288897700` passed, while cross-engine run `33288897689`, payload-custody
run `33288897702`, and parser-isolation run `33288897683` rejected only the
incomplete Cycle 2x classifier/routing closure. That red workflow history is
preserved rather than treated as source or quality failure. Exact revision
`39ce73760afe0e5d22063b02a60efe64e83f3747` closes exact-source workflow
routing over that cumulative transition.

For the exact final revision, public CI run `33290262191` passed on Ubuntu job
`99200554338` and Windows job `99200554388`. Payload-custody run/job
`33290262184` / `99200554310`, normalization run/job `33290262180` /
`99200554376`, isolation run/job `33290262185` / `99200554319`, and
cross-engine run/job `33290262193` / `99200554372` also passed on their first
attempt. Cross-engine verification emitted no artifact. Standard regression
artifacts are public capability health only and are not private quality
evidence.

The source transition passed public source, boundary, privacy, adversarial,
commit/reveal, threshold, quarantine, and routing verification. No private
measurement record, reference, quality plan, approval chain, or operation
material is Git or CI evidence.

Promotion requires both the exact cumulative source chain and the coarse
owner-approved private Pass with the personal threshold met. Neither source
verification alone nor the coarse operation status alone satisfies this exit.

## Consequences and next blocker

Cycle 2x closes the declared personal-profile quality gate for the exact frozen
scope. It establishes a bounded, owner-reviewed, commit-before-reveal quality
measurement with predeclared zero-tolerance thresholds, internally derived
candidate observations, aggregate evaluation, and atomic value-free
quarantine.

It does not make the reference independently adjudicated truth, establish
general parser correctness, authenticate the filing source, prove accounting
truth, or authorize application or production use. If development continues,
the next distinct blocker is explicit local running-application composition
across any introduced database, API, web, queue, fetcher, or background
boundary. That future work must preserve this private-evidence boundary.
Enterprise and shared-service requirements remain Out of scope for the
personal profile.

## References

- [Cycle 2x exit matrix](../CYCLE_2X_EXIT_MATRIX.md)
- [Cycle 2w exit matrix](../CYCLE_2W_EXIT_MATRIX.md)
- [ADR 0049](./0049-bounded-personal-raw-filing-selected-fact-extraction-agreement.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
