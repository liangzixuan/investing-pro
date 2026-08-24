# Cycle 2c exit matrix

Scope: one generated 4,096-byte synthetic payload, a maximum 1 MiB protocol
envelope, AES-256-GCM encrypted local custody, fixed 24-hour retention, and
terminal logical key unavailability in one process. The decision is recorded
in [ADR 0030](./adr/0030-bounded-synthetic-filing-payload-custody.md).

Current status: **the bounded synthetic claim is Pass on exact commit
`ef22c7bc10596840b8ff686b9190730956fab0c4`; production remains Blocked.**
Local integration, two-OS CI, dedicated Linux evidence, exact-commit offline
review, and independent retained artifact/log review agree. Cycle 2b remains
separately Blocked on external metadata, approvals, and human key-authority
review. No real payload, external configuration, fetch, or application
composition exists.

The final local aggregate is successor-compatibility health: 848 passed plus 2
POSIX-only Windows skips, including 64 filing-parser passes. It does not replace
or widen the canonical live evidence at
`ef22c7bc10596840b8ff686b9190730956fab0c4`.

The injected entropy provider is an out-of-band trusted CSPRNG TCB. Source
validates only the returned byte shape and exact requested length, not
randomness or uniqueness. The dedicated Linux record is limited to
observed Node `crypto.randomBytes` use and distinct DEK-fingerprint and
nonce-hash samples in that run; it cannot establish OS entropy quality.

| Gate                       | Required result                                                                                                                                     | Current status                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Fixed synthetic input      | One fresh owned copy of the exact 4,096-byte generated fixture matches its fixed SHA-256 and stays within the 1 MiB limit                           | Implemented; local verification Pass                                                                    |
| Closed encryption contract | Random per-lifecycle AES-256-GCM key/nonce and exact canonical AAD bind all fixed identity/retention fields                                         | Implemented; local verification Pass                                                                    |
| Domain separation          | No plaintext staging; injected key store, ciphertext, and closed audit-file domains remain separate; only public aggregate views are value-free     | Implemented; local verification Pass                                                                    |
| Atomic publication         | Create-exclusive staging plus one publish rename leaves one complete record or zero visible records; failure cleanup removes key/stage/orphans      | Implemented; local verification Pass                                                                    |
| Authenticated read         | Audit/ciphertext/AAD/tag/length/plaintext-hash validation rejects mutation without returning partial data                                           | Implemented; local verification Pass                                                                    |
| Retention boundary         | Trusted host time enforces `now < expiry` read and `now >= expiry` transition with no caller extension                                              | Implemented; local verification Pass                                                                    |
| Logical key unavailability | Expiry forgets the key, retains available/terminal audit history, then removes ciphertext; no resurrection, decrypt denial, and retry cleanup agree | Implemented; local verification Pass; never called cryptographic erasure                                |
| Value-free boundary        | Public aggregate audit, errors, evidence, and log markers expose no payload, key ID/key, nonce, tag, internal path, or rejected value               | Implemented; local verification Pass                                                                    |
| Isolation                  | No parser, corpus admission, fetch/network, database, API, web, queue, or real config composition is added                                          | Implemented; guardrail verification Pass                                                                |
| Local integration          | Final successor-compatible format, lint, guardrails, all project typechecks/tests, and builds pass                                                  | Pass: 39 files; 848 passed + 2 POSIX-only Windows skips (850 total cases); parser 64; 86 license checks |
| Regression CI              | The same frozen source gate passes on Ubuntu and Windows                                                                                            | Pass: run `32463955370`; jobs `96716506990` / `96716506716`                                             |
| Dedicated Linux evidence   | One success-only canonical record binds the exact commit, fixture chain, source hashes, checks, nonclaims, and real Linux lifecycle                 | Pass: run `32463955421`; job `96716507074`; artifact `9439965468`                                       |
| Independent review         | Original artifact/logs and an exact-commit offline review agree                                                                                     | Pass: `offline_consistent`, 29 source hashes, retained ZIP/JSON/log hashes exact                        |
| Cycle 2b authority         | Exact external 100-entry metadata, rights/steward approvals, chronology, and human registry/key review pass before real bytes                       | Blocked; outside Cycle 2c                                                                               |
| Production admission       | Real-byte acquisition, production KMS/storage/retention/deletion, parser quality, composition, operations, and privacy/legal gates pass             | Blocked                                                                                                 |

## Target claim and exact checks

The sole bounded target claim is
`bounded_synthetic_filing_payload_integrity_custody_and_logical_key_unavailability`.
It is Pass only for exact commit
`ef22c7bc10596840b8ff686b9190730956fab0c4` and the gates above.

The exact ordered checks are:

