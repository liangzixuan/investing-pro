# ADR 0013: Offline PostgreSQL run-record verification

Status: accepted; retained version 7 artifact reviewed successfully

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
historical v1 through v6 support and accepts the current v7 schema without
mixing any version's closed check, limitation, or source-hash lists. Retained
version 6 and version 7 artifacts have been reviewed. Canonical comparison
rejects byte-order marks, CRLF or alternate whitespace, trailing content,
reordered members, and duplicate JSON member names.

Source validation uses only fixed paths read as raw Git blobs from the explicit
40-character commit. It does not read source from the mutable worktree and does
not consult or trust a Git remote. The commit must exist locally as a commit
object. The local Git database and PATH-resolved Git executable must be
operator-controlled; this tool is not an untrusted-repository sandbox. The
verifier compares the workflow, synthetic fixture, migration manifest,
acceptance runner, and version-specific projection-query and normalizer hashes
recorded in the artifact; validates the reviewed PostgreSQL target against the
commit's image declaration; and checks the exact ordered migration inventory
and every migration-body hash.

For version 7 only, the reviewer also requires the fixed v2 platform plan,
application manifest, authenticated renderer, and the exact manifest-listed
application bodies from the anchored commit. It rejects missing, extra,
non-regular, or mixed-version v2 tree entries and validates each body against
the closed manifest. Versions 1 through 6 retain their historical source
shapes and do not acquire these inputs retroactively.

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

The version 3 artifact from run `31991498652`, attempt 1, at commit `664c0e5b`
also returned `offline_consistent`; see the
[Cycle 1b-b3 evidence note](../POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md).
That reviewed run adds the exact shared synthetic tenant-isolation,
operation-rights, and one-backend prepared matrix through the service account.
External/production and end-user authentication,
migrator/test-loader/backup sessions, restore, pool/concurrency, and adapter
work remain separate gated work. `offline_consistent` still does not prove the
database execution without separate review of the run and logs.

The version 4 artifact from run `32007521395`, attempt 1, at commit `55c61ec`
also returned `offline_consistent`; see the
[Cycle 1b-b4 evidence note](../POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md). That
reviewed run adds the exact authenticated driverless financial-fact
query-to-normalizer path. It does not prove an application driver or pool,
complete or dimensioned projections, external/end-user identity, concurrency,
restore, or real data. `offline_consistent` remains a source/record consistency
result, not database-execution proof without the separately reviewed run and
logs.

The version 5 artifact from run `32012508025`, attempt 1, at commit `04e5c1b`
also returned `offline_consistent`; see the
[Cycle 1b-b5 evidence note](../POSTGRESQL_TEST_LOADER_EVIDENCE.md). That
reviewed run adds the exact authenticated non-owner synthetic fixture-load
path, including its negative, rollback, cleanup, and zero-residue probes. It
does not prove production/external authentication, end-user binding, TLS or
secret operations, an authenticated migrator or backup, a driver/pool or
concurrency, restore, real data, application integration, or production
readiness. `offline_consistent` remains a source/record consistency result, not
database-execution proof without the separately reviewed run and logs.

The version 6 artifact from run `32058853521`, attempt 1, at commit `7aac502`
also returned `offline_consistent`; see the
[Cycle 1b-b6 evidence note](../POSTGRESQL_OWNER_DDL_EVIDENCE.md). The verifier
accepted the same six-source bundle as versions 4 and 5 and required the exact
appended `authenticated_owner_ddl_canary` check with every version 5 limitation
unchanged. It does not infer that the canary is a migration and cannot remove
`authenticated_migrator_sessions`. Historical version 5 bytes and semantics
remain frozen. The later documentation commit does not retest or expand the
recorded run, and `offline_consistent` retains every verifier limitation above.

The version 7 artifact from run `32068159652`, attempt 1, at commit `41d13dd`
returned `offline_consistent`; see the
[Cycle 1b-b7 evidence note](../POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md).
The reviewer accepted the exact nine-source bundle, including the V2 platform
bootstrap, application manifest and bodies, and authenticated renderer. It
required the exact appended
`authenticated_clean_application_migrations_after_platform_bootstrap` check and
the ordered V7 limitation replacement while preserving every other version 6
limitation. Historical v1 through v6 bytes and meanings remain frozen. The
later documentation commit does not retest or expand the recorded run.

That `offline_consistent` result proves only record/source consistency; it
cannot authenticate GitHub or independently establish that the platform and
authenticated application phases executed. See
[ADR 0019](./0019-versioned-authenticated-migration-phase.md) for the bounded
claim and explicit nonclaims.
