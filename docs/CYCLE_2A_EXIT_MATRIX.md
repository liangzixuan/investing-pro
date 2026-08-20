# Cycle 2a exit matrix

Scope: one disconnected, one-shot, synthetic ZIP/XML filing-parser envelope in
a new locked-down Linux container per nonempty host-size-eligible worker call,
with atomic quarantine, exact-byte
replay, outside-worker ephemeral Ed25519 provenance, and a separate
source-bound evidence domain. The design is recorded in
[ADR 0028](./adr/0028-bounded-synthetic-filing-parser-isolation.md).

Current status: **Source implementation and the exact frozen-byte local
`pnpm verify` gate pass. The dedicated Linux live run, retained artifact,
offline review, and Cycle 2a exit are pending.** This work does not create
B15/V15, alter PostgreSQL V1 through V14, compose the parser into an
application, or admit real data.

| Gate                       | Evidence required                                                                                                                                                                                                         | Current status                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Historical preservation    | PostgreSQL V1 through V14 workflow/evidence bytes and Cycle 1c claims remain unchanged; Cycle 2a uses a separate evidence schema/artifact                                                                                 | Local Pass; commit-bound live artifact pending                                                                                        |
| Closed synthetic corpus    | Source-controlled manifest/case inventory is explicitly synthetic, contains exactly 103 reviewed cases (three accepted two-fact cases and 100 quarantines), and is hash-bound without raw values in evidence              | Local Pass; dedicated Linux run pending                                                                                               |
| Pinned zero-install worker | Python 3.12.13 slim-bookworm index and Linux/amd64 child digests, exact Dockerfile, no pip/install step, fixed parser/taxonomy sources                                                                                    | Local source/guard Pass; image license inventory unproved                                                                             |
| Process isolation          | Numeric non-root user, all capabilities dropped, no-new-privileges, network none, no ports/listener, read-only root/input, hardened tmpfs, IPC none                                                                       | Local source/test Pass; dedicated Linux run pending                                                                                   |
| Resource bounds            | Exact input/entry/expanded-size/ratio, stdout/stderr, CPU, memory/swap, PIDs, nofile, control and worker wall-clock limits                                                                                                | Local source/test Pass; dedicated Linux run pending                                                                                   |
| Archive defense            | Exact entry names/count; duplicate/case collision, encryption, nesting, path/type, local/central metadata, declared/streamed size, aggregate expansion, and ratio rejection                                               | Local adversarial tests Pass; live run pending                                                                                        |
| XML defense                | DTD/entity/XInclude/extra processing instruction/comment/CDATA, depth, node, attribute, text, syntax, namespace and value rejection                                                                                       | Local adversarial tests Pass; live run pending                                                                                        |
| Closed taxonomy/protocol   | Fixed taxonomy/concept/unit allowlist; exact canonical one-line output; duplicate/extra/malformed keys and nonempty stderr fail closed                                                                                    | Local adversarial tests Pass; live run pending                                                                                        |
| Atomic quarantine          | Every rejected archive returns one allowlisted code with zero facts and no raw/rejected values in diagnostics or evidence                                                                                                 | Local adversarial tests Pass; live run pending                                                                                        |
| Replay and provenance      | Exact-byte accepted replay with the same ephemeral signer yields the same normalized result, signing payload, and full signed record; exact built image ID is signed; outside-worker Ed25519 verifies and tampering fails | Local source/test Pass; dedicated Linux run pending                                                                                   |
| Cleanup                    | Success, timeout, abort, create/start/output/signature failure remove staging input/container and prove zero exact residue                                                                                                | Local adversarial tests Pass; live run pending                                                                                        |
| Evidence schema            | Success-only canonical filing-parser evidence v1 binds commit/run/attempt, tools, image/build, cases, source hashes, manifest, checks and nonclaims                                                                       | Local schema/reviewer tests Pass; no live artifact yet                                                                                |
| Offline review             | Independent repository/commit/run/attempt/evidence-digest anchors; exact Git blobs and manifest chain; sole success verdict `offline_consistent`                                                                          | Source-stage; retained artifact/review pending                                                                                        |
| Local integration          | Format, lint, guardrails, typechecks, package/workspace tests and builds pass on frozen bytes                                                                                                                             | Pass — 32 files / 789 tests: contracts 1/5; research-state 1/48; filing-parser 4/40; research-core 2/62; web 2/3; API 4/49; DB 18/582 |
| Dedicated Linux CI         | Pinned workflow builds and runs the exact image; failure retains no candidate; success uploads one canonical artifact                                                                                                     | Pending                                                                                                                               |
| Production admission       | Wider corpus/rights/quality, external fetch, source authenticity, production keys/container host, malware, queues, composition, retention, lineage, load and real data are separately proved                              | Blocked; explicitly outside Cycle 2a                                                                                                  |

## Bounded claim and nonclaims

The sole bounded claim proposed for exit is
`bounded_synthetic_one_shot_filing_parser_isolation_quarantine_replay_and_provenance_binding`.

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

## Exit rule

Cycle 2a exits only when the full local gate and exact dedicated Linux run pass
on frozen bytes, the success-only canonical artifact is retained, its API/run/
job/artifact/log anchors are independently checked, and the offline reviewer
returns `offline_consistent` against the exact commit and evidence digest. A
failed or canceled run produces no candidate artifact and cannot promote these
source-stage statements.

Offline consistency does not authenticate GitHub, artifact/log custody,
supplied anchors, Git object signatures, or remote branch reachability; those
remain independent review duties.

Even after that bounded exit, Cycle 2 remains open. The result will not prove a
counsel-approved or representative filing corpus, ten facts, quality metrics,
general XBRL/iXBRL, production isolation/keys/operations, application or
database composition, malware safety, external fetching, or real-data
admission. It remains separate from B15/V15 and production remains blocked.
