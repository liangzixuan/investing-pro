# Federal Reserve monetary-policy announcements

Implementation is in progress and unreleased. Root recorded the
outcome, ownership and acceptance before edits in CURRENT.md. Accepted
a86 is the baseline: release `dbfaf478722eab4cfde0fbe2b0c896d2fab37398`, feature
`bee398c709debade0246667f2689f5007c316acb`, build `nWXiku1-SsHPISrPv44B1`.
Its running app and prior evidence remain intact. The first implementation window
ended with an unreleased checkpoint at September 27, 06:26 UTC. The owner renewed
work from September 27, 06:29:44 UTC through September 28, 06:29:44 UTC; select no
new slice after September 28, 05:44:44 UTC. Continue this same outcome under the
[plan](./plan.md) and [tasks](./tasks.md). The renewed window does not waive any
release requirement. Workspace CURRENT.md records the current authorization.

Add one independent Markets panel showing up to ten announcements from the
Federal Reserve Board's monetary-policy feed. Loading and refreshing are explicit.
Show title, publication time or its absence, source attribution and the local
retrieval time. Keep the existing price board, comparison and BEA agenda unchanged.
Company news, article contents, summaries, sentiment and automatic refresh are
outside this slice.

The source prerequisite is complete: one consumed public observation returned
HTTP 200 and 9,645 bytes, with 15 items. Use the retained fixture and corrected
analysis for development; do not repeat that observer. The
[source proposal](../../../tmp/fed-announcements/source-contract-integration-proposal.md) and
[parser decision](../../../tmp/fed-announcements/parser-decision.md) provide the evidence and package rationale.

## Source and validation contract

The only provider URL is
`https://www.federalreserve.gov/feeds/press_monetary.xml`. Use the existing BEA
provider's injected fetch/clock, `load(signal)`/`close()` lifecycle and bounded
transport pattern: one GET, omitted credentials, no referrer, no-store, redirect
rejection, zero retries, ten seconds shared across fetch/body, and at most 262,144
measured response-body bytes. Require status 200 and a body; reject a redirected
response and invalid/excess content-length. Fatal UTF-8 decoding accepts the
observed BOM. Capture `fetchedAt` from the injected clock after the complete body
is received, before normalization; publish it only with an accepted result.

Parse with exact `@rgrove/parse-xml@5.0.0` and the options in the parser decision.
Use no resolver. Reject every preserved DTD and processing instruction, any
non-1.0 declaration or declared encoding other than case-insensitive `UTF-8`.
An absent declaration is allowed because bytes are already decoded as UTF-8.
Comments are discarded; CDATA and ordinary text are decoded once. Parser errors,
including excessive-nesting errors, yield `invalid_response`; never return raw
parser messages, excerpts or a partial result. No URL in XML is fetched.

The parser has no documented hard CPU-time or depth bound. The byte limit is an
input bound; the network timer cannot interrupt synchronous parsing. Adverse
offline tests at that limit are required before acceptance. Do not claim that a
post-parse check provides a pre-parse resource bound or add a custom XML parser.

Apply this narrow RSS grammar through typed tree nodes:

- Exactly one attribute-only `rss` root whose sole attribute is `version="2.0"`,
  containing one attribute-free `channel`. Structural text must be whitespace.
- Channel fields are `title`, `link`, optional `description`, optional `language`,
  and zero to 128 `item` elements. Require one title equal to
  `FRB: Press Release - Monetary Policy` and one link equal to
  `https://www.federalreserve.gov/feeds/feeds.htm`. Other channel fields occur at
  most once. Reject other elements, namespaces and non-whitespace structural text.
- An attribute-free item requires exactly one `title` and one `link`. Optional
  `guid`, `pubDate`, `description` and `category` occur at most once. Scalar fields
  have no attributes or child elements and may contain text/CDATA only. The
  description/category/language values are not returned or rendered. Their size
  remains bounded by the response cap. Unknown elements and duplicate fields fail.
- Trim surrounding XML whitespace from selected scalars. The title must then be
  nonempty, at most 256 UTF-16 code units, and free of Unicode `Cc`, `Cf` and `Cs`
  characters. Preserve ordinary Unicode and internal spaces; no HTML rendering or
  additional entity decoder.
