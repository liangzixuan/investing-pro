# Build roadmap after Sprint 0

## Completed foundation

Sprint 0 proves the clean vertical path with one fictional common stock: bitemporal dossier, ten metrics, formula/evidence passports, server-side rights denial, transparent valuation, browser-local thesis, local rule evaluation, responsive UI, REST/OpenAPI contracts, tests, production builds, and automated governance gates.

## Cycle 1 — persistence and authorization harness

Target: 2–3 weeks, still synthetic only.

1. Define issuer, security, share class, listing, symbol history, fact, evidence, metric definition/result, rights policy, entitlement, organization, and thesis/alert schemas.
2. Model effective and system intervals explicitly; use fixed-point numeric/scale/unit/currency fields and UTC exchange cutoffs.
3. Add reviewed PostgreSQL migrations, repository ports, tenant RLS, and restore tests while keeping the in-memory demo profile.
4. Add local development identity fixtures and test every tenant/object permission path; do not add production authentication yet.
5. Validate implementation responses against OpenAPI and generate the web client instead of hand-maintaining transport types.

Exit gate: cross-tenant property tests pass, replayed restatements reproduce exactly, a backup restores inside the stated RPO/RTO, and no real/customer data exists.

## Cycle 2 — filing ingestion proof

Target: 3–4 weeks after the parser threat-model gate is implemented.

1. Build a sandboxed Python 3.12 worker boundary and a fixed, counsel-approved public-filing corpus.
2. Preserve raw payload and audit metadata in separate retention domains; support payload deletion/crypto-erasure.
3. Normalize ten launch facts with source accession, accepted/available time, parser version, taxonomy, unit, dimensions, and supersession lineage.
4. Compare two independent parsers/validators, quarantine conflicts, and forbid silent repair.
5. Measure document success, fact precision/recall, unit/date tolerance, silent-failure rate, and quarantine rate against independently adjudicated ground truth.

Exit gate: at least 100 representative filings and 2,000 critical assertions meet the frozen quality thresholds with zero silent critical failures.

## Cycle 3 — product breadth

Only after executed display/derived/alert/export rights and 10K/100K-user cost models exist:

- expand from 10 to 30 versioned common-stock metrics;
- add a typed screener/query engine and saved views;
- persist thesis/watchlist data behind tenant authorization;
- add one production alert channel with delivery receipts and duplicate monitoring; and
- run paid-beta accessibility, performance, restore, incident-correction, and operational-readiness gates.

ETF accounting, portfolio performance, broad calendars, generative AI, broker connections, and multi-channel alerts remain deferred.
