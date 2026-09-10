# Personal product-breadth roadmap

For current priorities and the short delivery plan, read
[Current work](./CURRENT_WORK.md). It orders the next useful slices without
changing the capability targets or historical acceptance requirements below.

Status: **Cycle 3a is promoted only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`. Cycle 3b is accepted and promoted
only for exact source revision
`3fe17a21330b6a8ee438298628a832f274fc7216`, with private evidence limited to
the permitted coarse outcome recorded in the Cycle 3b exit matrix. Cycle 3c is promoted only for exact
provider-neutral, no-transport public source revision
`4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`; it is not privately activated.
Cycle 3d is promoted only for its exact corrected public/local-temporary chain
rooted at `520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at
`3edb5464a3414313a980ffd9fecce5ca5257084a`; no actual personal vault, key,
backup, restore, or private activation has occurred. Cycle 3e-a is accepted and
promoted only for exact source revision
`5b547c88f213cfbc10450c460528a97ee395a834` and the declared personal scope,
with private evidence limited to the permitted coarse outcome recorded in its
exit matrix. Cycle 3e-a1 has a recorded public engineering Pass only
for exact source revision `0cf87021648e05c191eebbeb95aee6742c4c0f09` and
routing closure `5e27bed1a11956bb207f523739083131aea254f0`; no real source
or private operation is recorded. Cycle 3e-a2 has a recorded public engineering
Pass only for exact source revision
`8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and routing closure
`0374becdf96c1e9891d80e73024c8be0440fd812`; it records no real source,
breadth, latency, or private operation in that historical subcycle record.
Cycle 3e-b1 is implemented as the first visible discovery/watchlist slice;
Cycles 3g-a1 and 3g-b1 deliver the first market-data and transparent-analytics
slices; Cycles 3h-a1, 3h-a2, and 3h-a3 add annual statements, quarterly
statements, and valuation history; partial Cycle 3h-a4 adds quarterly coverage
and an offline compatibility assessment before source admission and TTM;
partial Cycle 3h-a5 adds selected-company SEC dated observations and filing joins;
Cycles 3i-a1 and 3i-a2 add historical
multiple bands and forward/reverse DCF; and Cycle 3j-a1 adds the first
selected-company quality and balance-sheet diagnostic while Cycle 3j-a2 adds a
bounded manual peer comparison, and Cycle 3k-a1 adds a whole-catalog identity
screener with encrypted saved criteria. A first partial Cycle 3k-a2 slice adds
seven SEC annual financial metrics and numerical filters; live catalog coverage
remains unmeasured. Later Cycle 3e-b work, full
3g/3h/3i/3j breadth, Cycle 3f, the metric-backed remainder of Cycle 3k, and
Cycles 3l through 3q remain planned.**
This does not alter
the exact historical Cycle 2z personal result or
make a feature-parity claim.

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
| Personal dossier composition            | Promoted fixed-snapshot composition only for its exact source       | Cycle 3b        |
| Connected source governance             | Provider-neutral public control plane promoted; no source activated | Cycle 3c        |
| Durable personal state                  | Public/local-temporary SQLite vault promoted; no actual vault       | Cycle 3d        |
| Security universe and local search      | Exact personal snapshot plus authenticated browser search           | Cycle 3e-a      |
| Browser discovery and local watchlists  | One typed durable primary list in an authenticated browser workflow | Cycle 3e-b1     |
| Automated filings and amendments        | Manually prepared exact filing corpus                               | Cycle 3f        |
| Quotes, price history, actions, charts  | On-demand Tiingo quote, six history ranges, actions, chart, table   | Cycle 3g        |
| Transparent technical indicators        | Five metrics plus three SMA trend classifications on loaded history | Cycle 3g-b      |
| Statements and metric depth             | Annual/quarterly 30-field views plus bounded core analytics         | Cycle 3h        |
| Valuation models and history            | Provider history, historical bands, and forward/reverse DCF         | Cycle 3i        |
| Peers, health, quality, and risk scores | 12-check diagnostic plus bounded manual peer comparison             | Cycle 3j        |
| Screener and saved views                | Whole-catalog identity query plus encrypted saved criteria          | Cycle 3k        |
| Earnings, dividends, news, calendars    | No daily event workflow                                             | Cycle 3l        |
| Analyst revisions and ownership events  | No analyst, insider, institutional, or 13F workflow                 | Cycle 3l-b      |
| Transcript discovery                    | No transcript metadata or permitted-text workflow                   | Cycle 3l-c      |
| Holdings and portfolio performance      | Snapshot valuation and a bounded transaction ledger                 | Cycle 3m        |
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

Status: **Accepted and promoted only for exact source revision
`3fe17a21330b6a8ee438298628a832f274fc7216`, with private evidence limited to
the permitted coarse outcome recorded in the Cycle 3b exit matrix.** See
[ADR 0054](./adr/0054-authenticated-personal-dossier-composition.md) and the
[Cycle 3b exit matrix](./CYCLE_3B_EXIT_MATRIX.md).

The promoted scope is exact API startup with
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
but those variants do not independently establish a private sub-result. The
private gate's status is represented only by the permitted coarse outcome.

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

The Cycle 3b contract requires fresh owner review of the canonical response and
one source-bound, single-use
`APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE` authorization. The prior Cycle
2z and Cycle 3a approvals remain incompatible. Cycle 3c has a separate promoted
connected-personal source-policy control plane and remains outside this offline
scope. It and every later cycle do not broaden this exact Cycle 3b promotion.

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
intentional skips, and its four workflows passed. Cycle 3e-a now has a recorded
owner-local security-master admission and symbol/name-search public engineering
Pass at terminal tip `fda5148a4251a36861196029bbc6df6b7d1a84d0`. Its local
gate passed 2,024 tests with 9 intentional skips; CI run `33691407884` passed
Ubuntu job `100450725750` and Windows job `100450725932`, and parser
`33691407866`, custody `33691407885`, and cross-engine `33691407952` acceptance
runs passed. No exact real snapshot or network access is authorized by either
result.

### Cycle 3e — security master, search, and watchlists

Target: move from one symbol to a useful local U.S. common-stock universe.

The roadmap splits this milestone into ordered boundaries. Cycle 3e-a is
accepted and promoted only for its exact personal source. Cycle 3e-a1 records
the separately reviewable historical offline source handoff, and Cycle 3e-a2
records the historical repository-owned measurement-integrity correction.
Cycle 3e-b1 supplies the first visible product boundary. Cycles 3g-a1 and 3g-b1
then add current quote/price history, charting, and transparent analytics; Cycle
3h-a1 follows with the first multi-year annual-statement slice.

#### Cycle 3e-a — owner-local security-master snapshot and search

Status: **Accepted and promoted only for exact source revision
`5b547c88f213cfbc10450c460528a97ee395a834` and the declared personal scope.
Private evidence is limited to the permitted coarse outcome recorded in the
Cycle 3e-a exit matrix.** See
[ADR 0057](./adr/0057-owner-local-security-master-snapshot-and-search.md) and
the [Cycle 3e-a exit matrix](./CYCLE_3E_A_EXIT_MATRIX.md).

Exit objectives:

- at least 3,000 active U.S.-listed common stocks and ADRs with stable internal
  identifiers, CIK and provider mappings, exchange identity, ticker-change
  history, and no duplicate active exchange-symbol identity;
- local symbol/name search with a measured p95 below 200 ms on the declared
  hardware and loaded universe under the exact fixed measurement plan.

Cycle 3e-a admits only an exact owner-local snapshot with explicit provenance,
digest, source-policy compatibility, and rights-compatible local use. Synthetic
scale cases verify the implementation but cannot establish a private result.
The separately authorized private gate is represented only by the permitted
coarse outcome.

The prepared engine enforces canonical bounded bytes, closed records, stable
issuer/security/share-class/listing/provider-mapping identities with canonical
1:N ancestry, exact U.S./operating-MIC declarations, observation-only ticker
chronology, explicit admitted/ineligible/unsupported/stale/quarantined counts,
and no duplicate active MIC-symbol pair. Search uses only active eligible
listings; its name matches cover issuer, security, and share-class names, with
fixed Unicode normalization, symbol/name ranking, stable tie breaks, a 128-
code-point raw query/name bound, a 512-normalized-code-point bound, and a
25-result cap. The separate owner-session-authenticated API exposes private/no-
store snapshot status and search only.
There is no browser search client, mutation, provider transport, vault write, or
request-selected local path.

The chosen future free/personal, U.S.-listed-only source profile is
`sec_openfigi_v1`:

- SEC `company_tickers_exchange.json` supplies the current CIK, name, ticker,
  and exchange candidate set;
- SEC submissions and issuer-filed Inline XBRL cover facts supply filing and
  security-title evidence for common-stock/ADR classification;
- OpenFIGI v3, with unlisted equities excluded, supplies candidate ticker/MIC
  and FIGI metadata that must reconcile unambiguously as provider mappings,
  never as internal identity; and
- one pinned ISO 10383 MIC snapshot supplies exchange identity.

The private gate reviewed and bound exact inputs, versions, retrieval metadata,
digests, applicable terms, and source-policy material. Those details remain
outside repository-visible evidence. Ambiguous reconciliation or disagreement
between issuer-filed cover classification and the OpenFIGI mapping is
quarantined. This profile defines
ticker and provider mapping ambiguity to include more than one external ID for
the same provider, mapping kind, and internal target. Source artifact URLs must
be canonical query/fragment-free HTTPS locations with no URI-authority
credential and must be owner-reviewed to contain no credential elsewhere in
the locator. This profile defines ticker history only as
`sec_filing_observed` or
`prospective_snapshot_observed` intervals, with prospective diffs keyed by
stable internal `listingId`; an OpenFIGI listing FIGI remains a mapping. These
labels cannot establish an exchange-effective time. Complete pre-observation
or exchange-effective history requires a separately rights-compatible licensed
corporate-actions source and is outside this free profile unless later added.

The measurement enforces 100 iterations over exactly 32 ordered queries that
are distinct after normalization at result limit 25. It reports nearest-rank
local p95 and binds its exact catalog, eligible count, digest, result limit,
ordered raw-query-set canonical-JSON-plus-LF SHA-256, declared hardware, and
synthetic or owner-local basis. A synthetic result is explicitly engineering-
only. The recorded Cycle 3e-a2 public engineering correction removes the caller-
supplied clock, requires exactly `(catalog, input)`, privately captures the
monotonic `node:perf_hooks` clock, and binds exact clock and timed-region
literals in the receipt. The later private gate passed under that exact plan;
its exact count, latency, hardware detail, snapshot, digests, and rows remain
outside repository-visible evidence.

#### Cycle 3e-a1 — offline `sec_openfigi_v1` source preparation

Status: **Recorded public engineering Pass only for exact merge-free source
revision `0cf87021648e05c191eebbeb95aee6742c4c0f09` and routing closure
`5e27bed1a11956bb207f523739083131aea254f0`. No real acquisition, provider
credential, owner authorization, private operation, or generated real snapshot
exists.** See
[ADR 0058](./adr/0058-offline-sec-openfigi-v1-source-preparation.md) and the
[Cycle 3e-a1 exit matrix](./CYCLE_3E_A1_EXIT_MATRIX.md).

At routing tip `5e27bed1a11956bb207f523739083131aea254f0`, the full local
gate passed 2,051 tests with 9 intentional skips. Exact-tip CI run `33806494548`
passed Windows job `100818110497` and Ubuntu job `100818110717`; custody run
`33806494300`, normalization run `33806494295`, cross-engine run `33806494318`,
and parser-isolation run `33806494364` also passed. This records only the
public offline source-preparation engineering boundary.

The exact public entry accepts digest and byte maps for six canonical roles:
`preparationPlan`, `secCandidates`, `normalizedSecCoverEvidence`,
`aggregatedOpenFigiMappings`, `isoMicRegistry`, and
`opaqueIdentityAssignments`. The role documents use fixed snake-case role
literals, profile `sec_openfigi_v1`, and schema `1.0.0`; the plan binds the
other five role digests and its exact stale cutoff. Fixed implementation limits
are not plan-selected. The module performs no retrieval. It validates closed
bounded canonical inputs and prevents row order from choosing reconciliation/
admission ordering, while exact-byte differences remain visible through
digests, provenance, and output source revision. It deterministically
reconciles SEC classification, OpenFIGI mapping, operating MIC, and supplied
opaque identities and separates admitted/ineligible/stale/unsupported/
quarantined counts before sending one canonical output through the recorded
admission engine.

A nonempty result returns a frozen aggregate receipt, an identity-bound single-
use capability, and synchronous `readSnapshot`. The factory wipes all six
captured source copies before returning. The first read attempt consumes the
capability, returns a fresh caller-owned snapshot copy on success, and wipes
the retained derived copy in all outcomes. A result with no admitted candidate
has no capability. Public failures and `exclusionReasonCounts` are fixed and
value-free, and public tests use synthetic artifacts, including the at-least-
3,000-row case.

Actual input acquisition, normalization, terms review, identity assignment,
and authorization remain owner-only. Every private artifact, key, path,
rejected row, restricted field, generated snapshot, measurement input, and
runner/retry/cleanup record stays outside Git and public logs. A real run needs
fresh exact single-use authorization. Cycle 3e-a1 public source cannot itself
satisfy breadth, latency, acceptance, or promotion.

#### Cycle 3e-a2 — package-owned security-master measurement clock

Status: **Recorded public engineering Pass only for exact merge-free source
revision `8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and routing closure
`0374becdf96c1e9891d80e73024c8be0440fd812`. No real source, snapshot,
breadth, declared-hardware latency, private operation, Cycle 3e-a acceptance/
promotion, or parity is recorded.** See
[ADR 0059](./adr/0059-package-owned-security-master-measurement-clock.md) and the
[Cycle 3e-a2 exit matrix](./CYCLE_3E_A2_EXIT_MATRIX.md).

