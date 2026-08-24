# Cycle 2a exit matrix

Scope: one disconnected, one-shot, synthetic ZIP/XML filing-parser envelope in
a new locked-down Linux container per nonempty host-size-eligible worker call,
with atomic quarantine, exact-byte
replay, outside-worker ephemeral Ed25519 provenance, and a separate
source-bound evidence domain. The design is recorded in
[ADR 0028](./adr/0028-bounded-synthetic-filing-parser-isolation.md).

Current status: **the exact frozen-byte local `pnpm verify` gate, dedicated
Linux run, retained success-only artifact, authenticated log review, and
independent offline review remain historical green facts. The prior bounded
owned-byte security conclusion is Superseded.** Archive snapshotting and
injected signer/process-runner byte outputs used caller-observable metadata or
allocation paths before Cycle 2h hostile-carrier coverage.
Current intrinsic-backing, actual-length, and owned-copy hardening is
implemented, and its exact final working-tree local gate is Pass. The source
commit, two-OS CI, parser live acceptance, and custody live acceptance remain
Pending. Broader Cycle 2 and
production admission remain blocked. This work does not create B15/V15, alter
PostgreSQL V1 through V14, compose the parser into an application, or admit real
data. Immutable historical anchors remain in the
[Cycle 2a evidence note](./FILING_PARSER_ISOLATION_EVIDENCE.md); the current
status overlay is specified by the
[Cycle 2h exit matrix](./CYCLE_2H_EXIT_MATRIX.md).

Every Pass entry below records the historical exact-source result. None attests
the current hardened source bytes or revives the Superseded conclusion.

| Gate                       | Evidence required                                                                                                                                                                                                         | Current status                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Historical preservation    | PostgreSQL V1 through V14 workflow/evidence bytes and Cycle 1c claims remain unchanged; Cycle 2a uses a separate evidence schema/artifact                                                                                 | Pass; all 26 exact-commit source hashes independently reviewed                                                                        |
| Closed synthetic corpus    | Source-controlled manifest/case inventory is explicitly synthetic, contains exactly 103 reviewed cases (three accepted two-fact cases and 100 quarantines), and is hash-bound without raw values in evidence              | Pass; 103/103 live outcomes match the reviewed synthetic inventory                                                                    |
| Pinned zero-install worker | Python 3.12.13 slim-bookworm index and Linux/amd64 child digests, exact Dockerfile, no pip/install step, fixed parser/taxonomy sources                                                                                    | Pass for exact pinned source/image; complete image license inventory unproved                                                         |
| Process isolation          | Numeric non-root user, all capabilities dropped, no-new-privileges, network none, no ports/listener, read-only root/input, hardened tmpfs, IPC none                                                                       | Pass in exact Ubuntu/Docker live run; host/kernel/daemon security remains unproved                                                    |
| Resource bounds            | Exact input/entry/expanded-size/ratio, stdout/stderr, CPU, memory/swap, PIDs, nofile, control and worker wall-clock limits                                                                                                | Pass in exact bounded live run                                                                                                        |
| Archive defense            | Exact entry names/count; duplicate/case collision, encryption, nesting, path/type, local/central metadata, declared/streamed size, aggregate expansion, and ratio rejection                                               | Pass across exact adversarial local/live case inventory                                                                               |
| XML defense                | DTD/entity/XInclude/extra processing instruction/comment/CDATA, depth, node, attribute, text, syntax, namespace and value rejection                                                                                       | Pass across exact adversarial local/live case inventory                                                                               |
| Closed taxonomy/protocol   | Fixed taxonomy/concept/unit allowlist; exact canonical one-line output; duplicate/extra/malformed keys and nonempty stderr fail closed                                                                                    | Pass across exact closed local/live protocol                                                                                          |
| Atomic quarantine          | Every rejected archive returns one allowlisted code with zero facts and no raw/rejected values in diagnostics or evidence                                                                                                 | Pass; 100 live quarantines matched with zero facts                                                                                    |
| Replay and provenance      | Exact-byte accepted replay with the same ephemeral signer yields the same normalized result, signing payload, and full signed record; exact built image ID is signed; outside-worker Ed25519 verifies and tampering fails | Pass with ephemeral test key; source authenticity and production key custody unproved                                                 |
| Cleanup                    | Success, timeout, abort, create/start/output/signature failure remove staging input/container and prove zero exact residue                                                                                                | Pass for exact tested paths and live fixed-label aggregate                                                                            |
| Evidence schema            | Success-only canonical filing-parser evidence v1 binds commit/run/attempt, tools, image/build, cases, source hashes, manifest, checks and nonclaims                                                                       | Pass; retained canonical artifact has 16 checks and 16 nonclaims                                                                      |
| Offline review             | Independent repository/commit/run/attempt/evidence-digest anchors; exact Git blobs and manifest chain; sole success verdict `offline_consistent`                                                                          | Pass; independent review matched 26/26 source hashes and fixture/image chain                                                          |
| Local integration          | Format, lint, guardrails, typechecks, package/workspace tests and builds pass on frozen bytes                                                                                                                             | Pass — 32 files / 792 tests: contracts 1/5; research-state 1/48; filing-parser 4/43; research-core 2/62; web 2/3; API 4/49; DB 18/582 |
| Dedicated Linux CI         | Pinned workflow builds and runs the exact image; failure retains no candidate; success uploads one canonical artifact                                                                                                     | Pass — run `32431896953`, job `96625046704`, attempt 1, artifact `9429394295`                                                         |
| Production admission       | Wider corpus/rights/quality, external fetch, source authenticity, production keys/container host, malware, queues, composition, retention, lineage, load and real data are separately proved                              | Blocked; explicitly outside Cycle 2a                                                                                                  |

