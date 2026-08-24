# ADR 0029: Fixed public-filing candidate-manifest admission

Status: Phase-A verifier protocol and local/CI verification pass; Cycle 2b
blocked on external metadata, approvals, and key-authority review

## Context

Cycle 2a proved only a disconnected synthetic parser-isolation envelope. The
next named roadmap dependency is the wider Cycle 2 filing-ingestion proof,
whose first unmet input is a fixed, counsel-approved public-filing corpus. The
full Cycle 2 exit additionally requires independently adjudicated ground truth,
at least 2,000 critical assertions, frozen quality thresholds, and zero silent
critical failures.

Engineering cannot manufacture the external corpus metadata, a legal or rights
decision, a data-steward decision, or trust in the signing keys. Phase A
therefore implements only a closed, side-effect-free admission verifier. It
contains no real filing configuration, approval, workflow, evidence artifact,
raw filing, parser execution, external fetch, or application composition.

## Decision

Add `verifyFilingCorpusAdmission` in
`packages/filing-parser/src/corpus-admission.ts`. The verifier accepts exact
bytes named `authorityKeys`, `candidateManifest`, `selectionPlan`,
`adjudicationProtocol`, `rightsApproval`, `stewardApproval`, and `manifest`,
plus `evaluatedAt`. Every document byte string is syntactically untrusted. The
authority/revocation registry becomes a trust anchor only after separate
human review, and `evaluatedAt` is a trusted out-of-band current-time input in
the verifier's trusted computing base; it is never supplied by an approval or
candidate manifest. Phase A does not prove clock authenticity or freshness. The
verifier performs no file, network, parser, database, API, web, queue, or
key-service I/O.

The future, externally reviewed configuration is reserved at these exact paths:

- `config/filing-corpus/v1/authority-keys.json`;
- `config/filing-corpus/v1/selection-plan.json`;
- `config/filing-corpus/v1/adjudication-protocol.json`;
- `config/filing-corpus/v1/candidate-manifest.json`;
- `config/filing-corpus/v1/rights-approval.json`;
- `config/filing-corpus/v1/steward-approval.json`; and
- `config/filing-corpus/v1/manifest.json`.

None of those files exists in Phase A. Adding them requires a separate review
and authorization.

The closed protocol requires a content-addressed inventory of exactly 100
unique filing accessions. Each entry carries only the reviewed identity and
selection metadata required by the contract, including content digest, CIK,
form, accepted/available timing, taxonomy, and amendment status. The selection
plan and adjudication protocol must be frozen before parser or adjudication
results exist. Their strata, counts, and exclusion accounting must reconcile
exactly; duplicate accessions, duplicate content weighting, unknown keys,
noncanonical bytes, and mutations fail the whole admission.

“Frozen before results” is deliberately narrow in code: the verifier proves
only signed timestamp and hash consistency among the supplied documents. It
cannot observe prior executions. The assertion that no parser or adjudication
result existed before the freeze is externally attested chronology.

Two distinct Ed25519 keys have the exact roles `rights_authority` and
`data_steward`. Their approvals bind the exact candidate manifest, selection
plan, adjudication protocol, purpose
`offline_parser_quality_evaluation_only`, and retention class. Wrong keys,
roles, algorithms, scopes, expiry, the exact supplied revocation snapshot, and
signature changes fail closed. Each signed approval payload includes the exact
`authorityKeysSha256` of that supplied validity/revocation registry. The
verifier can compare only the supplied, syntactically untrusted registry and
trusted `evaluatedAt`. Human/host review must compare the exact registry digest
to the reviewed out-of-band anchor. Clock authenticity, authority/counsel/
steward identity, legal validity, and revocation freshness remain external
requirements.

Success returns one closed aggregate record containing schema, claim, corpus,
version, `evaluatedAt`, and `status: "admitted"` identifiers plus exact input
hashes, the admitted count, and `validUntil`. Failure is atomic and value-free.
Neither result emits accessions, approval bodies, raw filing content, fact
values, or rejected metadata. The protocol exposes no update operation: a later
corpus must be a separately versioned, separately approved input.

`status: "admitted"` therefore proves only internal schema and cryptographic
consistency under the caller-supplied registry. It is never itself an authority,
counsel, or data-steward identity decision and cannot replace the required
human/host comparison.

The target claim is
`fixed_rights_and_steward_approved_content_addressed_100_filing_corpus_admission`.
Phase A does not establish that claim. It implements and locally verifies only
the verifier protocol.

## Evidence and status boundary

