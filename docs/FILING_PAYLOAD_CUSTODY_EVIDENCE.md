# Filing payload custody evidence

This note records the retained, independently reviewed evidence for the exact
Cycle 2c claim
`bounded_synthetic_filing_payload_integrity_custody_and_logical_key_unavailability`.
It is not a real-filing, external corpus-admission, production KMS/storage,
cryptographic-erasure, application-composition, or production-admission result.

## Verdict

**GO for the bounded synthetic Cycle 2c claim only.** Exact commit
`ef22c7bc10596840b8ff686b9190730956fab0c4` passed the frozen local gate,
Ubuntu/Windows regression CI, dedicated Linux custody acceptance, exact-commit
offline review, and retained-artifact/log custody review. Cycle 2b remains
Blocked on external metadata, approvals, chronology, and human key-authority
review. Production admission remains Blocked.

The final successor-compatible local `pnpm verify` gate passed format, lint,
every guardrail including 86 production-license checks, all project typechecks
and builds, and 39 test files with 848 passed tests plus 2 POSIX-only Windows
skips (850 total cases; filing-parser: 64 passed). The post-live custody
reviewer accepts only the exact legacy 32-path or evidence-note successor
33-path shape; the evidence schema, checks, nonclaims, and 29-source set stay
unchanged. This later local compatibility result does not replace or widen the
canonical live evidence at
`ef22c7bc10596840b8ff686b9190730956fab0c4`.

## Remote anchors

