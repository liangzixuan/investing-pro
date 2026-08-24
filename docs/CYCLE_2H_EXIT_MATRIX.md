# Cycle 2h exit matrix

Scope: one atomic, source-only hardening transition across every public
`Uint8Array` ingress owned by Cycle 2a through Cycle 2g. The transition replaces
caller-observable metadata and allocation paths with intrinsic typed-array slot
and element-type reads, exact carrier/backing validation, role-specific preallocation length
checks, ordinary allocation, and intrinsic copy. The decision is recorded in
[ADR 0035](./adr/0035-cross-boundary-intrinsic-byte-snapshot-hardening.md).

Current status: **Pass only for exact source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.** Its exact frozen-byte local gate,
Ubuntu/Windows CI, parser live acceptance, and custody live acceptance all
passed. The historical Cycle 2a through Cycle 2g bounded owned-byte conclusions
on their original source bytes remain Superseded; their bounded owned-byte
premises are restored only on this exact hardened successor. Cycle 2b, full
Cycle 2 quality, and production admission remain Blocked. Cycle 2f's original
`72e91f5` conclusion and the Cycle 2f restoration/Cycle 2g conclusion at
`df1ddffdede9900302da34160ce6b9a62b9d1708` remain Superseded historical
conclusions.

| Gate                             | Required result                                                                                                                                                                                                                                                                                                                                                                                                                                       | Current status                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Exact ingress inventory          | Every public or injected Cycle 2a–2g byte role is enumerated: parser archive, signer signature output, create/start/remove/residue process-runner stdout/stderr; seven admission documents; custody payload, five semantic entropy results, and key-store reads/writes; two normalization documents; two comparison reports; three quality-measurement documents; three quality-precommitment documents                                               | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Intrinsic slot/type reads        | Intrinsic typed-array `buffer` and `byteLength` getters plus the intrinsic `%TypedArray%.prototype[Symbol.toStringTag]` getter recover backing, actual length, and element type before any proxy-sensitive prototype check                                                                                                                                                                                                                            | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Exact carrier and backing        | Only intrinsic element type `Uint8Array` with exact `Uint8Array.prototype`, intrinsic-validated `ArrayBuffer` backing, and exact `ArrayBuffer.prototype` is accepted. Carriers retaining subclass or foreign-realm prototypes fail exact-prototype admission; re-prototyped `Int8Array`, `Uint8ClampedArray`, and `Uint16Array`, proxies, detached buffers, shared or re-prototyped shared backing, other views, and spoofed own metadata fail closed | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Limit before allocation          | Each role's actual internal byte length is checked against its exact or maximum contract before any owned-snapshot allocation, including exact 64-byte signatures and each process request's stdout/stderr limits                                                                                                                                                                                                                                     | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Hook-free owned copy             | A direct ordinary `Uint8Array` allocation plus intrinsic `Uint8Array.prototype.set.call` copies bytes without caller iterator, constructor, species, instance `set`, `buffer`, or `byteLength` dispatch                                                                                                                                                                                                                                               | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Cycle 2a oversize semantics      | An oversized exact carrier is synchronously SHA-256 hashed without an owned copy, returns the existing signed `archive_limit_exceeded` quarantine, and never starts the worker                                                                                                                                                                                                                                                                        | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Coarse failure preservation      | Existing Cycle 2a–2g invalid-input, document/report-invalid, hash-mismatch, quarantine, value-free diagnostic, and zero-partial-result mappings remain unchanged                                                                                                                                                                                                                                                                                      | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Mutation ownership               | Every accepted in-limit role is copied before parsing, validation, asynchronous work, storage, or comparison, and later caller mutation cannot change the owned snapshot                                                                                                                                                                                                                                                                              | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Hostile role matrix              | Metadata shadows, own throwing `Symbol.toStringTag`, accessors, iterators, constructors, species, instance methods, shared/oversized backing, re-prototyped `Int8Array`/`Uint8ClampedArray`/`Uint16Array`, subclasses, detached views, proxies, and mutation are exercised across every affected role                                                                                                                                                 | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Cycle 2f / Cycle 2g hardening    | Their six plan/candidate/reference roles add intrinsic `Uint8Array` element-type and `ArrayBuffer` brand validation with safe prototype-check ordering while preserving all non-carrier schemas, arithmetic, state, capability, and delegation semantics                                                                                                                                                                                              | Pass at `61701307ded7fa77a555e27925ae86670f6b4dc0`                    |
| Exact transition                 | The atomic diff from `14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98` is exactly 40 paths: 38 modified and two added                                                                                                                                                                                                                                                                                                                                        | Pass — exact source commit `61701307ded7fa77a555e27925ae86670f6b4dc0` |
| Historical evidence preservation | Canonical Cycle 2a/Cycle 2c live evidence schemas, artifacts, notes, checks, nonclaims, and source sets remain unchanged. The existing local custody fixture manifest refreshes only the SHA-256 entries for the changed custody source and security-test files; fixture cases, schema, order, and payload identity/content remain unchanged                                                                                                          | Pass — parser and custody commit-bound reviews accepted exact history |
| Full local gate                  | Formatting, ESLint, all guardrails, production-license review, all scripted typechecks/tests/builds, and both historical boundary verifiers pass on the exact final bytes                                                                                                                                                                                                                                                                             | Pass — 47 files; 1,017 passed + 2 skipped (1,019 total)               |
| Two-OS CI                        | The existing frozen-source CI matrix passes on Ubuntu and Windows for the exact source commit                                                                                                                                                                                                                                                                                                                                                         | Pass — run `32757171049`; Ubuntu `97527284364`; Windows `97527284624` |
| Parser live acceptance           | The existing dedicated parser workflow completes runtime acceptance and its commit-bound offline review accepts the exact Cycle 2h transition without mutating canonical Cycle 2a evidence                                                                                                                                                                                                                                                            | Pass — run/job/artifact `32757171096` / `97527284903` / `9531335028`  |
| Custody live acceptance          | The existing dedicated custody workflow completes runtime acceptance and its commit-bound offline review accepts the exact cumulative Cycle 2c history without mutating canonical Cycle 2c evidence                                                                                                                                                                                                                                                   | Pass — run/job/artifact `32757171127` / `97527284597` / `9531290999`  |

