# Cycle 2x exit matrix

Scope: add a bounded personal-use quality measurement over an owner-reviewed,
frozen reference whose selection rules and thresholds are committed before
candidate execution and whose content is revealed only through a consuming,
single-use capability. The operation evaluates document success, fact
precision, fact recall, exact unit/date tolerance, silent critical failure,
and quarantine rate. The decision is recorded in
[ADR 0050](./adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md).

Source status: **Pass only for exact source revision
`39ce73760afe0e5d22063b02a60efe64e83f3747`, reached from the promoted Cycle
2w documentation baseline
`716a3f6b7ad5a43c48a6a61d18b59c2cd5645018` through source revision
`c0138a3121361fc06f210e42febe6af4c6fa3e13`, validator-isolation corrective
revision `7f7163d4673360645e332d0b7d28467c15656f8a`, and the final routing-closure
revision.**

Private quality status: **owner-approved private bounded quality-measurement
Pass for one owner-selected corpus; the personal quality threshold was met**.
No selected-corpus characteristic, private reference or quality plan, input or
output, fact, label, value, coordinate, mapping, count, metric, threshold
component outcome, measured numerator or denominator, digest, timestamp, token,
approval, seal, receipt, path, runner material, execution mode, or execution
detail belongs in Git or logs.

| Gate                          | Required result                                                                                                                                                                   | Current status                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Cycle 2w prerequisite         | Candidate derivation internally requires the bounded normalization and raw-extraction agreement chain before measurement                                                          | Pass at exact source revision              |
| Owned bounded snapshots       | Plan, primary inputs, source documents, and raw documents are copied into bounded, disjoint owned byte snapshots before validation                                                | Pass at exact source revision              |
| Frozen reference binding      | The owner-reviewed reference identity, selection rule, and quality plan are bound before candidate execution without supplying reference content to commit                        | Pass at exact source revision              |
| Commit before reveal          | Candidate observations are committed before reference content can be revealed through the identity-bound consuming capability                                                     | Pass at exact source revision              |
| Consuming one-shot protocol   | The protocol, capability, and first commit/reveal attempts are consumed; replay, substitution, malformed input, and invalid sequencing fail closed                                | Pass at exact source revision              |
| Internal candidate derivation | Candidate observations are derived by the production normalization and raw-extraction path; callers cannot supply observations, counts, metrics, weights, exclusions, or outcomes | Pass at exact source revision              |
| Reference scope               | The frozen reference covers the exact manifest-ordered source scope and fixed launch-fact selection contract                                                                      | Pass at exact source revision              |
| Document success              | Every reference-scoped document must produce a successful bounded candidate outcome                                                                                               | Pass at exact source revision              |
| Fact precision and recall     | Both ratios must meet their predeclared exact minimums                                                                                                                            | Pass at exact source revision              |
| Unit/date tolerance           | Units must match the exact canonical policy and periods must match with no date tolerance                                                                                         | Pass at exact source revision              |
| Silent critical failure       | The predeclared maximum is zero                                                                                                                                                   | Pass at exact source revision              |
| Quarantine rate               | The predeclared maximum is zero                                                                                                                                                   | Pass at exact source revision              |
| Exact evaluation              | Threshold comparisons use integer ratios, reject a zero denominator, and allow no caller-selected weights, exclusions, or tolerance                                               | Pass at exact source revision              |
| Disagreement handling         | A valid disagreement or explicit candidate-stage quarantine is measured as not meeting the gate rather than repaired or silently discarded                                        | Pass at exact source revision              |
| Atomic quarantine             | Invalid input, binding, sequencing, capability, reference, or non-measurable internal failure produces one immutable aggregate value-free quarantine                              | Pass at exact source revision              |
| Confidentiality               | Public results expose no reference fact, label, value, concept, coordinate, identifier, path, timestamp, or diff                                                                  | Pass at exact source revision              |
| Private operation             | Only the coarse owner-approved quality-measurement status may become repository-visible                                                                                           | Owner-approved private Pass; threshold met |
| Application composition       | Database, API, web, queue, fetcher, and running-application composition                                                                                                           | Unproven                                   |
| Enterprise/shared service     | Organizational approval, tenancy, B15/V15, commercial redistribution, shared-service controls, and production operation                                                           | Out of scope                               |

## Protocol and commit/reveal boundary

One protocol instance snapshots the declared personal-quality plan and the
candidate inputs into bounded, intrinsically owned byte carriers with disjoint
backing storage. Commit receives only the frozen reference binding, not the
reference content, labels, or expected values. It validates the exact source
scope, binds the predeclared selection and zero-tolerance policy, executes the
normalization and raw-extraction candidate path internally, and commits the
resulting observations.

A successful commit returns an identity-bound, empty, frozen capability. The
first reveal attempt consumes that capability before validating the supplied
reference. Reveal accepts only the exact frozen reference binding established
before candidate execution. A second attempt, a capability from another
protocol, a malformed capability, a substituted reference, or an invalid
sequence cannot evaluate.

