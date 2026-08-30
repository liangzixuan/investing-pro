# Cycle 2y exit matrix

Scope: compose only the coarse Cycle 2x personal-quality readiness state into
the local API and optional browser chip while the personal-filing data plane
remains disabled. Startup is synthetic by default. Only the explicit
`personal_readiness` mode may admit the exact source-pinned and hash-pinned
resource-corrected aggregate, exactly once and before the server begins
listening. The decision is recorded in
[ADR 0051](./adr/0051-bounded-personal-quality-readiness-composition.md).

Source status: **Pending — replace with the exact frozen source revision after
implementation is complete and verified.**

Public verification status: **Pending — record exact local and CI evidence only
after the source revision is frozen.**

| Gate                        | Required result                                                                                                                                         | Current status                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Default mode                | Startup remains synthetic unless the exact `personal_readiness` mode is explicitly selected                                                             | Pending exact-source evidence             |
| Pre-listen admission        | The readiness loader completes before listen and cannot admit private evidence after the server starts                                                  | Pending exact-source evidence             |
| One-shot aggregate read     | The exact resource-corrected aggregate is read and admitted at most once during startup                                                                 | Pending exact-source evidence             |
| Exact source binding        | Admission requires the expected source revision rather than accepting an alternate build                                                                | Pending exact-source evidence             |
| Exact aggregate binding     | Admission requires the expected aggregate hash without exposing it to API, browser, logs, or storage                                                    | Pending exact-source evidence             |
| Quality-ready predicate     | Only the exact evaluated, met personal-quality terminal state can become ready; every other state is unavailable                                        | Pending exact-source evidence             |
| Data-plane denial           | The admitted runtime state fixes `dataPlane` to `disabled`; no personal fact or personal dossier loader is composed                                     | Pending exact-source evidence             |
| Closed response             | Success is exactly `{schemaVersion, profile, status, dataPlane}` with fixed literal values                                                              | Contract staged; runtime evidence Pending |
| Loopback transport          | The server binds only to an exact loopback literal and rejects a non-loopback peer                                                                      | Pending exact-source evidence             |
| Host guard                  | The readiness request requires one exact allowlisted local Host value                                                                                   | Pending exact-source evidence             |
| Origin guard                | The readiness request requires one exact allowlisted local browser Origin value                                                                         | Pending exact-source evidence             |
| Method and input closure    | Only GET is accepted; path parameters, query parameters, request bodies, and caller-supplied readiness are rejected                                     | Contract staged; runtime evidence Pending |
| Cache denial                | Every GET readiness response carries `Cache-Control: private, no-store` and `Pragma: no-cache` and emits no private ETag                                | Contract staged; runtime evidence Pending |
| Value-free failures         | Denied or unavailable requests disclose no validation stage, binding, path, hash, or private state                                                      | Pending exact-source evidence             |
| Browser boundary            | An optional chip may render only the same coarse readiness DTO and stores none of it                                                                    | Pending exact-source evidence             |
| Confidentiality             | No personal fact, label, value, metric, hash, path, reference, plan, approval, aggregate, or execution detail enters response, browser, log, or storage | Pending exact-source evidence             |
| Selected facts and dossier  | Personal normalized facts, personal dossier composition, and personal evidence display remain disconnected                                              | Later boundary                            |
| Same-snapshot release       | Atomic release of facts from the same snapshot whose quality result was admitted                                                                        | Later boundary                            |
| Browser authentication      | An authenticated owner browser session and protection from other local clients                                                                          | Later boundary                            |
| Same-user hostile processes | Protection from hostile processes running as the same operating-system user                                                                             | Unproven                                  |
| Enterprise/shared service   | Organizational approval, tenancy, B15/V15, commercial redistribution, shared-service controls, and production operation                                 | Out of scope                              |

## Startup and admission boundary

The application remains synthetic by default. The exact
`personal_readiness` startup mode is a closed, explicit opt-in and is not
inferred from file presence, environment shape, a browser request, or a
previous run. Before opening a listening socket, that mode invokes one
dedicated readiness loader.

The loader is bound to the expected application source and the exact expected
resource-corrected aggregate hash. It reads the aggregate once, validates the
closed aggregate shape and exact quality-ready terminal predicate, discards the
private carrier, and returns only an opaque capability that can enable the
fixed readiness DTO. No request can
trigger a reread, retry, alternate source, fallback aggregate, or late
admission. Missing, malformed, mismatched, quarantined, not-met, unreadable, or
otherwise invalid evidence prevents readiness composition and fails closed.

