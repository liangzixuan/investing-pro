# ADR 0035: cross-boundary intrinsic byte-snapshot hardening

Status: implementation and focused hostile-carrier coverage present; prior
Cycle 2a through Cycle 2g bounded owned-byte security conclusions Superseded;
exact final frozen-byte working-tree local gate Pass; source commit, two-OS CI,
parser live acceptance, and custody live acceptance Pending. The sole target
claim therefore remains Pending. Cycle 2b, full Cycle 2 quality, and production admission Blocked.

## Context

Cycle 2a through Cycle 2g each accept caller-controlled `Uint8Array` values and
claim to own the bytes before later parsing, validation, asynchronous work,
storage, or comparison. Their historical gates are real green facts: Cycle 2a
and Cycle 2c also retain canonical live artifacts and independent reviews, and
Cycle 2b, Cycle 2d, Cycle 2e, Cycle 2f, and Cycle 2g retain exact source and
two-OS CI anchors.

An audit found that those historical implementations did not establish the
owned-byte premise against hostile plain carriers. Across the seven boundaries,
code read shadowable instance `buffer` or `byteLength` properties, treated an
exact prototype as sufficient proof of the `Uint8Array` element type, used
`Uint8Array.from`, typed-array `slice`, or an instance `set`, or performed
proxy-sensitive checks before intrinsic slot validation. A caller could spoof
shared-backing or bound metadata, invoke iterator, constructor,
`Symbol.species`, accessor, proxy, or instance-method hooks, observe or reenter
snapshot creation, or force allocation based on caller-controlled metadata.

Because the flaw is repeated across already-named milestones, closing only one
copy would leave the same repository-level claim false elsewhere. The prior
bounded owned-byte security conclusions for Cycle 2a through Cycle 2g are
Superseded. Their jobs and artifacts remain historical facts, but cannot attest
the hardened bytes.

## Decision

Apply one atomic Cycle 2h source-only transition to every affected public or
injected byte role:

- Cycle 2a: the parser archive, injected signer signature output, and stdout
  and stderr from injected create/start/remove/residue process-runner results;
- Cycle 2b: authority keys, candidate manifest, selection plan, adjudication
  protocol, rights approval, steward approval, and final manifest;
- Cycle 2c: staging payload; injected entropy outputs for the payload ID, key
  ID, AES key, nonce, and staging record name; and key-store writes and reads;
- Cycle 2d: original and amendment documents;
- Cycle 2e: declared-validator A and B reports;
- Cycle 2f: plan, candidate, and declared-reference documents; and
- Cycle 2g: plan, candidate-observation, and declared-reference documents.

Each snapshot helper first invokes the captured intrinsic typed-array `buffer`
and `byteLength` getters plus the captured intrinsic
`%TypedArray%.prototype[Symbol.toStringTag]` getter with the candidate as
receiver. A proxy or non-typed-array receiver fails during those intrinsic
brand reads before any proxy-sensitive `Object.getPrototypeOf` call. A detached
typed-array carrier may instead expose its detached `ArrayBuffer` and zero byte
length; it fails closed no later than the intrinsic copy operation, before
semantic use or completion of an owned copy and without caller dispatch. After
internal slots are recovered, the helper requires the recovered element-type
tag to be `Uint8Array` and the candidate's exact prototype to be
`Uint8Array.prototype`, invokes the intrinsic `ArrayBuffer` byte-length getter
to brand-check the recovered backing slot, and requires that backing object's
exact prototype to be `ArrayBuffer.prototype`. Carriers retaining subclass or
foreign-realm prototypes fail exact-prototype admission; this contract does not
claim constructor or realm provenance for a genuine typed array re-prototyped to
the exact local prototypes. `SharedArrayBuffer` backing (including a
re-prototyped shared buffer), re-prototyped alternate typed arrays, `DataView`,
proxies, detached buffers, and spoofed own metadata fail closed.

The helper validates the actual internal byte length against the role's exact
or maximum limit before allocating an owned snapshot. This includes the exact
64-byte signer result and the specific stdout/stderr limits on every process
request. An accepted carrier is
copied into a directly allocated ordinary `Uint8Array` with
`Uint8Array.prototype.set.call(snapshot, bytes)`. Snapshotting does not read a
caller own `buffer`, `byteLength`, `Symbol.toStringTag`, `constructor`,
`Symbol.species`, iterator, or instance `set`, and it does not dispatch allocation or copy through caller
code. All later parsing, asynchronous work, storage, comparison, and mutation
tests use the owned copy.

Every injected signer and process-runner byte result is validated and owned
before length-dependent parsing, decoding, provenance publication, or cleanup
logic uses it. Cycle 2a preserves its signed archive-oversize behavior without allocating a second
archive-sized buffer. Once intrinsic slots and exact carrier/backing are
validated, an over-limit archive is synchronously SHA-256 hashed directly and
then represented as the existing signed `archive_limit_exceeded` quarantine.
It never reaches the worker. Empty in-limit archives retain
`archive_invalid`. Invalid carriers retain the existing invalid-input boundary.

Cycle 2b retains its existing invalid-input versus document-invalid mapping.
Cycle 2c retains its boundary-specific invalid-input and key-store-failure
wrapping. Cycle 2d retains empty `document_invalid` quarantine, and Cycle 2e
retains empty report-invalid/conflict quarantine. Cycle 2f retains its
measurement quarantine, and Cycle 2g retains its one-shot consuming protocol
and measurement quarantine. No path exposes rejected
values, partial facts, preferred results, detailed carrier failures, or new
diagnostic distinctions.