This establishes in-process commit-before-reveal ordering for one consuming
protocol instance. It does not authenticate external chronology or prove that
the caller lacked the reference content through another process or channel.

## Measurement and threshold boundary

Candidate derivation is internal. The caller cannot supply candidate
observations, success classifications, counts, metrics, thresholds, weights,
exclusions, or the final outcome. The operation measures the source contract's
fixed metric set: document success, fact precision, fact recall, exact
unit/date tolerance, silent critical failure, and quarantine rate.

The quality plan predeclares exact document success, precision, and recall;
exact canonical-unit identity; no date tolerance; no silent critical failures;
and no quarantined documents. Ratios are evaluated with integer arithmetic and
zero denominators fail closed. A valid semantic disagreement or explicit
candidate-stage quarantine remains part of evaluation and produces a
not-met outcome; it is not converted into protocol quarantine merely because
the quality gate fails.

The private operation reached `quality_evaluated_for_personal_use` and its
predeclared personal quality threshold outcome was met. Repository-visible
documentation records only the coarse Pass sentence above, not the underlying
measurement record or any component of it.

## Quarantine and confidentiality boundary

Invalid input, invalid carrier ownership, missing prerequisite agreement,
reference or plan binding failure, candidate execution failure that cannot be
validly measured, invalid capability, invalid sequencing, malformed reference,
or internal evaluation failure collapses to one frozen aggregate quarantine.
Quarantine has empty bindings, counts, and metrics and reveals no private
material. It cannot return partial facts, a preferred side, a detailed diff,
or a repaired candidate.

Commit and evaluated results are immutable aggregate protocol records, but no
private result record is repository evidence. No selected-corpus
characteristic or private operation material is retained in Git or logs. The
only repository-visible private fact is the coarse owner-approved Pass and met
threshold status stated above.

## Source and public verification record

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
artifacts are capability health only and are not private quality evidence.

The exact source passed its public source, boundary, privacy, adversarial,
commit/reveal, threshold, quarantine, and routing checks. Those checks prove
the bounded capability on public synthetic inputs. They do not authenticate or
reconstruct the private operation.

## Exact nonclaims

Cycle 2x does not prove:

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

For `personal_single_user_local`, enterprise approvals, tenant and multi-user
controls, B15/V15, and shared-service or production operation remain Out of
scope—not Pass and not current blockers. They reopen if the profile widens.

## Subsequent boundary and next blocker

The bounded personal quality gate is closed for the exact frozen scope. Cycle
2y closes disabled-by-default coarse readiness composition at exact source
revision `a3ab46aa09f1b63a86fdb8c1f98976b26ba30e3f`, from a
pre-listen one-shot admission through a guarded local API to an optional
browser chip. It does not change the Cycle 2x quality claim, expose the private
measurement record, or enable personal facts or a personal dossier.
Exact-source CI run `33334380969` passed on Ubuntu and Windows. See
[ADR 0051](./adr/0051-bounded-personal-quality-readiness-composition.md) and the
[Cycle 2y exit matrix](./CYCLE_2Y_EXIT_MATRIX.md).

Cycle 2z separately closes the atomic, owner-authorized release of the minimum
selected normalized facts from the same immutable candidate snapshot bound to
the admitted quality result. It is promoted only for exact frozen source
revision `e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`, with private evidence
limited to the permitted coarse outcome; it does not widen Cycle 2x or Cycle
2y. Cycle 3a separately closes request-time authenticated owner-browser
composition only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`. Cycle 3b authenticated personal
dossier composition has prepared public source but no fresh owner
authorization, terminal exact-source evidence, private activation, acceptance,
or promotion. Cycle 3c is promoted only for exact provider-neutral,
no-transport public source revision
`4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`, with no private activation or
provider result. Cycle 3d is promoted only for its exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at
`3edb5464a3414313a980ffd9fecce5ca5257084a`; it has no actual personal vault,
key, backup, restore, or private activation and does not widen this historical
boundary. Cycle 3e-a owner-local security-master snapshot admission and search
now has prepared public engineering source only. It is not accepted or promoted
and has no real breadth claim until a later exact owner-approved,
rights-compatible source snapshot is admitted and measured.
See
[ADR 0052](./adr/0052-bounded-personal-owner-authorized-selected-fact-release.md)
and the [Cycle 3e-a exit matrix](./CYCLE_3E_A_EXIT_MATRIX.md).

## Exit rule

Cycle 2x may be promoted only for the exact cumulative source chain and coarse
private quality status above. It closes bounded personal quality measurement
against an owner-reviewed frozen reference with predeclared zero-tolerance
thresholds, consuming commit-before-reveal sequencing, internally derived
candidate observations, aggregate evaluation, and atomic value-free
quarantine. Promotion requires both exact-source public verification and the
coarse owner-approved private Pass with the personal threshold met.

It does not close external chronology, independent adjudication, label truth,
representativeness, general parser correctness, source authenticity,
accounting truth, amendment discovery, global currentness, application
composition, shared-service safety, or production readiness.
