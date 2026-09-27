# Implementation plan

Continue the unreleased a87 changes in `markets-home/` on accepted a86 release
`dbfaf478722eab4cfde0fbe2b0c896d2fab37398`. Preserve its running app, rollback and
the unrelated parked `research-cockpit/` work. The owner renewed this outcome on
September 27 at 06:29:44 UTC. Scope and behavior remain those in the
[specification](./spec.md).

## Modules and ownership

| Owner       | Files and existing seams                                                                                                                  | Responsibility                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Spec        | `personal-monetary-announcements.ts` and test, contracts export, OpenAPI and its exact inventory test; focused workspace integration test | Strict shared DTO, canonical public URLs, source/time/count/order validation and app wiring |
| Finance     | `fed-monetary-announcements-provider.ts`, `workspace-monetary-announcements-routes.ts` and their tests                                    | Fixed public transport, typed RSS normalization, authenticated route and cancellation       |
| Performance | `useFedMonetaryAnnouncements`, `FedMonetaryAnnouncements`, their tests, scoped CSS and `MarketsHome` composition                          | Explicit independent loading, retained state, request authority and accessible presentation |
| Root        | Dependency/lock/notices, client and tests, API composition, guards, integration and release                                               | Join the existing application seams and verify the complete outcome                         |

Use exact `@rgrove/parse-xml@5.0.0` as the API's direct dependency. Its installed
types, ISC notice and license inventory are recorded. The provider follows the
existing BEA fetch/clock and `load`/`close` pattern without introducing a general
feed framework. It performs one fixed GET, validates the entire bounded feed and
returns an immutable projection of at most ten items. Article bodies, alternative
sources and owner records are outside this feature.

The route reuses current request/session authorization before loading. The client
validates and freezes the DTO. The new hook owns one controller and accepted DTO
within the existing persistent Markets mount. Price-board, comparison and BEA
state remain independently owned. Hiding Markets aborts pending work and retains
accepted announcements; retiring session authority clears them.

## Recorded checkpoint

The [implementation checkpoint](../../../tmp/fed-announcements/implementation-checkpoint.md)
and its [independent review](../../../tmp/fed-announcements/implementation-checkpoint-independent-review.json)
record 631 distinct focused passes: 451 contracts/OpenAPI, 88 API, 73 UI/composition,
17 client and two static-graph cases. This includes existing regressions; the source
registration increment was 192, not a measured native total. Types, scoped lint,
formatting, boundaries and license inventory passed. The retained public feed
produced 15 validated unique items and ten returned items through an injected
offline fetch, with zero network requests.

All 28 saved source pins and HEAD matched the
[renewal reconciliation](../../../tmp/fed-announcements/renewal-checkpoint-reconciliation.json)
before resumed edits. Preserve the original receipts and failed attempts. Record
new source pins after changes; do not reuse the old checkpoint as proof of changed
files or repeat unchanged passing checks.

The renewed work adds three focused workspace integration passes: no startup
acquisition, authorized route reachability, shutdown cancellation and authority
retirement even when provider disposal fails. These use an admitted synthetic
catalog, an in-memory vault stub and injected transport. The
[integration handoff](../../../tmp/fed-announcements/workspace-integration-handoff.json)
records the source pins and affected checks.

The configured personal-workspace/local production web build passed with build ID
`0jN1_VQa2fxRAPTekA-_e`, along with 16 page-mode cases. The
[preflight](../../../tmp/fed-announcements/production-web-preflight.json) and
[independent review](../../../tmp/fed-announcements/production-web-preflight-independent-review.json)
preserve the default-mode first build and configured second build separately.
Their source pins are checkpoint reconciliations, not a compiler-produced manifest
of consumed bytes. Browser and release acceptance remain pending.

## Remaining verification and release

1. Independently review the new workspace integration evidence and any remaining
   integration findings. The application wiring checks supplement the standalone
   route and import-graph tests; they do not replace source-bound browser QA.
2. Review current source and complete remaining affected integration checks. Carry
   the passed configured web build forward while its inputs remain unchanged;
   repeat prior checks only for changed behavior or an unresolved finding.
3. Use a fresh source-bound, RAM-only Brave fixture for desktop and 390px layout,
   keyboard loading, titles/source/publication/retrieval labels, empty and failed
   refresh states, hide/Back retention, session retirement and panel independence.
   Do not use owner records, a real feed or linked articles for synthetic QA.
4. Freeze and independently review the exact feature inventory and registration
   delta. Commit explicit feature files, then generate and verify the separate
   nine-file a87 closure under the existing release-classification procedure.
5. Pass the unchanged isolated native gate. Derive hosted applicability from the
   final committed feature and closure; six workflows/seven jobs are currently
   expected because the lockfile changes. Require actual results at the exact
   pushed revision. Terminal observers and consumed helpers cannot be replayed.
6. Use fresh reviewed activation evidence and preserve the actual rollback.
   Complete local smoke and a separately reviewed live plan allowing one explicit
   feed load, no retry or article requests, before final independent acceptance.

The synchronous parser has no established hard CPU/depth deadline. Keep this
limit distinct from the response-byte cap and network deadline in all evidence.
If the outcome remains incomplete, checkpoint it without weakening checks. The
renewed window ends September 28 at 06:29:44 UTC; stop selecting new slices at
05:44:44 UTC that day.
