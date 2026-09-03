# ADR 0057: owner-local security-master snapshot and search

Status: **Recorded public engineering Pass for the exact merge-free chain from
`5186103977b906d3c035599b3b2b00793926fca3` through
`fda5148a4251a36861196029bbc6df6b7d1a84d0`. No real security-master snapshot,
provider credential, download, network request, or private activation has
occurred. The separate Cycle 3e-a1 offline preparation boundary is recorded only
for exact source `0cf87021648e05c191eebbeb95aee6742c4c0f09` and routing closure
`5e27bed1a11956bb207f523739083131aea254f0`. Cycle 3e-a is not accepted or
promoted.**

## Context

The synthetic demo has one symbol and therefore cannot support useful local
company discovery. Cycle 3c promoted a provider-neutral source-policy control
plane without a provider or transport, and Cycle 3d promoted a durable local
vault boundary without an actual owner vault. Neither result admits security
identity data or authorizes a source fetch.

Cycle 3e-a needs a reviewable separation between the engine and the real
catalog. Public source and synthetic fixtures can prove strict admission,
stable identities, deterministic search, and measurement mechanics. They
cannot prove that a real U.S.-listed universe is sufficiently broad, correctly
classified, current, or rights-compatible.

## Decision

Add the zero-production-dependency package
`@research-cockpit/personal-security-master` and exact profile
`personal_single_user_local_security_master`. The package admits one complete
canonical snapshot supplied by the owner-side caller, constructs immutable in-
memory search state, and exposes only a bounded local symbol/name search plus
an engineering measurement helper.

Admission is all-or-nothing. The caller supplies owned `Uint8Array` bytes and
an exact `sha256:<lowercase-hex>` digest. The boundary takes an intrinsic copy,
checks the digest, decodes strict UTF-8, requires canonical JSON with one LF,
and enforces closed keys plus byte, row, depth, node, string, and array bounds.
Invalid, ambiguous, duplicate, noncanonical, or internally inconsistent input
produces a generic failure and no partial catalog.

The canonical snapshot fixes:

- schema, profile, catalog identity/version, generation time, and `asOf`;
- provenance with acquisition time, content kind, source identity, an exact
  composite-manifest SHA-256 revision and matching owner-local locator,
  attribution, and one through 16 sorted source artifacts binding a canonical
  query/fragment-free HTTPS URI with no URI-authority credential, source
  version, media type, acquisition time, and content digest; the owner must
  additionally review that no credential appears elsewhere in the locator;
- an exact source-policy compatibility declaration bound to the same source,
  policy document digest, policy identity/version/profile/schema, effective,
  review, expiry, and non-revocation chronology, the `fetch_snapshot`
  operation, and explicit owner-local display/search/cache/retention,
  attribution, deletion, export, and redistribution controls;
- source coverage counts for source, admitted, ineligible, unsupported, stale,
  and quarantined records, with admitted count equal to both record length and
  total catalog securities; and
- sorted issuer records, security records with nested share classes and
  listings, and typed provider mappings with stable identities.

The compatibility declaration records the owner's reviewed, exact policy
binding. It is not legal advice, independent source attestation, or a mechanism
that can discover a later policy revocation while the snapshot remains
offline. Its chronology is exactly
`effectiveAt <= reviewedAt <= acquiredAt <= asOf < expiresAt`; policy expiry is
exclusive and equality fails closed.

Snapshot `contentKind` is either `synthetic_engineering` or
`owner_local_source`. Coverage derived from synthetic input is permanently
labeled `synthetic_engineering_only_not_real_universe`, even when it contains
3,000 or more records. Owner-local input is labeled
`owner_declared_snapshot_only`; that label still does not independently prove
source authenticity, correctness, or completeness.

## Identity and history model

Issuer, security, share class, listing, current symbol, former symbol, and
provider mapping remain distinct. The canonical graph permits one issuer to
have multiple securities and one security to have multiple share classes. A
ticker, CIK, FIGI, or provider identifier is never an internal identity.

Each sorted issuer has one stable internal `issuerId`, ten-digit CIK, and
issuer name. CIK is unique and every admitted issuer is referenced. Every
admitted security has its own `securityId`, references one issuer, declares
`common_stock` or `adr`, and has exact active/eligible state plus one or more
sorted share classes. Each share class has a distinct
`shareClassId`, name, active state, and sorted listings. Each listing binds its
own `listingId`, parent security and share class, `country: "US"`, operating
exchange MIC, current-symbol state, and ordered nonoverlapping ticker history.
The country and MIC-type fields are declarations checked for exact shape; they
do not authenticate the upstream ISO or exchange mapping.