The source revision passed 2,058 local tests with 9 intentional skips. Its
attempt-1 CI run `33816810188` passed Windows job `100850647775` and Ubuntu job
`100850648064`; custody run `33816810200`/job `100850647942`, normalization run
`33816810227`/job `100850647938`, cross-engine run `33816810267`/job
`100850648210`, and parser-isolation run `33816810173`/job `100850647900` also
passed. Final independent review was clean after the pre-commit timed-region
AST-order blocker was fixed.

The sole routing child passed 2,060 local tests with 9 intentional skips and
clean independent review. Its attempt-1 CI run `33823588896` passed Windows job
`100871341851` and Ubuntu job `100871342201`; custody run `33823588891`/job
`100871342729`, parser-isolation run `33823588916`/job `100871341920`, and
cross-engine run `33823588901`/job `100871342184` also passed. No routing-tip
normalization run was triggered or required because the exact five-path routing
transition did not match that workflow's path filters.

The exact measurement API has two arguments and rejects any third argument with
`PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID` before a hostile callback can
run. The package privately captures bound `performance.now` from
`node:perf_hooks` as `READ_MONOTONIC_MILLISECONDS`. Every receipt binds
`clock: "module_captured_node_perf_hooks_performance_now_monotonic"` and
`timedRegion: "normalize_request_and_search_in_memory_catalog"`; each sample
starts before normalization and ends after in-memory catalog search.

