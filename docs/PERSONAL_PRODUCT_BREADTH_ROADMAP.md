# Personal product-breadth roadmap

Status: **Cycle 3a is promoted only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`. Cycle 3b has prepared public
source but no fresh owner authorization, terminal exact-source result, private
activation, acceptance, or promotion. Cycle 3c is promoted only for exact
provider-neutral, no-transport public source revision
`4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`; it is not privately activated.
Cycle 3d is promoted only for its exact corrected public/local-temporary chain
rooted at `520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at
`3edb5464a3414313a980ffd9fecce5ca5257084a`; no actual personal vault, key,
backup, restore, or private activation has occurred. Cycles 3e-a, 3e-b, and 3f
through 3q remain planned.** This does not alter the exact historical Cycle 2z
personal result or make a feature-parity claim.

## Goal

Maximize useful personal common-stock research coverage while preserving the
project's evidence-first, fail-closed design. Publicly listed capabilities from
broad retail research products, including Investing.com Pro+, are used only as
a gap-discovery benchmark. This project will not copy competitor data,
rankings, model formulas, reports, generated content, assets, or interface
structure; scrape a service that does not authorize it; or claim identical
behavior or feature parity.

Exact vendor counts vary by locale and over time. The numerical objectives
below are internal breadth and verification targets, not promises that a
competitor's proprietary catalog has been reproduced.

Investing.com and InvestingPro are third-party trademarks. This personal
project is not affiliated with, endorsed by, or a substitute for either
service. Benchmark references identify user jobs and gaps only.

## Profile boundaries

### Preserved offline profile

`personal_single_user_local` remains the default and current profile: one
owner, local-only offline research, no customers, no redistribution, and no
production service. The startup-fixed Cycle 2z release remains exact and
historical.

### Promoted connected control-plane source

`personal_single_user_local_connected` is promoted as a separate, explicit
opt-in provider-neutral control-plane profile. It does not yet connect to a
source. A later
execution gateway may retain one-owner local UI and storage while allowing only
configured outbound sources. Admission requires:

- an allowlist of exact hosts and operations;
- a versioned source-policy record covering provider product/tier,
  entitlement identifier, license/terms URI and version,
  effective/review/expiry dates, permitted purpose/geography/device,
  attribution, display, derivation, cache, history, export, retention,
  deletion, and termination;
- designated `owner-local-ref:v1:<store>:<entry>` owner-local secret locators
  held in policy, with no separate provider-credential startup field; locator
  identifiers must be non-secret operator metadata and credentials remain
  outside Git, browser storage, URLs, and logs;
- declared cache behavior, request/response byte ceilings, request-count and
  storage ceilings, and application-side estimated-spend budgets.

A later concrete execution gateway must separately add identified clients,
rate limits, bounded retry/backoff, and source-backed freshness plus
delayed/real-time labels before any live data feature can rely on them. Those
controls are not fields or admission claims of the promoted Cycle 3c registry.

Every admitted source has an owner-operated kill switch. Expired, revoked, or
incompatible terms disable its network operations and dependent refresh jobs
without silently falling back to another provider. Application budgets limit
work the project starts; they are not guaranteed provider billing ceilings.

Cycle 3c startup performs no credential-readiness probe and resolves no secret
reference. The core package prepares injected secret and transport interfaces,
but the API composes neither. A later execution gateway may resolve a reference
just in time only after exact policy and budget admission.

A configured source-policy record proves only that the application is bound to
the reviewed configuration. It is not legal advice or an organizational
approval. Personal use removes enterprise sign-off; it does not override a
source's terms.

### Dormant enterprise profile

Organizational rights/steward/counsel/key-authority signatures, tenants and
roles, billing, commercial redistribution, customer support, B15/V15,
10K/100K-user load and cost models, high availability, multi-region disaster
recovery, and production operations remain out of scope unless the user
explicitly widens the profile.

## Standard exit rules

Every Cycle 3 milestone must satisfy the applicable rules below before it is
promoted:

1. **Provenance:** every displayed or exported value records source, period,
   unit, observed time, known-at interval, and evidence locator.
2. **Derivation:** every calculated value records a versioned formula, exact
   inputs, rounding policy, and applicability rule.
3. **Source policy:** each external operation is allowed by a versioned local
   policy and honors attribution, cache, retention, deletion, and export
   constraints.
4. **Correctness:** independent golden cases or reconciliations cover the
   declared universe; unsupported ambiguity is quarantined rather than
   repaired silently.
5. **Failure semantics:** missing, stale, conflicting, delayed, rate-limited,
   unavailable, or quarantined inputs are visible and never replaced with
   fabricated values.
6. **Security and privacy:** personal data, provider credentials, raw private
   evidence, and restricted provider payloads do not enter logs, fixtures,
   Git, public CI, or unauthorized responses.