Focused suites on the exact promoted source bytes pass with 84 parser tests; 48 custody
tests plus two skipped; 29 normalization tests; 36 comparison tests; 40 quality
measurement tests; and 31 quality precommitment tests: 268 passed plus two
skipped across the affected suites. These focused results establish
implementation coverage alongside the full local gate's exact inventory of
47 files, 1,017 passed plus two skipped (1,019 total). The exact
final frozen-byte local gate and all source-bound and remote anchors passed for
exact commit `61701307ded7fa77a555e27925ae86670f6b4dc0`.

The sole bounded target claim is
`bounded_synthetic_cycle2_public_uint8array_ingress_intrinsic_backing_and_length_validation_owned_copy_and_no_caller_metadata_iterator_or_allocation_dispatch`.
It is Pass only for exact commit
`61701307ded7fa77a555e27925ae86670f6b4dc0` and the recorded attempt-1 gates.

## Exact checks

The exact ordered checks are:

1. `exact_cycle2a_through_cycle2g_public_and_injected_uint8array_ingress_role_inventory`
2. `intrinsic_typed_array_buffer_byte_length_and_uint8array_element_type_before_proxy_sensitive_prototype_checks`
3. `exact_intrinsic_uint8array_element_type_and_prototype_intrinsic_arraybuffer_brand_and_prototype`
4. `actual_internal_byte_length_role_limit_validation_before_snapshot_allocation`
5. `ordinary_uint8array_allocation_and_intrinsic_set_call_without_caller_metadata_iterator_or_allocation_dispatch`
6. `cycle2a_oversize_synchronous_no_copy_sha256_and_signed_archive_limit_exceeded_quarantine`
7. `existing_cycle2a_through_cycle2g_coarse_failures_empty_quarantines_and_value_free_diagnostics_unchanged`
8. `fresh_owned_snapshot_and_post_call_caller_mutation_safety_for_every_accepted_role`
9. `hostile_buffer_byte_length_symbol_to_string_tag_accessor_iterator_constructor_species_instance_method_shared_oversize_reprototyped_int8_uint8clamped_uint16_subclass_detached_and_proxy_role_matrix`
10. `cycle2f_cycle2g_intrinsic_uint8array_element_type_arraybuffer_brand_proxy_ordering_and_noncarrier_protocol_semantics_preservation`
11. `exact_40_path_38_modified_2_added_transition_from_14f76bb_and_82_unique_cycle2c_history`
12. `canonical_cycle2a_cycle2c_evidence_schema_artifact_note_check_nonclaim_and_source_set_preservation`
13. `exact_final_frozen_byte_full_local_release_gate`
14. `existing_ubuntu_windows_ci_matrix_on_exact_source_commit`
15. `dedicated_parser_live_acceptance_and_commit_boundary_review`
16. `dedicated_custody_live_acceptance_and_commit_boundary_review`

