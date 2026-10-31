# CPI release headlines and a dated research check

This M3/M4 workflow connects one official BLS CPI headline feed to an authored
company question. Source, API and Android 1.55 delivery are accepted from
`0d72521c5631540c626b8cd63920f478624673de`. The managed website remains at its prior
release. [Current work](CURRENT_WORK.md) records verification and its limits.

CPI is also part of the seven-operation [Markets source pass](MANAGED_MARKETS_SOURCE_REVIEW.md). The [daily briefing](MANAGED_MARKETS_BRIEFING.md) retains the complete reading and chosen headline through Follow-ups Research and Back. These client changes are in acceptance; the existing source and request limits stay in force.

## Read and choose

In Markets, open **Published CPI headlines**. Opening the panel, filtering loaded
titles and choosing a headline start no source request. Use **Load CPI headlines**
to read the fixed official feed. **Refresh CPI headlines** checks it again;
**Cancel** stops unfinished work. A retained previous packet keeps its original
clocks and previous-data qualification. A successful empty feed, an unloaded
panel, no search matches and a failed read have separate meanings.

Each headline keeps its complete title, original dated BLS archive link, source
entry ID and attribution to the U.S. Bureau of Labor Statistics. **Feed published
time** and **Feed updated time** retain the source's exact offset and fractional
precision, or an explicit unknown. Retrieval time and the feed-level update time
stay separate. A feed clock does not independently verify the release's embargo
or publication time. The source does not establish an economic revision, complete
history, market-wide news or relevance to a company. No article body, summary,
economic-value extraction or BLS image is acquired for display.

The panel shows at most ten admitted headlines and the number available in the
accepted feed. This is bounded feed coverage, not a promise of ten publications,
a fixed history window or a real-time service. The existing BLS and BEA calendars
remain schedules. A calendar entry is never promoted to a publication by time.

## Keep the authored check

1. Choose **Keep a dated check** on one loaded headline. Independently choose an
   exact company from the editable **My Watchlist** draft. The choice starts empty;
   the app does not infer that CPI concerns the company or changes its thesis.
2. Write a one-line question and a UTC due date in `YYYY-MM-DD` form. This authored
   planning date remains separate from every feed and retrieval clock.
3. If eligible, explicitly load Follow-ups for the question. Retain the raw form
   through that initial read or recoverable failure. Do not replace an existing
   draft, pending save or recovery state.
4. Preview the complete saved question and citation, both source clocks or unknowns,
   original archive URL, full listing/share-class identity, catalog and UTC date.
   The entire one-line question and citation must fit the existing 500 Unicode
   character limit. Invalid or oversized text is refused without clipping.
5. Create one independent Follow-ups draft entry. The existing 20-entry and
   one-entry-per-listing limits apply. Review that exact entry, open company
   Research, return through Back, then **Save follow-ups** separately. A fresh
   explicit Load can confirm the complete saved text. Watchlist notes, Portfolio
   and valuation inputs retain their independent Saves.

Source refresh, including identical returned values, retires the old source choice.
Changes to the form, exact company, catalog, drafts, file activity, recovery state,
visit or session retire old previews permanently. Create consumes its preview
before resource notifications, so repeated or reentrant actions cannot create
another entry. Source choice survives only its own eligible initial Follow-ups
read. No navigation or authored action starts a source request or online Save.

## Fixed source and admission

The [official BLS feed directory](https://www.bls.gov/feed/) lists the
[Consumer Price Index feed](https://www.bls.gov/feed/cpi.rss) under News Release
RSS Feeds. The documented URL returns UTF-8 Atom XML with an Atom namespace;
the `.rss` suffix does not make it RSS 2.0. The separate Latest Numbers feed is
a changing indicator summary and is not used as a release-headline list.

The source adapter uses one credential-free GET to that exact feed, behind an
authenticated, body-free and query-free `/v1/managed/cpi-headlines` route. It
accepts no caller URL, redirect or hidden retry. The existing ten-second total
operation lifetime starts at function entry and includes authentication. The
admission bounds are 256 KiB of source XML, 128 input entries and 64 KiB for the
response. These are application limits, not provider guarantees.

The installed `@rgrove/parse-xml` library parses this fixed source in memory.
Admission checks the namespace and feed identity, bounded scalar fields, opaque
entry IDs, canonical dated CPI archive URLs and complete source clocks. Present
malformed, impossible, floating or date-only clocks fail admission. Missing item
clocks remain unknown. Do not derive them from an ID, archive filename, calendar,
HTTP header, root update time or retrieval time.

Exact duplicates can deduplicate only under the defined identity and metadata
rule. Conflicting repeated IDs or URLs fail the whole read. Sorting uses validated
feed publication instants, with unknown times last and original order for ties.
Original source fields remain unchanged. A single capture does not establish
immutable publisher IDs, article revision history or continued source availability.

BLS's [public-domain and linking policy](https://www.bls.gov/bls/linksite.htm)
supports attributed factual metadata. Previously copyrighted photographs and
illustrations are excluded; the BLS emblem is protected. The app uses its own
layout and keeps admitted metadata in the volatile session model. An explicitly
authored private Follow-up can retain its citation. This adds no server cache,
bulk archive, background polling, account, paid entitlement or new usage charge.

## Verification and release boundaries

Retained public responses qualified the source format and clocks offline. They
are local evidence, not public test fixtures or a production availability promise.
Implementation tests use invented data. Required acceptance includes strict
source/DTO admission, unknown clocks, empty and malformed responses, cancellation,
late results and retained packets, complete Unicode citation limits, exact-company
ownership, one-time creation and stale preview refusal. The complete invented
journey must preserve the full citation through Review, Research, Back, separate
Save and a fresh explicit Load while leaving unsaved Watchlist work intact.

Source checks, hosted synthetic native checks, API activation, website publication
and local Android delivery are separate events. None establishes owner-record
access, browser layout, installation or physical-phone acceptance. Browser work
remains subject to the owner's current stop. The source and current-status guides
will record actual acceptance before any release claim.
