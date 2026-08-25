# Cycle 2i exit matrix

Scope: one disconnected, bounded synthetic handoff that accepts exactly two raw
archives and two canonical Ed25519-signed complete ten-fact parser-result
envelopes, verifies caller-supplied key/image provenance and exact archive
digest bindings, and delegates the exact embedded canonical
original/amendment documents to the public Cycle 2d normalizer. The decision is
recorded in
[ADR 0036](./adr/0036-bounded-synthetic-authenticated-parser-normalization-handoff.md).

Current status: **implementation and promotion are pending. The exact baseline
is `dda2ecafc70aa6c4859a29cb312849bac5dec253`; the exact successor source
commit, frozen local inventory, and Ubuntu/Windows CI anchors remain pending
until the transition is complete. Cycle 2b, full Cycle 2 quality, real-data
admission, and production admission remain Blocked.** There is no real filing,
actual parser execution, external key authority, independent adjudication,
dedicated workflow, evidence schema, evidence artifact, offline evidence
review, or evidence note.

| Gate                         | Required result                                                                                                                                                                               | Current status                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Exact role inventory         | Exactly one original archive, amendment archive, signed original ten-fact envelope, and signed amendment ten-fact envelope are accepted                                                       | Pending                                                  |
| Owned bounded inputs         | Raw archives, envelope bytes, and supplied Ed25519 DER SPKI bytes are intrinsically validated, bounded, and copied before use                                                                 | Pending                                                  |
| Canonical envelopes          | Both envelopes are strict canonical UTF-8 JSON with duplicate keys and unexpected fields rejected                                                                                             | Pending                                                  |
| Supplied provenance          | Canonical DER SPKI re-export matches supplied bytes; each Ed25519 signature over the exact domain-separated canonical payload verifies under that key and exact expected key/image identities | Pending; this does not prove key or image authority      |
| Archive binding              | SHA-256 is recomputed over both owned raw archives and matches the corresponding signed envelope                                                                                              | Pending                                                  |
| Complete fact pairs          | During delegation, Cycle 2d requires each distinct role to satisfy the exact closed ten-fact metadata, taxonomy, unit, period, dimension, source, and lineage contract without repair         | Pending                                                  |
| Exact Cycle 2d handoff       | Exact embedded canonical original/amendment document bytes delegate without remapping to `normalizeSyntheticFilingFactPair`                                                                   | Pending                                                  |
| Atomic success               | Success exposes one immutable Cycle 2d normalized record plus aggregate handoff provenance                                                                                                    | Pending                                                  |
| Fail-closed result           | Invalid input, provenance, partial sets, substitutions, mutation, dependency failure, or downstream quarantine returns one empty value-free quarantine                                        | Pending                                                  |
| Local integration            | Format, lint, guardrails, all project typechecks/tests/builds, and the boundary verifier pass for one frozen exact successor commit                                                           | Pending; no count or exact successor commit asserted yet |
| Two-OS CI                    | The existing Ubuntu and Windows CI matrix passes on the same exact successor commit                                                                                                           | Pending; no run or job anchors asserted yet              |
| Dedicated evidence           | Separate workflow/schema/artifact/offline review                                                                                                                                              | Not created; not required for this source-stage contract |
| Parser execution/correctness | A real parser executes and correctly extracts the ten facts                                                                                                                                   | Not proven; outside 2i                                   |
| Key and source authority     | Signer identity, key authority/custody, image execution, SEC source authenticity, and external attestation are established                                                                    | Not proven; outside 2i                                   |
| Cycle 2b authority           | Exact external inventory, rights/steward approvals, chronology, authority keys, and human review pass before real bytes                                                                       | Blocked; outside 2i                                      |
| Independent quality          | Representative real filings and independently adjudicated assertions meet approved thresholds with zero silent critical failures                                                              | Blocked                                                  |
| Production admission         | Real-data rights, persistence, security, privacy, scale, and operational gates pass                                                                                                           | Blocked                                                  |

## Target claim and exact checks

The sole bounded target claim is
`bounded_synthetic_authenticated_ten_fact_parser_result_to_normalization_handoff`.