## Exact nonclaims

The exact ordered nonclaims are:

1. `primordial_intrinsic_global_constructor_or_prototype_poisoning`
2. `caller_process_thread_realm_host_operator_or_failure_domain_isolation`
3. `arbitrary_arraybuffer_sharedarraybuffer_dataview_typedarray_subclass_cross_realm_or_proxy_support`
4. `real_filing_payload_presence_declared_digest_equality_sec_source_authenticity_or_attestation`
5. `cycle2b_external_manifest_rights_steward_key_authority_human_review_or_phaseb_admission`
6. `true_parser_validator_implementation_process_host_operator_key_or_failure_domain_independence`
7. `independent_adjudicator_identity_ground_truth_label_correctness_or_human_resolution`
8. `representative_100_real_filings_2000_real_assertions_precision_recall_threshold_adequacy_or_zero_silent_failure_quality`
9. `durable_cross_process_precommitment_chronology_transparency_log_recovery_or_nonrepudiation`
10. `network_fetch_edgar_dns_tls_ssrf_rate_limit_malware_archive_or_source_safety`
11. `production_payload_custody_kms_hsm_key_rotation_retention_backup_deletion_or_cryptographic_erasure`
12. `general_xbrl_ixbrl_taxonomy_concept_alias_unit_dimension_fiscal_or_amendment_correctness`
13. `database_api_web_queue_persistence_evidence_passport_rights_projection_or_b15_v15_composition`
14. `concurrency_reentrancy_distributed_retry_exactly_once_load_slo_or_operational_readiness`
15. `cryptographic_confidentiality_side_channel_timing_or_denial_of_service_resistance`
16. `real_data_admission_full_cycle2_exit_or_production_use`

## History and exit rule

The canonical Cycle 2a and Cycle 2c live jobs, artifacts, evidence notes,
schemas, checks, nonclaims, and source sets remain immutable historical facts.
The Cycle 2b, Cycle 2d, and Cycle 2e local and two-OS CI jobs likewise remain
historical green facts. Cycle 2f's original/restoration gates and Cycle 2g's
local/two-OS gates are also historical green facts. Those runs did not cover hostile plain carriers that
could shadow `buffer` or `byteLength`, disguise a different typed-array element
type by changing its prototype, or dispatch iterator, constructor, species,
accessor, or instance-method hooks before ownership was established.
Their bounded owned-byte security conclusions are therefore Superseded; green
history is not evidence for the current hardening.

