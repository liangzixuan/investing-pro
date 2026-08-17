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

Cycle 1b-b2 is the next bounded PostgreSQL contract. Its source is implemented,
but live execution and evidence review are still pending. It targets one ephemeral runtime service
account authenticating with SCRAM over loopback TCP inside the isolated service
container, then explicitly assuming only the existing read-only runtime
capability. It will not add an application driver or pool, expose a database
port, authenticate an end user, or prove external TLS, production secrets,
migrator/test-loader/backup authentication, restore, or deployment readiness.
The distinct-migrator boundary remains separate because PostgreSQL 17 role
creation conflicts with migration `0001`'s zero-membership bootstrap invariant.

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
platforms passed for `611c93d`. That reviewed clean-only synthetic run is bounded
engine evidence; it does not substitute for authenticated sessions, concurrent
pool behavior, dump/restore, production identity, or deployment readiness. The
offline verifier checks record/source consistency after download but cannot
authenticate the run by itself. The b2 runtime-authentication rows remain
Pending until a new reviewed remote run succeeds; the historical b1 run does
not satisfy them.

## Safety boundary

- Synthetic records declare provenance and a rights policy.
- Restricted facts are removed before API serialization.
- Financial values cross domain/API boundaries as decimal strings.
- Browser-local state is for demonstration only and must not contain real holdings or personal information.
- Production data, identity, billing, persistence, SEC ingestion, external alerts, and AI remain gated work.
- Synthetic tests and a clean-only acceptance run are not production authentication or deployed-persistence evidence.
- Container-local database service-account authentication, once proved, will
  still not establish end-user identity, external/TLS transport, managed
  secrets, pool safety, or production authorization.

See [the sanitized product brief](./docs/SANITIZED_PRODUCT_BRIEF.md),
[threat model](./docs/THREAT_MODEL.md), [next build cycles](./docs/BUILD_ROADMAP.md),
[canonical model](./docs/CANONICAL_MODEL.md),
[Cycle 1b-a exit matrix](./docs/CYCLE_1BA_EXIT_MATRIX.md),
[Cycle 1b-a2 exit matrix](./docs/CYCLE_1BA2_EXIT_MATRIX.md),
[Cycle 1b-b1 exit matrix](./docs/CYCLE_1BB1_EXIT_MATRIX.md),
[Cycle 1b-b2 exit matrix](./docs/CYCLE_1BB2_EXIT_MATRIX.md), and
[architecture decisions](./docs/adr/).