Focused hostile tests plus the static
`personalSecurityMasterMeasurementBoundaryViolation` guard and representative
mutations pin the arity, clock capture/use, timed region, receipt fields, and
lack of an alternate timing seam. This recorded work used no real source
operation, and public source plus synthetic timing cannot prove real breadth,
real latency, a below-200-ms result, Cycle 3e-a acceptance/promotion, or feature
parity.

#### Cycle 3e-b — browser discovery and owner-local watchlists

Status: **Cycle 3e-b1 is implemented and locally verified for the explicit
personal-workspace composition. Actual owner-private workspace startup remains
an explicit local operation; Cycle 3e-b2 is planned.**

Target: let the owner find a security in the admitted personal universe from
the browser and save it in a durable typed local watchlist.

Cycle 3e-b is split so the usable vertical slice lands before secondary
hardening:

- **3e-b1:** authenticated browser search over the admitted snapshot; one typed
  durable primary `My Watchlist`; add, remove, and reorder; inline notes;
  reload/restart persistence; and explicit loading, empty, error, conflict, and
  stale-snapshot states; and
- **3e-b2:** multi-list create/rename/delete, the same security across lists,
  tags, import/export, and the aggregate stress case.

Exit objectives:

- complete the 3e-b1 visible workflow before treating secondary hardening as a
  release blocker;
