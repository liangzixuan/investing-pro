# ADR 0013: Offline PostgreSQL run-record verification

Status: accepted; verifier source implemented, first artifact review pending

ADR 0012 defines a success-only PostgreSQL acceptance run record. Its schema
parser can reject malformed fields, but parsing alone cannot establish that a
downloaded file matches a separately identified GitHub run or the source blobs
at its recorded commit. Cycle 1b-b1 therefore ends its disconnected hardening
with one offline consistency verifier.

The verifier requires independent trust anchors for the evidence-file SHA-256,
repository name and numeric ID, commit SHA, run ID, and run attempt. None of
those expected values may be inferred from the record being checked. The
evidence file must be a regular non-symlink file no larger than 32 KiB. Its
original bytes must be valid UTF-8 and exactly equal the canonical v1
serialization. This rejects byte-order marks, CRLF or alternate whitespace,
trailing content, reordered members, and duplicate JSON member names.

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

No live result is claimed by this decision. The current checkout still has no
approved Git remote or local container/PostgreSQL runtime, so the first remote
run and first offline artifact review remain pending. This is the final local
database-evidence scaffolding increment; migrator, authenticated-session,
restore, pool, and adapter work remain gated on a successful real run.
