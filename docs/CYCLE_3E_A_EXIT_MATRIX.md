# Cycle 3e-a exit matrix

Scope: prepare exact owner-local security-master snapshot admission,
deterministic in-memory symbol/name search, and one owner-session-authenticated
read-only API mode without adding a source download, provider credential,
network adapter, real catalog, browser client, watchlist workflow, or
enterprise/shared-service scope. The decision is recorded in
[ADR 0057](./adr/0057-owner-local-security-master-snapshot-and-search.md).

Implementation status: **Recorded public engineering Pass for the exact
merge-free source/stabilization chain from
`5186103977b906d3c035599b3b2b00793926fca3` through
`fda5148a4251a36861196029bbc6df6b7d1a84d0`.**

Terminal verification status: **Pass at `fda5148`: full local verification
passed 2,024 tests with 9 intentional skips, and the exact-tip Linux/Windows
CI plus parser, custody, and cross-engine acceptance workflows succeeded.**

Offline source-preparation status: **Recorded public engineering Pass only for
exact source revision `0cf87021648e05c191eebbeb95aee6742c4c0f09` and routing
closure `5e27bed1a11956bb207f523739083131aea254f0`; no real source or private
operation is recorded.**

Measurement-integrity correction status: **Cycle 3e-a2 has a recorded public
engineering Pass only for exact source revision
`8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and routing closure
`0374becdf96c1e9891d80e73024c8be0440fd812`. No real measurement or private
operation is recorded.**

Real-snapshot authorization and admission status: **Pending exact owner review;
no real snapshot or private activation has occurred.**

Acceptance/promotion status: **Not accepted or promoted.**

## Gate matrix

| Gate                             | Required result                                                                                                                                                                                                                                                                                        | Current status                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Synthetic default                | Existing synthetic API/web behavior remains the default                                                                                                                                                                                                                                                | Recorded engineering Pass                                 |
| Prior-mode isolation             | Earlier personal, connected, and vault modes retain their exact contracts and reject security-master-only configuration                                                                                                                                                                                | Recorded engineering Pass                                 |
| Exact mode                       | Only `personal_single_user_local_security_master` selects the dedicated non-splitting server                                                                                                                                                                                                           | Recorded engineering Pass                                 |
| Startup closure                  | Owner bootstrap, one canonical fixed-name absolute snapshot path, and one exact digest are captured and deleted before listen                                                                                                                                                                          | Recorded engineering Pass                                 |
| Stable file                      | One bounded regular single-link file is opened read-only/no-follow where available, read completely, and verified against pre/open/post identity and size                                                                                                                                              | Recorded engineering Pass                                 |
| Intrinsic owned bytes            | Admission accepts an intrinsic ordinary `Uint8Array`/`ArrayBuffer` snapshot, copies without caller constructors/hooks, and wipes composition-owned bytes                                                                                                                                               | Recorded engineering Pass                                 |
| Canonical document               | Strict UTF-8, one-LF canonical JSON, closed schemas, and byte/record/depth/node/string/array limits fail closed as one unit                                                                                                                                                                            | Recorded engineering Pass                                 |
| Snapshot identity                | Schema/profile, catalog identity/version, generation/as-of time, provenance, source coverage, policy compatibility, and digest form one exact receipt                                                                                                                                                  | Recorded engineering Pass                                 |
| Source-policy binding            | Same-source policy identity/version/document digest, validity chronology with expiry equality rejected, non-revocation, `fetch_snapshot`, and owner-local attribution/display/search/cache/retention/deletion/export controls are explicit                                                             | Prepared; actual exact policy/snapshot pending            |
| Provenance artifact URIs         | Every source URI is canonical query/fragment-free HTTPS with no URI-authority credential; owner review must confirm that no credential appears elsewhere in the locator                                                                                                                                | Prepared; real artifact review pending                    |
| Source coverage                  | Source equals admitted plus ineligible, unsupported, stale, and quarantined; admitted equals record length and total catalog securities, so coverage cannot hide rejected rows                                                                                                                         | Prepared; real counts pending                             |
| Content-kind honesty             | Synthetic input remains labeled engineering-only and cannot become a real-universe breadth result                                                                                                                                                                                                      | Recorded engineering Pass                                 |
| Stable internal identity         | Distinct issuer, security, share-class, listing, and mapping IDs support canonical 1:N issuer→security→share-class ancestry and cannot be replaced by ticker, CIK, FIGI, or provider identity                                                                                                          | Prepared; real snapshot pending                           |
| Security eligibility             | Only explicit active eligible `common_stock` or `adr` records with exact issuer/share-class ancestry enter search                                                                                                                                                                                      | Prepared; real classification pending                     |
| U.S. listing declaration         | Every listing declares `country: "US"` and operating MIC shape without treating either declaration as authentication of the upstream ISO/exchange mapping                                                                                                                                              | Prepared; real source reconciliation pending              |
| Listing chronology               | Parent links, active/current state, ordered nonoverlapping ticker intervals, terminal open interval, and `sec_filing_observed`/`prospective_snapshot_observed` time basis are coherent                                                                                                                 | Prepared; complete exchange-effective history not claimed |
| Active MIC-symbol uniqueness     | No two active listings share the same exchange MIC and current symbol                                                                                                                                                                                                                                  | Prepared; real snapshot pending                           |
| Provider mappings                | Top-level exact `issuer`/`security`/`share_class`/`composite`/`listing` mappings target the right entity, every share class and listing has required structural mapping coverage, provider/kind/target triples are unambiguous, and external completeness is not inferred                              | Prepared; real mapping pending                            |
| Deterministic search             | Fixed normalization and issuer/security/share-class name search, seven-level ranking, exact symbol/MIC/name/share-class/security/listing tie breaks, active-listing filter, input-order invariance, and defensive results pass                                                                         | Recorded engineering Pass                                 |
| Bounded query                    | At most 128 raw and 512 normalized code points and 25 results; admitted names share the same nonempty bounds; controls, format/surrogate characters, empty normalized values, and invalid limits fail closed                                                                                           | Recorded engineering Pass                                 |
| Exact search URL                 | A 2,048-code-unit envelope admits the worst-case canonical encoding of 128 Unicode scalars; exactly one NFC `q` comes first and optional canonical `limit=1..25` second/default 10; repeats, unknowns, alternate encodings, whitespace, fragments, bodies, and forbidden authority headers fail closed | Recorded engineering Pass                                 |
| Parameter-free status            | Snapshot status accepts no query or body and cannot select source, policy, snapshot, path, or catalog state                                                                                                                                                                                            | Recorded engineering Pass                                 |
| Authenticated read API           | Exact status and search routes require the Cycle 3a owner session and literal-loopback Host/Origin/CORS/cookie boundary before catalog access                                                                                                                                                          | Recorded engineering Pass                                 |
| Confidential response            | Bounded private/no-store status/search receipts omit local path, raw policy, rejected rows, credentials, and internal errors                                                                                                                                                                           | Recorded engineering Pass                                 |
| Static runtime isolation         | Runtime graph excludes source transport, DNS/provider clients, credentials, vault, filing corpus, demo state, scheduler, child process, and dynamic code                                                                                                                                               | Recorded engineering Pass                                 |
| Synthetic scale                  | At least 3,000 synthetic records exercise admission/search without being counted as real breadth                                                                                                                                                                                                       | Recorded engineering evidence only                        |
| Real catalog breadth             | One exact admitted snapshot contains at least 3,000 eligible active U.S.-listed common stocks/ADRs after explicit exclusions                                                                                                                                                                           | Pending exact owner-approved real snapshot                |
| Real search latency              | Nearest-rank p95 is below 200 ms on declared owner hardware and exact loaded real universe under the fixed 100-iteration, 32-distinct-query, limit-25 plan whose ordered raw query set is digest-bound                                                                                                 | Pending exact real-snapshot measurement                   |
| Package-owned measurement clock  | `measurePersonalSecurityMasterSearchP95(catalog,input)` has exactly two public/runtime arguments, rejects a hostile third callback without invocation, and uses only the private module-captured `node:perf_hooks` monotonic clock                                                                     | Cycle 3e-a2 recorded public engineering Pass only         |
| Measurement receipt integrity    | Plan and receipt bind `clock: "module_captured_node_perf_hooks_performance_now_monotonic"` and `timedRegion: "normalize_request_and_search_in_memory_catalog"` with receipt types derived from the plan; each sample spans request normalization through in-memory search                              | Cycle 3e-a2 recorded public engineering Pass only         |
| Measurement static guard         | `personalSecurityMasterMeasurementBoundaryViolation` and mutation coverage pin exact arity, clock capture/use, timed region, receipt bindings, and absence of an alternate timing seam                                                                                                                 | Cycle 3e-a2 recorded public engineering Pass only         |
| Offline source preparation       | Cycle 3e-a1 consumes six exact canonical `sec_openfigi_v1` artifacts and emits one admission-verified snapshot through an identity-bound one-shot handoff                                                                                                                                              | Recorded public engineering Pass only; no real operation  |
| Ticker-history limitation        | Filing-observed plus prospective diffs are labeled honestly; complete exchange-effective history requires a separately licensed corporate-actions source                                                                                                                                               | Explicit free/personal-profile limitation                 |
| No network or credential         | No SEC/OpenFIGI fetch, key, provider adapter, refresh, scheduler, or real source payload exists in this slice                                                                                                                                                                                          | Explicit nonclaim                                         |
| No browser/watchlist integration | No browser search client, watchlist CRUD/import/export, vault write, dossier selection, or downstream product integration is included                                                                                                                                                                  | Explicit nonclaim                                         |
| Personal-only scope              | Remote, multi-user, tenant, shared-service, commercial, redistribution, organizational, and production controls remain outside this profile                                                                                                                                                            | Out of scope                                              |
| Preserved evidence               | Cycle 2z and Cycles 3a-3d contracts, approvals, source bindings, and evidence remain unchanged                                                                                                                                                                                                         | Recorded engineering Pass                                 |
| Public verification              | Focused hostile/scale/API tests, full local verification, independent review, and terminal routing-tip Windows/Linux CI pass                                                                                                                                                                           | Engine `fda5148`; preparation `5e27bed`; clock `0374bec`  |
| Promotion topology               | Exact merge-free source and routing revisions plus exact changed-path transitions are frozen and verified                                                                                                                                                                                              | Engine `fda5148`; preparation `5e27bed`; clock `0374bec`  |
| Private breadth evidence         | A separately authorized owner-local run records only a rights-safe coarse result without placing source bytes, paths, credentials, rejected rows, or restricted metadata in public evidence                                                                                                            | Pending; no private operation has been authorized         |

## Recorded public engineering evidence

The exact merge-free engineering chain begins at source revision
`5186103977b906d3c035599b3b2b00793926fca3` and terminates at canonical-temp-
fixture stabilization `fda5148a4251a36861196029bbc6df6b7d1a84d0`. At that
tip, the full local gate passed 2,024 tests with 9 intentional skips. The
following exact-commit GitHub Actions evidence succeeded:

- CI run `33691407884`, Ubuntu job `100450725750` and Windows job
  `100450725932`;
- parser acceptance run `33691407866`;
- custody acceptance run `33691407885`; and
- cross-engine acceptance run `33691407952`.

This records only the public synthetic engine/API boundary. It does not admit
a real source, authorize a private run, satisfy real breadth or latency, or
accept/promote Cycle 3e-a.

## Prepared package boundary

The zero-production-dependency package is
`@research-cockpit/personal-security-master`. Its exact schema and profile are
`PERSONAL_SECURITY_MASTER_SCHEMA_VERSION` and
`PERSONAL_SECURITY_MASTER_PROFILE`. `admitPersonalSecurityMasterSnapshot`
returns an immutable branded catalog receipt backed by private in-memory search
state. `searchPersonalSecurityMaster` exposes bounded deterministic search, and
`measurePersonalSecurityMasterSearchP95` exposes a content-kind-bound nearest-
rank p95 measurement. A result from synthetic input is explicitly labeled
engineering-only rather than a production SLO. The helper enforces 100
iterations, 32 ordered queries distinct after normalization, and result limit
25; its receipt includes the result limit and SHA-256 of the canonical JSON
ordered raw query array plus LF. Cycle 3e-a2 separately records the correction
that makes the helper exactly two arguments, rejects any third callback before
invocation, and privately captures the monotonic `node:perf_hooks` clock. Its
receipt also binds that clock and the per-sample region from request
normalization through in-memory search. The correction is covered only by its
exact source/routing record below.

The admitted graph separates stable issuer, security, share-class, listing, and
provider-mapping identities. It permits 1:N issuer-to-security-to-share-class
cardinality and keeps CIK, current/former ticker, FIGI, and every other provider
identifier as attributes or mappings rather than internal identity. Listings
declare U.S. country and operating MIC shape, while each ticker interval names
an observation-only time basis. Search uses only active eligible common stocks/
ADRs with active listings. The catalog receipt includes explicit issuer,
share-class, coverage, and content-kind counts so a large synthetic catalog
cannot satisfy the real-universe gate.

## Prepared API boundary

Exact startup mode is
`RESEARCH_COCKPIT_MODE=personal_single_user_local_security_master`, with
`RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET`,
`PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH`, and
`PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256`. The snapshot basename is fixed to
`personal-security-master.snapshot.json`.

The dedicated API exposes authenticated
`GET /v1/personal-filing/security-master/status` and
`GET /v1/personal-filing/security-master/search?q=<query>[&limit=<1..25>]`.
The status response is exactly `{snapshot}`. The search response is exactly
`{limitApplied,normalizedQuery,results,snapshot,totalMatches}`. Each result is
exactly `{cik,country,exchangeMic,instrumentType,issuerId,issuerName,listingId,matchKind,matchedValue,securityId,securityName,shareClassId,shareClassName,symbol}`.
It exposes neither provider mappings nor the operating-MIC-type declaration.
The shared bounded snapshot receipt is exactly
`{asOf,catalogId,catalogVersion,claim,coverage,generatedAt,profile,provenance,schemaVersion,snapshotSha256,sourcePolicyCompatibility,status}`;
its bounded provenance omits the local composite locator and its compatibility
member is the closed receipt, not the raw policy. No request selects a path,
snapshot, policy, source, ranking, or historical cutoff.

## Cycle 3e-a1 `sec_openfigi_v1` preparation boundary

Cycle 3e-a1 is recorded as a public engineering Pass only for exact merge-free
source revision `0cf87021648e05c191eebbeb95aee6742c4c0f09` and routing closure
`5e27bed1a11956bb207f523739083131aea254f0`. At the routing tip, the full
local gate passed 2,051 tests with 9 intentional skips. Exact-tip CI run
`33806494548` passed Windows job `100818110497` and Ubuntu job `100818110717`;
custody run `33806494300`, normalization run `33806494295`, cross-engine run
`33806494318`, and parser-isolation run `33806494364` also passed.

The selected later profile combines a pinned SEC current-company ticker/
exchange snapshot, SEC submissions plus issuer-filed Inline XBRL cover facts,
OpenFIGI v3 mapping responses, and a pinned ISO 10383 MIC snapshot. Cycle 3e-a1
now specifies a public offline preparer over six exact canonical roles:
preparation plan, SEC candidates, normalized SEC cover evidence, aggregated
OpenFIGI mappings, ISO MIC registry, and opaque internal identity assignments.
See [ADR 0058](./adr/0058-offline-sec-openfigi-v1-source-preparation.md) and the
[Cycle 3e-a1 exit matrix](./CYCLE_3E_A1_EXIT_MATRIX.md).

The owner must still review and bind the exact source versions, bytes,
retrieval metadata, policy documents, attribution, retention/deletion/export
controls, identity assignments, and classification/reconciliation result
before any real admission. Public preparation source and synthetic artifacts
do not perform or authorize that operation.

## Cycle 3e-a2 measurement-integrity boundary

Cycle 3e-a2 has a recorded public engineering Pass only for exact merge-free
source revision `8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and routing closure
`0374becdf96c1e9891d80e73024c8be0440fd812`. The source passed 2,058 local
tests with 9 intentional skips and final clean review after its pre-commit
timed-region AST-order blocker was fixed. Attempt-1 source CI run `33816810188`
passed jobs `100850647775` and `100850648064`; custody run `33816810200`/job
`100850647942`, normalization run `33816810227`/job `100850647938`, cross-
engine run `33816810267`/job `100850648210`, and parser-isolation run
`33816810173`/job `100850647900` also passed.