7. **Replay and recovery:** where source policy permits retention,
   network-derived results are reproducible from immutable local snapshots.
   Otherwise the application retains only permitted request/source metadata,
   digests, and normalized derived evidence, marks the result non-replayable,
   and refuses features whose required audit cannot be achieved. Stateful
   features pass migration, restart, deletion, backup, and restore checks as
   applicable.
8. **Product quality:** keyboard and semantic alternatives, measured bounds,
   relevant focused tests, and the full repository verification gate pass on
   Windows and Linux.
9. **Claim discipline:** release notes state the exact universe, sources,
   freshness, supported operations, omissions, and nonclaims. A breadth count
   alone never closes a capability gap.

## Universe and coverage vocabulary

Breadth claims use separate, named denominators:

- **catalog universe:** identity and mapping records for at least 3,000 active
  U.S.-listed common stocks and ADRs; catalog membership does not imply that
  research fields are populated;
- **screenable universe:** initially at least 500 catalog securities with the
  declared 30 core metrics populated or explicitly unknown;
- **price-history universe:** initially at least 100 declared symbols with the
  admitted history and corporate-action checks; and
- **validated regression universe:** at least 20 independently reviewed
  issuers across five industries for the declared filing and metric facts.

Every field, screen, model, and coverage report states its eligible
denominator and known, unknown, stale, unsupported, and quarantined counts.
Later subcycles may widen a universe only with the same checks.

## Gap-to-milestone map

| Capability gap                          | Current baseline                                                    | Planned closure |
| --------------------------------------- | ------------------------------------------------------------------- | --------------- |
| Owner authentication                    | Cycle 3a promoted only for its exact source                         | Cycle 3a        |
| Personal dossier composition            | Prepared fixed-snapshot composition; not promoted                   | Cycle 3b        |
| Connected source governance             | Provider-neutral public control plane promoted; no source activated | Cycle 3c        |
| Durable personal state                  | Public/local-temporary SQLite vault promoted; no actual vault       | Cycle 3d        |
| Security universe and local search      | One synthetic symbol                                                | Cycle 3e-a      |
| Owner-local watchlists                  | Generic vault record kind; no typed end-user workflow               | Cycle 3e-b      |
| Automated filings and amendments        | Manually prepared exact filing corpus                               | Cycle 3f        |
| Quotes, price history, actions, charts  | Synthetic reference price and one fundamentals chart                | Cycle 3g        |
| Transparent technical indicators        | No end-user price/volume indicator workspace                        | Cycle 3g-b      |
| Statements and metric depth             | Ten dossier metrics and a bounded private selected-fact set         | Cycle 3h        |
| Multi-model valuation                   | One exit-multiple model                                             | Cycle 3i        |
| Peers, health, quality, and risk scores | No end-user comparison or scorecards                                | Cycle 3j        |
| Screener and saved views                | No universe query                                                   | Cycle 3k        |
| Earnings, dividends, news, calendars    | No daily event workflow                                             | Cycle 3l        |
| Analyst revisions and ownership events  | No analyst, insider, institutional, or 13F workflow                 | Cycle 3l-b      |
| Transcript discovery                    | No transcript metadata or permitted-text workflow                   | Cycle 3l-c      |
| Holdings and portfolio performance      | No portfolio model                                                  | Cycle 3m        |
| Background delivered alerts             | One immediate local rule evaluation                                 | Cycle 3n        |
| Reports, exports, custom views          | No end-user export or saved layout                                  | Cycle 3o        |
| Evidence-grounded AI and strategies     | No model integration                                                | Cycle 3p        |
| Installable daily-use application       | Responsive local web demo                                           | Cycle 3q        |

## Wave 1 — usable personal core

### Cycle 3a — authenticated local owner session

Target: close the highest-priority request-time owner-browser blocker without
widening the offline data scope.

Status: **Accepted and promoted only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`. Private evidence is limited to
the permitted coarse outcome below.** See
[ADR 0053](./adr/0053-personal-local-owner-session.md) and the
[Cycle 3a exit matrix](./CYCLE_3A_EXIT_MATRIX.md).

The exact merge-free source transition is
`dd7fb5ea0b5c288f4337793dd6ddcb314f8b41f3` ->
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`: 39 paths, comprising 13 additions
and 26 modifications, with 6,543 insertions and 238 deletions. Local
`corepack pnpm verify` passed every gate; settled suite totals include 119 API,
94 web, and 582 database tests, with all remaining package suites passing and
only intentional skips. General CI run `33460175145` passed on attempt 1 in
Ubuntu job `99708487084` and Windows job `99708487035`; payload-custody run/job
`33460175120` / `99708486913` and cross-engine run/job `33460175088` /
`99708486675` also passed on attempt 1. Independent read-only source review
found no remaining actionable P0/P1/P2 issue for the declared personal scope;
this is not an external audit.

Coarse owner-approved private selected-fact release outcome: Pass for the exact
frozen personal scope.

Exit criteria:

- both explicit personal API modes require an operator-supplied exact
  64-lowercase-hex `RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET`; the API enforces
  only that shape, while generating and encoding 32 fresh CSPRNG bytes per
  process is an operator precondition; the API captures and deletes the value
  from its process environment before composition and listen and retains only a
  digest;
- the personal owner controls appear only under exact
  `RESEARCH_COCKPIT_WEB_MODE=personal_single_user_local`; the owner pastes the
  secret into a password field that clears on submission and sends it only in
  `X-Research-Cockpit-Bootstrap` on a bodyless POST;
- the one-time bootstrap establishes the sole active process-memory owner
  session in a host-only, nonpersistent `HttpOnly`, `SameSite=Strict` cookie
  scoped to `/v1/personal-filing`;
- Cycle 3a code places no bootstrap secret, session authority, or credential in
  Web Storage, IndexedDB, a durable cookie, a URL, a response body, or an
  application log;
- exact matching literal-loopback Origin and Host plus the fixed
  `X-Research-Cockpit-Intent` header enforce the CSRF boundary; before any
  personal fetch, the browser requires an exact literal-loopback HTTP API origin
  with an explicit valid port and no userinfo, path, query, or fragment; IPv4
  uses `http://127.0.0.1:3000`, IPv6 uses `http://[::1]:3000`, and `localhost` is
  not mixed with an API bound to `127.0.0.1`;
- a controlling service worker, or unreadable controller state, rejects personal
  calls before fetch; Cycle 3a registers no application service worker and stores
  no authority in application service-worker state;
- within one authority/process, bootstrap replay, normal valid reuse, rotation,
  logout, explicit revocation, process-close invalidation, a 10-minute monotonic
  idle expiry, and a 60-minute monotonic absolute expiry are enforced;
- the browser captures local lifecycle deadlines or observations before
  dispatching their corresponding bootstrap, revalidation, rotation, or
  protected-read requests, never later than server authorization; successful
  authorized private reads and rotation reset only local idle, while rotation
  preserves the known absolute deadline;
- a tab that discovers an active cookie without the original absolute timestamp
  receives only a conservative local lease bounded by the idle TTL, with no
  claim of exact browser/server deadline synchronization;
- `pagehide` and hidden visibility clear and deactivate local private
  presentation while preserving any known local deadline, without broadcasting or ending the server session; focus,
  `pageshow`, and visible transitions clear first and revalidate without polling;
  local expiry, logout, revocation, or failed revalidation immediately clears
  rendered private state;
- inability to construct the nonpersistent `BroadcastChannel` disables personal
  access, and a publish failure locks and clears the initiating tab;
- sibling invalidation is immediate only when the credential-free signal is
  delivered operationally; an already-active sibling that misses it falls back
  to focus/visible/`pageshow` revalidation or its conservative lease; bootstrap and
  rotation use the same fail-closed channel to request clear-then-revalidate;
  no lifecycle timestamp or signal enters Web Storage, IndexedDB, or a durable
  cookie;
- a fresh process can replace one syntactically valid stale owner cookie after
  restart or expiry, while malformed or duplicate cookies and every bootstrap
  attempted against an active session fail closed;
- every protected personal data route rejects missing, expired, cross-origin,
  malformed, revoked, or rotated authority before private work begins;
- tests protect both personal compositions; Cycle 3a's source binding is
  distinct, no private sub-result enters public evidence, and preserved Cycle
  2z evidence remains source-bound and unchanged;
- no credential or capability appears in a crash output or fixture; and
- synthetic API and web modes remain the defaults and unchanged.

This proves possession of the local session authority, not verified human
identity. The single-use and replay guarantee is scoped to one
authority/process; cross-process reuse of the same valid-shaped secret is not
detected and remains an explicit nonclaim. Hostile same-user processes, browser
extensions, developer tools, screenshots, clipboard readers, and memory
inspection remain explicit nonclaims, as does hostile browser state beyond the
narrow controlling-service-worker prefetch guard. Remote, multi-user, service,
and persistent authentication also remain outside this personal boundary. Cycle
3b dossier composition does not enter Cycle 3a.

The `personal_fact_release` owner authorization is a personal-profile gate, not
an enterprise/shared-service requirement. The preserved Cycle 2z evidence
remains bound to exact source `e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`;
Cycle 3a passed only for its own exact source. A later source requires fresh
owner review and fresh single-use authorization.

### Cycle 3b — authenticated personal dossier composition

Target: compose the admitted personal snapshot into the actual research
workflow instead of leaving it as a disconnected fact panel.

Status: **Prepared public source only; not owner-authorized, privately run,
terminally verified, accepted, or promoted.** See
[ADR 0054](./adr/0054-authenticated-personal-dossier-composition.md) and the
[Cycle 3b exit matrix](./CYCLE_3B_EXIT_MATRIX.md).

