# Managed security catalog

The hosted application needs a catalog whose permissions cover hosted search,
display and storage. The existing local catalog declares owner-local use and
prohibits redistribution. Its records must not be relabeled or copied into the
managed service.

The managed admission profile reuses the security-master package's canonical
snapshot validation, immutable identity graph, exact listing lookup and ranked
symbol/name search. It has a separate entry point and closed profile. Local
admission remains restricted to local snapshots; managed admission rejects a
local snapshot even if its security identities are otherwise valid.

## Permissions and provenance

A managed snapshot declares `personal_single_user_managed_security_master`.
Its source-policy profile is `personal_single_user_managed_connected`, with
`localOnly: false`, `permitted_managed` display/search/cache/retention and
`permitted_with_attribution` export/redistribution. Attribution is required.
The source identity and policy-document digest remain explicit, with the same
review, acquisition, as-of and expiry ordering as local admission. A revoked,
expired-at-as-of, mixed-profile or incomplete declaration is rejected.

Provenance uses a `managed-composite-manifest` digest locator. Invented inputs
remain `synthetic_engineering`; a reviewed distributable source is labeled
`redistributable_source`. These declarations describe the supplied snapshot.
They do not authenticate a provider, establish complete market coverage, supply
prices or discover a later rights change. The caller must review the actual
source artifacts and policy before deploying them.

## Offline preparation

The managed SEC/OpenFIGI preparation entry point retains the existing six roles:
the preparation plan, SEC candidates, normalized issuer cover evidence, OpenFIGI
mappings, ISO MIC registry and stable opaque identity assignments. It verifies
their exact digests, joins and classifications with the existing reconciler.
Missing or ambiguous rows remain excluded with explicit reason counts. A
successful preparation releases its snapshot through the existing consuming
capability; a second or unrelated capability cannot retrieve it.

Preparation is an in-memory operation. It reads no files, credentials or network
resources. It does not acquire source data or open an Appwrite database. Internal
issuer/security/share-class/listing identifiers remain distinct from ticker,
CIK and provider identifiers. The same assignments must be retained when a
catalog is refreshed.

## Reviewed September 30 cohort

The fixed managed cohort contains AAPL, GOOG and GOOGL: three listings for two
issuers. GOOG and GOOGL retain separate securities, share classes and listings.
This is a small reviewed cohort, with no price data or whole-market claim.

Its original canonical snapshot digest is
`sha256:0ff96ab386a9f1ce4ecab834706aa8da6d9b8ee9efd97f9f79908d616b43a3e4`.
The API's formatted JSON asset reconstructs those exact canonical bytes before
admission. Its adjacent manifest identifies public sources, issuer filing dates,
exclusions and the retained preparation review. Full original source bodies and
failed attempts remain outside Git. Stable opaque identity assignments must be
reused on a later refresh.

MSFT and TSM are excluded because their selected filings exceeded the acquisition
byte limit. BRK-B is excluded because the exact mapping returned no identifier.
The second, separately reviewed XNGS mapping batch supplied the three admitted
listings; the first operating-MIC batch returned no matches. This does not prove
how OpenFIGI expands operating MICs. The ISO MIC facts are a limited unofficial
projection with attribution to the official registry. The snapshot's policy
deadline is an application review deadline, not a source licence expiry.

The managed read handler provides authenticated `GET /v1/managed/catalog` and
`GET /v1/managed/catalog/search?q=...`, using the same fixed catalog. Its compact
receipt exposes attribution, source dates, coverage and exclusions. Detailed
rights declarations and internal preparation evidence remain on the server.
Search uses the existing ranked identity search and a 25-result cap. Responses
are bounded, private and uncached. This handler has no mounted service entrypoint
yet; its presence in source does not change the running application.

## Connecting Discover and My Watchlist

Acquire a fixed, reviewable cohort from permitted original sources and retain
the input bytes, timestamps, attribution and digests. Review every role's
permissions, including the ISO MIC and issuer-cover evidence. The
[OpenFIGI FAQ](https://www.openfigi.com/about/faq) describes reuse of FIGI and its
associated metadata; the [SEC FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions)
describes reuse of government and EDGAR content and warns that its ticker file
does not guarantee accuracy or scope. Those general references do not validate
a particular acquired bundle.

Inspect the resulting full identities, source/as-of dates and exclusion counts.
Keep partial coverage visible. The managed API must use the same admitted
catalog for status, search and watchlist writes. It will need a separate storage
namespace so the accepted demo's saved record remains intact. Reuse the existing
Appwrite repository's full-payload, version and command-receipt rules, then
connect the existing Discover and My Watchlist controls through a session-bound
access interface.

The full repository accepts the managed catalog and resolves a new membership
by its exact listing ID, independently of search ranking or result limits. A
matching command receipt is checked before current-catalog admission, so a
previously committed command can still be reconciled after a catalog refresh.
Valid historical saved records remain readable; new writes must match the
current catalog's complete identity. The accepted demo uses its existing
catalog and storage namespace.

This source layer changes no running deployment, saved data, authentication
origin, native Android profile or local vault. Workspace `CURRENT.md` records
actual verification and delivery; synthetic test coverage is not real catalog
coverage. The hosted Discover/watchlist interface and separate managed service
remain the next integration work.