Every ticker interval is labeled only `sec_filing_observed` or
`prospective_snapshot_observed`. Neither label claims an exchange-effective
corporate-action timestamp. Every top-level provider mapping has its own stable
`mappingId`, provider identity, target identity, and exact `issuer`, `security`,
`share_class`, `composite`, or `listing` kind. Every share class has at least a
share-class or composite mapping and every listing has a listing mapping. This
structural coverage is not a claim that real external mappings are complete or
current.

Active securities must have an active listing, an active listing must have one
open terminal ticker-history interval equal to its current symbol, and an
inactive listing must have no current symbol or open history interval. Stable
identifiers are globally distinct. Provider identities and active
`(exchange MIC, symbol)` pairs are unique. Records, listings, histories, and
mappings are canonically ordered; caller order cannot decide a search result.

## Deterministic local search

Search includes only active eligible securities and active listings. Raw input
is bounded to 128 Unicode code points, its normalized name-query form to 512,
and results to 25. Name normalization trims Unicode whitespace, applies NFKD,
removes combining marks, uppercases, replaces non-letter/number runs with one
space, and collapses and trims spaces. A separate symbol query applies trimmed
NFKC plus uppercase and preserves the admitted dot/hyphen ticker punctuation.
Control, format, and surrogate characters fail closed.

The exact match order is:

1. current symbol exact;
2. current symbol prefix;
3. former symbol exact;
4. former symbol prefix;
5. issuer, security, or share-class name exact;
6. issuer, security, or share-class name-token prefix; and
7. issuer, security, or share-class name contains.

Results then use deterministic Unicode-code-point current symbol, exchange MIC,
normalized security name, normalized share-class name, `shareClassId`,
`securityId`, and `listingId` tie breaks in that order. Each result names its
match kind and matched value while returning current symbol, issuer/security/
share-class names, type, CIK, U.S. country declaration, exchange MIC, and
issuer, security, share-class, and listing identities. Search returns a
defensive immutable result and cannot mutate or extend the admitted catalog.
Admitted issuer, security, and share-class names contain at most 128 raw code
points and normalize to a nonempty value of at most 512 code points, so an
admitted exact name cannot become unsearchable through normalization expansion.

`measurePersonalSecurityMasterSearchP95` enforces 100 iterations over exactly
32 ordered queries that are distinct after normalization at result limit 25.
It repeatedly measures individual local searches and reports nearest-rank p95,
maximum latency, query/iteration/sample counts, result limit, ordered raw-query-
set SHA-256 over canonical JSON UTF-8 plus LF, declared hardware profile,
catalog identity/digest, eligible count, and an exact content-kind basis.
Synthetic input is labeled
`synthetic_engineering_only_not_production_slo`; owner input is labeled
`owner_local_exact_snapshot_and_declared_hardware`. A synthetic timing is
useful for regression detection but cannot satisfy the Cycle 3e-a real-
universe latency objective.

## Prepared owner API

The exact API mode is
`RESEARCH_COCKPIT_MODE=personal_single_user_local_security_master`. It starts
through a separate non-splitting security-master server. Startup additionally
requires `RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET`, one canonical absolute
`PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH` whose basename is exactly
`personal-security-master.snapshot.json`, and
`PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256`.

The composition root captures and deletes its private startup entries before
listen. It accepts only one stable regular, single-link file, opens it
read-only with no-follow where available, verifies pre-open, descriptor, and
post-read identity and size, rejects trailing growth or substitution, and
wipes its owned byte carrier after admission. The lexical path rules reject
relative, noncanonical, UNC/device, double-root, and root-relative Windows
forms. They cannot prove that an accepted drive or POSIX path is not backed by
a network filesystem; genuinely owner-local backing remains an operator
precondition.

The only security-master data routes are owner-session-authenticated:

- `GET /v1/personal-filing/security-master/status`; and
- `GET /v1/personal-filing/security-master/search?q=<query>` with optional
  `&limit=<1..25>`.

Status is parameter-free and bodyless. The search URL is an exact grammar: `q`
appears first and exactly once, the optional canonical decimal `limit` appears
second, and unknown, repeated, misordered, empty, noncanonical percent/UTF-8 or
plus encoding, non-NFC input, leading/trailing whitespace, control/format/
surrogate characters, fragments, bodies, or forbidden authority headers are
rejected. An omitted limit means 10. Authorization, literal-loopback Host/
Origin, cookie, credentialed CORS, negotiation, framing, and request-shape
checks run before catalog search.

Status responds with exactly `{snapshot}`; search responds with exactly
`{limitApplied,normalizedQuery,results,snapshot,totalMatches}`. Each result is
exactly `{cik,country,exchangeMic,instrumentType,issuerId,issuerName,listingId,matchKind,matchedValue,securityId,securityName,shareClassId,shareClassName,symbol}`.
Both responses use a bounded snapshot receipt with exactly
`{asOf,catalogId,catalogVersion,claim,coverage,generatedAt,profile,provenance,schemaVersion,snapshotSha256,sourcePolicyCompatibility,status}`.
The receipt omits the local source path, private composite locator, and raw
policy document; results omit provider mappings, the operating-MIC-type
declaration, and rejected rows. Every success and failure is private/no-store,
and denial or startup failure is generic. This slice adds no browser search
client, mutation, vault write, or HTTP-selected snapshot.

