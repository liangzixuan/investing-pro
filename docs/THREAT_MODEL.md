# Sprint 0 through bounded live Cycle 1b-b11 threat model

## Current trust boundaries

The browser accepts dossier JSON only from the local Fastify API. The API reads only source-controlled synthetic fixtures and remains GET-only. Browser thesis and alert state remains local. There is no authentication, customer tenant data, live database, file upload, external fetch, email, broker, payment, model, or filing-parser boundary in the running profile.

Cycle 1a adds an isolated synthetic authorization harness and PostgreSQL
migration contract. The contract now has a reviewed clean-only acceptance execution,
but neither database component is imported by the API or web application.
Synthetic actor context is test-controlled and trusted; it does not establish
identity.

Cycle 1b-a adds a disconnected operation-scoped projection contract. It has no
database implementation. The complete synthetic fixture port is explicitly not
a database adapter seam.

Cycle 1b-a2 adds a disconnected PostgreSQL-row normalizer for dimensionless
synthetic financial facts. It accepts no connection or SQL capability and is
not imported by either running app.

Cycle 1b-b1 adds a disconnected, clean-only PostgreSQL acceptance harness and a
digest-pinned Ubuntu service workflow. Its first reviewed run passed at
`611c93d`. The live checks bootstrap through the ephemeral container superuser and impersonate
the migration-defined `NOLOGIN` capabilities, so they do not establish
production authentication, identity binding, network security, or migrator
separation. `set_request_context` still accepts trusted synthetic IDs and must
not be treated as an identity resolver.

After all implemented probes pass, the acceptance entry point creates one
exact-schema, success-only run record and the workflow may upload exactly that
file. Exclusive creation and success-only upload reduce stale or false-green
records; exact source hashes bind the record to reviewed inputs. The record is
unsigned metadata, not independent provenance. It intentionally excludes
secrets, raw environment values, SQL/logs, data identities, and counts. Pull
request artifacts and expired/deleted artifacts remain an external trust and
retention boundary.

The first retained record, run links, hashes, and explicit limitations are
listed in the [Cycle 1b-b1 evidence note](./POSTGRESQL_ACCEPTANCE_EVIDENCE.md).

Cycle 1b-b2 proves one narrower boundary in reviewed run `31988811000`: an
ephemeral PostgreSQL runtime service account authenticated with a run-local
SCRAM password over loopback TCP inside the same isolated service container,
then explicitly assumed only the existing `NOLOGIN` runtime capability. The
service published no host port. The run covered wrong-password rejection,
direct pre-`SET ROLE` denial, cross-capability role denial, exact membership
options, missing-context zero visibility, one alpha-versus-beta tenant read,
transaction cleanup, and a representative runtime write denial. Exact anchors
and limitations are in the
[Cycle 1b-b2 evidence note](./POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md). The broader
b1 query-shape, rights, and prepared-read probes are not reclassified as
authenticated-session evidence.