Focused regression coverage applies metadata shadows, an own throwing
`Symbol.toStringTag`, throwing accessors, iterators, constructors, species
hooks, instance methods, shared and oversized backing, re-prototyped
`Int8Array`, `Uint8ClampedArray`, and `Uint16Array` carriers, subclasses,
detached buffers, proxies, and post-call mutation across
every affected role. The claim is limited to the unpoisoned intrinsics and
ordinary same-realm carriers used by this source contract; it is not a
caller-process isolation or primordial-hardening claim.

## Evidence and status boundary

Cycle 2h adds no package, dependency, workflow, new evidence schema,
new/dedicated/live evidence artifact, evidence note, external input, or live
trust boundary. The refreshed existing local synthetic custody fixture manifest
is a fixture-integrity anchor, not new live evidence. Cycle 2h relies on
the exact final frozen-byte local release gate, the existing Ubuntu/Windows CI
matrix, and the existing dedicated parser and custody live-acceptance workflows.
The parser and custody runs must each complete runtime acceptance and accept the
exact successor history at `commit_boundary`; they remain regression and
historical-boundary anchors, not a new Cycle 2h evidence domain.

Focused working-tree suites currently pass with 84 parser tests; 48 custody
tests plus two skipped; 29 normalization tests; 36 comparison tests; 40 quality
measurement tests; and 31 quality precommitment tests: 268 passed plus two
skipped across the affected suites. These focused results establish
implementation coverage alongside the full local gate's expected inventory of
47 files, 1,017 passed plus two skipped (1,019 total). The exact
final frozen-byte working-tree local gate is Pass.

The source commit and all remote/live anchors remain Pending. Baseline
CI run `32695006904` passed in Ubuntu job `97335364409` and Windows job
`97335364324`, and PostgreSQL run/job `32695006890` / `97335364246` passed.
Those are historical baseline health only. Parser run/job `32695006897` /
`97335364268` and custody run/job `32695006869` / `97335364131` passed source
and focused runtime-test stages but failed exactly at `commit_boundary` on the
pinned unrelated database test path, so no runtime acceptance occurred.

The canonical Cycle 2a and Cycle 2c evidence schemas, artifacts, notes, checks,
nonclaims, and source sets remain unchanged. The Cycle 2g transition remains
exactly 32 paths (23 modified and nine added) and exactly 73 cumulative unique
Cycle 2c paths. The single later baseline-maintenance path
`packages/db/tests/postgres-acceptance-evidence-review.test.ts` raises the
pre-Cycle 2h cumulative set to 74 and is pinned history, not evidence. Cycle 2h
must be exactly 40 paths (38 modified and two added) from
`14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98`, producing exactly 82 cumulative
unique Cycle 2c paths because the eight added Cycle 2f/Cycle 2g hardening paths
already exist in cumulative history. The additional transition path
`fixtures/synthetic/filing-payload-custody/v1/manifest.json` is historical and
therefore does not add a new path to the union. It refreshes only the SHA-256
entries for `packages/filing-payload-custody/src/payload-custody.ts` and
`packages/filing-payload-custody/src/payload-custody-security.test.ts`; fixture
cases, schema, order, payload identity/content, and canonical live evidence
schemas, artifacts, notes, checks, nonclaims, and source sets remain unchanged.

Cycle 2f's original `72e91f5` conclusion remains Superseded. The restored Cycle
2f bounded claim and Cycle 2g bounded claim at `df1ddff` are now also
Superseded: their backing check accepted a re-prototyped `SharedArrayBuffer`,
and their carrier check accepted alternate typed-array element types
re-prototyped to `Uint8Array.prototype`. Cycle 2g also checked a proxy-sensitive
prototype before completing intrinsic brand validation. Cycle 2h hardens their six public byte roles while preserving
all non-carrier schemas, checks, nonclaims, metric arithmetic, state,
capability, delegation, historical anchors, and no-dedicated-evidence status.

## Exact target claim and checks

The sole bounded target claim is
`bounded_synthetic_cycle2_public_uint8array_ingress_intrinsic_backing_and_length_validation_owned_copy_and_no_caller_metadata_iterator_or_allocation_dispatch`.

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

## Consequences

Cycle 2h can close only the exact same-realm byte-carrier admission and owned
copy claim above. It does not harden poisoned primordials, isolate caller code
in another process or realm, authenticate a filing or declared digest, supply
Cycle 2b authority, establish independent parsing or adjudication, validate
real quality, make Cycle 2g durable, secure external networking, provide
production custody/KMS, compose any application, complete Cycle 2, or authorize
real-data or production use.

Until one exact source commit passes every final gate, the new target claim is
Pending and the prior Cycle 2a through Cycle 2g bounded owned-byte security
conclusions remain Superseded.

## References

- [Cycle 2h exit matrix](../CYCLE_2H_EXIT_MATRIX.md)
- [Cycle 2a exit matrix](../CYCLE_2A_EXIT_MATRIX.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
- [Cycle 2c exit matrix](../CYCLE_2C_EXIT_MATRIX.md)
- [Cycle 2d exit matrix](../CYCLE_2D_EXIT_MATRIX.md)
- [Cycle 2e exit matrix](../CYCLE_2E_EXIT_MATRIX.md)
- [Cycle 2f exit matrix](../CYCLE_2F_EXIT_MATRIX.md)
- [Cycle 2g exit matrix](../CYCLE_2G_EXIT_MATRIX.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
- [License policy](../../LICENSE_POLICY.md)
