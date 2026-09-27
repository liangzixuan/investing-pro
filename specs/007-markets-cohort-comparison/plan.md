# Implementation plan

Build on accepted a85 release `3aaa62206dcbc929a15c0c3b16ace5759c977d84` in
`markets-home/`. Preserve the configured runtime, rollback evidence and unrelated
`research-cockpit/` work. Scope and ownership were recorded in workspace CURRENT
before source edits on September 27, 2026 at01:27UTC.

## Modules and ownership

| Owner       | Files                                                                         | Responsibility                                                                         |
| ----------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Spec        | Existing analytics comparison implementation and test                         | Raise the series maximum to six, preserving arithmetic and validation                  |
| Performance | `market-cohort-comparison.ts` and test                                        | Pure full-cohort admission and projection through the existing engine                  |
| Finance     | `MarketCohortComparison.tsx`, test and `markets.css`                          | Compact accessible table, coverage disclosure and responsive presentation              |
| Root        | `MarketsHome.tsx`, test, feature/current documentation and this specification | Compose from the existing matching snapshot, verify integration and coordinate release |

`deriveMarketCohortComparison(snapshot)` returns a typed model: null when
unloaded, a reasoned unavailable state, or available/insufficient-history output
with ordered display identities and the existing engine result. The component
receives that model and the cohort name. It owns no acquisition or persistent
state. The existing hook and loader continue to own identity, lifetime, budget
and snapshot replacement. The existing three-company research comparison chart
and acquisition flow are unchanged.

## Verification order

1. Run meaningful focused analytics, adapter, presentation and composition tests.
   Preserve failed attempts and reconcile actual test-registration changes.
2. Independently review the affected source and module boundaries. Run affected
   types, formatting/lint/boundary/page-mode checks and the production web build
   before generated closure.
3. Use a source-bound synthetic Brave fixture for two/six companies, incomplete
   and invalid cohorts, shared-date coverage, retained/partial/draft states,
   navigation, zero incremental IO, keyboard disclosure and390px presentation.
4. Commit explicit reviewed feature files and the separate generated closure.
   Use the unchanged isolated native gate; require actual success for every
   applicable hosted job at the exact revision. Do not replay terminal observers.
5. Activate only the accepted candidate using fresh source/creation/listener
   checks and retained handles, preserving the actual rollback manifest. Complete
   local smoke, one bounded live board load and independent final acceptance.

Existing subscriptions and free sources only. No owner-record writes for tests,
credentials/private-storage inspection, authentication changes or extra provider
diagnostics. The autonomous window ends at06:26UTC; select no new slice after
05:41UTC. If work is incomplete, checkpoint it without weakening release gates.
