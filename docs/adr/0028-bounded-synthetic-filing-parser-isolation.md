# ADR 0028: Bounded synthetic filing-parser isolation

Status: source implementation and exact frozen-byte local `pnpm verify`
complete; dedicated Linux live evidence pending; production admission blocked

## Context

The threat model makes a parser isolation gate mandatory before filing
ingestion. Cycle 2's wider objectives also require a counsel-approved public
corpus, ten launch facts, independent validation, quality thresholds, and
correction lineage. None of those wider objectives is needed to test the
smallest dangerous boundary first: one adversarial, synthetic archive entering
one short-lived parser process.

Cycle 2a therefore remains disconnected from the API, web application,
database, queues, and external fetchers. It is not a continuation of the
PostgreSQL evidence version line and creates neither B15 nor V15. Historical B1
through B14 and Cycle 1c claims remain unchanged.

## Decision

Add a separate package and evidence domain for the
`bounded_synthetic_one_shot_filing_parser_isolation_quarantine_replay_and_provenance_binding`
claim.

The host accepts only a bounded in-memory archive. Every nonempty,
host-size-eligible parse that reaches the worker creates a new container from
the exact built image ID and mounts one staging file at the exact read-only path
`/input/filing.zip`. Empty and over-host-limit inputs are signed quarantines
without starting a process. The archive is not exposed as an arbitrary host
path. The container receives no signing key and no application, database,
tenant, network, or secret context.

The archive is a closed ZIP containing exactly `filing-manifest.json` and
`filing.xml`. The synthetic manifest and XML use one fixed schema, namespace,
taxonomy version, unit, and two-concept allowlist. ZIP entry names, duplicates,
encryption, nested archives, entry count, local/central metadata agreement,
declared and streamed sizes, aggregate expansion, and compression ratio fail
closed. XML DTDs, entities, XInclude, processing instructions after the exact
declaration, comments, CDATA, excessive depth/nodes/attributes/text, unknown
taxonomy or concepts, duplicate/ambiguous facts, and malformed values are
quarantined without partial facts.

The worker writes exactly one ASCII canonical JSON line and nothing to stderr.
The result is either a closed accepted candidate with exactly the two synthetic
sentinel facts or a closed quarantine result with an allowlisted code and
`facts: []`. The host requires exit zero, empty stderr, bounded stdout, exact
canonical reserialization, fixed source/image bindings, and no duplicate or
extra keys. Raw archive, XML, manifest, fact values, and rejected values are not
written to evidence or diagnostic output.

The host signs a domain-separated canonical result only after validation. The
Ed25519 signer is injected outside the worker; its private key is never mounted
or passed in the container environment. The signing payload binds the exact
built image ID as well as the normalized result. Cycle 2a uses an ephemeral test
key only to prove successful verification and fail-closed tamper rejection.
Exact-byte accepted replay must produce the same normalized result and signing
payload. The live gate also requires the full signed record and deterministic
Ed25519 signature to match when replayed with the same ephemeral signer;
signature bytes under a different key are not compared and this is not an
exactly-once claim.

The Docker boundary uses argument arrays without a shell and pins these
controls for every new container:

- exact Linux/amd64 image ID built from the reviewed digest-pinned Dockerfile;
- numeric user `65532:65532`, all capabilities dropped, and
  `no-new-privileges=true`;
- `--network none`, no published ports, read-only root filesystem, read-only
  one-file input mount, IPC isolation, and a `/tmp` tmpfs with
  `noexec,nosuid,nodev`;
- fixed CPU, memory/swap, PID, open-file, stdout, stderr, and wall-clock limits;
  and
- force removal plus the boundary's exact-name residue check after success,
  timeout, abort, malformed output, and worker failure; the live runner also
  requires zero containers under the fixed Cycle 2a label before evidence.

The worker image has no package-install step and no pip dependency. Its base is
exactly
`docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2`;
the reviewed Linux/amd64 child manifest is
`sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af`.
The Python Software Foundation license anchor applies to CPython. It does not
establish a complete license, notice, vulnerability, redistribution,
procurement, or production-admission review for Debian packages in the image.