Cycle 2f's source-stage conclusion at `72e91f5` was already Superseded by the
metadata/allocation-dispatch gap closed at `df1ddff`. The restored Cycle 2f
claim and Cycle 2g claim at `df1ddff` still accepted a re-prototyped
`SharedArrayBuffer` because backing prototype equality was not an intrinsic
`ArrayBuffer` brand check. They also accepted alternate typed-array element
types re-prototyped to `Uint8Array.prototype`; Cycle 2g additionally performed
a proxy-sensitive prototype check before completing intrinsic brand validation. Those two `df1ddff`
conclusions remain Superseded historical claims. Cycle 2h restores only their
bounded owned-byte premises on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`. Their schemas, fixed checks,
fixed nonclaims, arithmetic, one-shot state, capability, delegation semantics,
historical anchors, and no-dedicated-evidence status remain historical facts.

The exact Cycle 2g transition remains 32 paths (23 modified and nine added)
from `033e59cc06a421f104ecd869ae77ac694fa8ff31`, with exactly 73 cumulative
unique Cycle 2c paths. Baseline maintenance after Cycle 2g adds only
`packages/db/tests/postgres-acceptance-evidence-review.test.ts`, raising the
pre-Cycle 2h cumulative history to 74 unique paths. That maintenance path is
pinned history, not Cycle 2h evidence. Cycle 2h is exactly 40 paths (38 modified
and two added) from baseline
`14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98`; the resulting cumulative Cycle
2c history remains exactly 82 unique paths because all eight additional Cycle
2f/Cycle 2g hardening paths already exist in the cumulative history. The added
transition path
`fixtures/synthetic/filing-payload-custody/v1/manifest.json` is likewise
historical and adds no new path to that union. It refreshes only the SHA-256
entries for `packages/filing-payload-custody/src/payload-custody.ts` and
`packages/filing-payload-custody/src/payload-custody-security.test.ts`; fixture
cases, schema, order, and payload identity/content remain unchanged.

Baseline CI run `32695006904` passed in Ubuntu job `97335364409` and Windows
job `97335364324`; PostgreSQL run/job `32695006890` / `97335364246` also
passed. They are historical baseline regression health only. Parser run/job
`32695006897` / `97335364268` and custody run/job `32695006869` /
`97335364131` passed their source and focused runtime-test stages but failed
exactly at `commit_boundary` because the already-pinned unrelated database test
path was not yet accepted in cumulative successor history. No parser or custody
runtime acceptance occurred, and none of those four runs is Cycle 2h evidence.

Exact source commit `61701307ded7fa77a555e27925ae86670f6b4dc0` passed CI run
`32757171049` in Ubuntu job `97527284364` and Windows job `97527284624`.
Parser live-acceptance run/job `32757171096` / `97527284903` passed runtime
acceptance and commit-bound review and retained artifact `9531335028`. Custody
live-acceptance run/job `32757171127` / `97527284597` passed runtime acceptance
and commit-bound review and retained artifact `9531290999`. Every named run is
attempt 1 and binds the exact source commit. These results promote the sole
Cycle 2h claim only for those bytes and restore the Cycle 2a–2g bounded
owned-byte premises only on that hardened successor.

The promotion is valid only for the exact source commit bound to the passing
local gate, Ubuntu/Windows CI matrix, and dedicated parser and custody
live-acceptance workflows including commit-bound review. A future source
change, failure, cancellation, a partial or extra transition path, unreviewed
Cycle 2f/Cycle 2g semantic drift, caller-dispatched metadata or allocation hooks,
pre-limit allocation, mutation leakage, changed coarse failure semantics, or
any real-data input would invalidate this promotion.

Cycle 2h adds no package, dependency, workflow, new evidence schema,
new/dedicated/live evidence artifact, evidence note, external data, or
application composition. The refreshed existing local synthetic fixture
manifest is a fixture-integrity anchor, not new live evidence. Parser and
custody workflow results are required regression and historical-boundary
acceptance anchors only; they do not become a new Cycle 2h evidence domain.
