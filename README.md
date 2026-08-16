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
PostgreSQL 17.11 image digest. A future green run writes and uploads a
success-only, exact-schema record bound to the commit, GitHub run, reviewed
inputs, observed versions, completed checks, and explicit limitations. The
workflow has not run yet, so no such record exists: this is an executable
contract—not live database evidence—and it remains disconnected from the app.

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
on Windows and Linux. A separate digest-pinned Ubuntu workflow is the pending
real-PostgreSQL proof; static checks and the unexecuted run-record contract do
not substitute for a green run and its linked artifact.

## Safety boundary

- Synthetic records declare provenance and a rights policy.
- Restricted facts are removed before API serialization.
- Financial values cross domain/API boundaries as decimal strings.
- Browser-local state is for demonstration only and must not contain real holdings or personal information.
- Production data, identity, billing, persistence, SEC ingestion, external alerts, and AI remain gated work.
- Synthetic repository tests and unexecuted SQL are not production authentication or persistence evidence.

See [the sanitized product brief](./docs/SANITIZED_PRODUCT_BRIEF.md),
[threat model](./docs/THREAT_MODEL.md), [next build cycles](./docs/BUILD_ROADMAP.md),
[canonical model](./docs/CANONICAL_MODEL.md),
[Cycle 1b-a exit matrix](./docs/CYCLE_1BA_EXIT_MATRIX.md),
[Cycle 1b-a2 exit matrix](./docs/CYCLE_1BA2_EXIT_MATRIX.md),
[Cycle 1b-b1 exit matrix](./docs/CYCLE_1BB1_EXIT_MATRIX.md), and
[architecture decisions](./docs/adr/).
