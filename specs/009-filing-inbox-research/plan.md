# Implementation plan

Build on accepted a87 in `markets-home`. Preserve its running app and rollback,
the failed-attempt evidence, and unrelated parked `research-cockpit` changes.
The owner renewed work through September 28, 2026 at 06:29:44 UTC. Select no new
slice after 05:44:44 UTC. Workspace CURRENT owns later progress.

| Owner       | Files or seam                                                     | Responsibility                                                            |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Finance     | `PersonalFilingMonitor.tsx` and its existing test                 | Exact listing actions, click and return guards, retained monitor state    |
| Performance | `SecurityDiscoveryWorkspace.tsx` and its existing test            | Monitor origin, full-identity admission, SEC section and both Back paths  |
| Root        | This specification, feature guides and current-work documentation | Integration, evidence review and release                                  |
| Spec        | Outside-Git composed fixture and independent review               | Contract-valid invented records, bounded IO and realistic workflow checks |

Use the existing React state/refs, company origin and route machinery. The child
passes the captured membership, actual button, current-click predicate and
durable post-handoff predicate. A separate `active` prop controls initiation;
it must not enter the existing enabled/context reset key. The parent checks the
transient predicate before navigation and stores the durable predicate with its
full-identity/workspace guards for return focus. No new dependency is needed.

Focused component tests cover admission, synchronous retirement, pending
operations, retained drafts/pages, same-company section choice and routed Back.
The monitor suite mocks its binding validator and the workspace suite substitutes
children, so source-bound composed QA must also use the real client and monitor.
Its RAM fixture admits a current paused policy, two listings for one issuer and
21 retained entries. Accept only its exact read-only monitor GET; reject mutations
and external requests. Record counters separately from existing local session and
catalog reads. A History shim is not proof of production Next hydration.

Run affected types, scoped lint/format and the existing boundary checks. Record
actual focused registrations and source pins. Complete the configured local
personal-workspace production web preflight and browser checks before freezing
the feature inventory. Keep feature and generated closure commits separate,
then run the unchanged isolated native gate and require every applicable hosted
job's actual success at the exact pushed revision. Preserve raw failures.

Activate only after those gates pass, using fresh process identities, retained
handles and the established rollback-preserving launcher. A separately reviewed
live plan permits one explicit local monitor GET. Use an eligible existing entry
if present; do not enable, rebind, acknowledge, reset or seed the owner's monitor.
Record empty or obsolete coverage rather than manufacturing populated success.

Design evidence is retained in `tmp/filing-inbox-research/monitor-design.md`,
`workspace-design.md` and `acceptance-design.md` outside Git. These establish the
reviewed plan, not passing implementation or release acceptance.
