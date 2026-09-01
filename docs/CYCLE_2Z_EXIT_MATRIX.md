# Cycle 2z exit matrix

Scope: release only a startup-fixed, owner-authorized selection of normalized
personal facts from the same immutable candidate snapshot bound to the admitted
quality result. The personal response remains local, nonpersistent, and
separate from the synthetic dossier. The decision is recorded in
[ADR 0052](./adr/0052-bounded-personal-owner-authorized-selected-fact-release.md).

Source status: **Pass only for exact frozen source revision
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`.**

Public verification status: **Pass at that exact source revision.**

Private evidence status: **Limited to the permitted coarse outcome recorded
below.**

| Gate                        | Required result                                                                                                | Current status                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Default closure             | Synthetic and readiness-only startup cannot infer or activate fact release                                     | Pass at exact source revision      |
| Explicit startup            | Only the exact personal selected-fact mode can request release                                                 | Pass at exact source revision      |
| Pre-listen completion       | Private validation, derivation, and authorization consumption finish before listen                             | Pass at exact source revision      |
| Bounded snapshots           | Every private carrier is copied once into an owned, bounded, stable snapshot                                   | Pass at exact source revision      |
| Quality admission           | Only the exact evaluated and met personal quality result is accepted                                           | Pass at exact source revision      |
| Input-set binding           | The rederived input set matches the admitted quality result                                                    | Pass at exact source revision      |
| Candidate binding           | Production rederivation succeeds and matches the admitted candidate commitment                                 | Pass at exact source revision      |
| Plan closure                | The owner-reviewed plan selects only a bounded nonempty canonical subset of the fixed vocabulary               | Pass at exact source revision      |
| Response closure            | The proposed response is exact, immutable, and contains only the selected-fact DTO                             | Pass at exact source revision      |
| Owner authorization         | Fresh exact authorization binds source, quality result, snapshot, plan, and response                           | Pass at exact source revision      |
| One-shot consumption        | Authorization is consumed atomically; replay, race, replacement, and revocation fail closed                    | Pass at exact source revision      |
| Atomic failure              | Failure exposes no partial fact or alternate response and prevents explicit release startup                    | Pass at exact source revision      |
| Request closure             | GET only; no path, query, body, identifier, caller selection, or release assertion                             | Pass at exact source revision      |
| Local guard                 | Exact loopback, Host, and Origin checks apply with proxy trust disabled                                        | Pass at exact source revision      |
| Cache denial                | Every GET outcome is private and noncacheable and emits no private validator                                   | Pass at exact source revision      |
| Browser boundary            | The optional view renders only the authorized response and persists none of it                                 | Pass at exact source revision      |
| Synthetic separation        | Personal facts do not populate the synthetic dossier or its derived features                                   | Pass at exact source revision      |
| Confidentiality             | Public evidence, failures, and logs contain no private release material or operation detail                    | Pass at exact source revision      |
| Private operation           | Only a coarse owner-approved Pass may become repository-visible after success                                  | See permitted coarse outcome below |
| Browser authentication      | Request-time authenticated owner-browser composition                                                           | Closed separately by Cycle 3a      |
| Same-user hostile processes | Resistance to hostile processes under the same operating-system user                                           | Unproven                           |
| Enterprise/shared service   | Tenancy, organizational approval, commercial redistribution, shared-service controls, and production operation | Out of scope                       |

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

- Exact source revision:
  `e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`.
- Exact predecessor and transition topology: direct-child chain
  `62c01dafe305ddd43c75688e0225163b3abdf6df` ->
  `e64924bc091bfc7a3e071e7db746910e082051c4` ->
  `e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`, with no merge commit. The
  implementation transition contains 43 paths, comprising 13 additions and 30
  modifications, with 3,840 insertions and 46 deletions. The corrective
  transition contains 5 modified paths, with 1,310 insertions and 9 deletions.
- Local verification: `corepack pnpm verify` passed formatting, lint,
  guardrails, type checks, peer checks, 1,573 tests with 8 intentional skips,
  and all production builds at the exact source revision.
- Public CI: general exact-source run `33344500398` passed through Ubuntu job
  `99345958471` and Windows job `99345958683`. Parser-isolation run
  `33344500394`, payload-custody run `33344500364`, and cross-engine run
  `33344500412` also passed at the exact source revision.
- Independent review: parallel read-only implementation, contract,
  adversarial, and privacy review completed with no remaining actionable
  P0/P1/P2 finding for the declared personal scope. This is source review, not
  an external audit.
- Coarse owner-approved private selected-fact release outcome: Pass for the
  exact frozen personal scope.

Public source gates prove only the bounded capability. Synthetic tests cannot
produce the permitted coarse private outcome. No promotion text contains
released facts or any private release detail.

## Next blocker

Cycle 3a separately closes request-time authenticated owner-browser composition
only for exact source revision `ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`.
Hostile same-user processes remain unproven. The next separate blocker is Cycle
3b authenticated personal dossier composition. Dynamic selection, refresh,
persistence, and background work remain later milestones. Enterprise and
shared-service controls remain Out of scope.

## Exit rule

Cycle 2z is promoted only for exact frozen source revision
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`. Promotion requires the public
source evidence above and the permitted coarse private outcome, without
asserting any private sub-result. It does not widen the response, selection,
application features, authentication claim, hostile-process claim, or profile.
