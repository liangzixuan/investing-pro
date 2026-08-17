# Research Cockpit

An evidence-first investment research workspace being built from the audited product plan. `Research Cockpit` is an internal working name and is not trademark-cleared.

## Current slice

Sprint 0 is a zero-infrastructure demo that proves:

- a synthetic company dossier with “as known on” fact supersession and
  separately named public-knowledge/database-recorded intervals (the current
  demo still uses one cutoff for both axes);
- server-side rights filtering and explicit omissions;
- an evidence passport for every displayed number;
- deterministic valuation scenarios;
- browser-local, non-sensitive thesis and alert state; and
- an original responsive interface with semantic chart alternatives.

It uses **only deterministic synthetic data**. It does not call market-data providers, SEC, Investing.com, news sites, LLMs, brokers, payment services, or external notification providers.

Cycle 1a also includes a disconnected synthetic tenant/authorization module and
a statically checked PostgreSQL migration contract. They are development proof
artifacts only: the running API remains GET-only, browser state remains local,
and no database or identity provider is connected.

Cycle 1b-a moves history, timeline, and evidence membership into
instrument-scoped snapshots and freezes a separate operation-scoped port for a
future RLS reader. That port cannot claim complete coverage or disclose hidden
row counts. It is still disconnected; the current app continues to use only
the closed SYN1 fixture.

Cycle 1b-a2 adds a pure, fail-closed normalizer for the narrow synthetic,
dimensionless financial-fact row shape a future PostgreSQL reader must emit.
It separates listing and security identity, preserves decimals and timestamps
without rounding or precision loss, and rejects an entire ambiguous batch. It
does not add the query, driver, pool, or app wiring.

Cycle 1b-b1 adds an executable, clean-database PostgreSQL acceptance harness
for a separate Ubuntu CI job. It atomically renders the seven reviewed
migrations and ledger records, loads only source-controlled synthetic fixtures,
and probes impersonated capability-role/RLS semantics against one exact
PostgreSQL 17.11 image digest. A green run writes and uploads a
success-only, exact-schema record bound to the commit, GitHub run, reviewed
inputs, observed versions, completed checks, and explicit limitations. The
first reviewed run passed at commit `611c93d`; its retained run record is linked
in [the Cycle 1b-b1 evidence note](./docs/POSTGRESQL_ACCEPTANCE_EVIDENCE.md).
The harness remains disconnected from the app and is not deployed persistence.

The final local Cycle 1b-b1 review gate verifies a downloaded run record against
independently supplied repository/run/hash anchors and fixed source blobs read
from its exact Git commit. Its only success verdict is `offline_consistent`;
it cannot authenticate GitHub, inspect logs, or independently prove PostgreSQL
executed. The first retained artifact produced that verdict after the linked run
and logs were reviewed separately.

Cycle 1b-b2 proves one additional, bounded PostgreSQL contract. At commit
`3479e164`, an ephemeral runtime service account authenticated with SCRAM over
loopback TCP inside the isolated service container, then explicitly assumed
only the existing read-only runtime capability. The reviewed run and retained
version 2 record are linked in the
[Cycle 1b-b2 evidence note](./docs/POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md). This did
not add an application driver or pool, expose a database port, authenticate an
end user, or prove external TLS, production secrets,
migrator/test-loader/backup authentication, restore, or deployment readiness.
The distinct-migrator boundary remains separate because PostgreSQL 17 role
creation conflicts with migration `0001`'s zero-membership bootstrap invariant.

