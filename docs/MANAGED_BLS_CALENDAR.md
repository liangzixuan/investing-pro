# BLS release calendar

The source candidate adds an explicit BLS calendar to managed Markets. It is not
yet deployed or bundled into a delivered APK. The owner-reported Android 1.30
phone checklist in [Current work](CURRENT_WORK.md) does not accept this later
BLS candidate. Sustained daily use remains separate.

## Read scheduled releases

Use **Load BLS calendar** to read the next 30 elapsed days from the official
[BLS calendar](https://www.bls.gov/help/hlpiCAL.htm). Search the loaded release
names and select an Eastern date. Each row shows Eastern time, including its
daylight or standard offset, and its exact UTC instant. Retrieval time and the
inclusive/exclusive loaded window remain visible.

The official schedule link opens in a separate tab. Markets day view combines
already loaded BLS and BEA schedules with loaded Federal Reserve announcements.
Each source keeps its own retrieval time, window and failure status. Different
agencies or releases at the same instant remain separate. Selecting a source,
date or search does not make a request.

Use **Refresh BLS calendar** to check for a newer schedule. During refresh,
after a recoverable failure, or after Cancel, the previous accepted calendar
keeps its original timestamps and is marked previous. Leaving Markets cancels
an unfinished load. Returning uses the retained calendar. Session retirement
clears it and rejects late results. Calendar reads do not write Watchlist,
Follow-ups, valuation inputs or Portfolio records.

## Source and limits

The API makes one credential-free GET to BLS's fixed public ICS URL. It accepts
no caller URL, query, body, redirect or retry. The authenticated, body-free
managed route is `/v1/managed/bls-calendar`. Its total 10-second lifetime starts
at function entry and includes authentication. Source input is capped at
256 KiB and 4,096 events; the complete result is capped at 512 events and
512 KiB. Invalid input fails the load rather than producing a partial calendar.

The parser uses the installed Apache-2.0 `node-ical` library in memory. BLS's
legacy `US-Eastern` identifier is admitted only with its exact declared
post-2007 US daylight/standard rules, then mapped to `America/New_York`.
Round-trip checks reject ambiguous, nonexistent, floating or date-only release
times. Duplicate IDs, unsupported recurrence and tentative status fail the
load. Cancelled events are omitted. Only identical series/instant pairs can
deduplicate; simultaneous different releases remain separate.

The schedule mostly covers national BLS news releases. It does not establish
publication, released values, consensus estimates, importance or company
earnings dates. A valid empty window does not mean that no economic events
exist. `fetchedAt` is our retrieval time, not a publisher revision timestamp.
BLS's [reuse policy](https://www.bls.gov/bls/linksite.htm) permits its public-domain
material and requests attribution. The app uses factual schedule text and its
own layout, with no BLS emblem, photograph or illustration.

## Verification

Invented fixtures cover source normalization, DST, request admission and
lifetimes, complete packet admission, transport, explicit UI loading, filtering,
day view, retained return and cancellation without saved-record writes. One
retained public calendar capture was checked offline across the November DST
change. That capture establishes only its source format and covered dates.
Browser layout, authenticated production use, deployment and phone acceptance
remain separate checks.
