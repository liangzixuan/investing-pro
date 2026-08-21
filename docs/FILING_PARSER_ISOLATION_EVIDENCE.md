# Filing parser isolation evidence

This note records the retained, independently reviewed evidence for the exact
Cycle 2a claim
`bounded_synthetic_one_shot_filing_parser_isolation_quarantine_replay_and_provenance_binding`.
It is not a general filing-parser, production sandbox, malware-safety, source-
authenticity, application-composition, or real-data admission result.

## Verdict

**GO for the bounded synthetic Cycle 2a claim only.** Exact commit
`73e391e339bf42332d7082adaba00807facc233c` passed the frozen local gate, the
dedicated Linux acceptance, the exact-commit offline review, retained-artifact
custody review, and Ubuntu/Windows regression CI. The canonical record contains
103 synthetic outcomes: three accepted two-fact cases and 100 atomic
quarantines. Broader Cycle 2 and production admission remain blocked.

## Remote anchors

| Anchor               | Exact value                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository           | `liangzixuan/investing-pro`                                                                                                                                 |
| Commit               | [`73e391e339bf42332d7082adaba00807facc233c`](https://github.com/liangzixuan/investing-pro/commit/73e391e339bf42332d7082adaba00807facc233c)                  |
| Parser workflow run  | [`32431896953`](https://github.com/liangzixuan/investing-pro/actions/runs/32431896953), attempt `1`, success                                                |
| Parser job           | [`96625046704`](https://github.com/liangzixuan/investing-pro/actions/runs/32431896953/job/96625046704), `One-shot parser isolation (Ubuntu 24.04)`, success |
| Source/corpus step   | Step 7, success, `2026-08-21T00:14:59Z`–`00:15:09Z`                                                                                                         |
| Live acceptance step | Step 8, success, `2026-08-21T00:15:09Z`–`00:16:21Z`                                                                                                         |
| Offline review step  | Step 9, success, `2026-08-21T00:16:21Z`–`00:16:22Z`                                                                                                         |
| Artifact upload step | Step 10, success, `2026-08-21T00:16:22Z`–`00:16:23Z`                                                                                                        |
| Artifact             | [`9429394295`](https://github.com/liangzixuan/investing-pro/actions/runs/32431896953/artifacts/9429394295)                                                  |
| Artifact name        | `filing-parser-isolation-evidence-v1-73e391e339bf42332d7082adaba00807facc233c-1`                                                                            |
| Artifact size/digest | `20,991` bytes; `sha256:13b4c133741ce68804d724ce98082b4fa23764b30fe36900b4fbcbfc5fc50c9e`                                                                   |
| Artifact lifecycle   | Created/updated `2026-08-21T00:16:23Z`; expires `2026-09-20T00:16:22Z`; `expired=false` when reviewed                                                       |
| Regression CI        | [`32431896954`](https://github.com/liangzixuan/investing-pro/actions/runs/32431896954), attempt `1`, success                                                |
| Ubuntu CI job        | `96625046890`, success                                                                                                                                      |
| Windows CI job       | `96625046731`, success                                                                                                                                      |

The CI run is regression health for the same commit. The dedicated Linux parser
run and its success-only artifact are the live Cycle 2a evidence.

## Retained custody

The authenticated artifact and log bytes, extracted canonical JSON, and
locally generated offline verdict were retained outside the repository under
`research-cockpit-evidence/cycle2a-run-32431896953-attempt-1`.

| Retained object             |  Bytes | SHA-256                                                            |
| --------------------------- | -----: | ------------------------------------------------------------------ |
| Artifact ZIP                | 20,991 | `13b4c133741ce68804d724ce98082b4fa23764b30fe36900b4fbcbfc5fc50c9e` |
| Sole canonical JSON entry   | 84,550 | `3c2bb747f02cfcd3aba7c0cf3937f5aab8e0509c052f5e4897bf36151243774b` |
| Independent offline verdict |    277 | `7ccc0001f2bca577b99adbad8a6d9c926b40302fc5b0fa3fb52e46f5f7b3e220` |
| Authenticated log ZIP       | 24,204 | `eff8889c4121dfca28121098b39701ef1844a4dfe026563f301ec6078ac49c1e` |
| Extracted aggregate job log | 33,710 | `eccd709833602eaad443aad4e015c6650c495eed623c51cd6c855915c64ceef0` |
| Step 8 acceptance log       |  1,335 | `2c52d9d610266566f117abefa666b1b4abc69c940ff7836e24b1b294d12961cb` |
| Step 9 review log           |  2,507 | `014e9eb3310cc1c84691256ee68235e26ed194570f7ea25c8a3bb720d77a820d` |
| Step 10 upload log          |  2,627 | `7dd1b24bdc3d86dc0e114e413c37dca10e464fcdd4f460c67e9f6ce9183d97c2` |

The ZIP contains exactly one entry,
`research-cockpit-filing-parser-isolation-v1.json`. Its entry bytes are
byte-identical to the retained JSON. Canonical parse and reserialization are
exact. Artifact expiry is not permanent retention; this custody copy is the
retained review input.

## Canonical record

The record is schema `1.0.0`, evidence version `1`, `status: passed`, and
`synthetic: true`. It binds repository, revision, run `32431896953`, attempt
`1`, and timestamps `2026-08-21T00:15:09.581Z` through
`2026-08-21T00:16:21.613Z`. Its summary is exactly 103 cases, three accepted,
100 quarantined, with exact-byte replay passed. Every expected status equals
the observed status; accepted cases contain exactly two facts, quarantines
contain zero facts, IDs are unique, provenance verification and tamper
rejection are true, and the two replay cases match.

The recorded tools are Docker client `28.0.4`, Docker Engine `28.0.4`, Git
`2.55.0`, Node `v24.19.0`, pnpm `11.19.0`, and Python `3.12.13`.

The image/runtime anchors are:

- base index digest
  `sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2`;
- Linux/amd64 child manifest
  `sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af`;
- exact built image ID
  `sha256:2228906994f9793fc0b444a82e17c659286d4b9002b55248cf1d9228c045b6b1`;
- numeric user `65532:65532`, `--network none`, no published ports,
  read-only root and input, all capabilities dropped, no-new-privileges,
  isolated IPC, and zero retained container residue;
- `/tmp:rw,noexec,nosuid,nodev,size=8388608`, 0.5 CPU, 134,217,728 bytes
  memory with no additional swap, 32 PIDs, 64 open files, and a 5,000 ms
  worker wall-clock bound.

## Exact source chain

Independent review read all 26 blobs from the exact Git commit, not the
worktree, and matched them to the record:

| Source path                                                          | Recorded SHA-256                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                                           | `sha256:f879640b68e03386872525ea0d831670cc03f4e6a482de98aef31b5aa6ee6d27` |
| `.github/workflows/filing-parser-acceptance.yml`                     | `sha256:170459997c7b4220bde64d235742060586dacb7a9417c794210be866a8b12317` |
| `fixtures/synthetic/filing-parser/v1/cases.json`                     | `sha256:05e05a0865f5b5f74f08e91b326f5a316f1b5e0235dd55c463eb827d78389d0c` |
| `fixtures/synthetic/filing-parser/v1/manifest.json`                  | `sha256:bdfe0b89e96eb091ea494825ad4bfdad7216bb98f7ce174ce5b6ef84df100a0a` |
| `package.json`                                                       | `sha256:d7d2dc7291686ed375c8e28468ef7f96bf24115023ceb54d796eb75e0a283d4d` |
| `packages/filing-parser/acceptance/python-image.json`                | `sha256:3c89a16768a4dcac237c0ce5bab75fbdbda35084c4088daeb86cbdc705b9327a` |
| `packages/filing-parser/package.json`                                | `sha256:dcc4afc9acdac8d2ef28024cdfb064a8ce2fbbf1269671ead7146c97ee4592bf` |
| `packages/filing-parser/src/filing-parser-evidence-review.ts`        | `sha256:bb7d01f3e029a4acc9a6de9520c551c79ee5e27913ba534cd458d5bfa305f4b5` |
| `packages/filing-parser/src/filing-parser-evidence-verifier.test.ts` | `sha256:1048b751796cd36a9eee8404d979b7332b137ac6659ab71672f3504dda59939e` |
| `packages/filing-parser/src/filing-parser-evidence-verifier.ts`      | `sha256:e292478c7a991254a5826ce29eb57f38c8a574dc151a3b62a25caaf6e0424d15` |
| `packages/filing-parser/src/filing-parser-evidence.test.ts`          | `sha256:e9072ad248ec18d2f0d6d17be5289f5daa5f831ac18fa6be5aab7080dbb02a52` |
| `packages/filing-parser/src/filing-parser-evidence.ts`               | `sha256:dbb0e336adaaa9471f186ee801a9eaf873bd04a5b49477872aacbf64376c794d` |
| `packages/filing-parser/src/index.ts`                                | `sha256:6b84957120a5ca7ee54a6552a85204150c2f662b8f73c4379095e624053285c8` |
| `packages/filing-parser/src/parser-security.test.ts`                 | `sha256:a980de1f48a504b609b26855c112e1510a79427f67e6a25fdc6227f469fec9c8` |
| `packages/filing-parser/src/parser-boundary.test.ts`                 | `sha256:7d02857ac4a758c048a228e68f19f46fe8b5c1d2ff50f0f892bbc73a1b50b2c4` |
| `packages/filing-parser/src/parser-boundary.ts`                      | `sha256:b64fcc0baa0f3b4eb03d3f60c27672e25f9773c9cab522fda3eb73485cce4856` |
| `packages/filing-parser/src/run-filing-parser-acceptance.ts`         | `sha256:d5412f7f744d51211dc54a96dea9a71cef31a250335f228b477703a60dcb147e` |
| `packages/filing-parser/src/run-filing-parser-evidence-review.ts`    | `sha256:af1449e56de6c0c511e0f33b3bfbf06e8d3abda2fd7263ad7b19d2250fcc3b5b` |
| `packages/filing-parser/src/test-archive-builder.ts`                 | `sha256:688e4281ee801f42f381daf82fa828c6f49cd4fe99bda1726d3c20c2199f686d` |
| `packages/filing-parser/tsconfig.json`                               | `sha256:397a6b82d7c3400cc7deafe48c439aa9840b06d8da417da978af95f5539b33a8` |
| `packages/filing-parser/worker/Dockerfile`                           | `sha256:2f50135778787401c223eb6a2bf2ce133d43126f0dfc9b5b5dbf99479ab193a0` |
| `packages/filing-parser/worker/parser.py`                            | `sha256:7c4796b43da755970439e0f5e982f98fc0b9e207a8b1a325100c0fc975025b40` |
| `packages/filing-parser/worker/taxonomy-v1.json`                     | `sha256:d46b603088cc0f415fa8a01a296d649e8917751ffe7ad7fe2dc9d91967ae0691` |
| `pnpm-lock.yaml`                                                     | `sha256:f27a5722e879e1124b8884330b152cbf1645ae7ce48e46163a8ea5cf36364056` |
| `scripts/verify-boundaries.ts`                                       | `sha256:742726531f606b7290be87dc4b5be92370457412901fabbc14f9b0b1e19f4a46` |
| `scripts/verify-filing-parser-fixtures.ts`                           | `sha256:6a6d7c3411bf36bf43330580c29ed251b1379e808a5b458e78a548bb4b1a51b0` |

The fixture manifest binds the 103-case ledger plus the exact image config,
archive builder, Dockerfile, worker, and taxonomy bytes. PostgreSQL V1 through
V14 and Cycle 1c remain separate and unchanged.

## Exact checks

The record contains the exact ordered checks:

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

## Exact nonclaims

The record retains the exact ordered nonclaims:

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

## Authenticated log review

The acceptance marker at `2026-08-21T00:16:21.6429897Z` records 103 cases and
the exact canonical JSON SHA-256. The offline marker at
`2026-08-21T00:16:22.2897633Z` records `offline_consistent`, the same evidence
digest, exact revision/run/attempt, and `sourceHashCount: 26`. The upload log
binds artifact ID `9429394295`, 20,991 uploaded bytes, and the exact artifact
digest. The aggregate authenticated log contains zero `##[error]`,
`##[warning]`, bounded acceptance diagnostic, or acceptance-failure markers.

## Review boundary

`offline_consistent` establishes internal consistency between the retained
canonical record, supplied run anchors, exact local Git blobs, fixture chain,
image configuration, and frozen historical PostgreSQL hashes. It does not
authenticate GitHub, the runner, Docker daemon or kernel, the artifact service,
logs, supplied anchors, Git object signatures, or remote branch reachability.
The remote run, job, artifact, and log anchors were separately compared with
authenticated API and log custody. Runner, daemon, and kernel trust; Git object
authenticity and signatures; supplied-anchor authenticity; and remote branch
reachability remain unproved.

The result does not authorize public uploads, external EDGAR fetching, real
filings, a production signing key, a production container host, general
XBRL/iXBRL, malware claims, queues, retention/erasure operations, correction
lineage, application or database composition, B15/V15, load/SLO claims, or
production admission. Broader Cycle 2 remains open.

See [ADR 0028](./adr/0028-bounded-synthetic-filing-parser-isolation.md), the
[Cycle 2a exit matrix](./CYCLE_2A_EXIT_MATRIX.md), the
[threat model](./THREAT_MODEL.md), and the [build roadmap](./BUILD_ROADMAP.md).