1. `exact_single_nonempty_synthetic_payload_and_owned_byte_snapshot`
2. `closed_size_digest_retention_and_algorithm_inputs`
3. `recomputed_sha256_matches_declared_content_identity`
4. `exact_replay_idempotency_and_same_hash_metadata_conflict_rejection`
5. `random_per_payload_aes_256_gcm_dek_and_nonce_uniqueness`
6. `aad_binds_schema_content_hash_size_and_retention_identity`
7. `no_plaintext_staging_and_payload_key_audit_domain_separation`
8. `opaque_internal_paths_and_link_device_reparse_escape_rejection`
9. `atomic_stage_commit_or_bounded_zero_visible_record`
10. `failure_injection_rollback_and_orphan_cleanup`
11. `read_reauthenticates_tag_metadata_and_plaintext_sha256`
12. `trusted_clock_active_expiry_boundary_and_no_caller_extension`
13. `read_expire_delete_serialization_and_terminal_no_resurrection`
14. `logical_key_forget_decrypt_denial_and_idempotent_cleanup`
15. `aggregate_value_free_audit_error_and_canary_leakage_rejection`
16. `no_network_parser_database_api_web_queue_and_cycle2a_schema_check_nonclaim_source_set_artifact_preservation`

## Exact nonclaims

1. `real_filing_rights_approval_counsel_identity_or_legal_validity`
2. `cycle2b_external_manifest_authority_or_phaseb_admission`
3. `sec_source_authenticity_or_declared_digest_provenance`
4. `real_payload_presence_100_filing_completeness_or_batch_atomicity`
5. `edgar_fetch_dns_tls_ssrf_rate_limits_or_malware_scanning`
6. `production_kms_hsm_key_custody_rotation_attestation_or_recovery`
7. `physical_media_secure_erasure_memory_zeroization_or_cryptographic_erasure`
8. `backup_replica_snapshot_cache_temp_log_or_third_party_deletion`
9. `legal_hold_dsar_offboarding_or_regulatory_retention_execution`
10. `multi_process_cross_host_object_store_or_distributed_consistency`
11. `power_loss_filesystem_durability_disaster_recovery_or_restore`
12. `database_api_web_queue_or_b15_v15_composition`
13. `general_xbrl_ixbrl_ten_fact_parser_or_lineage_correctness`
14. `dual_parser_ground_truth_2000_assertions_or_quality_thresholds`
15. `production_network_secret_tenant_load_slo_or_operational_readiness`
16. `real_data_admission_or_production_use`

## Exit rule

Source or local tests alone cannot establish the claim. For exact commit
`ef22c7bc10596840b8ff686b9190730956fab0c4`, the frozen-byte local and two-OS CI
gates, one successful dedicated Linux run, one canonical artifact uploaded only
after exact-commit offline review, and independent custody review of the
original artifact and authenticated log all passed. The workflow remains
fail-closed: failure, cancellation, missing source/history binding, or any
retained failed candidate means no promotion.

This Cycle 2c result proves only the exact bounded synthetic protocol. It does
not unblock Cycle 2b, authorize real filing bytes, prove
cryptographic erasure, establish production custody, satisfy the 100-filing or
2,000-assertion quality gates, create B15/V15, or authorize production use.

Cycle 2d is a separate closed synthetic normalization/lineage successor. It
does not consume or widen this custody result, and the Cycle 2c schema, checks,
nonclaims, 29-source set, canonical artifact, and evidence note remain
unchanged. See the [Cycle 2d exit matrix](./CYCLE_2D_EXIT_MATRIX.md).

Cycle 2e is another disconnected synthetic source successor. It does not
consume or widen ciphertext, keys, receipts, audit history, or the canonical
Cycle 2c evidence. The 16 checks, 16 nonclaims, 29-source set, artifact, and
evidence note remain unchanged. See the
[Cycle 2e exit matrix](./CYCLE_2E_EXIT_MATRIX.md).

Cycle 2f is another disconnected synthetic source successor. It consumes no
Cycle 2c payload, ciphertext, key, receipt, audit history, artifact, or evidence
record. The canonical Cycle 2c 16 checks, 16 nonclaims, 29-source schema,
artifact, and evidence note remain unchanged. See the
[Cycle 2f exit matrix](./CYCLE_2F_EXIT_MATRIX.md).

Cycle 2g is another disconnected synthetic source successor. Its in-process
candidate-observation commitment consumes no Cycle 2c plaintext, ciphertext,
key, receipt, audit history, artifact, or evidence record. The canonical Cycle
2c 16 checks, 16 nonclaims, 29-source schema, artifact, and evidence note remain
unchanged. See the [Cycle 2g exit matrix](./CYCLE_2G_EXIT_MATRIX.md).

Exact remote, source, artifact, log, and custody anchors are recorded in the
[Cycle 2c evidence note](./FILING_PAYLOAD_CUSTODY_EVIDENCE.md).