- 3e-b1 ships one primary typed watchlist with inline notes and the complete
  visible state model; and
- 3e-b2 adds multi-list CRUD, cross-list membership, tags, import, export, and a 10,000-membership aggregate
  stress case across all lists without a plan-imposed quota.

Each objective is admitted only for the exact loaded security-master snapshot;
it is not a claim of complete U.S. or global coverage.

Security and privacy remain acceptance criteria for every slice, not standalone
milestones unless they block correctness, private data, or credentials. Remote,
multi-user, tenant, shared-list, collaboration, cloud-sync, commercial,
redistribution, high-availability, and production-operation requirements are
outside this personal-only profile.

Cycle 3e-b1 composes one owner session, the admitted security-master status and
search routes, and a dedicated typed `main` watchlist route in one non-splitting
local API process. The `/discover` browser screen loads private data only after
owner authentication. It supports add/remove/reorder and notes, persists via the
encrypted SQLite vault rather than browser storage, tolerates unrelated legacy
watchlists, and leaves search available in a clearly read-only state when the
primary watchlist cannot be loaded. Public verification uses synthetic data; no
private row, path, digest, count, latency, credential, or activation is recorded
here.

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

Current implementation status: Cycle 3g-a1 delivers the first useful data
vertical slice through the existing authenticated `/discover` workspace. One explicit
owner action loads a Tiingo derived reference quote and a selected 1M, 3M, YTD,
1Y, 5Y, or 10Y EOD window for one catalog-bound US listing. The response carries
raw and adjusted OHLCV, cash dividends, split factors, provider attribution,
currency, source/ingestion time, quote kind, and a coarse freshness state. The
browser provides a price/volume chart, raw/adjusted switch, action markers, and
an exact semantic table. Missing configuration, coverage, rejected credentials,
rate exhaustion, provider failure, and stale data remain explicit; there is no
synthetic fallback.

Cycle 3g-b1 adds the first transparent analytical slice over that already
loaded response. It reports selected-window return, trailing 20-session
annualized log-return volatility, maximum drawdown with peak/trough dates,
trailing up-to-252-session close-range position, and 20/50/200-session
simple-moving-average trend classifications. Results recalculate when
raw/adjusted mode changes and
make formula identity/version, parameters, observed input dates and sessions,
rounding, warm-up, and the no-gap-fill policy inspectable. Insufficient history
and a zero range remain explicit. The calculation is pure and in-memory, makes
no additional provider request, emits no derived price series, and gives no
buy/sell rating.

The selected Tiingo Starter-compatible path is deliberately non-persistent:
provider values exist only in active owner-session memory and cannot be replayed
offline. Full 3g-a remains open until the declared 100-symbol/ten-year validation
gate and independent corporate-action golden reconciliation pass. A durable
offline price cache is applicable only if the owner later selects terms that
permit retention; it is not required for the non-persistent Starter path.
Full 3g-b remains open for a separately admitted benchmark series and relative
strength, plus any additional research indicators that satisfy the provider's
non-reconstructable aggregate-derivation boundary.

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

