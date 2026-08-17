# ADR 0018: Authenticated owner-DDL canary

Status: accepted for Cycle 1b-b6; source implemented and locally verified; live
version 6 evidence pending

## Context

Cycle 1b-b5 proved one authenticated, non-owner fixture-load session without
changing the historical superuser bootstrap. The next full operational-identity
boundary remains blocked: migration `0001` creates the capability roles and
rejects every membership involving them, while PostgreSQL 17 gives a
non-superuser `CREATEROLE` user an administrative edge on roles it creates. A
real authenticated migrator therefore requires a versioned split between
platform role provisioning and application migrations.

Changing the seven reviewed migrations or claiming that a disposable DDL probe
is a migration would widen the milestone unsafely. Before that redesign, the
acceptance harness can prove one narrower fact: a locked-down authenticated
login can explicitly assume the existing `NOLOGIN` owner capability, perform a
fixed transactional DDL canary, and leave no object or authentication residue.

## Decision

Cycle 1b-b6 adds one preparatory owner-DDL canary after the unchanged historical
clean bootstrap and authenticated test-loader cleanup. The harness creates one
ephemeral acceptance-only login with `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOREPLICATION`, `NOINHERIT`, `NOBYPASSRLS`, no unsafe role
settings, and connection limit `1`.

The login receives no direct application privilege. Its only temporary
membership is in `research_cockpit_owner`, with `ADMIN FALSE`, `INHERIT FALSE`,
and `SET TRUE`. A run-local password is stored as SCRAM and supplied only through
mode-`0600`, non-symlink passfiles to the pinned container's `psql` over loopback
TCP. The workflow continues to publish no PostgreSQL port.

The authenticated probe must prove:

- wrong-password rejection through the same container-local TCP path;
- before role selection, denial of application-schema use, application-table
  access, request-context routine execution, and temporary-object creation;
- denial of `SET SESSION AUTHORIZATION` and switches to runtime, test-seed,
  backup, or `postgres`;
- exact `session_user` and `current_user` identities before and after
  transaction-local selection of only `research_cockpit_owner`;
- an injected failure rolls back the fixed DDL canary completely;
- a separate committed create has the exact reviewed identity, owner, and ACL;
- the authenticated owner session removes that canary object, and role state
  resets afterward; and
- the migration ledger is unchanged across rollback, committed creation, and
  authenticated removal.

The canary login, membership, client backends, passfiles, and database object
must be removed in mandatory cleanup. Their absence is verified before the
existing zero-membership catalog fingerprint and before success-only evidence
can be emitted. Cleanup failure is a run failure even when every earlier probe
succeeded.

## Evidence contract

Source implementation and local tests are not live evidence. The first B6 live
claim requires a new immutable version 6 success record that:

- preserves the exact validation and meaning of versions 1 through 5;
- appends only `authenticated_owner_ddl_canary` after the canary, cleanup,
  zero-residue checks, and every b1 through b5 prerequisite succeed;
- retains the version 5 six-source-hash shape because the acceptance-runner hash
  binds all B6 orchestration;
- retains every version 5 `notProven` value unchanged, including
  `authenticated_migrator_sessions` and `authenticated_backup_sessions`; and
- uses `research-cockpit-postgres-acceptance-v6.json` and
  `postgres-acceptance-evidence-v6-${{ github.sha }}-${{ github.run_attempt }}`
  so no earlier record can be overwritten or reinterpreted.

A B6 live row may become `Pass` only after the dedicated workflow succeeds from
a clean checkout against the pinned PostgreSQL 17 image, the version 6 artifact
and logs are retained, repository and artifact hashes match, and independent
offline review returns `offline_consistent`. No live version 6 result or
evidence note exists at source stage.

## Explicit exclusions

B6 does not execute, render, validate, or replay a migration. It does not split
platform provisioning from application migrations, create capability roles,
install `btree_gist`, transfer existing object ownership, change the migration
ledger, or close `authenticated_migrator_sessions`. The canary is not a
migrator, deployment runner, production credential, or authorization for a
production owner login.

It also does not prove external authentication, TLS, managed secret storage or
rotation, secure passfile erasure, concurrent sessions, a driver or pool,
authenticated backup or restore, real data, application integration, deployed
persistence, or production readiness. It changes no migration, fixture,
capability role, application dependency, package manifest, lockfile, or exposed
network surface.

## Consequences

B6 reduces risk around the future authenticated migration executor's login,
role-transition, transactional-DDL, and cleanup mechanics. It intentionally
leaves the actual migrator boundary open. Cycle 1b-b7 must introduce a
separately reviewed, versioned platform/application migration plan and prove the
complete migration phase through an authenticated non-superuser. Authenticated
backup and restore follow that redesign.

Historical b1 through b5 evidence retains its exact recorded scope and is not
retroactively widened by this decision.

## Related decisions

- [ADR 0014: Container-local runtime authentication](./0014-container-local-runtime-authentication.md)
- [ADR 0017: Authenticated test-loader fixture load](./0017-authenticated-test-loader-fixture-load.md)
- [Cycle 1b-b6 exit matrix](../CYCLE_1BB6_EXIT_MATRIX.md)
- [PostgreSQL 17 role attributes](https://www.postgresql.org/docs/17/role-attributes.html)
- [PostgreSQL 17 `GRANT`](https://www.postgresql.org/docs/17/sql-grant.html)
- [PostgreSQL 17 `SET ROLE`](https://www.postgresql.org/docs/17/sql-set-role.html)