- The trimmed link is at most 2,048 code units and is the item identity. Require
  its literal canonical form to match
  `https://www.federalreserve.gov/newsevents/pressreleases/monetary` followed by
  eight decimal digits, one lowercase ASCII letter and `.htm`. Use `URL` to also
  verify exact HTTPS origin and no port, credentials, query or fragment; require
  `url.href` to equal the trimmed input. Reject encoded/path-normalized aliases,
  other hosts, relative URLs and other schemes. The filename is not a substitute
  publication date and creates no linked-page availability claim.
- GUID is optional because identity comes from the link. If supplied, it must be
  nonempty, attribute-free, at most 2,048 units, and equal the validated URL after
  the same outer trim. Do not expose a second identity or support opaque/permalink
  variants in this source-specific slice.

Publication-date acceptance is exact and locale-independent. Absence of `pubDate`
produces `null`; a present empty or malformed value fails. After outer XML trim,
accept only `Www, D Mon YYYY HH:mm:ss GMT` or a two-digit day, using the English
three-letter weekday/month names with that capitalization, literal spaces and
literal `GMT`. Limit the source string to 64 units. Years are four digits from
1000 through 9999; day is 1–31, hour 00–23, minute/second 00–59. Construct UTC from
numeric fields, round-trip every component to reject impossible dates, and
compare its UTC weekday with the supplied weekday. Do not use permissive
`Date.parse` on the source string. Emit canonical UTC `YYYY-MM-DDTHH:mm:ss.000Z`.
Accept source-provided future instants without describing them as already issued;
do not silently substitute retrieval time. Leap-second values, numeric offsets,
other timezone names, two-digit years and trailing text fail this contract.

Validate every bounded input item before sorting or limiting output. For repeated
URLs, collapse only identical normalized title/publication pairs, preserving the
first source position; conflicting data fails the whole response. Distinct URLs
with repeated titles or equal timestamps remain distinct. Sort known publication
instants descending, preserving source order for ties; place unknown times last,
also in source order. Then return the first ten unique items. A structurally valid
channel with zero items succeeds; an empty body/object or missing channel fails.

## Local API and DTO

Add `PersonalMonetaryAnnouncementsDto` and its strict shared validator:

```ts
{
  schemaVersion: "1.0.0",
  source: {
    id: "federal-reserve-board",
    name: "Board of Governors of the Federal Reserve System",
    feedUrl: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    directoryUrl: "https://www.federalreserve.gov/feeds/feeds.htm",
    timeZone: "America/New_York"
  },
  fetchedAt: "<canonical UTC instant>",
  availableItemCount: 0,
  items: [{ title: "...", url: "...", publishedAt: "<UTC instant> or null" }]
}
```

The illustrated item is a shape example, not an example empty DTO. Exact keys are
required at every level. `availableItemCount` is an integer 0–128 counting unique,
validated items before the ten-item limit; `items.length` equals
`min(10, availableItemCount)`. Validate canonical dates, fixed source constants,
item lengths/URLs, URL uniqueness, descending known times and unknowns last in
both API and client. Source-order ties are a provider obligation since no ordering
index is exposed. Deep-freeze accepted provider/client projections.

Register only GET `/v1/personal-filing/monetary-policy-announcements`, without query
or body and with automatic HEAD disabled. Reuse
`authorizePersonalRouteRequest`, configured loopback/origin boundaries and current
local-access/owner-session authority. Unauthorized or malformed request framing
must fail before provider acquisition. Pass disconnect cancellation to the
provider. Revalidate its DTO at the route and return the existing generic 502
problem shape on source/validation failure; retain the existing authorization
failure behavior. No token, vault, catalog, owner-record, company or configuration
dependency is added.

## UI and request lifetime

Use a dedicated `useFedMonetaryAnnouncements` beside `useBeaReleaseAgenda` in the
existing persistent Markets mount. Reuse its activity-start/completion protocol,
captured/current session and epoch checks, synchronous `isCurrent`/`isActive`
checks, one pending controller and unmount/close cleanup. A second click while
pending is a no-op. Construction, render, mode changes, company navigation and
Back must not start a feed request. The panel has its own request state and does
not consume the price-board acquisition budget.

