# Cycle 2z exit matrix

Scope: release only a startup-fixed, owner-authorized selection of normalized
personal facts from the same immutable candidate snapshot bound to the admitted
quality result. The personal response remains local, nonpersistent, and
separate from the synthetic dossier. The decision is recorded in
[ADR 0052](./adr/0052-bounded-personal-owner-authorized-selected-fact-release.md).

Source status: **Pending — replace with the exact frozen source revision only
after implementation is complete and verified.**

Public verification status: **Pending — record exact local and CI evidence
only after the source revision is frozen.**

Private release status: **Pending — no personal selected-fact release Pass is
claimed.**

| Gate                        | Required result                                                                                                | Current status                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Default closure             | Synthetic and readiness-only startup cannot infer or activate fact release                                     | Pending exact-source evidence             |
| Explicit startup            | Only the exact personal selected-fact mode can request release                                                 | Pending exact-source evidence             |
| Pre-listen completion       | Private validation, derivation, and authorization consumption finish before listen                             | Pending exact-source evidence             |
| Bounded snapshots           | Every private carrier is copied once into an owned, bounded, stable snapshot                                   | Pending exact-source evidence             |
| Quality admission           | Only the exact evaluated and met personal quality result is accepted                                           | Pending exact-source evidence             |
| Input-set binding           | The rederived input set matches the admitted quality result                                                    | Pending exact-source evidence             |
| Candidate binding           | Production rederivation succeeds and matches the admitted candidate commitment                                 | Pending exact-source evidence             |
| Plan closure                | The owner-reviewed plan selects only a bounded nonempty canonical subset of the fixed vocabulary               | Pending exact-source evidence             |
| Response closure            | The proposed response is exact, immutable, and contains only the selected-fact DTO                             | Contract staged; runtime evidence Pending |
| Owner authorization         | Fresh exact authorization binds source, quality result, snapshot, plan, and response                           | Pending private evidence                  |
| One-shot consumption        | Authorization is consumed atomically; replay, race, replacement, and revocation fail closed                    | Pending exact-source evidence             |
| Atomic failure              | Failure exposes no partial fact or alternate response and prevents explicit release startup                    | Pending exact-source evidence             |
| Request closure             | GET only; no path, query, body, identifier, caller selection, or release assertion                             | Contract staged; runtime evidence Pending |
| Local guard                 | Exact loopback, Host, and Origin checks apply with proxy trust disabled                                        | Pending exact-source evidence             |
| Cache denial                | Every GET outcome is private and noncacheable and emits no private validator                                   | Contract staged; runtime evidence Pending |
| Browser boundary            | The optional view renders only the authorized response and persists none of it                                 | Pending exact-source evidence             |
| Synthetic separation        | Personal facts do not populate the synthetic dossier or its derived features                                   | Pending exact-source evidence             |
| Confidentiality             | Public evidence, failures, and logs contain no private release material or operation detail                    | Pending exact-source and private evidence |
| Private operation           | Only a coarse owner-approved Pass may become repository-visible after success                                  | Pending owner approval                    |
| Browser authentication      | Request-time authenticated owner-browser composition                                                           | Later boundary                            |
| Same-user hostile processes | Resistance to hostile processes under the same operating-system user                                           | Unproven                                  |
| Enterprise/shared service   | Tenancy, organizational approval, commercial redistribution, shared-service controls, and production operation | Out of scope                              |

## Startup and same-snapshot boundary

Cycle 2z remains disabled unless the exact release mode and complete private
configuration are supplied before startup. It never activates from file
presence, a prior run, a readiness request, or a browser request.

The release boundary reuses the production candidate derivation over the exact
bounded source inputs. Both the input set and rederived candidate must match the
already admitted quality result. An independently supplied normalized record,
reference, displayed value, or caller assertion cannot substitute for those
checks.

The owner reviews the canonical plan and proposed response before providing
fresh single-use authorization. The response is fully derived and matched
before atomic authorization consumption. Only then may an opaque capability
enter the application composition root.

## API, browser, and storage boundary

The only success body is the exact closed selected-facts DTO. It contains the
personal profile, release status, and the authorized facts. Each fact contains
only a fixed public key, canonical value, canonical unit, and period. Runtime
enforces the bounded nonempty selection, unique keys, and canonical order.

The route is GET-only and accepts no caller state. Exact loopback, Host, and
Origin checks gate access. Success, denial, and unavailability are private and
noncacheable. No request can reopen inputs, select another fact, or trigger a
new authorization attempt.

The optional browser view is memory-only and remains separate from the
synthetic dossier, evidence, valuation, thesis, alert, history, export, and
persistence paths.

## Confidentiality and exact nonclaims

Public evidence and value-free failures reveal no selected subset, response
content, source metadata, quality detail, binding, authorization material,
private location, or operation detail. Rendering the authorized response does
make its selected facts visible in the local browser; secrecy after rendering
is not claimed.

Cycle 2z does not establish fact truth, source authority, independent review,
general parser coverage, amendment discovery, currentness, dynamic selection,
multi-document history, dossier composition, persistence, export, valuation,
thesis, alerts, authenticated owner identity, an authenticated browser session,
same-user hostile-process resistance, or any remote/shared-service/production
safety.

Enterprise and shared-service requirements remain Out of scope for
`personal_single_user_local`. They reopen only if the profile widens.

## Evidence and promotion

- Exact source revision: **Pending**.
- Exact predecessor and transition topology: **Pending**.
- Local verification: **Pending**.
- Focused contract, candidate-binding, API, browser, privacy, and adversarial
  verification: **Pending**.
- Public CI runs and jobs: **Pending**.
- Independent review: **Pending**.
- Coarse owner-approved private release outcome: **Pending**.

These placeholders are not evidence and do not authorize promotion. Public
source gates prove only the bounded capability. Synthetic tests cannot produce
the private Pass. No promotion text may contain released facts or any private
release detail.

## Next blocker

After Cycle 2z, the next separate blocker is request-time authenticated
owner-browser composition with a short-lived session-bound owner capability and
CSRF, replay, and lifetime controls. Host and Origin alone are not owner
authentication. Hostile same-user processes remain unproven even after that
boundary.

Broader selection, history, dossier composition, persistence, export,
valuation, thesis, and alerts remain separate later milestones. Enterprise and
shared-service controls remain Out of scope.

## Exit rule

Cycle 2z cannot be promoted while either exact-source public evidence or the
coarse owner-approved private release outcome remains Pending. A future
promotion is limited to the exact frozen source and exact frozen personal scope
that passed both boundaries. It cannot widen the response, selection,
application features, authentication claim, hostile-process claim, or profile.
