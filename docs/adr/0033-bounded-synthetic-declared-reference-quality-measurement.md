# ADR 0033: bounded synthetic declared-reference quality measurement

Status: prior bounded source-stage security conclusion for exact source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39` Superseded. Historical local and
Ubuntu/Windows jobs were green, but hostile typed-array carriers falsified the
bounded owned-snapshot check on those bytes. The Cycle 2g local/two-OS gate
restored hardened Cycle 2f at exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`, but that restoration is now also
Superseded: backing prototype equality did not intrinsically brand an
`ArrayBuffer`, so a re-prototyped `SharedArrayBuffer` remained admissible, and
carrier prototype equality did not prove the intrinsic `Uint8Array` element
type, so re-prototyped alternate typed arrays remained admissible. The Cycle 2h
bounded owned-byte conclusion and its source-commit, local, two-OS CI, parser,
and custody gates Pass only for exact hardened source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`. The historical `72e91f5` and
`df1ddff` conclusions remain Superseded; Cycle 2b, full Cycle 2 quality, and
production admission remain Blocked.

## Context

Cycle 2e proves only byte-exact agreement between two distinctly declared
same-process synthetic validator roles. It does not prove actual parser or
validator independence, independently adjudicated reference labels, real
filing correctness, or measured quality. Cycle 2b Phase B also remains blocked
on the exact external 100-entry inventory, approvals, chronology, and human
authority-registry review.

Those external blockers prohibit a real-data quality claim. They do not prevent
a smaller repository-controlled contract: deterministically accounting for one
fixed synthetic population, deriving every metric from closed candidate and
declared-reference documents, and applying one fixed synthetic-pilot threshold
policy without floating-point tolerance or caller-supplied arithmetic.

## Decision

Add the private, zero-dependency `packages/filing-quality-measurement` package.
The caller supplies exactly three bounded canonical UTF-8 JSON byte documents
in fixed plan, candidate, and declared-reference roles. The boundary immediately
takes fresh owned snapshots before parsing. Each document is label-separated,
closed-schema, synthetic-only, chronologically declared, and hash-bound to its
fixed role. Duplicate JSON keys, non-canonical bytes, unexpected fields,
oversized input, broken chronology, wrong hashes, or declaration mismatches
fail closed.

The declared reference contains exactly 100 unique documents. Each document
contains the exact ten launch fact coordinates, for 1,000 fact targets total.
The evaluator derives exactly two critical assertions per target:
`semantic_value_presence` and `exact_unit_period`. All 2,000 assertions must be
accounted; they need not all pass for the input to be valid. Coordinates are
sorted and unique and are recomputed from their closed fields. Duplicate,
omitted, excluded, or reweighted targets are invalid.

The candidate contains zero through 100 unique document rows. Its only explicit
row statuses are `succeeded` and `quarantined`. A succeeded row may carry zero
through ten sorted unique known-coordinate facts; fewer than ten remains valid
measured incomplete, with one false negative and two silent assertion failures
per omission and no caller partial flag. An explicit-quarantine row must be
fact-empty and carry one closed coarse code. A missing candidate document is
derived from absence, not a caller label. Succeeded/reference disagreement,
missing succeeded facts, and missing documents are silent failures; explicit
quarantine is not silent. Explicit quarantine nevertheless reduces document
success and fact recall and increases quarantine rate. Each `documentSha256`
is a domain-separated synthetic coordinate binding, not a real payload or
content digest. The evaluator, never the caller, derives classification,
counts, denominators, assertion outcomes, and metrics.

Exact fact equality is a true positive. A wrong prediction contributes one
false positive and one false negative. Missing expected facts contribute false
negatives. Precision is `TP/(TP+FP)` and recall is `TP/(TP+FN)`; an undefined
zero denominator fails closed. Thresholds are evaluated by integer
cross-multiplication only. There is no float, `NaN`, rounding, epsilon,
tolerance widening, weighting, exclusion, repair, or caller-supplied metric.

The fixed synthetic-pilot policy is:

- document success at least `95/100`;
- fact precision at least `99/100`;
- fact recall at least `99/100`;
- quarantine rate at most `5/100`;
- maximum silent critical failures `0`;
- exact canonical unit policy `exact_canonical_unit.v1`; and
- date tolerance `0` days.

Valid inputs always return an immutable aggregate-only `status: "evaluated"`
receipt. The receipt binds input and evaluation hashes, exact counts and
metrics, failed thresholds, and a synthetic-pilot threshold outcome of `met` or
`not_met`. Falling below a threshold is a valid `not_met` evaluation, not input
quarantine. The receipt contains no filing accessions, coordinates, concepts,
dimensions, units, periods, decimals, values, candidate facts, or reference
facts.

Malformed input returns only `status: "quarantined"`, one coarse closed code,
zero audit counts, and an empty metric array. It exposes no input hash,
declaration, mismatch position, count, coordinate, fact value, threshold
detail, or canary.

The canonical met fixture has 99 succeeded documents with ten exact facts each
and one explicit-quarantine document. It accounts for 1,000 expected fact
targets and all 2,000 critical assertions, records 990 true positives, ten false
negatives, zero false positives, and 1,980 passed assertions, and meets the
fixed synthetic-pilot policy. The remaining 20 assertions are accounted but
not passed. This is fixture arithmetic only, not independently adjudicated
quality, real-parser quality, or production threshold approval.

### Superseded owned-snapshot conclusion

The historical source intended to take bounded owned byte snapshots, but read
shadowable instance `buffer` and `byteLength` properties and copied through
typed-array `slice`. A hostile plain `Uint8Array` could therefore disguise
`SharedArrayBuffer` backing or an oversized carrier and could dispatch caller
`constructor` / `Symbol.species` code during snapshot allocation. Exact check
2, `owned_bounded_utf8_canonical_json_snapshots_and_duplicate_key_rejection`,
was false for those bytes, so the sole bounded security conclusion is
Superseded despite its green local and CI jobs.

The `df1ddff` restoration reads backing-buffer and byte-length metadata through
intrinsic typed-array getters, requires the backing prototype to equal
`ArrayBuffer.prototype`,
allocates an ordinary `Uint8Array` directly, and copies through the intrinsic
typed-array `set`. Its hostile-carrier security regressions and all prior checks
passed as part of the exact Cycle 2g frozen-byte local and two-OS CI gates. The
exact local gate and Cycle 2g Ubuntu/Windows CI passed at exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`, historically restoring the
hardened bounded claim for those bytes. That restoration is now Superseded:
prototype equality alone accepts a `SharedArrayBuffer` whose prototype was
changed to `ArrayBuffer.prototype` and an alternate typed array whose prototype
was changed to `Uint8Array.prototype`. Cycle 2h adds intrinsic `Uint8Array`
element-type and `ArrayBuffer` brand checks with safe prototype ordering across
all three Cycle 2f roles.