## Evidence boundary

Cycle 2a uses a dedicated success-only filing-parser evidence schema version 1
and a dedicated Linux workflow. It does not append the PostgreSQL V1 through
V14 schema or upload to the PostgreSQL artifact name. A passing record binds the
exact commit, run and attempt, reviewed source blobs, fixture manifest,
digest-pinned base image, exact built image ID, observed tool versions,
value-free case outcomes, the fixed checks, and the fixed nonclaims. The
artifact is uploaded only after the acceptance command exits successfully.

The offline reviewer requires independent repository, commit, run, attempt,
and evidence-digest anchors. It accepts only one small regular canonical file,
reads source blobs from the exact local Git commit rather than the worktree,
checks the source and manifest chain, and emits only `offline_consistent` on
success. It does not authenticate GitHub, the runner, Docker daemon, artifact
service, logs, supplied trust anchors, Git object authenticity, signatures, or
remote branch reachability. The operator-controlled local Git object database
and executable are part of its trusted computing base. The exact frozen-byte
local `pnpm verify` gate passes format, lint, every guardrail, seven-project
typechecking, all builds, and 32 test files with 789 tests. Live evidence and an
evidence note remain pending until a successful workflow artifact and
independent review exist.

## Fixed checks

The exact ordered checks are:

1. `historical_b1_b14_and_cycle_1c_preservation`
2. `pinned_python_3_12_zero_pip_worker`
3. `numeric_nonroot_dropped_capabilities_and_no_new_privileges`
4. `network_none_no_published_ports_and_no_worker_listener`
5. `read_only_root_input_mount_and_hardened_tmpfs`
6. `cpu_memory_pids_nofile_and_wall_clock_limits`
7. `bounded_input_output_empty_stderr_and_exit_zero`
8. `archive_name_duplicate_encryption_nested_count_declared_streamed_size_and_ratio_rejection`
9. `xml_dtd_entity_xinclude_depth_node_and_text_rejection`
10. `taxonomy_concept_and_plugin_allowlist`
11. `closed_canonical_result_protocol_and_duplicate_key_rejection`
12. `atomic_quarantine_without_partial_facts`
13. `exact_byte_replay`
14. `outside_worker_ed25519_signature_and_tamper_rejection`
15. `timeout_abort_failure_cleanup_and_zero_residue`
16. `source_hash_bound_live_artifact_and_offline_review`

## Fixed nonclaims

The exact ordered nonclaims are:

1. `real_public_sec_filings`
2. `counsel_approved_corpus_or_rights`
3. `ten_fact_coverage`
4. `precision_recall_or_adjudicated_quality`
5. `general_xbrl_ixbrl_taxonomy_or_plugins`
6. `external_fetch_edgar_dns_tls_ssrf_or_rate_limits`
7. `source_authenticity_or_sec_attestation`
8. `production_key_kms_hsm_custody_or_rotation`
9. `production_container_host_kernel_or_daemon_isolation`
10. `malware_or_zero_day_safety`
11. `queue_scheduler_distributed_retry_or_exactly_once`
12. `database_api_web_composition_or_b15_v15`
13. `retention_crypto_erasure_or_quarantine_operations`
14. `correction_supersession_or_lineage`
15. `load_scale_or_slo`
16. `real_data_or_production_admission`

## Consequences

Cycle 2a can close only the exact synthetic, one-shot parser-envelope claim
after local verification, a successful pinned Linux workflow, retained
success-only evidence, and independent offline review. It cannot be cited as
the Cycle 2 quality/corpus exit, general filing support, a production container
sandbox, malware safety, application composition, or permission to ingest real
data. Production admission remains blocked.

## References

- [Cycle 2a exit matrix](../CYCLE_2A_EXIT_MATRIX.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [License policy](../../LICENSE_POLICY.md)
- [Third-party notices](../../THIRD_PARTY_NOTICES.md)
