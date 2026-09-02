# Cycle 3e-a exit matrix

Scope: prepare exact owner-local security-master snapshot admission,
deterministic in-memory symbol/name search, and one owner-session-authenticated
read-only API mode without adding a source download, provider credential,
network adapter, real catalog, browser client, watchlist workflow, or
enterprise/shared-service scope. The decision is recorded in
[ADR 0057](./adr/0057-owner-local-security-master-snapshot-and-search.md).

Implementation status: **Prepared public engineering source only; exact source
transition not yet declared.**

Terminal verification status: **Pending.**

Real-snapshot authorization and admission status: **Pending exact owner review;
no real snapshot or private activation has occurred.**

Acceptance/promotion status: **Not accepted or promoted.**

## Gate matrix

| Gate                             | Required result                                                                                                                                                                                                                                                                                        | Current status                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Synthetic default                | Existing synthetic API/web behavior remains the default                                                                                                                                                                                                                                                | Prepared; terminal evidence pending                       |
| Prior-mode isolation             | Earlier personal, connected, and vault modes retain their exact contracts and reject security-master-only configuration                                                                                                                                                                                | Prepared; terminal evidence pending                       |
| Exact mode                       | Only `personal_single_user_local_security_master` selects the dedicated non-splitting server                                                                                                                                                                                                           | Prepared; terminal evidence pending                       |
| Startup closure                  | Owner bootstrap, one canonical fixed-name absolute snapshot path, and one exact digest are captured and deleted before listen                                                                                                                                                                          | Prepared; terminal evidence pending                       |
| Stable file                      | One bounded regular single-link file is opened read-only/no-follow where available, read completely, and verified against pre/open/post identity and size                                                                                                                                              | Prepared; terminal evidence pending                       |
| Intrinsic owned bytes            | Admission accepts an intrinsic ordinary `Uint8Array`/`ArrayBuffer` snapshot, copies without caller constructors/hooks, and wipes composition-owned bytes                                                                                                                                               | Prepared; terminal evidence pending                       |
| Canonical document               | Strict UTF-8, one-LF canonical JSON, closed schemas, and byte/record/depth/node/string/array limits fail closed as one unit                                                                                                                                                                            | Prepared; terminal evidence pending                       |
| Snapshot identity                | Schema/profile, catalog identity/version, generation/as-of time, provenance, source coverage, policy compatibility, and digest form one exact receipt                                                                                                                                                  | Prepared; terminal evidence pending                       |
| Source-policy binding            | Same-source policy identity/version/document digest, validity chronology with expiry equality rejected, non-revocation, `fetch_snapshot`, and owner-local attribution/display/search/cache/retention/deletion/export controls are explicit                                                             | Prepared; actual exact policy/snapshot pending            |
| Provenance artifact URIs         | Every source URI is canonical query/fragment-free HTTPS with no URI-authority credential; owner review must confirm that no credential appears elsewhere in the locator                                                                                                                                | Prepared; real artifact review pending                    |
| Source coverage                  | Source equals admitted plus ineligible, unsupported, stale, and quarantined; admitted equals record length and total catalog securities, so coverage cannot hide rejected rows                                                                                                                         | Prepared; real counts pending                             |
| Content-kind honesty             | Synthetic input remains labeled engineering-only and cannot become a real-universe breadth result                                                                                                                                                                                                      | Prepared; terminal evidence pending                       |
| Stable internal identity         | Distinct issuer, security, share-class, listing, and mapping IDs support canonical 1:N issuer→security→share-class ancestry and cannot be replaced by ticker, CIK, FIGI, or provider identity                                                                                                          | Prepared; real snapshot pending                           |
| Security eligibility             | Only explicit active eligible `common_stock` or `adr` records with exact issuer/share-class ancestry enter search                                                                                                                                                                                      | Prepared; real classification pending                     |
| U.S. listing declaration         | Every listing declares `country: "US"` and operating MIC shape without treating either declaration as authentication of the upstream ISO/exchange mapping                                                                                                                                              | Prepared; real source reconciliation pending              |
| Listing chronology               | Parent links, active/current state, ordered nonoverlapping ticker intervals, terminal open interval, and `sec_filing_observed`/`prospective_snapshot_observed` time basis are coherent                                                                                                                 | Prepared; complete exchange-effective history not claimed |
| Active MIC-symbol uniqueness     | No two active listings share the same exchange MIC and current symbol                                                                                                                                                                                                                                  | Prepared; real snapshot pending                           |
| Provider mappings                | Top-level exact `issuer`/`security`/`share_class`/`composite`/`listing` mappings target the right entity, every share class and listing has required structural mapping coverage, provider/kind/target triples are unambiguous, and external completeness is not inferred                              | Prepared; real mapping pending                            |
| Deterministic search             | Fixed normalization and issuer/security/share-class name search, seven-level ranking, exact symbol/MIC/name/share-class/security/listing tie breaks, active-listing filter, input-order invariance, and defensive results pass                                                                         | Prepared; terminal evidence pending                       |
| Bounded query                    | At most 128 raw and 512 normalized code points and 25 results; admitted names share the same nonempty bounds; controls, format/surrogate characters, empty normalized values, and invalid limits fail closed                                                                                           | Prepared; terminal evidence pending                       |
| Exact search URL                 | A 2,048-code-unit envelope admits the worst-case canonical encoding of 128 Unicode scalars; exactly one NFC `q` comes first and optional canonical `limit=1..25` second/default 10; repeats, unknowns, alternate encodings, whitespace, fragments, bodies, and forbidden authority headers fail closed | Prepared; terminal evidence pending                       |
| Parameter-free status            | Snapshot status accepts no query or body and cannot select source, policy, snapshot, path, or catalog state                                                                                                                                                                                            | Prepared; terminal evidence pending                       |
| Authenticated read API           | Exact status and search routes require the Cycle 3a owner session and literal-loopback Host/Origin/CORS/cookie boundary before catalog access                                                                                                                                                          | Prepared; terminal evidence pending                       |
| Confidential response            | Bounded private/no-store status/search receipts omit local path, raw policy, rejected rows, credentials, and internal errors                                                                                                                                                                           | Prepared; terminal evidence pending                       |
| Static runtime isolation         | Runtime graph excludes source transport, DNS/provider clients, credentials, vault, filing corpus, demo state, scheduler, child process, and dynamic code                                                                                                                                               | Prepared; terminal evidence pending                       |
| Synthetic scale                  | At least 3,000 synthetic records exercise admission/search without being counted as real breadth                                                                                                                                                                                                       | Prepared engineering evidence only                        |
| Real catalog breadth             | One exact admitted snapshot contains at least 3,000 eligible active U.S.-listed common stocks/ADRs after explicit exclusions                                                                                                                                                                           | Pending exact owner-approved real snapshot                |
| Real search latency              | Nearest-rank p95 is below 200 ms on declared owner hardware and exact loaded real universe under the fixed 100-iteration, 32-distinct-query, limit-25 plan whose ordered raw query set is digest-bound                                                                                                 | Pending exact real-snapshot measurement                   |
| Future source profile            | `sec_openfigi_v1` exact SEC, OpenFIGI v3, and pinned ISO MIC inputs are separately acquired, hashed, reconciled, policy-reviewed, and owner-approved                                                                                                                                                   | Chosen design; no source acquired or admitted             |
| Ticker-history limitation        | Filing-observed plus prospective diffs are labeled honestly; complete exchange-effective history requires a separately licensed corporate-actions source                                                                                                                                               | Explicit free/personal-profile limitation                 |
| No network or credential         | No SEC/OpenFIGI fetch, key, provider adapter, refresh, scheduler, or real source payload exists in this slice                                                                                                                                                                                          | Explicit nonclaim                                         |
| No browser/watchlist integration | No browser search client, watchlist CRUD/import/export, vault write, dossier selection, or downstream product integration is included                                                                                                                                                                  | Explicit nonclaim                                         |
| Personal-only scope              | Remote, multi-user, tenant, shared-service, commercial, redistribution, organizational, and production controls remain outside this profile                                                                                                                                                            | Out of scope                                              |
| Preserved evidence               | Cycle 2z and Cycles 3a-3d contracts, approvals, source bindings, and evidence remain unchanged                                                                                                                                                                                                         | Prepared; terminal evidence pending                       |
| Public verification              | Focused hostile/scale/API tests, full local verification, independent review, and terminal routing-tip Windows/Linux CI pass                                                                                                                                                                           | Pending                                                   |
| Promotion topology               | Exact merge-free source and routing revisions plus exact changed-path transitions are frozen and verified                                                                                                                                                                                              | Pending; exact source transition not yet declared         |
| Private breadth evidence         | A separately authorized owner-local run records only a rights-safe coarse result without placing source bytes, paths, credentials, rejected rows, or restricted metadata in public evidence                                                                                                            | Pending; no private operation has been authorized         |

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
ordered raw query array plus LF.

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