## Selected future source profile

The chosen free/personal preparation profile is `sec_openfigi_v1`. A later
owner-run builder may combine only exact, pinned inputs for the declared
U.S.-listed common-stock/ADR universe from:

1. SEC `company_tickers_exchange.json` for the current CIK, company name,
   ticker, and exchange candidate set;
2. SEC submissions data and issuer-filed Inline XBRL cover facts for filing
   identity, security-title evidence, and common-stock/ADR classification;
3. OpenFIGI API v3 with unlisted equities excluded for candidate ticker/MIC
   mappings and FIGI, composite FIGI, share-class FIGI, name, ticker, exchange,
   and security-type metadata that must reconcile unambiguously; and
4. one pinned ISO 10383 MIC snapshot for exchange identity.

The builder must mint internal identities independently of all source keys,
retain exact source locations, retrieval times, response/request metadata and
digests permitted by policy, and quarantine ambiguity rather than choose a
match. Common-stock/ADR classification must agree between issuer-filed cover
evidence and the admitted OpenFIGI mapping; disagreement is quarantined.
OpenFIGI identifiers are provider mappings, not internal identity. Each
provider, mapping-kind, and internal-target triple has at most one external
identifier. Admitted artifact locations are canonical query/fragment-free HTTPS
URLs with no URI-authority credential and must be owner-reviewed to contain no
credential elsewhere in the locator.

The free profile defines ticker history honestly as intervals explicitly tagged
`sec_filing_observed` or `prospective_snapshot_observed`, with prospective
snapshot diffs keyed by stable internal `listingId`; an OpenFIGI listing FIGI
remains a mapping used to reconcile that listing. SEC former-company-name data
is not ticker history. This method cannot establish complete pre-observation or
exact exchange-effective ticker history. That stronger result requires a
rights-compatible licensed corporate-actions source and remains outside
`sec_openfigi_v1` unless the owner later adds one.

Source selection is not source admission. Cycle 3e-a1 and
[ADR 0058](./0058-offline-sec-openfigi-v1-source-preparation.md) now define the
separate public, deterministic, offline preparation handoff over six exact
canonical roles. That handoff still does not acquire or authorize a source.
Before real use, the owner must pin and review the exact SEC, OpenFIGI, and ISO
inputs and applicable terms, attribution, cache, retention, deletion, and
export rules. SEC fair-access behavior belongs to a later network acquisition
workflow, not either offline slice. The public repository contains no
OpenFIGI key, real source payload, generated real catalog, or claim that ISO's
public download page grants unrestricted reuse.

## Prepared implementation and security checklist

Cycle 3e-a engineering source was recorded only after all of these properties
were verified:

1. **Mode closure:** exact opt-in mode and distinct entry; default, connected,
   vault, and earlier personal modes reject security-master-only inputs.
2. **Stable-file closure:** fixed canonical path/name, exact digest, bounded
   regular file, identity pinning, no-follow handling, complete read, owned
   bytes, and post-use wipe before listen.
3. **Canonical admission:** strict UTF-8/canonical JSON, closed schemas, exact
   chronology, bounds, sorting, uniqueness, and whole-input failure.
4. **Policy binding:** exact source identity and policy digest/version plus
   explicit owner-local use controls are compatible at `asOf`; later offline
   revocation discovery is explicitly unavailable.
5. **Identity closure:** 1:N issuer-to-security-to-share-class cardinality,
   exact listing ancestry, and typed provider targets are supported; all
   internal IDs are globally distinct from ticker, CIK, FIGI, and provider
   identity.
6. **Listing closure:** exact U.S./operating-MIC declarations,
   active/current/history state, observation-only time basis, and duplicate
   active MIC-symbol rejection are enforced without claiming upstream MIC
   authenticity.
7. **Coverage honesty:** excluded source rows are accounted for and synthetic
   scale can never receive a real-universe basis.
8. **Search closure:** bounded normalization, fixed ranking/tie breaks, active-
   eligible filtering, defensive results, and input-order invariance pass.
9. **Request closure:** owner authorization and exact loopback request grammar
   precede search; URL-selected path, policy, snapshot, source, or ranking is
   impossible.
10. **Confidential output:** responses are bounded and private/no-store; paths,
    raw policy, rejected rows, provider credentials, and internal errors are
    absent.
11. **Static isolation:** no source transport, DNS, provider client, SDK,
    credential adapter, vault, filing corpus, demo state, scheduler, child
    process, or dynamic code enters the security-master runtime graph.