The aggregate, its hash, its source location, and every approval, reference,
quality plan, seal, receipt, runner, and validation detail remain on the
private side of the startup boundary. The absolute path and owner-provided
digest pin exist only as paired pre-listen process inputs and are removed from
the listening process environment. They are neither API request configuration
nor browser state.

## API and transport boundary

The only success body is the exact closed object:

```json
{
  "schemaVersion": "1.0.0",
  "profile": "personal_single_user_local",
  "status": "quality_gate_ready",
  "dataPlane": "disabled"
}
```

The readiness route is GET-only, accepts no caller state, and has no path or
query input. The server remains bound to an exact loopback IP literal with
proxy trust disabled. The route additionally requires one exact allowlisted
Host and one exact allowlisted local browser Origin. Missing, duplicated,
malformed, forwarded, or non-allowlisted authority input fails closed.

Every GET outcome is noncacheable with `Cache-Control: private, no-store` and
`Pragma: no-cache`. The readiness route emits no ETag, last-modified value,
data-as-of value, private identifier, or input-derived trace. Denial and
unavailability use stable value-free responses that do not distinguish the
private failure stage.

## Browser and storage boundary

The browser integration is optional and may render only a coarse readiness
chip from the fixed DTO. That readiness fetch cannot request personal facts,
follow a personal evidence locator, or infer a private filename or source
identifier. The response and chip must
not enter local storage, session storage, IndexedDB, service-worker caches,
application persistence, analytics, telemetry, error reporting, or logs.

`dataPlane: "disabled"` is an enforceable boundary, not a user-interface hint.
No personal normalized fact, metric value, history, timeline, evidence passport,
valuation input, thesis input, alert input, or dossier field may be populated
from the personal filing route in Cycle 2y.

## Confidentiality and failure boundary

Success reveals only that the already-completed personal quality gate is ready
for the declared local profile while the data plane is disabled. It does not
return the private aggregate or prove anything beyond the coarse Cycle 2x
status already allowed in repository documentation.

Every failure is atomic and value-free. No failure returns a partial DTO,
private binding, validation stage, file existence distinction, hash mismatch,
result status detail, retry hint, or owner-local path. Exceptions, request
headers, response bodies, and private carriers are not logged. The listener
must not start with a partially admitted readiness state.

## Exact nonclaims

Cycle 2y does not establish:

1. delivery of personal normalized facts, values, labels, metrics, history,
   evidence, or a personal dossier to the API or browser;
2. atomic release of personal facts from the same immutable snapshot whose quality
   aggregate was admitted;
3. reference, quality-plan, approval, seal, receipt, or aggregate disclosure;
4. a persistent personal-filing database, cache, local-storage record, export,
   or audit trail;
5. authenticated owner identity or an authenticated browser session;
6. protection from hostile processes running as the same operating-system
   user, browser extensions, developer tools, screenshots, or process-memory
   inspection;
7. external chronology, independent adjudication, label correctness,
   representativeness, or generalization;
8. source authenticity, accounting truth, general parser coverage, amendment
   discovery, or global currentness;
9. network, remote-client, multi-user, tenant, shared-service, commercial, or
   production safety; or
10. authorization to widen `dataPlane` beyond `disabled`.

Enterprise and shared-service requirements remain Out of scope for
`personal_single_user_local`. They reopen if the profile widens.

## Evidence and promotion

- Exact source revision: **Pending**.
- Exact source baseline/topology: **Pending**.
- Local verification commands and results: **Pending**.
- Public CI runs and jobs: **Pending**.
- Independent review outcome: **Pending**.

These placeholders are not evidence and do not authorize promotion. Replace
them only after the final source is frozen and the exact public gates are
green. No private aggregate, binding, owner-local path, or private operation
detail may be added while finalizing this section.

## Next blocker

After coarse readiness composition, the next separate blocker is an explicit,
owner-authorized personal fact-display boundary. It must atomically release
only the minimum selected normalized facts from the same immutable candidate
snapshot bound to the admitted quality result, while keeping the reference,
quality plan, aggregate, mappings, source paths, and persistence disabled.

An authenticated browser session and defenses against same-user hostile local
processes remain later, separate boundaries. They are not implied by a
loopback address, Host check, Origin check, or disabled data plane.

## Exit rule

Cycle 2y may be promoted only when its Pending evidence is replaced by an exact
frozen source revision and passing public verification. The promoted claim is
limited to disabled-by-default, explicit `personal_readiness` startup that
admits the exact source-pinned and hash-pinned resource-corrected aggregate
once before listen and exposes only the fixed readiness DTO through the guarded
noncacheable loopback route and optional coarse browser chip.

Personal facts, personal dossier composition, same-snapshot personal-fact
release, browser authentication, hostile-local-process resistance,
shared-service controls, and production remain outside the exit.