Cycle 1b-b3 now has a reviewed live result at commit `664c0e5b`. While the same
ephemeral b2 login was active, the acceptance harness reran the reviewed alpha/
beta tenant visibility, inactive and non-current membership, direct/join/
subquery isolation, operation-rights, and alternating prepared-read assertions
through the SCRAM-authenticated session with transaction-local runtime role
selection. Run `31991498652` produced a version 3 success record that returned
`offline_consistent` against separately supplied anchors. B3 changes no
migration, capability role, application dependency, network exposure, driver,
pool, or composition root, and it does not promote b1's additional
null/malformed/unsupported-context cases. See the
[Cycle 1b-b3 evidence note](./docs/POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[exit matrix](./docs/CYCLE_1BB3_EXIT_MATRIX.md), and
[ADR 0015](./docs/adr/0015-authenticated-runtime-authorization-matrix.md).

Cycle 1b-b4 is complete for its bounded recorded scope. It adds one
parameterized, operation-specific listing-to-financial-fact PostgreSQL query, a
closed semantic unit mapping, a 100-row fail-closed result bound, and
integration with the existing row normalizer through the authenticated
container-local `psql` path.
It is deliberately driverless: no pool, API/web import, app composition, write
path, migration, or real data is included. It also adds no external
runtime/development dependency, database-driver dependency, package-manifest
dependency change, or lockfile change. The pinned PostgreSQL run passed and its
version 4 artifact returned `offline_consistent`; see the
[B4 evidence note](./docs/POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[ADR 0016](./docs/adr/0016-driverless-projection-query-and-semantic-unit-mapping.md)
and the [Cycle 1b-b4 exit matrix](./docs/CYCLE_1BB4_EXIT_MATRIX.md).

Cycle 1b-b5 is complete for its bounded recorded scope at commit `04e5c1b`.
The unchanged reviewed fixture was loaded through one ephemeral,
acceptance-only SCRAM login with one exact non-inheriting, non-admin, set-only
edge to the existing test-seed capability. The pinned PostgreSQL run and
version 5 record passed independent review and returned `offline_consistent`.
B5 adds no production or external authentication, TLS, managed secret system,
driver, pool, concurrent loader, migrator, backup/restore, real data, or app
integration. See the
[B5 evidence note](./docs/POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[ADR 0017](./docs/adr/0017-authenticated-test-loader-fixture-load.md), and the
[Cycle 1b-b5 exit matrix](./docs/CYCLE_1BB5_EXIT_MATRIX.md).

Cycle 1b-b6 is complete for its bounded recorded scope at commit `7aac502`.
One ephemeral, acceptance-only SCRAM login received one exact non-inheriting,
non-admin, set-only edge to the existing owner capability. The reviewed run
proved pre-role denial, rejected the reviewed forbidden role and
session-authorization transitions, and exercised transaction-local owner
selection, rollback and committed-create behavior for one fixed DDL object,
authenticated removal, ledger immutability, role reset, and zero residue.
PostgreSQL run `32058853521` produced a retained version 6 record that returned
`offline_consistent`. B6 did not execute a migration or close
`authenticated_migrator_sessions`; the versioned platform/application migration
redesign and complete authenticated migration proof remain reserved for B7.
See the [B6 evidence note](./docs/POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[ADR 0018](./docs/adr/0018-authenticated-owner-ddl-canary.md), and the
[Cycle 1b-b6 exit matrix](./docs/CYCLE_1BB6_EXIT_MATRIX.md).

Cycle 1b-b7 is implemented and locally verified in source; live version 7
evidence is pending. It keeps the historical b1 through b6 plan as
regression-only input,
then resets the exact disposable database and four capability roles before a
new, closed v2 platform/application plan. The container-superuser platform
phase creates the roles, owner-owned schemas, database/schema/public ACL
lockdown, and hardened `btree_gist` installation. A distinct ephemeral
non-superuser then authenticates with SCRAM, selects only the owner capability,
and applies the complete role-neutral application plan with login-attributed
ledger rows, rollback/replay checks, and mandatory zero-residue cleanup. This
does not prove a production or incremental migrator, external/TLS identity,
managed secrets, cross-phase atomicity, backup/restore, concurrency, a driver
or pool, real data, or deployment readiness. See
[ADR 0019](./docs/adr/0019-versioned-authenticated-migration-phase.md) and the
[Cycle 1b-b7 exit matrix](./docs/CYCLE_1BB7_EXIT_MATRIX.md).

## Requirements

- Node.js 24.19.x
- pnpm 11.19.0

## Run

```powershell
pnpm install --frozen-lockfile
pnpm dev:demo
```

Open `http://localhost:3000/research/SYN1`. The API listens on `http://localhost:3100`.

## Verify

```powershell
pnpm verify
```

The release gate checks formatting, lint, clean-room/database boundaries,
fixture and migration hashes, the acceptance-harness declaration, production
licenses, strict types, tests, and both production builds. CI runs the same gate
on Windows and Linux. The digest-pinned Ubuntu PostgreSQL workflow and both CI
platforms passed for the b1 commit `611c93d` and the bounded b2 commit
`3479e164`. B1 remains clean-only impersonated-capability evidence. B2
additionally proves only one container-local SCRAM runtime service account; it
does not substitute for end-user or production identity, concurrent pool
behavior, dump/restore, or deployment readiness. B3's broader authenticated
tenant/rights/prepared-read matrix passed in PostgreSQL run `31991498652` at
commit `664c0e5b`; its retained version 3 record returned `offline_consistent`.
B4's driverless query-to-normalizer path passed in run `32007521395`. B5's
authenticated fixture-load path passed in run `32012508025` at commit
`04e5c1b`; its retained version 5 record returned `offline_consistent`. B6's
bounded owner-DDL canary passed in run `32058853521` at commit `7aac502`; its
retained version 6 record also returned `offline_consistent`. These remain
sequential, synthetic, container-local acceptance results. The offline verifier
checks record/source consistency after download but cannot authenticate the
GitHub run or independently prove PostgreSQL execution. B7 source work does
not add a live result; its distinct version 7 run and review remain pending.

## Safety boundary

- Synthetic records declare provenance and a rights policy.
- Restricted facts are removed before API serialization.
- Financial values cross domain/API boundaries as decimal strings.
- Browser-local state is for demonstration only and must not contain real holdings or personal information.
- Production data, identity, billing, persistence, SEC ingestion, external alerts, and AI remain gated work.
- Synthetic tests and a clean-only acceptance run are not production authentication or deployed-persistence evidence.
- The proved container-local database service-account boundary does not
  establish end-user identity, external/TLS transport, managed
  secrets, pool safety, or production authorization.
- The reviewed b3 authenticated matrix does not establish a trusted end-user or
  tenant binding, an external/TLS path, production secrets, pool safety,
  concurrent behavior, restore viability, or deployed persistence.
- The reviewed B5 run is limited to one ephemeral acceptance-only synthetic
  loader; it does not establish production/external authentication, TLS, secret
  operations, concurrent loading, an authenticated migrator or backup, restore,
  real-data ingestion, or application integration.
- The reviewed B6 result is only an authenticated owner-DDL canary. It applies
  no migration, does not redesign role bootstrap, and does not authorize a
  production owner or migrator login.
- B7 source work separates a local container-superuser platform phase from an
  acceptance-only authenticated application migration phase. Until its pinned
  version 7 run is retained and reviewed, it is not live evidence; even then it
  cannot authorize production/incremental migration or make the two phases
  globally atomic.

See [the sanitized product brief](./docs/SANITIZED_PRODUCT_BRIEF.md),
[threat model](./docs/THREAT_MODEL.md), [next build cycles](./docs/BUILD_ROADMAP.md),
[canonical model](./docs/CANONICAL_MODEL.md),
[Cycle 1b-a exit matrix](./docs/CYCLE_1BA_EXIT_MATRIX.md),
[Cycle 1b-a2 exit matrix](./docs/CYCLE_1BA2_EXIT_MATRIX.md),
[Cycle 1b-b1 exit matrix](./docs/CYCLE_1BB1_EXIT_MATRIX.md),
[Cycle 1b-b2 exit matrix](./docs/CYCLE_1BB2_EXIT_MATRIX.md),
[Cycle 1b-b2 evidence note](./docs/POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md),
[Cycle 1b-b3 exit matrix](./docs/CYCLE_1BB3_EXIT_MATRIX.md),
[Cycle 1b-b3 evidence note](./docs/POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[Cycle 1b-b4 exit matrix](./docs/CYCLE_1BB4_EXIT_MATRIX.md),
[Cycle 1b-b4 evidence note](./docs/POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[Cycle 1b-b5 exit matrix](./docs/CYCLE_1BB5_EXIT_MATRIX.md),
[Cycle 1b-b5 evidence note](./docs/POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[Cycle 1b-b6 exit matrix](./docs/CYCLE_1BB6_EXIT_MATRIX.md),
[Cycle 1b-b6 evidence note](./docs/POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[Cycle 1b-b7 exit matrix](./docs/CYCLE_1BB7_EXIT_MATRIX.md),
and [architecture decisions](./docs/adr/).