12. **Exact-source evidence:** focused hostile and scale tests, full repository
    verification, Windows/Linux CI at the terminal routing tip, independent
    review, and exact merge-free source topology passed before the engineering
    boundary was recorded.

## Exact nonclaims

This prepared Cycle 3e-a slice does not establish:

1. an actual owner-local security-master snapshot or private activation;
2. a provider credential, API key, network request, adapter, refresh, or
   scheduler;
3. source authenticity, provider attestation, entitlement validity, legal
   advice, or compliance in fact;
4. at least 3,000 real eligible active U.S.-listed common stocks/ADRs;
5. complete U.S. or global coverage, current mappings, or correct external
   classification;
6. complete or exchange-effective ticker/corporate-action history;
7. p95 below 200 ms on declared owner hardware with the exact real loaded
   universe and fixed 100-iteration, 32-distinct-query, limit-25 digest-bound
   plan;
8. a browser company-search workflow, watchlists, persistence, refresh,
   prices, statements, charts, screening, or portfolio integration;
9. protection against a hostile same-user process, administrator, filesystem,
   memory inspection, swap, or crash dump;
10. remote, multi-user, tenant, shared-service, commercial, redistribution, or
    production safety; or
11. competitor feature parity.

Enterprise rights/steward/counsel workflows are out of scope for this
personal-only profile. The owner's source-terms review and exact snapshot
approval remain required because personal use does not override source terms.

## Evidence and promotion rule

The repository-visible engineering transition is frozen and recorded as the
exact merge-free chain from source revision
`5186103977b906d3c035599b3b2b00793926fca3` through terminal stabilization
`fda5148a4251a36861196029bbc6df6b7d1a84d0`. At that tip, the full local gate
passed 2,024 tests with 9 intentional skips. CI run `33691407884` succeeded for
Ubuntu job `100450725750` and Windows job `100450725932`; parser acceptance run
`33691407866`, custody acceptance run `33691407885`, and cross-engine
acceptance run `33691407952` also succeeded.

Those public gates establish only the synthetic engine/API engineering
boundary. The separately governed Cycle 3e-a1 source-preparation boundary has a
recorded public engineering Pass only for exact source revision
`0cf87021648e05c191eebbeb95aee6742c4c0f09` and routing closure
`5e27bed1a11956bb207f523739083131aea254f0`. At that routing tip, the full
local gate passed 2,051 tests with 9 intentional skips. Exact-tip CI run
`33806494548` passed Windows job `100818110497` and Ubuntu job `100818110717`;
custody run `33806494300`, normalization run `33806494295`, cross-engine run
`33806494318`, and parser-isolation run `33806494364` also passed. That record
does not authorize a real source or private operation; see
[ADR 0058](./0058-offline-sec-openfigi-v1-source-preparation.md).

Cycle 3e-a itself remains **not accepted or promoted** until a later exact
owner-approved `owner_local_source` snapshot:

- is bound to exact source bytes/versions and a reviewed compatible policy;
- contains at least 3,000 eligible active U.S.-listed common stocks and ADRs
  after explicit ineligible, unsupported, stale, and quarantined exclusions;
- passes all identity, listing, mapping, and duplicate MIC-symbol checks; and
- measures local search p95 below 200 ms on declared owner hardware with that
  exact loaded universe under the fixed 100-iteration, 32-distinct-query,
  limit-25 digest-bound plan.

That later private operation must keep source bytes, provider credentials,
local paths, rejected rows, and any restricted metadata out of Git, logs,
fixtures, and public CI. Public evidence may record only an allowed coarse,
nonsecret result. No enterprise approval is a prerequisite for this personal
profile.

## References

- [Cycle 3e-a exit matrix](../CYCLE_3E_A_EXIT_MATRIX.md)
- [ADR 0058](./0058-offline-sec-openfigi-v1-source-preparation.md)
- [Cycle 3e-a1 exit matrix](../CYCLE_3E_A1_EXIT_MATRIX.md)
- [ADR 0055](./0055-connected-personal-source-policy-registry.md)
- [ADR 0056](./0056-durable-personal-local-research-vault.md)
- [Cycle 3c exit matrix](../CYCLE_3C_EXIT_MATRIX.md)
- [Cycle 3d exit matrix](../CYCLE_3D_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](../PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
- [SEC current company ticker/exchange snapshot](https://www.sec.gov/files/company_tickers_exchange.json)
- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [SEC fair-access guidance](https://www.sec.gov/about/developer-resources)
- [OpenFIGI API documentation](https://www.openfigi.com/api/documentation)
- [OpenFIGI terms of service](https://www.openfigi.com/docs/terms-of-service)
- [ISO 10383 MIC source](https://www.iso20022.org/market-identifier-codes)