Target: expand the dossier from a ten-fact slice to inspectable statement and
fundamental depth.

Current implementation status: Cycle 3h-a1 adds a separately triggered Tiingo
fundamentals request for the exact catalog-bound listing already selected in
`/discover`. It displays up to ten annual periods across a fixed 30-field income
statement, balance-sheet, and cash-flow registry. Missing years and individual
provider omissions remain blank and explicit. Eight exact-decimal metrics and
three latest-year growth comparisons are calculated locally with inspectable
formulas and input references; a zero or negative prior-year base remains
explicitly not meaningful. Cycle 3h-a2 adds another explicit action over the
same registry for up to sixteen fiscal quarters, with exact missing-quarter
slots and `statementDate` labelled as the provider statement/release date. The
browser labels both responses as Tiingo's most-recent corrected history,
distinguishes missing fundamentals access from a rejected credential with a
fixed credential-test request after a 403, performs no automatic request, and
discards each response with the view or owner session. Cycle 3h-a3 adds an
independently triggered Tiingo fundamentals-daily view over the same six date
ranges as price history. It exposes market capitalization, enterprise value,
provider P/E, P/B, and trailing PEG 1Y with exact USD or unitless-ratio labels
and explicit unknown cells. The current provider-most-recent revision basis is
visible and is not presented as point-in-time or as-reported history.

Partial Cycle 3h-a4 adds a browser-local assessment of revenue and net income
over the latest four exact expected fiscal slots. It separates missing quarters
and unknown cells from missing fact-level period, flow-basis, unit, scope,
concept and revision evidence. An offline compatibility contract checks
standalone calendar-month periods and preserves unsupported cases; matching
declared metadata is not source verification. The loaded provider response
remains blocked and no TTM amount, new request or source admission is added.
See [quarterly compatibility](./PERSONAL_QUARTERLY_COMPATIBILITY.md).

Partial Cycle 3h-a5 adds a separate explicit SEC evidence view for one catalog
issuer. Company Facts observations retain exact USD values, dates, concepts and
accessions. Current Submissions supplies filing membership and metadata where
available; missing and conflicting joins stay visible. Same-end-date durations
and revision alternatives remain distinct. Neither filing-focus labels nor
calendar frames are assigned to fiscal slots. Shared SEC request pacing, bounded
loads and session cancellation support this source path; live coverage and
revision-operand admission remain open. See
[SEC quarterly evidence](./PERSONAL_SEC_QUARTERLY_EVIDENCE.md).

These are independently useful statement-depth slices, not full 3h-a. They do
not establish verified TTM aggregation, point-in-time/restatement history, the
planned 30-core-metric registry, 500-security coverage, 90% knownness, or the
20-issuer independent validation gate. TTM remains visibly unavailable because
the loaded quarterly contract lacks the fact-level evidence needed to establish
compatible durations, standalone flows, units, scope and revisions. Tiingo currently documents the full
fundamentals feed as an add-on and a three-year Dow 30 evaluation; the exact
owner entitlement therefore remains visible rather than assumed.

Promotable subcycles:

- **3h-a1:** provider-backed annual statement tables and a first transparent
  core-analytics set for one selected listing;
- **3h-a2:** provider-backed 16-quarter statement tables with exact fiscal
  coordinates, missingness, and fail-closed TTM gating;
- **3h-a3:** provider-backed daily history for five valuation fields, with
  fixed units, explicit missingness, and active-session-only custody;
- **3h-a4 (partial):** latest-four-slot revenue/net-income coverage and an
  offline compatibility assessment; source admission and aggregation remain open;
- **3h-a5 (partial):** selected-company SEC dated USD observations with filing
  joins and unresolved fiscal/revision metadata; no TTM aggregation;
- **3h-a:** normalized statements plus the 30 core metrics required by the
  initial screenable universe, including the declared breadth gates; and
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

- **3i-a1:** browser-local historical P/E and P/B bands for one selected
  listing, using an exact-date raw-close join, visible applicability and
  exclusion accounting, deterministic quartiles, and no new provider request;
- **3i-a2:** browser-local mechanical unlevered-FCF-proxy forward and reverse
  DCF for one selected listing, with three owner scenarios, exact-date market
  bridge and share-count proxies, and a 5-by-5 sensitivity table;
- **3i-a:** finish the direct/audited FCFF and applicability-validation breadth
  for the DCF, reverse-DCF, and historical-multiple models, including
  independent golden cases;
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

Cycle 3i-a1 is the first bounded slice. It admits a ratio only when the current
same-date provider multiple and raw close are positive and there are at least
60 positive observations in the selected window. It exposes P25, P50, and P75
multiple scenarios, implied prices, the current empirical percentile, exact
sample and exclusion counts, and formula/version metadata. It uses the
provider's most-recent corrected history, so it is historical context rather
than point-in-time fair-value history.

