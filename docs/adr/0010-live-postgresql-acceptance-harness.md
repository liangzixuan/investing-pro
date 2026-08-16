# ADR 0010: Digest-pinned live PostgreSQL acceptance harness

Status: accepted for Cycle 1b-b1; local and remote live execution pending

Cycle 1a established a static PostgreSQL security contract, and Cycle 1b-a
froze the operation-scoped projection boundary. Neither increment executed the
migrations, roles, row-level-security policies, or logical restore against a
real PostgreSQL server. Static SQL inspection remains useful, but it cannot be
treated as database-engine evidence.

The acceptance environment is therefore a separate Ubuntu 24.04 GitHub
Actions job backed by the Docker Official Image
`postgres:17.11-bookworm`. The workflow pins the complete, human-readable tag
and the immutable OCI image-index digest recorded in
`packages/db/acceptance/postgres-image.json`. PostgreSQL 17.11 is retained
within the selected major line while incorporating the August 2026 security
and correctness update, including role-dependent plan-cache invalidation that
can affect row-level-security behavior.

The job does not publish a PostgreSQL port and does not construct a database
URL. It passes `${{ job.services.postgres.id }}` to the package runner as
`RESEARCH_COCKPIT_PG_CONTAINER_ID`. The runner must validate that opaque
identifier and invoke the service container's own `psql`; it also verifies the
container's `pg_dump` and `pg_restore` versions through `docker exec`. This
keeps the available PostgreSQL clients and server on the same pinned major and
patch release and prevents accidental dependence on runner-installed client
tools. Dump/restore behavior itself remains a later gate.

The service is deliberately an ephemeral acceptance fixture. Its bootstrap
superuser can create databases and roles, replay the reviewed migrations, and
perform dump/restore operations. Runtime, test-seed, and backup behavior is then exercised by
impersonating the migration-defined non-login roles inside that isolated
cluster. This can prove PostgreSQL's grants, `NOBYPASSRLS`, `ENABLE`/`FORCE ROW
LEVEL SECURITY`, transaction-local request context, and policy behavior under
those impersonated capabilities. It does **not** prove a production
least-privileged migrator, an authenticated external session, identity-to-role
mapping, network authentication, TLS, secret management, or pooler behavior.

No live result is claimed by this ADR. The current development machine has no
container runtime or PostgreSQL service, and the new remote workflow has not
yet run. The implemented migration, adversarial RLS, ACL, rights, and
sequential-session probes remain pending until a successful workflow run
supplies reviewable logs and the success-only run record defined by ADR 0012,
both tied to a repository commit. Cancellation, concurrent
backends, a real application pool, dump, and restore are not implemented by
this workflow and remain explicitly deferred. The acceptance command is
`pnpm --filter @research-cockpit/db acceptance:postgres:ci`; the ordinary
cross-platform release gate remains separate.

The pinned reference is a multi-architecture image-index digest. Ubuntu 24.04
currently selects its Linux/AMD64 child manifest. A future runner-architecture
change must be reviewed against the same index or accompanied by an intentional
image update. Digest pins do not absorb later PostgreSQL or Debian security
rebuilds, so image refreshes require an explicit, reviewed change to both the
declaration and workflow.

## Primary sources

- [PostgreSQL 17.11 release notes](https://www.postgresql.org/docs/17/release-17-11.html)
- [Docker Official Images PostgreSQL definition](https://github.com/docker-library/official-images/blob/master/library/postgres)
- [Docker Hub metadata for `17.11-bookworm`](https://hub.docker.com/v2/repositories/library/postgres/tags/17.11-bookworm)
- [Docker image-index and platform-digest model](https://docs.docker.com/dhi/explore/security-concepts/digests/)
- [GitHub Actions PostgreSQL service-container guidance](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)
- [GitHub Actions `job.services.<service_id>.id` context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#job-context)
