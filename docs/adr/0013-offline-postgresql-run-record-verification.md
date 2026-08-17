# ADR 0013: Offline PostgreSQL run-record verification

Status: accepted; first retained artifact reviewed successfully

ADR 0012 defines a success-only PostgreSQL acceptance run record. Its schema
parser can reject malformed fields, but parsing alone cannot establish that a
downloaded file matches a separately identified GitHub run or the source blobs
at its recorded commit. Cycle 1b-b1 therefore ends its disconnected hardening
with one offline consistency verifier.

The verifier requires independent trust anchors for the evidence-file SHA-256,
repository name and numeric ID, commit SHA, run ID, and run attempt. None of
those expected values may be inferred from the record being checked. The
evidence file must be a regular non-symlink file no larger than 32 KiB. Its
original bytes must be valid UTF-8 and exactly equal the canonical
serialization for their declared supported version. The verifier retains exact
historical v1 support and accepts the current v2 schema without mixing either
version's closed check or limitation lists. Canonical comparison rejects
byte-order marks, CRLF or alternate whitespace, trailing content, reordered
members, and duplicate JSON member names.

Source validation uses only fixed paths read as raw Git blobs from the explicit
40-character commit. It does not read source from the mutable worktree and does
not consult or trust a Git remote. The commit must exist locally as a commit
object. The local Git database and PATH-resolved Git executable must be
operator-controlled; this tool is not an untrusted-repository sandbox. The
verifier compares the workflow, synthetic fixture, migration
manifest, and acceptance-runner hashes recorded in the artifact; validates the
reviewed PostgreSQL target against the commit's image declaration; and checks
the exact ordered migration inventory and every migration-body hash.

The CLI performs no fetch, network request, archive extraction, glob expansion,
source write, or database operation. It emits a fixed-schema
`offline_consistent` result on stdout. All failures are value-free and
fail-closed. The producer also logs the exact evidence JSON byte hash after the
file has been created, allowing an operator to supply that value separately
when reviewing a downloaded artifact.

`offline_consistent` is deliberately narrower than “database verified.” The
verifier cannot establish GitHub run or artifact authenticity, inspect workflow
logs, prove PostgreSQL execution, validate commit signatures or branch
reachability, or prove the provenance of the operator-supplied anchors. A hash
copied from the same compromised run is not an independent trust source. Review
the GitHub run, event, actor, logs, commit, and artifact together before changing
any engine-dependent exit row.

The retained artifact from run `31961988213`, attempt 1, at commit `611c93d`
returned `offline_consistent` against independently supplied metadata and the
producer-log byte hash. The [evidence note](../POSTGRESQL_ACCEPTANCE_EVIDENCE.md)
records the exact anchors and limitations. This completes the first remote-run
consistency milestone.

The version 2 artifact from run `31988811000`, attempt 1, at commit `3479e164`
also returned `offline_consistent`; see the
[Cycle 1b-b2 evidence note](../POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md). That run
adds one bounded, container-local authenticated runtime service account only.
External/production and end-user authentication, the full authenticated
authorization matrix, migrator/test-loader/backup sessions, restore, pool, and
adapter work remain separate gated work.
