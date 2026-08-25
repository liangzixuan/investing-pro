# ADR 0036: bounded synthetic authenticated parser-normalization handoff

Status: accepted and promoted only for exact source commit
`5a1589ede57e00d6ff60521e7b53bea2ac849b0a` from exact baseline
`dda2ecafc70aa6c4859a29cb312849bac5dec253`. The transition is exactly 21 paths
(9 added, 12 modified); the frozen local release gate and Ubuntu/Windows CI
passed on those source bytes. Cycle 2b, full Cycle 2 quality, real-data
admission, and production admission remain Blocked.

## Context

Cycle 2a established one isolated synthetic parser execution and an
Ed25519-signed parser-result shape. Cycle 2d separately established a closed,
pure, synthetic original/amendment ten-fact normalization and supersession
boundary. Neither historical result defines a provenance-preserving interface
that accepts archive bytes and authenticated complete parser-result documents,
verifies their mutual binding, and hands the exact canonical documents to the
public Cycle 2d normalizer.

The highest-priority repository-controlled gap is therefore a bounded schema
handoff, not another claim about parser execution or external authority. The
handoff must require exactly two raw synthetic archives and exactly two signed
complete ten-fact parser-result envelopes, preserve their original/amendment
roles, verify only the cryptographic and provenance assertions supplied to the
call, and fail closed before exposing normalized values.

This is a parallel complete-result protocol. It does not consume, translate,
or widen Cycle 2a's historical two-fact v1 result; that shape fails the exact
ten-fact contract.

## Decision

Add the private
`@research-cockpit/filing-parser-normalization-handoff` package with one exact
workspace dependency on `@research-cockpit/filing-fact-normalization`. It
exposes one synchronous, disconnected handoff boundary for an exact synthetic
original/amendment pair.

The command supplies exactly four role-bearing inputs: the original raw
archive, amendment raw archive, canonical Ed25519-signed original ten-fact
parser-result envelope, and canonical Ed25519-signed amendment ten-fact
parser-result envelope. It also supplies the exact expected key and image
provenance needed to verify those envelopes. All public byte carriers are
validated and copied into owned, bounded ordinary byte snapshots before
parsing, hashing, signature verification, or delegation.

Each signed envelope is strict canonical UTF-8 JSON with duplicate keys and
unexpected fields rejected. The boundary reconstructs the domain-separated
canonical signing payload, verifies the Ed25519 signature under the supplied
public key, and requires the declared key and image identities to match the
supplied expectations. This proves only internal
cryptographic consistency under caller-supplied trust inputs; it does not prove
who controls the key, whether the image ran, or whether either is authoritative.

The boundary independently recomputes SHA-256 over each owned raw archive and
requires the corresponding signed envelope to bind that exact digest. It
reconstructs two embedded documents without synthesizing, defaulting, inferring,
repairing, or remapping facts.

The boundary reconstructs the exact embedded canonical original and amendment
Cycle 2d document bytes while parsing the closed envelopes and signing payloads.
After carrier, envelope, signature, key/image, and raw-archive binding checks
pass, those bytes are delegated without repair or semantic remapping to the
public `normalizeSyntheticFilingFactPair` function. Cycle 2d validates the
distinct roles, closed ten-fact sets, parser/taxonomy metadata, periods,
dimensions, sources, amendment lineage, and pair during delegation; only its
`normalized` result succeeds. The package does not reproduce the Cycle 2d
normalizer or widen its schema.

Success returns an immutable result containing the Cycle 2d normalized record
and aggregate handoff provenance: counts, expected key/image identifiers, the
canonical SPKI hash, and a pair binding over both source hashes, both Cycle 2d
document hashes, and the key/image/SPKI identities. The aggregate does not hash
the envelope or signature bytes or the normalized result. It is not a
filing-admission record, evidence passport, external attestation, or authority
decision.

Any invalid carrier or command, non-canonical envelope, duplicate key,
signature failure, wrong key or image expectation, raw-archive digest mismatch,
role swap, pair substitution, incomplete or
duplicate fact set, metadata or lineage mismatch, mutation, dependency error,
or downstream Cycle 2d quarantine produces the same empty, value-free handoff
quarantine. Failure exposes no normalized facts, raw values, document or
archive hashes, signature detail, provenance identifiers, mismatch detail, or
canary content.

## Evidence and status boundary

Cycle 2i's production handoff is a deterministic synchronous TypeScript
boundary. It adds no parser or container execution, filesystem or network I/O,
custody operation, database, API, web, queue, clock, randomness, or real filing,
and it loads no configuration from the environment, files, or network. Its
strict expected-key, expected-image, and SPKI options are bounded in-memory
caller inputs. The test-only fixture builder intentionally generates ephemeral
Ed25519 key pairs and is not part of that production runtime claim. Cycle 2i's
only promotion evidence is the frozen-byte full local release gate and the
repository's existing Ubuntu/Windows CI matrix for one exact successor commit.

The frozen local gate passed formatting, lint, every guardrail, dependency and
peer policy, all project typechecks, 49 test files with 1,064 passed and 3
skipped (1,067 total cases), and all builds. CI run `32817294734` passed in
Ubuntu job `97708048290` and Windows job `97708048027` on the exact source
commit. Cycle 2i creates no dedicated workflow, evidence schema, evidence
artifact, retained log package, offline evidence review, or evidence note.
Parser run/job `32817294720` / `97708047987`, custody run/job `32817294732` /
`97708048009`, and PostgreSQL run/job `32817294741` / `97708049006` passed as
regression health only and cannot become Cycle 2i evidence.

Cycle 2a and Cycle 2d evidence, checks, nonclaims, source sets, artifacts,
notes, and historical anchors remain immutable. Cycle 2i does not amend their
records or claim that their historical executions produced its two envelopes.
The transition begins at exact baseline
`dda2ecafc70aa6c4859a29cb312849bac5dec253` and ends at exact source commit
`5a1589ede57e00d6ff60521e7b53bea2ac849b0a`. Both evidence verifiers freeze the
same exact 21-path, 9-added/12-modified transition; no rename or deletion is
admitted.

## Exact target claim and checks

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

## Consequences

Cycle 2i can close only the exact authenticated synthetic schema-interface gap:
two complete signed ten-fact documents are cryptographically consistent with
the supplied key/image expectations and raw archive digests, and their exact
embedded canonical documents reach the unchanged Cycle 2d normalizer as one
atomic pair. It does not establish that a parser executed, that extraction was
correct, that signed documents were derived from archive content beyond the
asserted digest binding, or that the supplied key or image is authoritative.

Cycle 2b remains Blocked. No external manifest, rights or steward approval,
authority-key review, payload inventory, human review, independent validator,
adjudicated ground truth, real filing, real parser quality, production custody,
application composition, B15/V15 gate, full Cycle 2 exit, or production
admission follows from this handoff.

## References

- [Cycle 2i exit matrix](../CYCLE_2I_EXIT_MATRIX.md)
- [Cycle 2a exit matrix](../CYCLE_2A_EXIT_MATRIX.md)
- [Cycle 2d exit matrix](../CYCLE_2D_EXIT_MATRIX.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
- [ADR 0028](./0028-bounded-synthetic-filing-parser-isolation.md)
- [ADR 0031](./0031-bounded-synthetic-ten-fact-normalization-and-lineage.md)