## Future `sec_openfigi_v1` source boundary

The selected later profile combines a pinned SEC current-company ticker/
exchange snapshot, SEC submissions plus issuer-filed Inline XBRL cover facts,
OpenFIGI v3 mapping responses, and a pinned ISO 10383 MIC snapshot. The owner
must review and bind the exact source versions, bytes, retrieval metadata,
policy documents, attribution, retention/deletion/export controls, and
classification/reconciliation result before admission.

Ticker history under this free profile contains only
`sec_filing_observed` and `prospective_snapshot_observed` intervals, with
prospective diffs keyed by stable internal `listingId`. An OpenFIGI listing FIGI
is a provider mapping, not internal identity. Complete historical exchange-
effective changes and upstream MIC authenticity require separately admitted
evidence; complete corporate-action history needs a rights-compatible licensed
source and is not claimed here.

## Exit and highest-priority blocker

The prepared engine/API can close only after its exact source transition,
focused tests, full repository gate, independent review, routing transition,
and terminal CI are frozen. Even then, Cycle 3e-a remains unpromoted until an
exact real source snapshot is separately owner-approved and admitted.

The highest-priority remaining product blocker is that exact real snapshot and
its declared-hardware measurement: at least 3,000 eligible active U.S.-listed
common stocks/ADRs, explicit exclusions, exact policy compatibility, no
duplicate active MIC-symbol, and search p95 below 200 ms under the exact fixed
measurement plan. Synthetic volume and
synthetic timing cannot substitute for this result.

Enterprise approval is not required for the personal profile. The owner still
must follow the exact source terms and authorize the real local operation.

## References

- [ADR 0057](./adr/0057-owner-local-security-master-snapshot-and-search.md)
- [Cycle 3c exit matrix](./CYCLE_3C_EXIT_MATRIX.md)
- [Cycle 3d exit matrix](./CYCLE_3D_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](./BUILD_ROADMAP.md)
- [Threat model](./THREAT_MODEL.md)
- [Canonical model](./CANONICAL_MODEL.md)
