# ADR 0017: Authenticated test-loader fixture load

Status: accepted; source implemented; first live version 5 evidence reviewed

## Context

The retained b1 acceptance run loaded the reviewed synthetic fixture while the
container superuser impersonated the `NOLOGIN` capability
`research_cockpit_test_seed` with `SET SESSION AUTHORIZATION`. B2 through B4
introduced and exercised a separate authenticated runtime service account, but
they deliberately left the b1 fixture-load boundary unchanged.

PostgreSQL does not allow an ordinary authenticated login to become another
session user with `SET SESSION AUTHORIZATION`. Replacing the historical fixture
wrapper or changing migrations would also invalidate reviewed b1 through B4
source anchors without improving the loader boundary. B5 therefore needs a
separate, acceptance-only login and a transaction-local role transition while
preserving the fixture and all seven migrations byte for byte.

## Decision

Cycle 1b-b5 adds one closed test-loader lifecycle to the isolated PostgreSQL
acceptance harness:

- after clean bootstrap and migration-replay refusal, the harness creates one
  ephemeral `research_cockpit_test_loader_login` with `LOGIN`,
  `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOINHERIT`,
  `NOBYPASSRLS`, no role settings, and connection limit `1`;
- a run-local password is generated outside source and workflow configuration,
  stored by PostgreSQL as SCRAM, and supplied only through container-local,
  mode-`0600`, non-symlink passfiles;
- the only temporary membership edge is
  `research_cockpit_test_seed` to the login with `ADMIN FALSE`,
  `INHERIT FALSE`, and `SET TRUE`;
- the positive client uses the pinned container's `psql` over loopback TCP to
  the fixed acceptance database and requires SCRAM authentication;
- the historical `acceptance/synthetic-fixture.sql` remains unchanged. The
  harness accepts only its exact reviewed session-authorization prefix and
  reset suffix, extracts the enclosed direct-`INSERT` body, and rejects any
  wrapper drift before executing SQL;
- the authenticated load is one transaction: `BEGIN`, `SET LOCAL ROLE
research_cockpit_test_seed`, an exact identity assertion, the unchanged
  insert body, and `COMMIT`; after commit, the session must again identify the
  login as `current_user`; and
- the login, membership, backends, and passfiles are removed before the
  existing zero-membership catalog fingerprint and before any success-only
  evidence can be emitted.

The rollback probe executes the complete extracted fixture body and then
forces a failure before commit. It must leave all fixture relations empty and
the migration ledger unchanged before the successful authenticated load is
allowed. This is an atomicity check, not a partial or alternate fixture.

The authenticated negative matrix must also prove:

- wrong-password rejection on the same container-local TCP path;
- no application-schema use, application-table read, context-routine use, or
  temporary-object creation before explicit role selection;
- denial of `SET SESSION AUTHORIZATION` and of role switches to the owner,
  runtime, backup, or `postgres` roles;
- rejection of non-synthetic rows by the existing synthetic-only RLS policies;
- denial of authenticated `UPDATE`, `DELETE`, and `TRUNCATE`, migration-ledger
  read or write, persistent DDL, and temporary DDL; and
- transaction-local role reset plus zero login, membership, backend, and
  passfile residue after cleanup.

The test-loader login is distinct from the runtime login. Neither login may be
granted the other's capability, and the acceptance-only edge is never part of
a migration or production role graph.

## Evidence contract

Source implementation and local tests are not live evidence. A B5 result
requires a new immutable version 5 success record that:

- preserves the exact meanings and validation contracts of versions 1 through
  4;
- appends the completed check
  `authenticated_test_loader_fixture_load` only after the authenticated load,
  all negative probes, cleanup, zero-residue checks, and every b1 through b4
  prerequisite succeed;
- retains the version 4 source-hash schema, with the new acceptance-runner hash
  binding B5 orchestration and the unchanged fixture hash continuing to bind
  the historical fixture bytes;
- replaces the version 4 combined future-session limitation with the two exact
  remaining nonclaims `authenticated_migrator_sessions` and
  `authenticated_backup_sessions`, while retaining every other version 4
  limitation; and
- uses new version 5 filenames and artifact names so no earlier record can be
  overwritten or reinterpreted.

A B5 live row may become `Pass` only after the dedicated workflow succeeds
from a clean checkout against the pinned PostgreSQL 17 image, the version 5
artifact and workflow logs are retained, repository and artifact byte hashes
match, and the offline review returns `offline_consistent` against independently
supplied anchors. A documentation-only rerun or a later documentation commit
cannot expand the tested source commit.

Tested commit
[`04e5c1b94c6488b72705c0c5d5e176909a33c857`](https://github.com/liangzixuan/investing-pro/commit/04e5c1b94c6488b72705c0c5d5e176909a33c857)
satisfied that rule in PostgreSQL [run `32012508025`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32012508025).
The downloaded version 5 record was retained and returned
`offline_consistent`; exact anchors, byte hashes, source hashes, completed
checks, and nonclaims are recorded in the
[B5 evidence note](../POSTGRESQL_TEST_LOADER_EVIDENCE.md). The later
documentation commit does not retest or expand the recorded run.

## Explicit exclusions

B5 does not add or prove a production loader, external database route, TLS,
end-user or external identity, managed secret storage or rotation, secure
passfile erasure, a driver or pool, concurrent sessions, cancellation or
timeouts, migration execution by an authenticated non-owner, authenticated
backup, logical dump/restore, real or licensed data, incremental ingestion,
application/API integration, deployed persistence, or production readiness.

The test-loader login and membership are ephemeral acceptance-harness objects,
not production configuration. The accepted design changes no fixture,
migration, capability role, application dependency, package manifest, lockfile,
workflow topology, or exposed network surface.

## Consequences

B5 closes only the historical authenticated test-loader nonclaim for one
sequential, synthetic, container-local acceptance run. The distinct migrator
still requires a separate bootstrap design, and authenticated backup/restore
remains a later milestone. Historical b1 through b4 evidence retains its exact
recorded scope and is not retroactively widened by this decision.

## Related decisions

- [ADR 0014: Container-local runtime authentication](./0014-container-local-runtime-authentication.md)
- [ADR 0015: Authenticated runtime authorization matrix](./0015-authenticated-runtime-authorization-matrix.md)
- [ADR 0016: Driverless projection query and semantic unit mapping](./0016-driverless-projection-query-and-semantic-unit-mapping.md)
- [Cycle 1b-b5 exit matrix](../CYCLE_1BB5_EXIT_MATRIX.md)
- [Cycle 1b-b5 evidence note](../POSTGRESQL_TEST_LOADER_EVIDENCE.md)
