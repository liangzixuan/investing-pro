# Markets watchlist implementation plan

Extend the existing Markets components and clients. The app already stores exact
watchlist identities, admits local catalog listings and fetches bounded EOD
history. This outcome connects those layers without another API or storage model.

## Boundaries

- `market-board-loader.ts` owns cohort types and keys, local admission and the
  single sequential EOD loop. Reuse the eleven-field `PersonalPortfolioIdentity`
  and exact-listing client. Admitted rows use `PersonalSecurityMasterScreenRowDto`.
- `useMarketsSnapshot` owns the editable mode/selection draft, one accepted
  snapshot, request cancellation, activity checks and shared refresh budget.
  Check budget availability before local admission; charge after admission,
  immediately before the first EOD request. Remove the automatic-entry effect.
- `MarketsHome` and its picker render native controls, exact cohort labels,
  retained/error states and the existing analytics/chart. Captured chart and
  company handlers require the current matching snapshot and view lifetime.
- `SecurityDiscoveryWorkspace` passes explicitly projected identities and a
  current-ref membership callback. Saved notes and record versions do not pass
  through this bridge or invalidate unchanged selected identities.

The two loader phases share one abort signal. Session and catalog conflicts
retire the operation; ordinary listing/feed errors remain explicit rows. The
hook decides whether a zero-usable result retains the existing same-cohort
snapshot. A partial usable result replaces it as a whole.

## Verification

Use injected loader dependencies and the existing hook/component harnesses.
Check full identity admission before EOD, sequential one/three/six-company loads,
shared refusal stops and exact operation counts. Test budgets across mode,
selection and route changes, including empty admission and started cancellation.
Exercise synchronous stale handlers, note-only versus selected-member changes,
retained refresh failures, partial replacement and matching company handoff.

Use synthetic watchlists for all membership mutations and failure cases. Bind
the synthetic Brave fixture to the actual source; verify desktop and 390px
controls, charts, draft changes, Research/Back and independent BEA state.
Production QA uses at most one existing admitted cohort and one explicit price
load, with no owner-data writes. Record unavailable real coverage honestly.

## Release

Root records scope and ownership in workspace CURRENT before source changes.
Complete source review, focused behavior checks, the production web build and
source-bound synthetic QA. Commit explicit feature files and then the separate
generated closure. Run the unchanged isolated native gate and require every
applicable hosted job to succeed at the exact candidate. Activate through fresh
source/process/listener checks and the rollback-preserving configured launcher.
Preserve the accepted BEA release until the candidate meets those gates.

The outside-Git handoffs retain failures, raw results and actual source/build/
runtime evidence. Stop new slices September 27 at 05:41 UTC and checkpoint/pause
autonomous work at 06:26 UTC.