The exact ordered checks are:

1. `exact_two_raw_archives_two_signed_parser_envelopes_and_strict_options`
2. `intrinsic_uint8array_arraybuffer_brand_prototype_and_preallocation_bounds`
3. `fresh_owned_snapshot_before_hash_parse_signature_or_normalization_use`
4. `bounded_canonical_utf8_json_envelope_and_duplicate_key_rejection`
5. `closed_envelope_payload_document_signature_and_identity_schema`
6. `exact_ed25519_spki_key_id_and_expected_image_digest_binding`
7. `domain_separated_signature_verification_over_exact_canonical_payload`
8. `raw_archive_sha256_recomputation_and_source_content_digest_binding`
9. `complete_embedded_original_and_amendment_document_without_fact_synthesis`
10. `exact_original_then_amendment_role_and_cross_document_identity_binding`
11. `canonical_embedded_document_bytes_delegated_to_cycle2d_normalization`
12. `whole_pair_atomic_success_or_single_empty_value_free_quarantine`
13. `deeply_frozen_cycle2d_record_and_aggregate_provenance_success`
14. `exact_replay_determinism_owned_input_mutation_safety_and_no_partial_result`
15. `signature_source_key_image_role_schema_and_downstream_failure_quarantine`
16. `no_io_network_parser_execution_custody_corpus_database_api_web_or_queue`

## Exact nonclaims

The exact ordered nonclaims are:

1. `cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission`
2. `real_public_filing_payload_presence_sec_source_authenticity_or_attestation`
3. `counsel_identity_legal_validity_revocation_freshness_or_data_rights`
4. `edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety`
5. `xml_xbrl_ixbrl_parser_worker_execution_or_general_taxonomy_correctness`
6. `signing_key_identity_production_kms_hsm_custody_rotation_or_nonrepudiation`
7. `raw_payload_custody_retention_backup_deletion_or_cryptographic_erasure`
8. `independent_dual_parser_validator_or_cross_engine_conflict_quarantine`
9. `independently_adjudicated_ground_truth_or_two_thousand_assertions`
10. `precision_recall_document_success_quality_thresholds_or_zero_silent_failures`
11. `general_concept_alias_unit_conversion_dimensions_or_fiscal_calendar_coverage`
12. `real_amendment_completeness_correction_discovery_or_accounting_truth`
13. `multi_issuer_batch_streaming_concurrency_retry_crash_recovery_or_slo`
14. `database_api_web_queue_persistence_evidence_passport_or_b15_v15_composition`
15. `production_identity_secrets_network_operations_or_incident_recovery`
16. `real_data_admission_full_cycle2_exit_or_production_use`

## History and exit rule

Cycle 2a and Cycle 2d checks, nonclaims, source sets, schemas, artifacts,
evidence notes, and exact historical anchors remain immutable. Cycle 2i does
not add a record to either historical evidence domain and does not claim that
their historical executions produced its signed ten-fact envelopes. Existing
parser, custody, and PostgreSQL runs for the eventual source commit, if any,
are regression health only.

The Cycle 2i transition begins at exact baseline
`dda2ecafc70aa6c4859a29cb312849bac5dec253`. The claim can be promoted only
after the complete exact package-and-document transition is frozen, the full
local gate passes on those bytes, the exact successor commit is recorded, and
the existing Ubuntu/Windows CI matrix passes on that same commit. No run ID,
job ID, path count, or test count is accepted before it is observed and bound
to those exact bytes.

Failure, cancellation, an omitted, extra, renamed, or deleted transition path,
a partial package tree, non-canonical envelope, archive-digest mismatch,
signature/key/image mismatch, role swap, partial or duplicate fact set,
remapping before Cycle 2d delegation, mutation leakage, non-value-free
quarantine, changed historical Cycle 2a/Cycle 2d evidence, or different local
and CI source commits prevents promotion. Passing this bounded source-stage
gate cannot prove actual parser execution or correctness, key authority, real
filing authenticity, Cycle 2b authority, independent validation, adjudicated
quality, full Cycle 2 exit, B15/V15, or production use.
