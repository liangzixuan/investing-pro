# ADR 0012: Success-only PostgreSQL acceptance run record

Status: accepted; first live record produced and retained

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
`research-cockpit-postgres-acceptance-v1.json`; the current producer writes
`research-cockpit-postgres-acceptance-v2.json`. Version 2 adds the bounded
container-local SCRAM runtime probe and explicitly records the authenticated
authorization and identity boundaries it does not prove. The parser retains
exact historical v1 support. The writer creates the current file with
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

## Primary sources

- [GitHub artifact upload action](https://github.com/actions/upload-artifact)
- [GitHub artifact retention documentation](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/downloading-workflow-artifacts)
- [GitHub default environment variables](https://docs.github.com/en/actions/reference/variables-reference)
