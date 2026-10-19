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

## Reviewed October 16 cohort

The fixed source candidate contains 19 listings for 18 issuers: AAPL, AEM, AFL,
AIG, ALCO, AMD, AP, AVD, AXP, BKTI, GOOG, GOOGL, HWM, LNG, MATX, MSFT, SWKS,
UHAL and UNM. This remains limited coverage. The four October 12 identities and
their 12 typed FIGIs are unchanged. Fifteen additional identities use separately
minted issuer, security, share-class, listing and mapping IDs.

The existing offline preparer produced 19 admitted records from 33 candidates.
Thirteen candidates are quarantined: ten lack unambiguous reviewed cover evidence
and three lack exact accepted mappings (BRK-B, CECO and ALX). UNMA is an unsupported
debt security. Partial filings, ambiguous classes and unresolved symbols stay
excluded. No alternate symbol or MIC query supplies a fallback identity.

The new immutable snapshot and manifest preserve the October 12 assets. The API
reconstructs canonical JSON bytes and checks the prepared digest; the formatted
file's byte digest is separate. The manifest pins the actual preparation receipt,
source-policy decision and independent review. Its public receipt retains the
original issuer filing links and adds a labelled SEC cover-collection link. All
additional selected filing URLs, filing and acceptance dates, capture times and
completeness flags remain in the server-only manifest. Exact exclusion reasons
also remain there; the public receipt keeps its existing closed reason labels.
The source and exclusion caps remain eight and 64.

The October 16 policy review covers this attributed identity projection. It uses
SEC issuer and literal cover facts, OpenFIGI identifiers and metadata, and limited
ISO 10383/SWIFT venue facts. It does not redistribute the raw filings or full MIC
registry. OpenFIGI returns no SEC CIK in these mappings; the reviewed join uses
the exact ticker, class, issuer and venue evidence. Listed status follows the
documented mapping-request default. Source-role acquisition clocks and older
capture dates are preserved. Assembly time does not refresh the sources.

Discovery does not enable financial feeds. Price remains limited to AAPL, GOOG
and GOOGL. Annual independently admits the named 18-listing, 17-issuer
[screening cohort](MANAGED_FINANCIAL_SCREEN.md). The deployed Filings scope remains
Apple, Alphabet and Microsoft. The next source candidate independently qualifies
Filings for the same named cohort; publication and API admission remain separate.
Other identities are refused before source admission or a provider request.
Saved records still require the current catalog review for new
writes; historical reads and original-command reconciliation retain their
existing rules. Source integration does not establish a running deployment.

## Retained October 12 evidence

The October 12 cohort introduced MSFT beside AAPL, GOOG and GOOGL. GOOG and GOOGL
retain separate securities, share classes and listings. The original three
complete identities and provider mappings were retained; only Microsoft's
internal identifiers were new. Those four identities remain exact in the current
candidate.

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