The prepared scope is exact API startup with
`RESEARCH_COCKPIT_MODE=personal_dossier`, exact browser startup with
`RESEARCH_COCKPIT_WEB_MODE=personal_dossier`, the parameter-free `/personal`
browser route, and authenticated `GET /v1/personal-filing/dossier`. The
`/research/[symbol]` route redirects before symbol or `knownAt` resolution in
this mode. One plan using
`exact_candidate_document_index.v1` fixes the document index, selected fact
keys, and chart keys. The index is the terminal entry of one separately sealed
and admitted declaration, manifest, and quality-plan prefix. Composition decodes
only the matching raw/source array prefix. An earlier snapshot requires its own
prefix-sealed artifact because a full manifest still binds every later manifest
entry. The result is a distinct `PersonalFilingDossierDto`. Facts are the sole
primary-fact registry; immutable derivation operands remain in evidence, while
lineage, chart, and valuation inputs reference those same-snapshot facts. There
is no synthetic fallback.

The public contract exposes honest unsupported chart and valuation variants,
but those variants do not close the end-user result. Terminal promotion
requires the later exact owner-approved response to contain a ready nonempty
filing-fact chart and ready same-snapshot valuation inputs.

Exit criteria:

- only an authenticated session can request or render the admitted personal
  snapshot;
- the dossier, evidence passports, restatement lineage, chart, and valuation
  inputs come from one coherent snapshot;
- synthetic and personal values cannot mix within a dossier, formula, chart,
  thesis evaluation, or error path;
- every displayed personal value has an evidence link and explicit omission or
  unsupported states remain visible;
- responses remain private and no-store; and
- adversarial tests find no private value, label, count, path, hash, or
  authorization leakage through denial and failure surfaces.

Dynamic selection, refresh, promoted personal persistence, and background work
remain later outcomes.

The prepared Cycle 3b source does not authorize private execution. Promotion requires
fresh owner review of the exact canonical response and one source-bound,
single-use `APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE` authorization. The
prior Cycle 2z and Cycle 3a approvals are incompatible. Cycle 3c now has a
separate promoted connected-personal source-policy control plane and remains
outside this offline scope.

### Cycle 3c — connected-personal profile and source-policy registry

Target: prepare the admission and owner-control boundary required before any
later network access, without silently widening the completed offline profile.

Status: **Accepted and promoted only for exact provider-neutral public source
revision `4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`; not privately activated.** The
promoted control plane includes no actual provider/source
credential, provider secret adapter, external request, entitlement or legal
determination, provider billing ceiling, SEC refresh, or market-data adapter. See
[ADR 0055](./adr/0055-connected-personal-source-policy-registry.md) and the
[Cycle 3c exit matrix](./CYCLE_3C_EXIT_MATRIX.md).

Promoted interfaces:

- package `@research-cockpit/connected-source-policy` publishes
  `CONNECTED_SOURCE_POLICY_SCHEMA_VERSION`,
  `CONNECTED_SOURCE_POLICY_PROFILE`, `CONNECTED_SOURCE_POLICY_OPERATIONS`, and
  `CONNECTED_SOURCE_POLICY_STATUSES`;
- `parseConnectedSourcePolicyConfig` accepts only the exact enabled or disabled
  configuration, while `createConnectedSourcePolicy` returns a process-memory
  controller with exact `status`, `kill`, `admitSourcePolicy`,
  `authorizeOperation`, `reserveBudget`, and `execute` seams;
- exact API mode is `personal_single_user_local_connected`; startup keys are
  `CONNECTED_SOURCE_POLICY_BUNDLE_PATH`,
  `CONNECTED_SOURCE_POLICY_BUNDLE_SHA256`, and
  `CONNECTED_SOURCE_POLICY_SECRET_REFERENCE`;
- bundle paths must be drive-qualified on Windows or single-rooted on POSIX;
  UNC, device-namespace, double-root, and root-relative Windows forms fail
  before file access, while mapped/network-mounted backing remains an operator
  precondition;
- a separate non-splitting `connected-server` entry owns this mode; the
  ordinary server refuses it, and the exact connected static graph excludes
  demo, personal-corpus, dossier/fact, research-state, and command-execution
  modules; and
- within the connected-source-policy business/control surface, the API composes
  only authenticated
  `GET /v1/personal-filing/connected-source-policy/status` and bodyless
  `POST /v1/personal-filing/connected-source-policy/kill` with intent
  `connected-source-policy-kill`; the dedicated app also exposes health and the
  five inherited owner-session lifecycle routes, none of which provide provider
  transport.

Exit criteria:

- the connected profile is disabled by default and cannot inherit an offline
  release implicitly;
- exact host/operation pairs support only the closed operations
  `fetch_metadata`, `fetch_snapshot`, and `fetch_history`; the API composes no
  outbound transport;
- each source has a versioned machine-readable policy naming its exact product
  or tier, entitlement identifier, terms/license URI and version,
  effective/review/expiry dates, permitted purpose/geography/device, use,
  attribution, cache, history, export, retention, deletion, and termination;