## Bounded claim and nonclaims

The sole bounded claim historically accepted at exit was
`bounded_synthetic_one_shot_filing_parser_isolation_quarantine_replay_and_provenance_binding`.
Its bounded owned-byte security conclusion is now Superseded pending Cycle 2h
promotion.

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

Cycle 2a exited when the full local gate and exact dedicated Linux run passed
on frozen bytes, the success-only canonical artifact is retained, its API/run/
job/artifact/log anchors are independently checked, and the offline reviewer
returns `offline_consistent` against the exact commit and evidence digest. A
failed or canceled run still produces no candidate artifact and cannot
promote source-stage statements.

Offline consistency does not authenticate GitHub, artifact/log custody,
supplied anchors, Git object signatures, or remote branch reachability; those
remain independent review duties.

Even after that bounded exit, Cycle 2 remains open. The result will not prove a
counsel-approved or representative filing corpus, ten facts, quality metrics,
general XBRL/iXBRL, production isolation/keys/operations, application or
database composition, malware safety, external fetching, or real-data
admission. It remains separate from B15/V15 and production remains blocked.

Cycle 2h is a source-only successor that hardens the parser archive, injected
signer signature output, and stdout/stderr from every injected process-runner
result. It uses intrinsic typed-array backing, length, and element-type reads,
requires the intrinsic `Uint8Array` element type and exact prototype, applies
intrinsic `ArrayBuffer` brand plus exact-prototype validation, and enforces preallocation role
limits, ordinary allocation, and intrinsic `set.call`. Signatures must have
exactly 64 actual bytes and the create/start/remove/residue runner streams must
fit the requesting process limits before allocation. Oversized exact archive carriers are hashed
synchronously without an owned copy so the existing signed
`archive_limit_exceeded` quarantine is preserved. The canonical Cycle 2a
schema, artifact, evidence note, 16 checks, 16 nonclaims, and 26-source set do
not change. See the [Cycle 2h exit matrix](./CYCLE_2H_EXIT_MATRIX.md).