Cycle 3i-a2 adds an owner-editable forward DCF, a market-implied constant-growth
reverse DCF, and a 5-by-5 WACC/terminal-growth sensitivity table. Its starting
cash flow is explicitly a mechanical unlevered FCF proxy built from reported
free cash flow and after-tax reported interest expense; its share count is
implied from same-date market capitalization and raw close. Direct audited
FCFF, forecast feeds, financial-sector applicability, independent issuer
validation, composites, and the remaining Cycle 3i-a breadth stay open.

### Cycle 3j — peers, financial quality, and risk scorecards

Target: add transparent comparison and diagnostic workflows.

Promotable subcycles:

- **3j-a1:** a browser-local selected-company financial-quality and
  balance-sheet diagnostic over already loaded annual statements, with 12
  independently inspectable met/not-met/unavailable checks and no universal
  grade;
- **3j-a2:** owner-selected manual peer comparison over an explicitly loaded,
  bounded in-memory set, with exact fiscal/date/currency compatibility and
  visible small-sample limitations; and
- **3j-a:** deterministic automatic peer selection and sector-relative
  comparison only after an admitted sector/industry source and compatible
  multi-company snapshot exist.

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

Cycle 3j-a1 uses the latest exact annual period for current checks and only the
immediately preceding consecutive fiscal year for trend checks. It evaluates
positive net income, operating cash flow, and free cash flow; operating cash
flow above net income; positive revenue growth; nondeclining gross margin,
operating margin, and revenue to ending assets; positive shareholders' equity; current
ratio at least one; nondeclining current ratio; and nonrising debt to assets.
Each check carries its formula/version, exact reported observations, fiscal
coordinates, units, and source references. Missing or unusable operands make
only dependent checks unavailable; malformed envelopes or chronology quarantine
the whole result. Its summary is coverage accounting, not a score or rating.

The Cycle 3j-a1 slice is provider-most-recent and browser-memory-only. It is not
point-in-time, sector-adjusted, look-ahead-safe, or universally applicable, and
it does not claim peer comparison, percentiles, Piotroski, Altman, Beneish,
dividend safety, a recommendation, or full Cycle 3j.

Cycle 3j-a2 adds one selected company plus one to three peers chosen by the
owner from current search results or a reconciled current-snapshot My
Watchlist. Listing and issuer identifiers must both be distinct. Adding or
removing a peer is memory-only and makes no request. After at least one usable
selected-company source—annual or same-range valuation—is loaded, one explicit
per-peer action requests both existing annual-financial and valuation-history
routes, with at most two peer-load-originated provider reads in flight. Each peer can fail or remain partially
available without hiding the other companies.

The fixed 15-metric comparison covers revenue, market capitalization,
enterprise value, revenue growth, gross/operating/net/free-cash-flow margins,
net debt, debt to assets, current ratio, revenue to ending assets, P/E, P/B,
and trailing PEG 1Y. The selected company's latest fiscal year and latest
valuation point are the anchors; a peer must contain those exact coordinates,
and neither an older fiscal year nor a nearby valuation date is substituted.
Every company's statement/release date and response timestamp remains visible.
USD/provider-most-recent semantics are required, while missing inputs affect
only their cells. The result is a small owner-selected sample, not automatic
peer relevance, a sector benchmark or percentile, a point-in-time comparison,
a rank, winner, recommendation, financial-sector applicability claim, or full
Cycle 3j.

### Cycle 3k — typed screener and saved screens

Target: close the largest stock-discovery gap with reproducible, point-in-time
queries.

Promotable subcycles:

- **3k-a1:** a typed, snapshot-bound query over the admitted catalog's known
  identity fields, deterministic sort/pagination, customizable identity
  columns, and encrypted saved criteria definitions;
- **3k-a2:** extend the same query boundary to an admitted multi-company
  current snapshot with known/unknown semantics and the 30 core metrics plus
  price fields;
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

Cycle 3k-a1 is the usable catalog-screener foundation. One explicit local
operation evaluates a closed, AND-only query AST over the already admitted
active U.S.-listed common-stock and ADR identities. The initial predicates are
identity text, operating exchange MIC, instrument type, and exact CIK. Results
can be sorted by symbol, issuer name, MIC, instrument type, or CIK and are
returned in deterministic bounded pages with stable listing-identity
tie-breaks. Every request is bound to the exact catalog snapshot digest; the
engine accepts no SQL, provider URL, arbitrary field name, or unbounded page.

The browser exposes the screener as an explicit action, keeps result rows only
in active-session memory, and can open a selected company or add its exact
catalog identity to the existing watchlist. Column choices and up to 20 named
saved criteria definitions are stored as one versioned `settings` record in the
encrypted local vault with compare-and-swap and idempotency. Results and Tiingo
payloads are never stored with a saved screen. A definition records the
snapshot against which it was saved and must be visibly rerun against the
current snapshot when that digest changes.