- expiry, revocation, or policy incompatibility preserves its distinct terminal
  status and denies eligibility before further network or dependent refresh
  work; it does not synthesize an owner kill;
- owner-set request-count, request-byte, response-byte, storage-byte, and
  estimated-spend-microunit budgets fail closed before excess work starts,
  without claiming to guarantee the provider bill;
- policy stores only the designated locator grammar and startup has no separate
  provider-credential field; the operator must keep locator identifiers and
  status-visible source/policy identifiers non-secret, startup performs no
  credential-readiness probe, and resolves no secret;
- the abstract owner-local secret and transport seams remain uncomposed by the
  API; a later gateway may resolve just in time only after policy and budget
  admission;
- status and kill remain owner-session-authenticated, parameter-free,
  private/no-store, credential/reference-free, and generic on denial; and
- focused hostile tests, full repository verification, Windows/Linux CI,
  independent review, and exact source topology pass before promotion.

Cycle 3d has a separate promoted public/local-temporary result. It has no actual
vault or private activation and does not make the Cycle 3c process-memory
policy, kill, reservation, replay, or budget state durable.

### Cycle 3d — durable local research vault

Target: provide restart-safe personal state behind the existing application
ports without introducing tenant or cloud scope.

Status: **Accepted and promoted only for the exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at terminal routing
closure `3edb5464a3414313a980ffd9fecce5ca5257084a`. No actual personal vault,
recovery key, backup, restore, or private activation has been performed.** See
[ADR 0056](./adr/0056-durable-personal-local-research-vault.md) and the
[Cycle 3d exit matrix](./CYCLE_3D_EXIT_MATRIX.md).

Exit criteria:

- theses, settings, watchlists, alert definitions, job state, and later
  portfolio records survive restart through a real local adapter;
- optimistic concurrency, idempotency, schema migration, explicit deletion,
  corruption detection, and clean rollback are tested;
- database and secret files are restricted to the owner account;
- an encrypted backup and offline absent-root restore reproduce declared record and
  attachment digests; and
- the browser contains only short-lived presentation state, not the durable
  source of truth.

The promoted source uses exact profile `personal_single_user_local_vault`, one
startup-fixed owner-only root, and exact SQLite V2. New initialization applies
the reviewed V1 base and V2 unique-ledger-request-binding suffix atomically;
opening fully verified V1 may run only that reviewed migration, with failure
rolling back to retryable V1 and arbitrary/unreviewed migrations rejected.
Verification uses full `PRAGMA integrity_check(1)`. Runtime behavior adds
optimistic concurrency, idempotency, tombstones, payload-free audit metadata,
and fail-closed corruption/restart handling.

Record payloads and attachment bytes use AES-256-GCM; this is not full-file,
filesystem, memory, or forensic encryption. The backup KDF uses the current
fixed domain-separation salt and fresh random GCM nonces, not a claimed random
salt for each backup. Backup snapshot staging is unique, external, owner-only,
and identity-pinned; final publication is a same-directory no-replace hard link
from the synced pending file followed by pending-name unlink and final
verification. Recovery requires the separate key, and old backups may
reintroduce deleted records.

The owner-authenticated HTTP surface is record-only. Attachments, backup, and
restore remain package interfaces, and no browser vault client, migration UI,
provider connection, scheduler execution, delivered alert, remote service,
tenant, or production boundary is included. The demo thesis/alert form is page
memory only so it cannot become a competing browser-durable source.

The full repository gate at terminal routing closure
`3edb5464a3414313a980ffd9fecce5ca5257084a` passed 1,906 tests with 9
intentional skips, and its four workflows passed. Cycle 3e-a owner-local security-master
snapshot admission and symbol/name search is the next planned functional slice.
No security-master load or network access is authorized by the Cycle 3d result.

### Cycle 3e — security master, search, and watchlists

Target: move from one symbol to a useful local U.S. common-stock universe.

The roadmap splits this milestone into two independently useful, ordered slices.
Cycle 3e-a is next; Cycle 3e-b builds on its stable identities.

#### Cycle 3e-a — owner-local security-master snapshot and search

Exit objectives:

- at least 3,000 active U.S.-listed common stocks and ADRs with stable internal
  identifiers, CIK and provider mappings, exchange identity, ticker-change
  history, and no duplicate active exchange-symbol identity;
- local symbol/name search with a measured p95 below 200 ms on the declared
  hardware and loaded universe.

Cycle 3e-a admits only an exact owner-local snapshot with explicit provenance,
digest, source-policy compatibility, and rights-compatible local use. Synthetic
scale cases may verify the implementation but cannot establish a real-universe
breadth result. No network adapter or real snapshot is authorized by the Cycle
3c or Cycle 3d public promotions.

#### Cycle 3e-b — owner-local watchlists

Exit objectives:

- owner-local watchlist CRUD, tags, ordering, notes, import, export, and a
  10,000-membership aggregate stress case across all lists, allowing the same
  security to appear in multiple lists, without a plan-imposed quota.