The exact frozen-byte local `pnpm verify` gate passes format, lint, every
guardrail including 86 production-license checks, all project typechecks, all
builds, and 34 test files with 810 tests: DB 18/582, API 4/49, research-state
1/48, contracts 1/5, research-core 2/62, web 2/3, and filing-parser 6/61.
[CI run 32447542432](https://github.com/liangzixuan/investing-pro/actions/runs/32447542432)
passed the same gate on Ubuntu job `96669820813` and Windows job `96669820914`
for exact commit `b9a9edf680b4c3a7373cd6d96210a24544ba0bbe`. The concurrent
[Cycle 2a parser run 32447542455](https://github.com/liangzixuan/investing-pro/actions/runs/32447542455)
and artifact `9434590292` are regression health only; they do not create Cycle
2b evidence or replace the canonical Cycle 2a result. Cycle 2b remains
**Blocked** until all of the following exist and pass separate review:

1. the exact external metadata inventory for 100 filing accessions;
2. the exact selection plan and adjudication protocol;
3. distinct rights-authority and data-steward signatures over the bound inputs;
4. human review of the authority keys and the supplied revocation snapshot;
5. a separately authorized success-only workflow, retained canonical artifact,
   authenticated logs, and independent offline review.

There is no Cycle 2b workflow, run, evidence schema, artifact, or evidence note
in Phase A. Any future evidence must use a separate filing-corpus admission
domain; it must not rewrite Cycle 2a filing-parser evidence v1 or append
PostgreSQL V15. Failure must retain no candidate artifact.

The SEC states that public EDGAR filing content is generally free to access and
reuse and separately publishes a ten-requests-per-second automated-access
limit. Those public statements are context only. They do not satisfy this
repository's required counsel/procurement approval, authenticate a filing or
its digest, supply the external approvals, or implement fetch, DNS, TLS, SSRF,
rate-control, or source-attestation controls.

## Fixed checks

The exact ordered checks proposed for the eventual bounded admission are:

1. `exact_canonical_candidate_manifest_and_duplicate_key_rejection`
2. `fixed_100_accession_content_hash_inventory`
3. `unique_accession_content_identity_and_duplicate_weighting_rejection`
4. `closed_form_cik_timestamp_taxonomy_and_amendment_metadata`
5. `selection_plan_frozen_before_parser_or_adjudication_results`
6. `frozen_strata_counts_and_exclusion_reason_accounting`
7. `adjudication_protocol_hash_bound_before_measurement`
8. `external_approval_binds_manifest_selection_protocol_purpose_and_retention_class`
9. `out_of_band_authority_key_and_curator_approver_separation`
10. `wrong_key_algorithm_scope_expiry_revocation_and_signature_tamper_rejection`
11. `immutable_versioned_manifest_and_no_update_surface`
12. `whole_manifest_atomic_accept_or_value_free_rejection`
13. `no_raw_filing_approval_body_or_sensitive_metadata_in_logs_or_evidence`
14. `no_network_fetch_parser_database_api_web_or_queue_execution`
15. `deterministic_exact_byte_replay_and_mutation_conflict`
16. `source_history_and_cycle2a_preservation`

## Fixed nonclaims

The exact ordered nonclaims are:

1. `legal_opinion_validity_counsel_identity_authentication_or_revocation_freshness`
2. `sec_source_authenticity_or_sec_attestation`
3. `raw_payload_presence_byte_hash_validation_ingestion_custody_retention_crypto_erasure_or_backup_deletion`
4. `external_fetch_edgar_dns_tls_ssrf_or_rate_limits`
5. `malware_scanning_or_zero_day_safety`
6. `ten_fact_normalization_or_parser_correctness`
7. `independently_adjudicated_ground_truth_or_2000_assertions`
8. `precision_recall_quality_or_zero_silent_critical_failures`
9. `dual_parser_independence_or_conflict_quarantine`
10. `general_xbrl_ixbrl_taxonomy_or_plugins`
11. `correction_supersession_lineage_execution`
12. `production_key_kms_hsm_custody_or_rotation`
13. `queue_scheduler_retry_exactly_once_or_load_slo`
14. `database_api_web_composition_or_b15_v15`
15. `representativeness_beyond_exact_approved_selection_plan`
16. `real_data_beyond_exact_approved_manifest_or_production_admission`

## Consequences

Phase A makes the eventual admission rule reviewable before external authority
or real metadata is introduced. It does not approve a corpus, establish
representativeness outside an exact future selection plan, prove that declared
content digests match existing payload bytes, run the Cycle 2a parser, or
complete any Cycle 2 quality gate. Cycle 2b is not B15/V15, changes no
PostgreSQL V1 through V14 or Cycle 2a evidence, and does not authorize real-data
or production use.

Cycle 2d is a successor-only closed synthetic normalization/lineage
contract. It supplies no external inventory, approval, chronology, authority
registry, or real payload and therefore does not change this Blocked status or
establish the Cycle 2b target claim.

Cycle 2e is also a successor-only synthetic comparison contract. Its fixed
validator declarations authenticate no counsel, steward, authority registry,
source, filing, or parser and supply none of the external Phase-B inputs. It
does not change Cycle 2b's Blocked status or establish its target claim.

Cycle 2f is also a successor-only synthetic metric-accounting contract. Its
fixed 100-document declared reference, declaration digests, and synthetic-pilot
thresholds authenticate no real corpus, counsel, steward, authority registry,
adjudicator, filing, or parser and provide none of the external Phase-B inputs.
It does not change Cycle 2b's Blocked status or establish its target claim.

Cycle 2g is also a successor-only synthetic in-process precommitment contract.
Its object-identity capability, reference digest, and call order authenticate no
real corpus, counsel, steward, authority registry, external clock, adjudicator,
filing, or parser and provide none of the external Phase-B inputs. It does not
change Cycle 2b's Blocked status or establish its target claim.

## References

- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
- [Cycle 2d exit matrix](../CYCLE_2D_EXIT_MATRIX.md)
- [Cycle 2e exit matrix](../CYCLE_2E_EXIT_MATRIX.md)
- [Cycle 2f exit matrix](../CYCLE_2F_EXIT_MATRIX.md)
- [Cycle 2g exit matrix](../CYCLE_2G_EXIT_MATRIX.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
- [License policy](../../LICENSE_POLICY.md)
- [SEC Webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions)
- [SEC automated-access rate controls](https://www.sec.gov/filergroup/announcements-old/new-rate-control-limits)