Hiding Markets aborts pending work and preserves accepted announcements. Returning
shows those same values and `fetchedAt`. Session-key/enablement changes, authority
retirement or session-unavailable completion clear accepted and pending state;
an abort-ignoring late completion cannot publish. A normal failed refresh retains
the old complete DTO and its retrieval time with an error message. A successful
empty refresh replaces the prior data with an accepted empty state. Unmount aborts
and invalidates all callbacks. No persisted cache or owner writes.

Use the heading “Federal Reserve announcements” and scope copy “Monetary policy ·
Announcements from this feed.” Actions are “Load announcements” and “Refresh
announcements,” disabled while loading or unavailable. Distinguish idle, loading,
initial failure, accepted empty, populated and retained-refresh-failure states.
Show “Showing N of M announcements from this feed,” plus source attribution and
“Loaded” retrieval time. Label item times “Published”; use “Unknown publication
time” for null. Format instants with existing `Intl.DateTimeFormat` in
`America/New_York`, display the timezone, and preserve canonical `time` values.
No “latest,” complete-market coverage or real-time freshness claim.

Render title links as React text with `target="_blank"` and
`rel="noopener noreferrer"`. Keep native buttons/links, visible keyboard focus,
44-pixel targets and wrapping at 390 pixels. Article navigation is a user action;
no prefetch or article request is part of loading or QA. Keep the BEA and price
panels mounted and independently usable.

## Ownership and acceptance

| Owner area           | Minimal files and existing seams                                                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract/integration | New `packages/contracts/src/personal-monetary-announcements.ts` and tests/export; existing OpenAPI and exact `openapi.test.ts` path list; `workspace-app.ts`, `workspace-composition-root.ts`, static-graph and boundary owner/adverse tests. |
| API                  | New `fed-monetary-announcements-provider.ts` and `workspace-monetary-announcements-routes.ts` with their tests. Reuse the BEA transport/lifecycle pattern locally; do not create a generalized feed framework.                                |
| Dependency           | Exact API dependency, lockfile, `verify-licenses.ts` direct notice mapping and `THIRD_PARTY_NOTICES.md` row/ISC notice. No license allowlist relaxation, Node change or extra type package.                                                   |
| Web                  | Existing `personal-workspace-api.ts` validated client plus focused client test; new hook/panel/tests/scoped CSS; small `MarketsHome.tsx` composition and existing composition assertions.                                                     |
| Root                 | Scope/spec/docs, independent reviews, source-bound synthetic/live plans and normal release procedure. Assign non-overlapping files before edits.                                                                                              |

Required focused evidence is behavioral, not a prescribed test count:

1. Installed pinned parser admits the retained fixture offline: 15 unique items,
   ten returned, CDATA and apostrophe entity correct; dates match corrected source
   analysis. No transport runs during parsing.
2. Exercise every malformed/missing/duplicate rule, single/double-digit days,
   impossible calendar values and weekday mismatch; verify equal-time source order,
   unknowns last, repeated titles and validate-before-limit behavior.
3. Prove DTD/external-entity/expansion/unknown-entity/malformed-numeric rejection,
   UTF-8 errors, hostile links, deep nesting and finite item/text/body bounds.
   Prove no resolver or linked-resource acquisition and no partial result.
4. Cover fetch/body deadlines, close, pre-abort, disconnect, ignored-abort late
   completion, no retry, route authorization/query/body rejection and strict DTO
   client validation. Run the whole contracts suite, including the route allowlist.
5. Cover idle/no automatic IO, double click, successful empty response, retained
   refresh failure, hide/Back, session/authority retirement and independent panel
   state. Verify keyboard use, source/time labels, hostile title escaping and
   desktop/390-pixel synthetic layout with the actual source-bound application.

Type/lint/format, license/boundary/static-graph and production build checks remain
required, followed by the established native/hosted/activation release process.
A later live plan may authorize one explicit feed load only, with its own source
budget and no article request; this draft grants no such action. Until those
stages actually pass, describe the feature as pending and preserve accepted a86.

Evidence pins: source proposal `eb45c77d83c0fee8a6c652326341622b69a6dec55e9183afc67469c3eae0bad4`;
parser decision `f2f1363106077b5c148305203594c952c25d2d8f486d2a1b07100ef1e2df564d`;
corrected retained analysis `f4848d504a10259541123c5baa0056f90d460d0fc987352b15f0d9faafedb13f`.