Each objective is admitted only for the exact loaded security-master snapshot;
it is not a claim of complete U.S. or global coverage.

### Cycle 3f — automated SEC filing refresh and amendment discovery

Target: replace manual frozen-corpus preparation with an explicitly enabled,
replayable filing workflow.

Exit criteria:

- the fetcher identifies itself, honors the SEC access policy, uses a global
  limiter below the published ceiling, caches, backs off, and supports
  conditional requests;
- each retrieval records accession, source URL, retrieval metadata, raw digest,
  immutable snapshot, custody receipt, and original/amendment chronology;
- duplicate accessions are idempotent and changed bytes under the same claimed
  identity are quarantined;
- stale, unavailable, malformed, oversized, unsupported, and ambiguous filings
  produce explicit states; and
- a reviewed public regression universe covers at least 20 issuers across five
  industries with zero silent critical failures for the declared fact set.

No claim extends to every issuer, custom taxonomy, dimension, or filing type.

### Cycle 3g — licensed market data, corporate actions, and charting

Target: add price context without mislabeling delayed data or violating source
terms.

Promotable subcycles:

- **3g-a:** entitlement-labelled quotes, daily price history, and corporate
  actions for the declared price-history universe; and
- **3g-b:** original, transparent price/volume analytics needed for trend,
  momentum, volatility, drawdown, and relative-strength research. Every
  indicator records its versioned formula, parameters, warm-up interval, and
  missing-session policy.

Exit criteria:

- one owner-selected provider adapter supplies entitlement-labelled quotes and
  at least ten years of daily adjusted and unadjusted OHLCV for 100 declared
  symbols;
- source time, ingestion time, currency, venue/session, delay class, and stale
  state are retained;
- splits, cash dividends, and adjusted/unadjusted series reconcile against
  independent golden cases;
- provider outage, rate exhaustion, invalid credentials, and stale cache are
  visible; policy-permitted cached snapshots remain replayable offline and
  policy-restricted results are visibly non-replayable; and
- restricted provider payloads cannot cross an operation whose source policy
  forbids display, derivation, retention, or export.

## Wave 2 — research breadth

### Cycle 3h — financial statements and metric registry

Target: expand the dossier from a ten-metric slice to inspectable statement and
fundamental depth.

Promotable subcycles:

- **3h-a:** normalized statements plus the 30 core metrics required by the
  initial screenable universe; and
- **3h-b:** metric-registry expansion toward at least 120 reported or derived
  metrics, admitting each only when it supports a named research job and has
  applicability and validation evidence.

Breadth objectives:

- income statement, balance sheet, and cash-flow views with ten annual years
  for every eligible issuer/source pair that supplies at least ten years;
  otherwise all available years are shown and each missing year is explicit;
- up to 16 quarters and TTM where the admitted source supports them; and
- for the 30 core metrics, at least 90% known, non-stale values across eligible
  security-metric pairs in the at-least-500-security screenable universe. The
  report separately lists inapplicable pairs and all unknown, stale,
  unsupported, and quarantined pairs.

Exit requires inspectable formulas, units, periods, dimensions, currency and
share conversions, restatements, missingness, and coverage reports. Unsupported
values remain unknown rather than coerced to zero. The validated regression
universe of at least 20 issuers is independently checked; it is not substituted
for the broader coverage denominator.

### Cycle 3i — transparent valuation suite and fair-value history

Target: replace the single exit-multiple scenario with an original,
inspectable multi-model valuation workspace.

Promotable subcycles:

- **3i-a:** FCFF DCF, reverse DCF, and historical-multiple models with
  applicability gates, scenarios, and independent golden cases;
- **3i-b:** expansion to at least eight transparent families and at least 12
  variants only where each variant supports a distinct owner research job;
  and
- **3i-c:** point-in-time fair-value history, uncertainty, and an inspectable
  owner-selected composite.

Breadth objectives:

- coverage may include FCFF/FCFE DCF, reverse DCF, historical multiples,
  peer-implied multiples, dividend discount, residual income, owner earnings,
  and exit models where their applicability gates pass;
- conservative, base, and expansion scenarios with sensitivity tables;
- explicit model-applicability gates, composite weights, uncertainty, and
  reference-price timestamps; and
- at least 20 independently calculated golden cases within declared decimal
  tolerances.

The models are original transparent analogues. They are not a reproduction of
any vendor's Fair Value formulas or ratings.

### Cycle 3j — peers, financial quality, and risk scorecards

Target: add transparent comparison and diagnostic workflows.

Exit criteria:

- deterministic peer selection with a visible rationale and manual override;
- at least 30 comparable peer columns with point-in-time sector and currency
  semantics;
- versioned Piotroski, Altman, Beneish, dividend-safety, growth-quality, and
  balance-sheet scorecards with every component traceable to admitted inputs;
- reproducible sector-relative percentiles that cannot observe future data;
  and
- applicability and insufficient-data states instead of universal scores.