All Cycle 3k-a1 fields are mandatory catalog identity fields, so their known
count equals the evaluated catalog denominator and their unknown count is zero.
This is not evidence that any financial field is populated. Cycle 3k-a1 makes
no provider request and does not add price, market-capitalization, valuation,
sector, growth, profitability, income, momentum, or risk filters;
three-valued metric semantics, the 30-field/500-security screenable-universe
gate, starter screens, historical point-in-time queries, ranking,
recommendations, export, and full Cycle 3k remain open for Cycle 3k-a2 and
later work.

### First partial Cycle 3k-a2 delivery

The [SEC annual financial screen](./SEC_ANNUAL_FINANCIAL_SCREENING.md) adds
seven annual size/profitability metrics, numerical AND predicates, visible
known/unknown counts and source periods, stable pages, and saved definitions.
Six fixed cross-company SEC Frames provide the source without per-company
fan-out. Missing or inconsistent facts remain unknown. This is a partial
implementation; no actual SEC request or owner-catalog coverage measurement
is recorded. Thirty metrics, 500 covered securities, per-field coverage and
independent validation remain the full-cycle targets. This does not change
the bounded historical claims for Cycle 3k-a1 above.

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

### First partial Cycle 3l-a delivery

[Recent SEC filings for My Watchlist](./WATCHLIST_SEC_FILINGS.md) adds explicit
7/30/90-day checks for up to 20 selected saved listings through the official SEC
submissions API. One request per distinct CIK preserves selected share-class
associations. The view includes filing dates/forms, source links, observation
times, issuer failures, unrequested coverage, and disclosed truncation. Requests
and results are bound to the saved watchlist version and admitted catalog.

This is filing metadata only. It does not complete the broader event calendar,
upcoming earnings, dividend, news, estimate, ownership, or transcript targets.
Live source and owner-catalog validation remain pending local configuration.

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

### First partial Cycle 3m-a delivery

[My Portfolio](./PERSONAL_PORTFOLIO.md) adds one encrypted manual holdings
snapshot for up to 20 admitted stock/ADR listings, optional cash and total cost
basis in USD, and quantity-confirmation dates. Explicit refresh reuses the
existing Tiingo adapter sequentially. Exact decimal calculations expose priced
subtotals, complete-value availability, unrealized change and allocation.
Missing, stale or mismatched quotes keep complete totals unavailable. Catalog
reconciliation preserves economic inputs only for consistent stable identities.

### Second partial Cycle 3m-a delivery

[The transaction ledger and safe CSV import](./PERSONAL_PORTFOLIO_LEDGER.md)
add explicit opening conversion, six transaction types, derived holdings/cash,
FIFO lots and realized estimates, recorded dividend/cash-flow totals, and a
reviewed import of up to 100 rows. The single encrypted ledger supports 20
registered identities and 250 transactions. Historical identities are retained;
current catalog admission is checked before pricing each open holding.

Opening holdings are aggregate pools, not reconstructed tax lots. Multiple
portfolios, actual tax accounting, broader corporate-action processing, historical
performance, TWR, XIRR and benchmarks remain open. These bounded deliveries do
not claim completion of Cycle 3m.

### Third partial Cycle 3m-a delivery

[Split reconciliation and history review](./PERSONAL_PORTFOLIO_CORPORATE_ACTIONS.md)
add an explicit schema 3 ledger with manually entered new:old split ratios,
exact remaining-share adjustment and rational FIFO basis preservation. Splits
require dated insertion and projection review; fractional precision failures
are rejected. Financial CSV imports preserve existing split records.

On-demand Tiingo EOD review checks exact registered identities, reports actual
observed-date coverage and compares split observations to recorded activities.
Known discrepancies withhold affected quotes from complete current totals.
Provider data stays transient and cannot automatically create ledger entries.
This does not cover all corporate actions or deliver historical performance.

### Fourth partial Cycle 3m-a delivery

[Historical portfolio valuation](./PERSONAL_PORTFOLIO_VALUATION_HISTORY.md)
reuses the explicit EOD review to calculate end-of-day ledger holdings and cash
at raw exact-date closes. A dated dot chart and paginated calendar table show
complete values, missing observations, unknown cash and unresolved splits.
The first/last complete observations have an explicitly dated dollar bridge
after recorded deposits and withdrawals. No provider data or derived series is
persisted. Percentage returns, TWR, XIRR and benchmark comparisons remain open.

### Fifth partial Cycle 3m-a delivery

