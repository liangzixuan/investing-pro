# Cycle 3b exit matrix

Scope: prepare one authenticated, startup-fixed, read-only, memory-only personal
dossier from one exact admitted frozen filing snapshot. The dossier, evidence
passports, in-manifest restatement lineage, fixed filing-fact chart, explicit
unsupported states, and valuation inputs must form one closed reference graph
with no synthetic/personal mixing. The decision is recorded in
[ADR 0054](./adr/0054-authenticated-personal-dossier-composition.md).

Implementation status: **Prepared public source only; exact source not yet
declared.**

Terminal verification status: **Pending.**

Private authorization and execution status: **Pending fresh exact owner review
and single-use authorization.**

Promotion status: **Not accepted or promoted.**

| Gate                       | Required result                                                                                                                                                                          | Current status                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Synthetic default          | Existing synthetic API and web behavior remain the default and unchanged                                                                                                                 | Prepared; terminal evidence pending            |
| Historical modes           | `personal_readiness` and `personal_fact_release` retain their exact prior contracts                                                                                                      | Prepared; terminal evidence pending            |
| Explicit dossier modes     | Only exact API and web `personal_dossier` configuration can compose or render the dossier capability                                                                                     | Prepared; terminal evidence pending            |
| Closed configuration       | Missing, partial, cross-mode, malformed, mismatched, or consumed inputs fail before listen                                                                                               | Prepared; terminal evidence pending            |
| Fixed plan                 | `exact_candidate_document_index.v1` fixes the terminal index of one separately sealed declaration, manifest, and quality-plan prefix plus canonical selected and chart keys              | Prepared; terminal evidence pending            |
| Prefix chronology          | Composition decodes only the matching raw/source array prefix; an earlier snapshot requires its own prefix-sealed artifact because a full manifest binds all later manifest entries      | Prepared; terminal evidence pending            |
| One normalization result   | Facts, evidence, lineage, chart, and valuation references come from one admitted normalization result                                                                                    | Prepared; terminal evidence pending            |
| Distinct personal contract | `PersonalFilingDossierDto` cannot be confused with or populated from synthetic `DossierDto`                                                                                              | Prepared; terminal evidence pending            |
| Closed reference graph     | Every identifier is canonical and every reference resolves exactly once inside the response                                                                                              | Prepared; terminal evidence pending            |
| Fact source of truth       | Facts are the sole primary-fact registry; chart, lineage, and valuation reference them, while derived evidence alone retains its exact immutable operands                                | Prepared; terminal evidence pending            |
| Evidence coverage          | Every displayed personal value retains `knownFrom`/`knownToExclusive` and links to same-snapshot evidence with source accession/concept, period, unit, accepted time, and available time | Prepared; terminal evidence pending            |
| Derivation coverage        | Every displayed derived value retains its versioned formula and exactly two ordered operands with role, concept, value, unit, and period                                                 | Prepared; terminal evidence pending            |
| Restatement lineage        | Supersession is limited to the exact frozen-manifest prefix; root-only and superseded states are explicit                                                                                | Prepared; terminal evidence pending            |
| Chart                      | The contract exposes honest unsupported state; terminal promotion requires a ready nonempty owner-approved chart using only same-snapshot fact references                                | Prepared; terminal evidence pending            |
| Valuation inputs           | The contract exposes honest unsupported state; terminal promotion requires ready same-snapshot required inputs with no synthetic fallback                                                | Prepared; terminal evidence pending            |
| Omission semantics         | Owner-fixed omissions and unsupported contract variants remain explicit; invalid, conflicting, stale, or quarantined composition fails closed behind generic unavailability              | Prepared; terminal evidence pending            |
| Exact routes               | The only dossier data operation is `GET /v1/personal-filing/dossier`; the browser uses parameter-free `/personal`, and neither surface admits request-selected state                     | Prepared; terminal evidence pending            |
| Authorization ordering     | The Cycle 3a owner session is accepted before private capability access or serialization                                                                                                 | Prepared; terminal evidence pending            |
| Request boundary           | Exact loopback Host/Origin, cookie, CORS, service-worker, proxy, negotiation, and framing checks remain fail closed                                                                      | Prepared; terminal evidence pending            |
| Cache denial               | Every success, denial, unavailable response, and malformed-request outcome is private and noncacheable                                                                                   | Prepared; terminal evidence pending            |
| Generic failure            | Denial and failure reveal no private value, label, key set, count, period, unit, locator, path, hash, metadata, authorization, or operation detail                                       | Prepared; terminal evidence pending            |
| Browser atomicity          | Authenticated load and every clear condition replace or remove the whole personal presentation as one unit                                                                               | Prepared; terminal evidence pending            |
| No browser persistence     | Response, lifecycle state, and derived presentation enter no Web Storage, IndexedDB, service worker, database, cache, telemetry, or log                                                  | Prepared; terminal evidence pending            |
| No mixing                  | No synthetic value enters a personal dossier, formula, chart, valuation, thesis evaluation, or error path                                                                                | Prepared; terminal evidence pending            |
| Personal thesis/alerts     | Personal thesis, alert evaluation, and persistence remain disabled                                                                                                                       | Explicit nonclaim                              |
| Dynamic work               | Dynamic selection, refresh, network fetch, persistence, and background work remain absent                                                                                                | Explicit nonclaim                              |
| Broader identity/data      | Security-master mapping, prices, multi-year statements, broad metrics, owner corrections, and external currentness remain absent                                                         | Explicit nonclaim                              |
| Remote/shared profile      | Remote, multi-user, tenant, shared-service, production, and enterprise controls remain outside the personal scope                                                                        | Out of scope                                   |
| Fresh approval             | Exact response requires a new `APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE` artifact; prior approvals are incompatible                                                                | Pending owner action after exact source freeze |
| Private activation         | Exact read-only, memory-only run succeeds once, consumes approval, revokes session, and closes server                                                                                    | Pending                                        |
| Public verification        | Full local gate, focused tests, Windows/Linux CI, and independent review pass at the exact source                                                                                        | Pending                                        |
| Promotion topology         | Exact merge-free source and documentation-promotion transitions are pinned and verified                                                                                                  | Pending                                        |