These are original diagnostics, not copies of proprietary Health Score or
instant-insight products.

### Cycle 3k — typed screener and saved screens

Target: close the largest stock-discovery gap with reproducible, point-in-time
queries.

Promotable subcycles:

- **3k-a:** typed query AST, deterministic sort/pagination, known/unknown
  semantics, saved views, and the 30 core metrics plus identity and price
  fields;
- **3k-b:** field expansion toward 120 or more filters only where each field
  has coverage and a named discovery job; and
- **3k-c:** 24 independently designed starter screens, then expansion toward
  60 only when each added screen has a distinct hypothesis and validation
  case.

Breadth objectives:

- a typed query AST with no caller-supplied SQL;
- customizable columns and migrated saved views;
- starter screens across value, quality, growth, income, momentum, and risk;
  and
- a catalog-universe current-snapshot screen below one second p95 on the
  declared hardware, with known and unknown result counts.

Three-valued filter semantics must distinguish true, false, and unknown.
Historical screens must be snapshot-reproducible and look-ahead safe. Unless a
starter screen is explicitly labelled sparse, its required fields must be
known for at least 90% of its eligible denominator and at least 500 securities.

## Wave 3 — daily operating workflow

### Cycle 3l — earnings, dividends, news, and event calendars

Target: provide the daily event context needed to monitor a personal universe.

Promotable subcycles:

- **3l-a:** earnings, dividends, filings, permitted news metadata, and event
  calendars;
- **3l-b:** analyst estimates/targets/ratings/revisions plus insider,
  institutional, and 13F ownership events only from an admitted licensed or
  official source; and
- **3l-c:** transcript discovery and metadata, with full text, search, summary,
  retention, and export enabled only where the exact source policy permits
  each operation.

Exit criteria:

- at least eight quarters of actual, estimate, surprise, and revision history
  where the admitted provider supplies it;
- dividend history, sustainability inputs, declaration/ex/pay dates, and
  split-adjusted continuity;
- filing, earnings, dividend, and selected macro calendars with explicit time
  zone and revision semantics;
- a watchlist news feed that retains attribution, source link, publication and
  ingestion times, and deterministic duplicate resolution; and
- no copyrighted full text is retained or exported unless the source policy
  explicitly permits it.

Unavailable entitlements remain explicit conditional gaps; they do not block
promotion of an independently useful, accurately labelled subcycle.

### Cycle 3m — personal portfolio analytics

Target: add holdings, allocation, income, and performance without broker or
trading scope.

Exit criteria:

- multiple local portfolios, manual transactions, and safe CSV import;
- lots, cost basis, realized/unrealized return, time-weighted return, XIRR,
  allocation, income, and benchmark comparison;
- independently calculated cases for deposits, withdrawals, fees, splits,
  dividends, spin-offs, ticker changes, and supported currency conversions;
- explicit missing-price and stale-price behavior; and
- encrypted backup/restore and deletion preserve the personal privacy
  boundary.

Broker order entry and execution remain out of scope. A future read-only broker
adapter requires its own credential and reconciliation milestone.

### Cycle 3n — background alerts and delivery

Target: turn immediate local rule evaluation into a reliable monitoring
service.

Exit criteria:

- rules cover admitted price/volume, filing, metric, valuation, earnings,
  dividend, news, portfolio-drift, and thesis-invalidation events;
- the local OS notification channel is required and an owner-configured email
  channel is optional;
- persistent scheduling handles restart, missed runs, time zones, DST, quiet
  hours, cooldown, revocation, and stale-source refusal;
- evaluation and delivery are idempotent with duplicate suppression, receipts,
  bounded retries, and visible terminal failures; and
- a seven-day accelerated soak has no duplicate or silently lost terminal
  deliveries within the declared workload.

No “unlimited” or exactly-once claim is made without a measured bound and a
stronger delivery proof.

### Cycle 3o — reports, exports, and customizable research views

Target: make the workspace portable and reproducible for offline personal work.

Exit criteria:

- saved widget/metric layouts and custom table views survive migration;
- dossier, screen, valuation, peer, alert, and portfolio exports support CSV
  and JSON, plus polished PDF or XLSX where the artifact benefits from it;
- every export contains its as-of time, source-policy manifest, snapshot and
  model versions, omissions, and evidence appendix;
- CSV injection, spreadsheet formula, path, overwrite, private-file, and
  restricted-field attacks fail closed; and
- canonical JSON and CSV reproduce byte-for-byte with pinned generation
  fields; PDF and XLSX reproduce the same declared content and pass render or
  semantic verification, but are byte-exact only when the generator,
  metadata, and compression settings are pinned.

## Wave 4 — optional intelligence and polish

### Cycle 3p — evidence-grounded AI and strategy research

Target: add useful natural-language and idea-generation workflows without
inventing facts, copying proprietary products, or promising returns.

Exit criteria:

- an opt-in local model or owner-key provider adapter with explicit privacy and
  retention settings;
- cited dossier Q&A, filing and earnings summaries, and natural-language
  screener construction;
- every numeric claim resolves to admitted evidence or the answer is
  “unknown”;
- prompt-injection, source-confusion, citation-mismatch, private-data leakage,
  and unsupported-recommendation evaluations fail closed; and
- original transparent strategies use versioned rules, point-in-time data,
  declared fees/slippage, walk-forward evaluation, and reproducible results.

No automated trading, generated financial facts, profit promise, or imitation
of proprietary stock-pick or assistant behavior is authorized.

### Cycle 3q — installable personal app and daily-use hardening

Target: make the completed breadth dependable for daily personal use.

Exit criteria:

- an installable responsive PWA with an explicit offline/read-only mode;
- keyboard-complete workflows and a recorded WCAG 2.2 AA audit;
- primary page and query p95 below two seconds on the declared hardware and
  loaded data set;
- bounded cache/disk growth, crash-safe jobs, migration rollback, corrupted
  snapshot recovery, and a backup/restore drill; and
- a 30-day local soak with no unresolved P0/P1 defect in the declared personal
  workflow.

Native app stores, cloud synchronization, global multi-asset breadth, and
commercial support remain later profile decisions rather than blockers for the
common-stock personal program.

## Conditional and deferred gap register

This program does not imply that every benchmark feature is obtainable:

- analyst estimates, targets, ratings, and revisions are conditional on a
  licensed entitlement in 3l-b;
- insider and institutional ownership use official filing data where
  sufficient, with licensed enrichment conditional on 3l-b source rights;
- transcript metadata and links may enter 3l-c, while full text, search,
  summary, retention, and export remain individually rights-gated;
- original transparent technical indicators enter 3g-b; proprietary signals
  and copied formulas do not;
- full real-time or intraday depth remains unavailable unless the exact
  entitlement authorizes its use, retention, derivation, and display;
- international equities, funds, commodities, currencies, bonds, derivatives,
  and other multi-asset coverage are deferred to a later declared profile;
- native app-store distribution and cloud synchronization are deferred;
- broker execution and automated trading are out of scope; and
- proprietary competitor data, models, scores, rankings, reports, generated
  content, and interface behavior are unavailable by design.

## Release order and stopping rules

Delivery is dependency-guided, not a strict alphabetic chain. The four waves
remain the default planning order:

1. **Usable personal core:** 3a through 3g.
2. **Research breadth:** 3h through 3k.
3. **Daily operating workflow:** 3l through 3o.
4. **Optional intelligence and polish:** 3p through 3q.

The dependency graph is:

- 3b depends on 3a;
- 3c and 3d depend on 3a and may proceed in parallel;
- 3e-a depends on 3c and 3d;
- 3e-b depends on 3e-a and 3d;
- 3f depends on 3c through 3e-a and may proceed alongside 3b;
- 3g depends on 3c through 3e-a and may proceed alongside 3f;
- 3h-a depends on 3f; market-derived extensions also depend on 3g;
- 3i depends on the applicable 3g and 3h subcycles;
- 3j depends on 3g and 3h;
- 3k depends on 3e-a, 3h, and the applicable 3j inputs;
- 3l subcycles depend only on the source and data capabilities they consume
  from 3c, 3e-a, 3f, 3g, and 3h;
- 3m depends on 3d, 3e-a, 3g, and applicable 3h inputs;
- each 3n alert type depends on 3d plus the feature that supplies its event;
- each 3o export depends only on the workflow it exports;
- 3p depends on the admitted 3h through 3o evidence it consumes; and
- 3q hardens capabilities incrementally, with the final soak after the target
  personal workflow is complete.

A milestone may be split into thinner bounded subcycles when each has an
independently useful end-user result and exact exit evidence. It may not be
promoted by renaming a missing feature, relaxing an earlier private-data
boundary, or substituting test volume for the declared end-user result. If a
provider does not grant a required operation, the affected feature stays
unavailable or is redesigned around a permitted source; the application does
not scrape around the restriction.

## External references informing source boundaries

- [InvestingPro plan comparison](https://www.investing.com/pro/pricing/plans)
- [Investing.com API availability statement](https://pro.investing-support.com/hc/en-us/articles/4408847632017-Do-You-Offer-API-Access-at-Investing-com)
- [Investing.com terms](https://www.investing.com/about-us/terms-and-conditions)
- [SEC EDGAR API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [SEC fair-access guidance](https://www.sec.gov/about/developer-resources)

## Original diagnostic-model references

- [Piotroski, _Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers_](https://doi.org/10.2307/2672906)
- [Altman, _Financial Ratios, Discriminant Analysis and the Prediction of Corporate Bankruptcy_](https://doi.org/10.1111/j.1540-6261.1968.tb00843.x)
- [Beneish, _The Detection of Earnings Manipulation_](https://doi.org/10.2469/faj.v55.n5.2296)