[Endpoint percentage returns](./PERSONAL_PORTFOLIO_VALUATION_HISTORY.md#endpoint-percentage-return)
extend the same dated comparison for intervals without recorded deposits or
withdrawals. Both endpoints must be complete, and the displayed first value must
be positive. Any external-flow activity after the first through the last date
blocks the percentage, including offsetting deposits and withdrawals. Exact
integer division uses the displayed endpoint cents and rounds to two percentage
decimals, with halfway values away from zero.

The dollar bridge remains available for intervals with external flows. Missing
intermediate observations stay visible; the endpoint result does not fill those
gaps, annualize or calculate daily linked performance. The existing history
request and session invalidation are reused, with no schema or persistence
change. Flow-adjusted methods, TWR, XIRR, other corporate actions and benchmark
comparisons remain open.

### Sixth partial Cycle 3m-a delivery

[Modified Dietz period-return estimates](./PERSONAL_PORTFOLIO_VALUATION_HISTORY.md#cash-flow-adjusted-return-estimate-modified-dietz)
weight recorded deposits and withdrawals by remaining calendar days under a
declared end-of-day convention. They use the same complete dated endpoints,
displayed USD cents and exact arithmetic, preserving the endpoint percentage
and dollar bridge. Positive starting value and exact weighted capital are
required; estimates strictly below `-100%` are withheld before rounding under
the product's supported loss-range policy.

The panel labels the result as an estimate and explains timing, large-flow
distortion and eligibility in an accessible methodology disclosure. Missing
flow-date prices stay visible; no new data request, schema or persistence is
introduced. This does not close exact TWR, XIRR, benchmark or broader
corporate-action requirements.

### Seventh partial Cycle 3m-a delivery

[Linked period returns](./PERSONAL_PORTFOLIO_VALUATION_HISTORY.md#linked-return-end-of-day-flow-convention)
compound exact subperiod factors under a declared end-of-day flow convention.
Every date with a recorded deposit or withdrawal needs a complete value, even
when activities offset to zero. Missing non-flow dates remain visible without
changing the compared interval. Ineligible capital states and required missing
values have dated explanations; the endpoint percentage, Dietz estimate and
dollar comparison retain their own eligibility.

This uses the existing raw-price history, ledger, identity checks and transient
session state. It adds no provider request or stored schema. Full withdrawals
on the final date are distinguished from losses; empty/refunded episodes are
not silently joined. Exact intraday performance, XIRR, benchmarks, dividend
accruals and other corporate actions remain separate requirements.

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

### Active delivery priority (2026-09-10)

The first SEC annual cross-company Frames slice and recent watchlist filing
loads are delivered. Their configured live coverage and sampled values still
require validation; the seven-metric screen does not close the broader
30-core-metric/500-security gate.

Historical portfolio values, the dated dollar bridge, eligible endpoint
percentages and Modified Dietz estimates are delivered. The seventh partial
3m-a slice also delivers linked returns with complete values at every cash-flow
date under an explicit EOD convention. Missing flow-date values and unsupported
capital states remain unavailable; no intraday timing is inferred.

The active partial 3h-a5 slice adds bounded SEC observations and filing joins
beside the existing quarterly compatibility assessment.
Next validate fiscal calendars, standalone flow basis and revision selection
against independent filing evidence before calculating trailing-period financials or
expanding screening metrics. Broader return methods remain in the backlog.
XIRR, benchmark comparisons, dividend accruals and other corporate actions need
their own methodology and evidence.

Alerts and exports follow as their inputs and source permissions become
available. A permitted daily event slice may proceed independently when bulk
screening is source-blocked. Historical screening, broad filing automation,
large filter and model counts, and AI stay in the backlog while those everyday
workflows are missing. Fix correctness, credential, and privacy blockers within
the feature; unrelated governance and hardening do not become standalone
product milestones.

See [the current-work guide](./CURRENT_WORK.md) for the next slice's acceptance
checklist and the focused development/full-release verification loop.

### Dependency map and unchanged exit rules

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
- 3e-a1 depends on the recorded 3e-a engine/API boundary;
- 3e-a2 depends on the recorded 3e-a engine/API boundary; its exact public
  engineering Pass is now recorded;
- the real 3e-a exit depends on 3e-a1, the recorded 3e-a2 public engineering
  measurement boundary,
  plus separate owner-approved source
  preparation, admission, breadth, and declared-hardware measurement;
- 3e-b depends on 3e-a and 3d;
- 3f depends on 3c through 3e-a and may proceed alongside 3b;
- 3g depends on 3c through 3e-a and may proceed alongside 3f;
- 3h-a1 depends on the admitted catalog/owner-source controls and 3g-a1's
  provider composition; it can deliver normalized provider statements without
  waiting for automated filing ingestion;
- full citation-rich and point-in-time 3h-a lineage depends on 3f, while
  market-derived extensions also depend on 3g;
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
- [SEC current company ticker/exchange snapshot](https://www.sec.gov/files/company_tickers_exchange.json)
- [SEC EDGAR API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [SEC fair-access guidance](https://www.sec.gov/about/developer-resources)
- [OpenFIGI API documentation](https://www.openfigi.com/api/documentation)
- [OpenFIGI terms of service](https://www.openfigi.com/docs/terms-of-service)
- [ISO 10383 MIC source](https://www.iso20022.org/market-identifier-codes)

## Original diagnostic-model references

- [Piotroski, _Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers_](https://doi.org/10.2307/2672906)
- [Altman, _Financial Ratios, Discriminant Analysis and the Prediction of Corporate Bankruptcy_](https://doi.org/10.1111/j.1540-6261.1968.tb00843.x)
- [Beneish, _The Detection of Earnings Manipulation_](https://doi.org/10.2469/faj.v55.n5.2296)