| Anchor                   | Exact value                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository               | `liangzixuan/investing-pro`                                                                                                                                        |
| Commit                   | [`ef22c7bc10596840b8ff686b9190730956fab0c4`](https://github.com/liangzixuan/investing-pro/commit/ef22c7bc10596840b8ff686b9190730956fab0c4)                         |
| Custody workflow run     | [`32463955421`](https://github.com/liangzixuan/investing-pro/actions/runs/32463955421), attempt `1`, success                                                       |
| Custody job              | [`96716507074`](https://github.com/liangzixuan/investing-pro/actions/runs/32463955421/job/96716507074), `Synthetic filing payload custody (Ubuntu 24.04)`, success |
| Source/fixture step      | Step 6, success, `2026-08-21T08:36:46Z`–`08:36:53Z`                                                                                                                |
| Live acceptance step     | Step 7, success, `2026-08-21T08:36:53Z`–`08:36:55Z`                                                                                                                |
| Offline review step      | Step 8, success, `2026-08-21T08:36:55Z`                                                                                                                            |
| Artifact upload step     | Step 9, success, `2026-08-21T08:36:55Z`–`08:36:56Z`                                                                                                                |
| Artifact                 | [`9439965468`](https://github.com/liangzixuan/investing-pro/actions/runs/32463955421/artifacts/9439965468)                                                         |
| Artifact name            | `filing-payload-custody-evidence-v1-ef22c7bc10596840b8ff686b9190730956fab0c4-1`                                                                                    |
| Artifact size/digest     | `3,471` bytes; `sha256:d9b30efd8c647201df6336ea53195ce504c8dc4c4d3109c7ab6051c867ebb72b`                                                                           |
| Artifact lifecycle       | Created/updated `2026-08-21T08:36:56Z`; expires `2026-09-20T08:36:56Z`; `expired=false` when reviewed                                                              |
| Regression CI            | [`32463955370`](https://github.com/liangzixuan/investing-pro/actions/runs/32463955370), attempt `1`, success                                                       |
| Ubuntu CI job            | [`96716506990`](https://github.com/liangzixuan/investing-pro/actions/runs/32463955370/job/96716506990), success; release gate `2026-08-21T08:36:57Z`–`08:38:43Z`   |
| Windows CI job           | [`96716506716`](https://github.com/liangzixuan/investing-pro/actions/runs/32463955370/job/96716506716), success; release gate `2026-08-21T08:37:46Z`–`08:43:06Z`   |
| Parser regression health | [`32463955351`](https://github.com/liangzixuan/investing-pro/actions/runs/32463955351), attempt `1`, success; health-only for unchanged Cycle 2a evidence          |

The CI run is regression health for the same source commit. The dedicated
Linux custody run and its success-only artifact are the live Cycle 2c evidence.
The parser run is regression health only; it does not replace or widen the
canonical Cycle 2a evidence at commit
`73e391e339bf42332d7082adaba00807facc233c`.

## Retained custody

The authenticated artifact and log bytes plus the extracted canonical JSON
were retained outside the repository under
`research-cockpit-evidence/cycle2c-run-32463955421-attempt-1`.
The exact retained names are
`filing-payload-custody-evidence-v1-ef22c7bc10596840b8ff686b9190730956fab0c4-1.zip`,
`artifact-extracted/research-cockpit-filing-payload-custody-v1.json`, and
`job-96716507074-authenticated-raw.log`.

| Retained object           |  Bytes | SHA-256                                                            |
| ------------------------- | -----: | ------------------------------------------------------------------ |
| Artifact ZIP              |  3,471 | `d9b30efd8c647201df6336ea53195ce504c8dc4c4d3109c7ab6051c867ebb72b` |
| Sole canonical JSON entry |  7,860 | `48dc5cebc460e165cdf71530200a206165617502fced7f56dfa4232484a5e70e` |
| Authenticated raw job log | 27,798 | `1e82f56509395f699ad385ec1a7e1fc5d8c1e22f3cc7f026bb2dd6ee05ca112e` |

The ZIP contains exactly one entry,
`research-cockpit-filing-payload-custody-v1.json`. Its entry bytes are
byte-identical to the retained extracted JSON. Canonical parse and
reserialization are exact. Artifact expiry is not permanent retention; this
custody copy is the retained review input.

The independent reviewer was re-executed against the retained JSON and exact
commit and returned these values:

```json
{
  "evidenceSha256": "sha256:48dc5cebc460e165cdf71530200a206165617502fced7f56dfa4232484a5e70e",
  "repository": "liangzixuan/investing-pro",
  "revision": "ef22c7bc10596840b8ff686b9190730956fab0c4",
  "runAttempt": 1,
  "runId": "32463955421",
  "sourceHashCount": 29,
  "verdict": "offline_consistent"
}
```

This locally reproduced result was not retained as an authenticated remote
object; the authenticated job log independently contains the same verdict.

## Canonical record

The record is schema `1.0.0`, evidence version `1`, `status: passed`, and
`synthetic: true`. It binds repository, revision, run `32463955421`, attempt
`1`, `push`, `refs/heads/main`, and timestamps
`2026-08-21T08:36:54.346Z` through `2026-08-21T08:36:55.038Z`. Its recorded
tools are Git `2.55.0`, Node `v24.19.0`, and pnpm `11.19.0`.

The bounded Linux/x64 runtime record binds AES-256-GCM, a 32-byte key, 12-byte
nonce, 16-byte authentication tag, 1,048,576-byte maximum payload, and
86,400,000 ms retention. The one generated payload is 4,096 bytes with content
SHA-256
`sha256:19befbe96017f31d5bf5f723fc8e5bee21210049706dfb65e3a0f77e1c6297df`.
Its source binding is the fixture-manifest SHA-256
`sha256:9aa7025758ec552b7994497414b6fe8918baf92608dea8c9ab3fe2e35a39b2ab`.
The record reports exact replay, distinct ciphertext, early-expiry rejection,
pre-expiry authenticated read, post-expiry denial, logical key unavailability,
bounded canary absence, value-free aggregate audit, terminal no-resurrection,
and zero residue as true. Creation is
`2026-08-21T08:36:54.509Z`; expiry and transition are both
`2026-08-22T08:36:54.509Z`.

The injected entropy provider remains an out-of-band trusted CSPRNG TCB. This
run observes Node `crypto.randomBytes` use and distinct DEK-fingerprint and
nonce-hash samples only. Source validates shape and length; neither source nor
the evidence establishes randomness, uniqueness in general, or OS entropy
quality.

## Exact source chain

Independent review read all 29 blobs from the exact Git commit, not the
worktree, and matched them to the record:

| Source path                                                                            | Recorded SHA-256                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                                                             | `sha256:f879640b68e03386872525ea0d831670cc03f4e6a482de98aef31b5aa6ee6d27` |
| `.github/workflows/filing-parser-acceptance.yml`                                       | `sha256:170459997c7b4220bde64d235742060586dacb7a9417c794210be866a8b12317` |
| `.github/workflows/filing-payload-custody-acceptance.yml`                              | `sha256:ad3dde53471817ae3384db1550b2e9be2998d00989148e4bb9f29dc59fa33ae5` |
| `fixtures/synthetic/filing-payload-custody/v1/cases.json`                              | `sha256:390dcb67ab32bdb7fbd11acadb5e0729949a36435b0e617909b7ef1985e0cf6d` |
| `fixtures/synthetic/filing-payload-custody/v1/manifest.json`                           | `sha256:9aa7025758ec552b7994497414b6fe8918baf92608dea8c9ab3fe2e35a39b2ab` |
| `package.json`                                                                         | `sha256:26d76bc49cb433511688b7914af4a665defeee1177c7ef30ebdce32e424b68f3` |
| `packages/filing-parser/src/filing-parser-evidence-verifier.test.ts`                   | `sha256:7f47c3124bc609aa55415ab60fb6bb5fe4fe1089e0987b868b6e5a1441cbc48f` |
| `packages/filing-parser/src/filing-parser-evidence-verifier.ts`                        | `sha256:240101b89e2f1461bc1b77748649ee7612be2d9f51f33b43f23e177791c1e72f` |
| `packages/filing-parser/src/filing-parser-evidence.ts`                                 | `sha256:dbb0e336adaaa9471f186ee801a9eaf873bd04a5b49477872aacbf64376c794d` |
| `packages/filing-payload-custody/package.json`                                         | `sha256:1eeec37309b7b3762270658af122c38f09474716847155232fc722e0de680be6` |
| `packages/filing-payload-custody/src/filing-payload-custody-evidence-review.test.ts`   | `sha256:1b87af1fb4b9d66eb31387690a788018fb07eacd736f7584017de1c97cde41ad` |
| `packages/filing-payload-custody/src/filing-payload-custody-evidence-review.ts`        | `sha256:184bae7d09b44ff524477a30450ae800872b8e11289d81a886961506831a321a` |
| `packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts` | `sha256:f894787205f548f012af59ea27fa09cdb7919235ad5f64f096a3da4b2ddb0f27` |
| `packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts`      | `sha256:89620eebcdafe2970a567cbb20016ba14d8a319eba2ad1115a8c38b86a597c22` |
| `packages/filing-payload-custody/src/filing-payload-custody-evidence.test.ts`          | `sha256:815116ab2d0c8c46559b975e202223e5ebb9a827e64b87c82672e2a83e23f08b` |
| `packages/filing-payload-custody/src/filing-payload-custody-evidence.ts`               | `sha256:e2fec6d05662c162215ff5844effe931e0609ef3652e08e82b456da598767c0d` |
| `packages/filing-payload-custody/src/index.ts`                                         | `sha256:ce30644345dec5792029b1aed00030c4f76375cfc5bb7216d8ce48b684f1a2d3` |
| `packages/filing-payload-custody/src/payload-custody-security.test.ts`                 | `sha256:2de5ae1a2f655b9752c2e7d9200c3e63253107a24ae12918ae9c882174a61754` |
| `packages/filing-payload-custody/src/payload-custody.test.ts`                          | `sha256:3dfb4f4d99ea1e0e21e5eabcbb5224f7390bf3c919bc4757e11487b14fbba3b8` |
| `packages/filing-payload-custody/src/payload-custody.ts`                               | `sha256:2b9aaa8441201e76f79da7044246017314a4c9f6862b950825236dbf18660771` |
| `packages/filing-payload-custody/src/run-filing-payload-custody-acceptance.ts`         | `sha256:3daa2753f091e0178a7502a084515361210c40e7296b01f2fbe49597c93557ca` |
| `packages/filing-payload-custody/src/run-filing-payload-custody-evidence-review.ts`    | `sha256:60cd16a354445bf50985e637421b6165532d98b93292ace56ccf5ab164c49b32` |
| `packages/filing-payload-custody/src/test-payload-builder.ts`                          | `sha256:7e05e1ba609f5d899c7824a4e1fd692de26ffbcb15515b710c84e71df4e85c4c` |
| `packages/filing-payload-custody/tsconfig.json`                                        | `sha256:397a6b82d7c3400cc7deafe48c439aa9840b06d8da417da978af95f5539b33a8` |
| `pnpm-lock.yaml`                                                                       | `sha256:2afd4190560c540d630801f40a9ae2b9ce801d857e6370d98d57fcfcef279820` |
| `pnpm-workspace.yaml`                                                                  | `sha256:935e9668cdf1c24899db895fd110a45651508a6e66462efc7861897aa1fe9b6f` |
| `scripts/verify-boundaries.ts`                                                         | `sha256:9047fb64cbc1c72bb3896a652b33c929c8e474c6929afd4bd4f31b902da82dc3` |
| `scripts/verify-filing-payload-custody-fixtures.ts`                                    | `sha256:0d4ce429a6ba2616dfac5acf023117187dcb5dd40e1080a7ccd07aa65de28574` |
| `tsconfig.base.json`                                                                   | `sha256:eb7e959fa75fece92cd4d014e948de43f82b56cae3a7e08101ca6f256cac1ffe` |

The fixture manifest itself is
`sha256:9aa7025758ec552b7994497414b6fe8918baf92608dea8c9ab3fe2e35a39b2ab`.
It binds the one-case ledger at
`sha256:390dcb67ab32bdb7fbd11acadb5e0729949a36435b0e617909b7ef1985e0cf6d`
and four exact implementation/test blobs: security test
`sha256:2de5ae1a2f655b9752c2e7d9200c3e63253107a24ae12918ae9c882174a61754`,
unit test
`sha256:3dfb4f4d99ea1e0e21e5eabcbb5224f7390bf3c919bc4757e11487b14fbba3b8`,
core source
`sha256:2b9aaa8441201e76f79da7044246017314a4c9f6862b950825236dbf18660771`,
and synthetic builder
`sha256:7e05e1ba609f5d899c7824a4e1fd692de26ffbcb15515b710c84e71df4e85c4c`.

The reviewer requires baseline
`ba97f43c10f7472151d4cd073c93904f04b1fdcf` to be an ancestor of the reviewed
commit. The exact cumulative baseline-to-commit path set contains 32 authorized
added or modified paths. `packages/filing-parser/src/parser-boundary.test.ts`
is the sole newly allowed successor compatibility path; it is intentionally
outside the 29-source custody runtime set, is regression-test health only, and
does not enter or widen the Cycle 2c record. The canonical Cycle 2a evidence
schema, checks, nonclaims, 26-source set, artifact semantics, and claim remain
unchanged.

## Exact checks

The record contains the exact ordered checks:

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

The record retains the exact ordered nonclaims:

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

## Authenticated log review

The acceptance marker at `2026-08-21T08:36:55.0410598Z` records the exact
canonical JSON SHA-256. The offline marker at
`2026-08-21T08:36:55.8489361Z` records `offline_consistent`, the same evidence
digest, exact revision/run/attempt, and `sourceHashCount: 29`. The upload log at
`2026-08-21T08:36:56.2848830Z` binds the exact artifact digest; finalization at
`2026-08-21T08:36:56.5256797Z` binds artifact ID `9439965468`, and the final
upload marker records 3,471 bytes. The authenticated raw log contains zero
`##[error]`, `##[warning]`, failure, diagnostic, or acceptance-failure markers.

## Review boundary

`offline_consistent` establishes internal consistency between the retained
canonical record, supplied run anchors, exact local Git blobs, the fixture
chain, exact checks/nonclaims, and cumulative authorized path set. It does not
authenticate GitHub, the runner, artifact service, operating system, filesystem,
Node runtime, entropy source, supplied anchors, Git object signatures, or remote
branch reachability. Remote run/job/artifact metadata and authenticated log
custody were compared separately.

The result establishes logical key unavailability only inside the exact bounded
one-process synthetic lifecycle. It does not establish cryptographic erasure,
physical-media overwrite, memory zeroization, production KMS/HSM custody,
backup/replica/cache/temp/log deletion, legal retention or DSAR execution,
multi-host or crash durability, real-payload presence or provenance, EDGAR
fetch/malware controls, parser quality, adjudicated ground truth, the broader
100-filing/2,000-assertion Cycle 2 exit, database/API/web/queue composition,
B15/V15, real-data admission, or production readiness. Broader Cycle 2 and
production admission remain open and Blocked.

See [ADR 0030](./adr/0030-bounded-synthetic-filing-payload-custody.md), the
[Cycle 2c exit matrix](./CYCLE_2C_EXIT_MATRIX.md), the
[threat model](./THREAT_MODEL.md), the [canonical model](./CANONICAL_MODEL.md),
the [license policy](../LICENSE_POLICY.md), and the
[build roadmap](./BUILD_ROADMAP.md).