The routing closure passed 2,060 local tests with 9 intentional skips and clean
independent review. Attempt-1 routing CI run `33823588896` passed jobs
`100871341851` and `100871342201`; custody run `33823588891`/job
`100871342729`, parser-isolation run `33823588916`/job `100871341920`, and
cross-engine run `33823588901`/job `100871342184` also passed. No routing-tip
normalization run was triggered or required because the exact five-path routing
transition did not match that workflow's path filters.

The exact signature is `measurePersonalSecurityMasterSearchP95(catalog, input)`,
with exactly two runtime arguments. A third argument fails with
`PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID`, and a hostile callback is never
invoked. The private `READ_MONOTONIC_MILLISECONDS` bound callable is captured
from `node:perf_hooks` at module initialization and cannot be supplied through an
input, option, overload, export, or test seam.

The frozen plan and measurement receipt bind
`clock: "module_captured_node_perf_hooks_performance_now_monotonic"` and
`timedRegion: "normalize_request_and_search_in_memory_catalog"`. Focused tests
and `personalSecurityMasterMeasurementBoundaryViolation` guard
the exact arity, clock capture, timed region, receipt bindings, and absence of
an alternate caller timer. See
[ADR 0059](./adr/0059-package-owned-security-master-measurement-clock.md) and the
[Cycle 3e-a2 exit matrix](./CYCLE_3E_A2_EXIT_MATRIX.md).

