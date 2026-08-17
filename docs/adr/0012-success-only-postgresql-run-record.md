# ADR 0012: Success-only PostgreSQL acceptance run record

Status: accepted; version 7 live record retained and reviewed

Cycle 1b-b1 defines a digest-pinned PostgreSQL acceptance workflow, but a
terminal success message is not a durable, machine-readable link between the
tested checkout and the workflow run. A future successful run therefore emits
one small JSON run record only after every implemented acceptance probe has
completed successfully.

The record has an exact versioned schema. It binds the successful outcome to
the repository identity, checked-out commit, GitHub run and attempt, reviewed
PostgreSQL image-index reference, observed server and client versions, and
SHA-256 hashes of the reviewed workflow, synthetic fixture, migration manifest,
and acceptance runner. Its ordered check list is closed over the probes the
runner actually performs. A separate ordered limitations list records the
important properties the workflow does not prove.

The runner derives its output path from `RUNNER_TEMP` and uses a filename tied
to the schema version. The first retained record is
`research-cockpit-postgres-acceptance-v1.json`; version 2 adds the bounded
container-local SCRAM runtime probe; version 3 adds the authenticated runtime
authorization matrix; and version 4 adds the authenticated financial-fact
projection-query check plus the query and normalizer source hashes. Version 4
was retained and live-reviewed for its recorded B4 scope. Version 5 adds only
the authenticated test-loader fixture-load check and splits the remaining
migrator and backup session limitations; its first record is retained and
live-reviewed. Version 6 appends only the authenticated owner-DDL canary while
retaining the exact version 5 limitations and six-source-hash shape; its first
record is retained and live-reviewed. The current source producer writes
`research-cockpit-postgres-acceptance-v7.json`. Version 7 preserves exact v1
through v6 parsing, appends only the clean authenticated application-migration
check, and binds three additional v2 plan inputs. Its pinned live run and
review are retained below; source presence alone is not evidence.

The writer creates the current file with
exclusive-create semantics and restrictive local permissions, so an old or
pre-created record cannot be overwritten. The entry point validates that the
clean checked-out Git commit equals `GITHUB_SHA`, awaits the complete
acceptance suite, revalidates that boundary, and only then builds and writes a
`passed` record. Callers cannot supply an outcome, check list, limitation list,
or arbitrary output path.

The isolated workflow uploads exactly that file only when the preceding step
succeeds. The upload action is pinned to an immutable commit, missing files are
errors, wildcard paths and failure-path uploads are forbidden, and retention is
finite. The JSON allowlists GitHub run metadata; it must never contain the
container ID, environment dump, credentials, tokens, SQL, logs, tenant or row
identifiers, query results, or data counts.

This run record is audit metadata, not a signed attestation or independent
proof. The recorded OCI digest is the reviewed multi-platform image-index
digest, not a claim about the resolved platform child manifest. GitHub artifact
retention is not a compliance archive, and an artifact from an untrusted pull
request is not automatically trusted. A record is useful only when reviewed
with its linked GitHub run and immutable commit.

The first record was produced by successful run `31961988213`, attempt 1, at
commit `611c93d` and retained outside the repository. ADR 0013's offline review
returned `offline_consistent`; exact links and hashes are in the
[evidence note](../POSTGRESQL_ACCEPTANCE_EVIDENCE.md). This remains unsigned
run metadata and does not promote any limitation recorded in the artifact.

The first version 2 record was produced by successful run `31988811000`,
attempt 1, at commit `3479e164` after the bounded container-local SCRAM runtime
probe passed. Its downloaded bytes also returned `offline_consistent`; the
[Cycle 1b-b2 evidence note](../POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md) records its
exact anchors and narrower authentication claim. Version 2 remains unsigned
run metadata and explicitly preserves the unproven production, end-user,
full-authorization, pool, restore, and real-data boundaries.

The first version 3 record was produced by successful run `31991498652`,
attempt 1, at commit `664c0e5b` after the authenticated runtime authorization
matrix passed. Its downloaded bytes returned `offline_consistent`; the
[Cycle 1b-b3 evidence note](../POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md)
records its exact anchors and bounded claim. Version 3 adds exactly
`authenticated_runtime_authorization_matrix`, removes only the matching version
2 limitation, and remains unsigned run metadata. External/production and
end-user authentication, migrator/test-loader/backup sessions, pool and
concurrency behavior, restore, and real-data boundaries remain unproven.

The first version 4 record was produced by successful run `32007521395`,
attempt 1, at commit `55c61ec` after the driverless financial-fact projection
query and fail-closed normalizer path passed. Its downloaded bytes returned
`offline_consistent`; the
[Cycle 1b-b4 evidence note](../POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md) records
its exact anchors and bounded claim. Version 4 adds exactly
`authenticated_financial_fact_projection_query` and the two new source hashes,
retains every version 3 check and limitation, and adds explicit driver/pool and
complete-projection nonclaims. It remains unsigned run metadata.

The first version 5 record was produced by successful run `32012508025`,
attempt 1, at commit `04e5c1b` after the authenticated non-owner test-loader
fixture-load path passed. Its downloaded bytes returned `offline_consistent`;
the [Cycle 1b-b5 evidence note](../POSTGRESQL_TEST_LOADER_EVIDENCE.md) records
its exact anchors and bounded claim. Version 5 adds exactly
`authenticated_test_loader_fixture_load`, retains the version 4 six-source
shape and checks, and replaces only the combined future-session limitation with
separate authenticated-migrator and authenticated-backup nonclaims. It remains
unsigned run metadata and does not prove production/external authentication,
end-user binding, TLS/secrets, a driver or pool, concurrency, restore, real
data, or application integration.

The first version 6 record was produced by successful run `32058853521`,
attempt 1, at commit `7aac502` after the authenticated owner-DDL canary passed.
Its downloaded bytes returned `offline_consistent`; the
[Cycle 1b-b6 evidence note](../POSTGRESQL_OWNER_DDL_EVIDENCE.md) records its
exact anchors and bounded claim. Version 6 appends exactly
`authenticated_owner_ddl_canary` and retains every version 5 check, limitation,
and source-hash key. The canary exercises one temporary authenticated owner-role
transition and fixed DDL object after the unchanged bootstrap; it does not
execute a migration or remove `authenticated_migrator_sessions`. Its distinct
filename and artifact name prevent reinterpretation of the retained version 5
record. The later documentation commit does not retest or expand the recorded
run.

The version 7 record from successful run `32068159652`, attempt 1, at commit
`41d13dd` was retained after the bounded authenticated application-migration
phase passed. Its downloaded bytes returned `offline_consistent`; the
[Cycle 1b-b7 evidence note](../POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md)
records its exact anchors and bounded claim. Version 7 replaces only the
ordered `authenticated_migrator_sessions` limitation with narrower external/
production/incremental-migration and global platform/application atomicity
nonclaims, while retaining every other version 6 limitation. Its expanded
source bundle binds the v2 platform bootstrap, exact application manifest, and
authenticated migration renderer; the manifest in turn binds every exact
application body. The later documentation commit does not retest or expand the
recorded run. See [ADR 0019](./0019-versioned-authenticated-migration-phase.md).

## Primary sources

- [GitHub artifact upload action](https://github.com/actions/upload-artifact)
- [GitHub artifact retention documentation](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/downloading-workflow-artifacts)
- [GitHub default environment variables](https://docs.github.com/en/actions/reference/variables-reference)