## Evidence and status boundary

Cycle 2f is a deterministic TypeScript source/test contract with no new live or
platform trust boundary. Its gate is the frozen-byte local release suite and
existing Ubuntu/Windows CI matrix. On the historical frozen bytes,
`corepack pnpm verify` completed all format, lint, guardrail, typecheck, test,
and build stages with 45 test files, 951 passed plus 2 skipped (953 total), all
12 workspace project checks, and 11 builds. CI run
`32681826143` passed in Ubuntu job `97299715600` and Windows job `97299715638`
on exact source commit `72e91f502b31f15deeaad761b82d9ed7b6377d39`. Parser
run/job `32681826015` / `97299715074`, custody run/job `32681826030` /
`97299715006`, and PostgreSQL run/job `32681826040` / `97299715107` are
unchanged regression health only, not Cycle 2f evidence. It creates no
dedicated workflow, evidence schema, evidence artifact, retained log package,
offline evidence review, or evidence note. These are historical green gate
facts only: the missing hostile-carrier coverage means they do not establish
the bounded source-stage security claim. The `df1ddff` hardened bytes passed
the exact final pre-promotion local restoration gate. Formatting, full ESLint, all
guardrails, the production-license check across 86 versions, every scripted
typecheck/test/build across 12 of 13 workspace projects, 47 test files with 987
passed plus two skipped (989 total), and the boundary verifier were green.
CI run `32690685837` passed in Ubuntu job `97323672725` and Windows job
`97323672813` on exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`, completing the historical Cycle 2f
restoration gate. It does not attest current Cycle 2h bytes or revive the now-
Superseded restoration conclusion. Parser run/job `32690685841` / `97323672800`, custody run/job
`32690685846` / `97323672628`, and PostgreSQL run/job `32690685829` /
`97323672631` passed as unchanged regression health only; they are not Cycle 2f
restoration or Cycle 2g evidence.

The canonical Cycle 2a and Cycle 2c evidence checks, nonclaims, schemas, source
sets, artifacts, and notes remain byte-exact. Their offline verifiers may accept
Cycle 2f only as one exact 28-path atomic successor transition from baseline
`baa79baa466cf1c869f63a279f90a6dde61c97ac`; no Cycle 2f result enters either
historical record.

## Exact target claim and checks

The sole bounded target claim is
`bounded_synthetic_fixed_population_declared_reference_quality_metric_accounting_and_fail_closed_threshold_evaluation`.

The exact ordered checks are:

1. `exact_fixed_role_synthetic_plan_candidate_and_declared_reference_documents`
2. `owned_bounded_utf8_canonical_json_snapshots_and_duplicate_key_rejection`
3. `fixed_095_099_099_005_zero_silent_exact_unit_zero_date_policy_binding`
4. `closed_label_separated_plan_candidate_and_reference_schemas`
5. `declared_plan_candidate_reference_chronology_and_exact_hash_role_binding`
6. `exact_100_unique_documents_ten_fixed_keys_and_2000_derived_critical_assertions`
7. `sorted_unique_coordinate_recomputation_and_no_duplicate_omission_exclusion_or_reweighting`
8. `strict_canonical_decimal_concept_dimension_unit_and_gregorian_period_validation`
9. `succeeded_partial_fact_or_quarantined_empty_candidate_state_coherence`
10. `evaluator_derived_counts_denominators_classification_and_no_caller_supplied_metrics`
11. `exact_fact_true_positive_wrong_prediction_false_positive_plus_false_negative_and_zero_denominator_fail_closed`
12. `integer_cross_multiplication_without_float_nan_rounding_epsilon_or_tolerance_widening`
13. `fixed_document_success_precision_recall_unit_date_silent_failure_and_quarantine_semantics`
14. `valid_below_threshold_evaluation_recorded_as_not_met_not_input_quarantine`
15. `immutable_aggregate_only_evaluated_receipt_or_empty_value_free_quarantine_and_canary_absence`
16. `domain_separated_determinism_mutation_safety_no_io_composition_or_historical_evidence_mutation`

## Exact nonclaims

The exact ordered nonclaims are:

1. `actual_independent_adjudicator_identity_process_host_operator_key_or_failure_domain`
2. `actual_blinding_label_leakage_absence_prediction_precommitment_or_chronology_authenticity`
3. `declared_reference_accounting_correctness_or_human_resolution_quality`
4. `candidate_report_parser_execution_identity_digest_authenticity_or_cycle2e_output`
5. `cycle2b_external_inventory_rights_steward_key_authority_or_human_review`
6. `real_filing_payload_digest_sec_source_authenticity_or_custody`
7. `representative_100_real_filings_or_independently_adjudicated_2000_real_assertions`
8. `real_parser_quality_precision_recall_document_success_quarantine_or_zero_silent_failures`
9. `threshold_statistical_adequacy_confidence_calibration_or_production_acceptance`
10. `strategic_quarantine_reason_authenticity_or_malicious_failure_masking_detection`
11. `cycle2d_normalizer_lineage_correctness_or_cycle2e_independent_validator_composition`
12. `adaptive_metric_oracle_privacy_differential_privacy_or_real_label_confidentiality`
13. `general_xbrl_ixbrl_taxonomy_concept_unit_dimension_fiscal_or_amendment_correctness`
14. `network_fetch_custody_retention_kms_backup_deletion_or_cryptographic_erasure`
15. `database_api_web_queue_persistence_evidence_passport_b15_v15_or_slo`
16. `production_identity_secrets_real_data_full_cycle2_exit_or_production_use`

## Consequences

Cycle 2f can close only exact fixed-population synthetic accounting, metric
derivation, and fail-closed evaluation against the fixed synthetic-pilot
policy. It cannot authenticate the declarations, establish independent
adjudication or blinding, validate a real filing or parser, prove threshold
adequacy, unblock Cycle 2b, satisfy the real 2,000-assertion quality gate,
compose B15/V15, or authorize production use.

Cycle 2g is a separate successor-only in-process precommitment contract. It can
bind one owned candidate-observation snapshot before the same instance accepts
declared-reference bytes and delegate the digest-matched result back to Cycle
2f. It adds no historical Cycle 2f result and keeps this ADR's exact claim,
checks, nonclaims, and no-evidence status frozen. The atomic successor transition
does change the current Cycle 2f implementation and security-test bytes so
owned snapshots use intrinsic typed-array buffer/length metadata and avoid
caller `constructor` / `Symbol.species` allocation dispatch. This ADR's CI
anchors remain historical green gate facts for source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39` only and do not attest the current
hardened bytes. The replacement Cycle 2g frozen-byte local and two-OS CI gates
passed for exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708` as historical green facts. That
Cycle 2f restoration and the Cycle 2g conclusion are now Superseded. Cycle 2g cannot prove that the caller
lacked the reference through another channel, that the digest hides predictable
labels, or that Cycle 2f cannot be called directly.

Cycle 2h hardens the Cycle 2f plan, candidate, and declared-reference roles
with intrinsic `Uint8Array` element-type and `ArrayBuffer` brand validation,
exact prototypes, safe check ordering, preallocation actual-length limits,
ordinary allocation, and intrinsic copying.
It preserves this ADR's non-carrier schema, exact checks, exact nonclaims,
metric arithmetic, failure/result semantics, historical anchors, and
no-dedicated-evidence status. Cycle 2h is the exact 40-path transition (38
modified and two added) from
`14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98`; the additional path is the
existing historical local custody fixture manifest, not a new/dedicated/live
evidence artifact. Its two changed custody source/test SHA-256 entries refresh,
while fixture cases, schema, order, and payload identity/content remain
unchanged. At exact successor source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`, the Cycle 2h source-commit,
frozen-byte local, Ubuntu/Windows CI, parser live-acceptance, and custody
live-acceptance gates are Pass, restoring Cycle 2f's bounded owned-byte
conclusion only for those exact hardened bytes. The historical `72e91f5` and
`df1ddff` conclusions remain Superseded. The exact remote anchors are recorded
in the [Cycle 2h exit matrix](../CYCLE_2H_EXIT_MATRIX.md); parser and custody
remain regression and historical-boundary anchors, not a new Cycle 2h evidence
domain.

## References

- [Cycle 2f exit matrix](../CYCLE_2F_EXIT_MATRIX.md)
- [Cycle 2g exit matrix](../CYCLE_2G_EXIT_MATRIX.md)
- [Cycle 2h exit matrix](../CYCLE_2H_EXIT_MATRIX.md)
- [ADR 0035](./0035-cross-boundary-intrinsic-byte-snapshot-hardening.md)
- [Cycle 2e exit matrix](../CYCLE_2E_EXIT_MATRIX.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
- [ADR 0032](./0032-bounded-synthetic-two-declared-validator-fact-comparison.md)
- [ADR 0029](./0029-fixed-public-filing-candidate-manifest-admission.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
- [License policy](../../LICENSE_POLICY.md)
