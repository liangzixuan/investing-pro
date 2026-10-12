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

## Reviewed October 12 cohort

The fixed managed cohort contains AAPL, GOOG, GOOGL and MSFT: four listings for
three issuers. GOOG and GOOGL retain separate securities, share classes and
listings. This is a small reviewed cohort, with no price data or whole-market
claim. The original three complete identities and provider mappings are retained;
only Microsoft's internal identifiers are new. Saved records keep their existing
identity, note and reconciliation rules.

The API reconstructs canonical bytes from its selected snapshot asset and checks
the exact digest before admission. The adjacent manifest identifies public
sources, issuer filing dates, exclusions and the retained preparation review.
Full original source bodies and failed attempts remain outside Git. Stable opaque
identity assignments must be reused on a later refresh.

Microsoft's complete annual filing cover, filed July 29, identifies its common
stock by title and filing context. Two debt securities also display MSFT; those
contexts are excluded from the common-stock projection. The reviewed title is a
displayed string. No transformed XBRL par-value or exchange value is asserted.
One separately reviewed XNGS mapping returned a unique common-stock result,
joined through the dated MIC relationship to XNAS.

The composed source retains the September 30 candidate, venue and existing
listing evidence, with Microsoft's complete cover and mapping acquired October 12. Assembly time does not refresh older sources. Filing acceptance dates stay
separate from acquisition dates. The ISO MIC facts are a limited unofficial
projection with attribution to the official registry. The policy declaration
retains its original review date and scope; its deadline is an application review
deadline, not a source licence expiry.

TSM remains excluded because its original selected filing exceeded the acquisition
limit. BRK-B remains excluded because its exact mapping returned no identifier.
Earlier failed acquisitions remain retained; no partial filing was admitted.
The separate mapping batches do not establish how OpenFIGI expands operating MICs.

Catalog and Annual admission do not enable Price coverage. The existing AAPL,
GOOG and GOOGL Price identities and three-row Markets board remain unchanged.
Microsoft's Price view explains that coverage is unavailable and makes no price
request; Annual and the shared note remain usable.

The managed read handler provides authenticated `GET /v1/managed/catalog` and
`GET /v1/managed/catalog/search?q=...`, using the same fixed catalog. Its compact
receipt exposes attribution, source dates, coverage and exclusions. Detailed
rights declarations and internal preparation evidence remain on the server.
Search uses the existing ranked identity search and a 25-result cap. Responses
are bounded, private and uncached. The managed function composes this handler
with the same catalog and full-payload repository. Its source does not establish
a running deployment; workspace `CURRENT.md` records activation evidence.

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
connect Discover and My Watchlist through a session-bound access interface.

The full repository accepts the managed catalog and resolves a new membership
by its exact listing ID, independently of search ranking or result limits. A
matching command receipt is checked before current-catalog admission, so a
previously committed command can still be reconciled after a catalog refresh.
Valid historical saved records remain readable; new writes must match the
current catalog's complete identity. The accepted demo uses its existing
catalog and storage namespace.

The connected screen supports explicit search, exact listing selection, notes,
ordering, removal and save. It shows the catalog's limited coverage and source
receipt. Search results distinguish share classes and exchanges; a ticker never
substitutes for a listing ID. Notes and unsaved edits remain in the current
screen until saved, and session retirement clears them synchronously.

Catalog status and Search have separate progress labels. An initial status read
shows "Loading catalog…"; a later refresh shows "Refreshing catalog…". Search
shows "Searching…" only for an actual search. Both submit controls are disabled
while a read is pending, but the query remains editable; editing it cancels and
invalidates that read.

A failed catalog read points to Refresh catalog, while a failed search points
to Search with the retained query. Catalog review has its own recovery message.
These messages identify the failed action without claiming a network outage.
Recovery is explicit and does not reload, save or replace the watchlist draft.
The existing dated catalog receipt remains visible after a failed refresh; only
a successful response supplies a new receipt. A changed catalog still requires
the existing identity review, and authentication failure retires the workspace.

When a saved list uses an older catalog, the user can request an exact review
through read-only `POST /v1/managed/catalog/resolve`. Each explicit request carries
the current snapshot and at most 50 distinct listing IDs. Further batches require
another user action. The screen shows changed identities and unavailable entries
before applying the review; retained notes and membership order are preserved.
Applying removals is explicit. There is no automatic ticker remapping or silent
list truncation. A catalog change during review requires a fresh review.

Catalog review cannot resolve an uncertain save or clear a version conflict.
The shared save coordinator retains the original uncertain command for explicit
reconciliation. A replay confirms that command's receipt, then requires loading
the latest saved version and choosing a draft before editing again.

This source layer changes no running deployment, saved data, authentication
origin, native Android profile or local vault. Workspace `CURRENT.md` records
actual verification and delivery; synthetic test coverage is not real catalog
coverage. The separate managed service, runtime context proof and exact-build
website delivery must be accepted before the connected flow is considered live.