The recorded correction uses no real source and establishes no real breadth,
latency, owner authorization, Cycle 3e-a acceptance/promotion, or parity.

Ticker history under this free profile contains only
`sec_filing_observed` and `prospective_snapshot_observed` intervals, with
prospective diffs keyed by stable internal `listingId`. An OpenFIGI listing FIGI
is a provider mapping, not internal identity. Complete historical exchange-
effective changes and upstream MIC authenticity require separately admitted
evidence; complete corporate-action history needs a rights-compatible licensed
source and is not claimed here.

## Exit and highest-priority blocker

The engine/API public engineering boundary is recorded through `fda5148`, the
separate Cycle 3e-a1 offline preparation boundary through `5e27bed`, and the
Cycle 3e-a2 package-owned measurement-integrity correction through `0374bec`.
All passed their exact source transitions, focused tests, full repository gates,
independent review, routing transitions, and terminal CI. Cycle 3e-a nonetheless
remains unpromoted until an exact real source snapshot is owner-approved,
prepared, admitted, and measured.

The highest-priority remaining private product blocker is the exact real
snapshot and its declared-hardware measurement: at least 3,000 eligible active U.S.-listed
common stocks/ADRs, explicit exclusions, exact policy compatibility, no
duplicate active MIC-symbol, and search p95 below 200 ms under the exact fixed
measurement plan. Synthetic volume and
synthetic timing cannot substitute for this result.

Enterprise approval is not required for the personal profile. The owner still
must follow the exact source terms and authorize the real local operation.

## References

- [ADR 0057](./adr/0057-owner-local-security-master-snapshot-and-search.md)
- [ADR 0058](./adr/0058-offline-sec-openfigi-v1-source-preparation.md)
- [Cycle 3e-a1 exit matrix](./CYCLE_3E_A1_EXIT_MATRIX.md)
- [ADR 0059](./adr/0059-package-owned-security-master-measurement-clock.md)
- [Cycle 3e-a2 exit matrix](./CYCLE_3E_A2_EXIT_MATRIX.md)
- [Cycle 3c exit matrix](./CYCLE_3C_EXIT_MATRIX.md)
- [Cycle 3d exit matrix](./CYCLE_3D_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](./BUILD_ROADMAP.md)
- [Threat model](./THREAT_MODEL.md)
- [Canonical model](./CANONICAL_MODEL.md)