## Prepared scope

The new bundle role is `personal_dossier_release_bundle`; the plan role is
`personal_dossier_release_plan`. The exact loader surface is
`loadPersonalDossierRelease`, the branded API capability is
`PersonalDossierReleaseCapability`, and the response accessor is
`getPersonalDossierResponse`.

The API is selected only by exact
`RESEARCH_COCKPIT_MODE=personal_dossier`. The matching browser is selected only
by exact `RESEARCH_COCKPIT_WEB_MODE=personal_dossier` and renders at
parameter-free `/personal`. In that browser mode, `/research/[symbol]` redirects
before the symbol or `knownAt` can influence personal composition.

The plan is startup-fixed. No request can select a fact, document, chart,
snapshot, or historical cutoff. The selected document index is the terminal
entry of the separately sealed and admitted declaration, manifest, and
quality-plan prefix. Composition ignores raw/source document-array suffixes,
but a full manifest would still cryptographically bind its later entries. An
earlier snapshot therefore requires its own prefix-sealed artifact. All included
current or superseded versions, evidence, and lineage must be closed over that
prefix and the exact normalization used for candidate commitment.

`chartFactKeys` may be empty in the public contract, which produces
`chart.status: "unsupported"` with
`NO_OWNER_APPROVED_CHART_FACTS`. Missing or out-of-domain valuation inputs also
produce an exact unsupported variant. These are required fail-closed semantics,
but they do not independently close the end-user chart or valuation-input gate;
the later owner-approved response must make both ready for terminal promotion.

The browser may render the admitted facts, evidence passports, lineage, chart,
valuation inputs, and explicit unsupported states only after owner-session
authorization. The personal view has no synthetic fallback and does not enable
the existing browser-persistent thesis or alert workflow.

## Confidentiality and private gate

Public source and synthetic fixtures can prove only the bounded design. They do
not prove any private field or private execution result. Repository-visible
evidence must contain no private key, value, label, count, period, unit,
locator, source metadata, path, hash, response, authorization material,
commitment, or operation detail.

The exact Cycle 2z and Cycle 3a approvals cannot authorize the wider Cycle 3b
response. After the exact source and canonical response are frozen, the owner
must review every response field and provide one fresh single-use approval with
action `APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE`. No private execution is
authorized by this prepared document.

## Exact nonclaims

Cycle 3b makes no claim for dynamic selection or `knownAt`, network access,
filing or amendment discovery, external currentness, refresh, persistence,
background work, security-master mapping, prices, price history, broad
statements, multi-model valuation, owner corrections, general SEC authenticity
or taxonomy correctness, personal thesis/alerts/exports, hostile same-user or
hostile-browser resistance, remote/shared authentication, enterprise controls,
commercial use, or competitor feature parity.

## Exit and next blocker

Cycle 3b cannot be marked Pass until the exact-source public gates and the
fresh owner-authorized private activation both complete. A prepared source or a
large synthetic test count is not a substitute for that end-user result.

Cycle 3c is promoted only for exact provider-neutral, no-transport public source
revision `4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`. It remains separate, contains no
actual provider or external request, and cannot silently widen or promote this
offline Cycle 3b boundary. Cycle 3d is promoted only for its exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at
`3edb5464a3414313a980ffd9fecce5ca5257084a`. It has no actual personal vault,
key, backup, restore, or private activation and cannot silently make this Cycle
3b response durable. Cycle 3e-a owner-local security-master snapshot admission
and search is next, with no real breadth claim without an exact
rights-compatible source.

## References

- [ADR 0054](./adr/0054-authenticated-personal-dossier-composition.md)
- [Cycle 3c exit matrix](./CYCLE_3C_EXIT_MATRIX.md)
- [Cycle 3d exit matrix](./CYCLE_3D_EXIT_MATRIX.md)
- [Cycle 3a exit matrix](./CYCLE_3A_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](./BUILD_ROADMAP.md)
- [Threat model](./THREAT_MODEL.md)
- [Canonical model](./CANONICAL_MODEL.md)