Cycle 1b-b3 closes that precise bounded evidence gap in reviewed PostgreSQL run
`31991498652` at commit `664c0e5b`. While the b2 ephemeral login and passfile
were active, the harness repeated the reviewed alpha/beta visibility, inactive
and non-current membership, direct/join/subquery isolation, operation-rights,
and alternating prepared-read assertions through transaction-local selection
of the runtime capability. The b1 administrator-impersonation path remained
intact. The downloaded version 3 record returned `offline_consistent` against
separately supplied anchors. See the
[Cycle 1b-b3 evidence note](./POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[exit matrix](./CYCLE_1BB3_EXIT_MATRIX.md), and
[ADR 0015](./adr/0015-authenticated-runtime-authorization-matrix.md).

Cycle 1b-b4 then exercised the narrow driverless financial-fact projection
query through that authenticated service account and passed the untrusted
JSON-lines rows through the fail-closed normalizer. The reviewed PostgreSQL run
`32007521395` at commit `55c61ec` retained an offline-consistent version 4
record. Exact scope and limitations are in the
[Cycle 1b-b4 evidence note](./POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[exit matrix](./CYCLE_1BB4_EXIT_MATRIX.md), and
[ADR 0016](./adr/0016-driverless-projection-query-and-semantic-unit-mapping.md).
This does not add an application driver, pool, composition root, complete
projection, write path, or real data.

Cycle 1b-b5 source now replaces only the fixture-load authentication boundary.
It preserves the reviewed fixture and migrations, extracts the validated
direct-insert body, and runs it through one ephemeral container-local SCRAM
login with an exact set-only edge to the existing synthetic test-seed
capability. The source includes wrong-password, pre-role, escalation,
full-fixture rollback, synthetic-only RLS, mutation/ledger/DDL denial,
role-reset, and zero-residue probes. That exact path passed in reviewed
PostgreSQL run `32012508025` at commit `04e5c1b`; the retained version 5 record
returned `offline_consistent`. See the
[B5 evidence note](./POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[ADR 0017](./adr/0017-authenticated-test-loader-fixture-load.md), and the
[Cycle 1b-b5 exit matrix](./CYCLE_1BB5_EXIT_MATRIX.md).

Cycle 1b-b6 adds a separate preparatory owner-DDL canary after the
unchanged bootstrap and test-loader cleanup. One ephemeral container-local
SCRAM login has no direct application privilege and may select only the
existing owner capability through an exact set-only edge. The reviewed run
covered wrong-password rejection; pre-role denial; the reviewed forbidden role
and session-authorization transitions; transaction-local owner identity;
injected DDL rollback; one committed canary with exact owner and ACL;
authenticated removal; ledger immutability; role reset; and zero login,
membership, backend, passfile, and object residue before catalog checks and
evidence. That path passed in PostgreSQL run `32058853521` at commit `7aac502`;
the retained version 6 record returned `offline_consistent`. See the
[B6 evidence note](./POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[ADR 0018](./adr/0018-authenticated-owner-ddl-canary.md), and the
[Cycle 1b-b6 exit matrix](./CYCLE_1BB6_EXIT_MATRIX.md).

The temporary owner edge is a high-authority acceptance boundary despite the
login's otherwise weak attributes. Mandatory cleanup and a fixed canary object
limit the exercised path, but they do not make the login a least-privileged
migrator or authorize any production owner membership.

Cycle 1b-b7 introduces a separate v2 plan as the sole current migration
authority for B7. After inherited b1 through b6 regressions, an exact
maintenance-database reset removes the disposable target and four
dependency-free capability roles before proving a pristine namespace. A local
container-superuser platform transaction then creates the roles, owner-owned
schemas, database/schema/public ACL lockdown, and hardened `btree_gist`.
Only the separately committed application phase uses an ephemeral,
connection-limited, non-superuser SCRAM login with one set-only owner edge.
Rollback/replay, identity, ledger attribution, object ownership, passfile,
backend, membership, login, and login-owned-object residue are fail-closed
gates before V7 evidence. That bounded path passed in PostgreSQL run
`32068159652` at commit `41d13dd`; the retained version 7 record returned
`offline_consistent`. See the
[B7 evidence note](./POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md),
[ADR 0019](./adr/0019-versioned-authenticated-migration-phase.md), and the
[Cycle 1b-b7 exit matrix](./CYCLE_1BB7_EXIT_MATRIX.md).

Cycle 1b-b8 adds one ephemeral container-local
SCRAM login with one exact set-only edge to the existing `NOBYPASSRLS` backup
capability. The pinned `pg_dump` retains row security and creates a custom,
column-insert, data-only archive containing exactly the 21 reviewed synthetic
application data tables, not the migration ledger or any schema/global object.
Its restore phase creates a second database from `template0` in the same
cluster, independently establishes the reviewed platform and exact v2
application plan, then uses a different ephemeral SCRAM login with one exact
set-only test-seed edge to perform a single-transaction data restore. The
archive file, privileged target provisioning, restore login, and temporary
database are new acceptance-only trust boundaries. Their source contracts,
negative probes, and cleanup orchestration passed 409 tests across the 10
database test files plus database typechecking, the migration and static
PostgreSQL guardrails, ESLint, Prettier, and the diff check. The bounded live
path then passed in PostgreSQL run `32076642878` at commit `49d3a96`; its
retained version 8 record returned `offline_consistent`. See the
[B8 evidence note](./POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md),
[ADR 0020](./adr/0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md)
and the [Cycle 1b-b8 exit matrix](./CYCLE_1BB8_EXIT_MATRIX.md).

Cycle 1b-b9 adds one real-driver boundary without connecting it to the
running application. A non-owning adapter receives one exclusively leased,
already-connected client and a separately injected trusted synthetic actor. It
snapshots actor and query data before I/O, resets transaction state, executes
one read-only transaction with transaction-local runtime role/context, feeds
only the reviewed B4 result shape to the fail-closed normalizer, rolls back
failures, poisons after unsafe reset or rollback failure, and rejects overlap
before SQL. The workflow exposes one random port bound only to runner loopback
for the real-client probe. All 450 database tests and local source gates passed.
The bounded live path then passed in PostgreSQL run `32083732063` at commit
`8e470e9`; its retained version 9 record returned `offline_consistent`. See the
[B9 evidence note](./POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md),
[ADR 0021](./adr/0021-single-client-read-only-postgresql-projection-adapter.md),
and the [Cycle 1b-b9 exit matrix](./CYCLE_1BB9_EXIT_MATRIX.md).

Cycle 1b-b10 has a live-reviewed bounded-pool result, still disconnected from
the running application. `PooledPostgresFinancialFactProjectionSource` owns one
explicitly transferred real `pg.Pool` limited to two clients; the caller may not
call `connect()`, query or release a client, call `end()`, or otherwise inspect
or use the pool during source ownership. Only read-only counters may be checked
after `source.close()` completes. It snapshots the complete query and trusted
synthetic actor before checkout, cleans each session,
reimplements the exact B9 read-only role/context/B4-query transaction, and
recycles only an unambiguously successful checkout after postflight reset.
Finite pool acquisition and PostgreSQL `statement_timeout` bound waiting;
adapter failure, timeout, failed transaction, or cleanup ambiguity destroys the
checkout. An active abort marks cancellation, waits for the in-flight
PostgreSQL operation to settle under the fixed server timeout, and only then
destroys the checkout. A queued abort cannot promptly cancel `pg-pool.connect()`;
it remains bounded by acquisition and destroys any late checkout. Source and
local verification pass all 12 database test files and 485 tests, database
typechecking, migration and PostgreSQL static guardrails, focused
ESLint/Prettier, and the diff check; independent integrated review reports GO
with no P0/P1 finding. The bounded path passed in PostgreSQL run `32161137775`
at commit `2dcb259`; its retained version 10 record returned
`offline_consistent`. See the
[B10 evidence note](./POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md),
[ADR 0022](./adr/0022-bounded-postgresql-projection-pool-lifecycle.md), and the
[Cycle 1b-b10 exit matrix](./CYCLE_1BB10_EXIT_MATRIX.md).

The reviewed live reset probe stays outside that ownership boundary. A separate
administrative connection may observe only same-PID idle state, canonical
application name, session user, and advisory-lock absence, then the source must
perform a subsequent actor-isolated load and the timeout/application-name
probes. Custom-GUC and prepared-statement cleanup are source/unit/static
`DISCARD ALL` evidence, not direct live pool inspection.

The queue probe also avoids inspecting the owned pool: fixed `max: 2`, two
admin-observed blocked PIDs, and a stable timeout from the third source load are
the complete live acquisition-bound evidence.

Cycle 1b-b11 source adds a separate high-authority migration boundary without
connecting it to either running application. One non-owning deployer snapshots
the closed v2 plan, accepts only an exclusively leased authenticated client,
and selects the reviewed owner capability only inside a finite-timeout
read-write transaction. The shared advisory lock precedes the exact ledger
table lock; ledger shape and an exact non-empty manifest prefix are validated
before pending reviewed bodies and matching rows may run. Drift is value-free,
injected failure must roll back body and ledger effects together, and any
ambiguous rollback, commit, or role-reset state poisons the deployer. The
acceptance-only `v2-0005` reconstruction is a bounded disposable-target setup,
not a downgrade or production recovery interface. Integrated local verification
and the bounded live V11 execution, cleanup, artifact, and independent review
are complete. PostgreSQL run `32183709701` passed at commit `5df9d07`; its
retained record returned `offline_consistent`.

These database logins and injected actors are not user identities. The runtime service still chooses
the synthetic principal and organization passed to `set_request_context`, so a
compromised service account could choose another synthetic context unless a
future verified identity resolver prevents it. B2 therefore does not establish
end-user binding, production BOLA protection, external/TLS transport, secret
management, an application pool, or deployed persistence. B11 narrows only one
exact container-local v2 suffix; external or production incremental
migrator credentials, arbitrary-manifest or multi-release upgrades, production
orchestration/recovery/cancellation/failover, and global platform/application
atomicity remain deferred. External/production/incremental/continuous backup
and full-scope restore also remain deferred. The
reviewed B8 result is strictly narrower than that broad production gate. The B5
test-loader result establishes only one sequential, synthetic, container-local
acceptance-only session, not a production loader or identity boundary. The
reviewed B6 canary does not execute a migration, redesign role bootstrap, or
close `authenticated_migrator_sessions`. B7 targets only the exact
container-local clean application migration after a separately committed
platform phase; external/production/incremental migration and global
cross-phase atomicity remain explicit nonclaims.
The reviewed B9 adapter narrows only the prior “no driver” gap; it does not
verify who supplied the synthetic actor and does not establish pool
reset, simultaneous backends, cancellation, timeout, TLS, secret-management, or
application-composition behavior.

The reviewed B10 result narrows only the bounded lifecycle mechanism. It proves
clean checkout/reuse, two simultaneous tenant-isolated backends, bounded
acquisition, settlement-before-discard active abort, server-timeout recovery,
destructive failure discard, idempotent close, and zero observed residue for
one runner-local pool. B10 never claims graceful PostgreSQL CancelRequest,
prompt queued abort, reuse of a canceled backend, production tuning, load
capacity, retries, failover, identity resolution, or application composition.

The B11 live result remains limited to its bounded exact-v2 proof. It does not
establish external or production credentials,
arbitrary manifests, general incremental or multi-release migration, online
application/schema compatibility, concurrent application writes, crash
recovery, cancellation, retry/failover, distributed coordination, or global
platform/application atomicity.

The offline record verifier accepts only a small regular non-symlink file,
requires independent repository/run/hash anchors, and compares canonical bytes
with fixed source blobs read from the explicit local Git commit. It never
consults a remote or mutable worktree and emits only `offline_consistent`.
Malicious or mistaken trust anchors, forged GitHub runs/artifacts, compromised
workflow logs, unsigned/unreachable commits, and a dishonest database execution
remain outside that result and require operator review.
The operator-controlled local Git database and PATH-resolved Git executable are
part of this verifier's trusted computing base; the CLI is not a sandbox for an
untrusted repository.

Assets at risk are source integrity, fixture provenance, rights-policy behavior, browser-local thesis text, and the guarantee that restricted fixture data does not leave the server projection.

## Implemented controls

- Server-side allow/deny checks run before API serialization; denial paths have tests.
- The API exposes GET only, permits CORS only from the two local web origins, disables caching, emits trace IDs, and applies security headers.
- The web app applies a CSP, denies framing, disables unused browser permissions, has no third-party scripts/fonts/assets, and renders evidence as React text rather than HTML.
- Fixture excerpts have SHA-256 hashes, a provenance manifest, and a gate that rejects missing, stale, or mismatched records.
- Clean-room and dependency gates reject competitor references, unapproved collectors, copied raster assets, and forbidden packages in application source.
- Clean-room scanning now covers SQL, future database/config directories, Dockerfiles, and Compose files. It rejects external database file/network import primitives and paths outside the project boundary.
- Context-bound repository ports remove per-operation tenant arguments. The in-memory unit of work serializes and rolls back transactions, applies a fail-closed owner/researcher/viewer matrix, and returns defensive copies.
- Idempotency records are principal/organization/operation scoped,
  request-hashed, and expire after 24 hours. Audit events are allowlisted
  metadata with a 90-day retention deadline; that deadline is not yet a
  production purge guarantee. Thesis and alert deletes remove payload content
  while retaining only a tenant- and resource-type-scoped ID marker to prevent
  same-type delete/recreate ABA.
- PostgreSQL migrations have ordered SHA-256 checksums and static guards for synthetic-only constraints, fixed numeric values, exact rights-policy versions, tenant composite keys, forced RLS, transaction-local context, public privilege revocation, and read-only runtime grants.
- Operation-scoped projections bind candidates to one instrument and exact
  rights-policy version, validate returned scope and temporal cutoffs in core,
  take policy evaluation time from an injected trusted provider, expose no
  denied row IDs, accept no caller-complete/count state, and force an unknown
  public omission count for every incomplete or RLS-unknown view.
- The PostgreSQL wire boundary accepts only exact plain data rows, keeps
  listing and security identities separate, validates lossless timestamps,
  fixed decimals, intervals, cutoffs, units, and exact policy/grant echoes, and
  rejects an entire malformed batch with a value-free error. It cannot accept
  completeness or count input.
- The B9 adapter source accepts no host, port, URL, password, environment,
  client factory, pool, logger, retry, timeout, cancellation, or arbitrary SQL
  seam. It requires one exclusively leased client, captures a trusted actor
  provider once, snapshots every call before awaiting, resets transaction state,
  uses one unnamed parameterized B4 query inside one read-only transaction,
  normalizes before commit, and emits one stable value-free error.
- The B11 deployer accepts no connection configuration, credential, pool,
  client factory, arbitrary manifest, logger, retry, cancellation, or shutdown
  seam. It snapshots the exact reviewed plan before I/O, uses fixed local
  timeouts and lock ordering, validates the ledger object and exact manifest
  prefix, applies a pending suffix and its ledger rows atomically, fails drift
  through one stable value-free error, and poisons ambiguous client state.
- The b3 acceptance source preserves the bounded b2 authentication controls and
  reuses the reviewed b1 tenant/rights assertions through the authenticated
  runtime session. It retains per-transaction `SET LOCAL ROLE`, sequential
  prepared-read isolation, and mandatory login/passfile/backend cleanup. The
  exact bounded matrix passed in the reviewed b3 workflow run; this is not a
  pool or concurrent-backend result.
- Exact dependency pins, a lockfile, a single allowed install script, an allowlisted production-license gate, dependency review, and two-OS CI reduce supply-chain drift.
- The evidence dialog traps/restores focus; chart values have a semantic table; reduced-motion and high-contrast preferences are respected.

## Non-production constraints

Local storage and the in-memory authorization harness are not encrypted and have no production identity boundary. Users are explicitly told not to enter sensitive information. The demo must not be exposed as a public service, connected to real data, or used for investment decisions.

The reviewed clean-only b1 run proves PostgreSQL syntax and only the exact
catalog, RLS, authorization, transaction-context, and failure probes listed in
its run record. It did not prove authenticated sessions. The reviewed b2 run
adds only one container-local SCRAM runtime service account and its explicitly
bounded probes. B3's broader authenticated tenant/rights/prepared-read matrix
passed only in the reviewed, sequential, container-local b3 run. None of these
results proves an authenticated end user, external or production
authentication, connection pooling, concurrent backends, cancellation,
dump/restore, disaster recovery, or production identity. An emulator is not a
substitute for those later gates, and `offline_consistent` alone is not engine
evidence without separate review of the GitHub run and logs. B2 does not
retroactively expand the historical b1 result, and b3 does not promote b1's
additional null/malformed/unsupported-context cases.

The reviewed B8 run adds only one authenticated, policy-scoped dump of
synthetic application rows and bounded restore into an independently
provisioned database in the same cluster. It does not establish an end-user,
external, production, or application trust boundary. Full-schema/global or
cross-cluster/version restore, untrusted
archive handling, external/production/incremental/continuous backup, storage
encryption or retention, backup deletion, disaster recovery, and RPO/RTO remain
release blockers outside B8.

The reviewed B9 run proves only that one real Node driver client reached the
ephemeral PostgreSQL service and passed the exact SCRAM/backend/read-only/
context/rollback/cleanup probes recorded for version 9. The trusted actor can
still be chosen by a compromised service, and the random loopback mapping is
only an acceptance-runner path, not production network security. Pool reset,
simultaneous backends, cancellation settlement, and timeout handling later
passed only the separate bounded B10 live gate; that result does not widen B9.
B11's reviewed V11 result covers the exact locked-ledger,
checksum-drift-refusal, once-only suffix, rollback, cleanup, and two-deployer
boundary. It is not a general or production migration system. See the
[B11 evidence note](./POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md).

## Gates before adding new trust boundaries

1. **Authentication or customer tenant data:** building on b1's bounded real-PostgreSQL run and the live-verified container-local b2/b3 service-account boundaries, prove end-user identity/role mapping, BOLA isolation, pooled context cleanup, external TLS, production secret handling, retention, export/delete, DSAR, backup deletion, and restore before adding verified OIDC/JWT identity. A database service login or synthetic context is never accepted as end-user authentication evidence.
2. **Filing ingestion:** run one-shot non-root parser workers with no unnecessary egress, read-only filesystems, CPU/memory/time limits, archive/XML bomb defenses, allowlisted taxonomy/plugins, quarantine, replay, and signed provenance.
3. **External URLs or files:** add SSRF allowlists, DNS/IP revalidation, MIME and size checks, sandboxed parsing, malware scanning, and stored-XSS sanitization.
4. **Licensed vendor data:** require executed field/channel/purpose/retention/derived-use/AI rights, executable policy versions, deletion tests, and unit economics before connection.
5. **Alerts:** use at-least-once processing, deterministic dedupe keys, idempotent internal state, provider receipts, duplicate SLOs, and correction notices.
6. **AI:** keep it outside deterministic calculations; require a rights-safe evidence ledger, prompt-injection isolation, numeric-claim evaluation, cost limits, and unsupported-claim fail-closed behavior.

These are release blockers, not optional backlog items.
