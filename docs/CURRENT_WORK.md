# Current work

Updated October 8, 2026. This is the portable status summary for the public
repository. [Product roadmap](PRODUCT_ROADMAP.md) owns the goals and delivery
order; [architecture](ARCHITECTURE.md) explains the runtime boundaries. Private
operational receipts are retained separately and are not required to understand
or develop the repository.

## Accepted release

PR 53 is merged as `5f0dbfc49c28a9b5ca3825033babab161041deb1`, from candidate
`e8e550b185d784362bf3d200e676d9125dcdaadd`, with tree
`880f7d7d99863d07aa49d7e8652149b019c88e40`. Three required actual-main workflows
and four jobs, the original producing-CI source proof and seventeen synthetic
native cases are accepted. Loaded Markets rows now carry their validated dated
history into company Price, including Annual-first visits, without another price
request. Direct visits remain unloaded. Repeated same-location Home navigation
in the disconnected Android shell preserves the previous Back destination.

Website release
[37730493042](https://github.com/liangzixuan/investing-pro/actions/runs/37730493042),
attempt 1, promoted the same accepted archive after normal production approval.
Staging `6ac7245e65ebafefd376` and production `6ac7297176077331c655` used the
827,839-byte archive, SHA-256
`dbe63df7e1e54836567ced38a27ac3ed26a14e4ad96e30b3ef92e052d8127902`.
Production replaced `6ac6ac75b756f9d2ff49`; its receipt verified activation on
October 8 at 05:26:40 UTC. This records that observation, not continuing availability.

Signed Android 1.14.0, code 15, passed build, complete artifact and delivery
review with the existing package and production signer. The delivered APK is
6,655,640 bytes, SHA-256
`bf3280ca36b7f5fdd7324586ab7739efa8614af61db7ef1ccb995e1453645d38`.
Its source is the PR 53 main commit above. Earlier APKs and rollback identities
remain preserved; no physical 1.14 installation or use is accepted here.

The seventeen-case emulator report covers three disconnected and fourteen
managed journeys. Ten of forty original frames received visual review; the full
assertions, request counters and thirty-seven captures supply the wider test
evidence. Minor focused-note error spacing remains readable. BrowserStack covered
the exact-build inert staging shell; authenticated interactions used separate
invented-data checks. Physical Pixel 1.14, separate screen-reader and
backup/restore acceptance remain open. The owner's issue-free Pixel 1.13 report
remains a separate observation without per-step logs.

Both earlier failed PR 53 native reports and the nonrequired CodeScene advisory
failure remain recorded. The successful report does not establish every rare
tap-recovery path. API continuity covers the same 109 selected committed inputs
with two historical exceptions; no API redeployment or coverage expansion occurred.

## Previous release: PR 51

PR 51 is merged as `b110ae9ca1194fbef98b85401e29451cb5b987c1`, from candidate
`d67c354c6a9371e3750315ac88b77b13a35b3cec`, with tree
`aa5e8a57de381bcba0bead5f5b508426e9692ed5`. Its three required actual-main
workflows and four jobs, original CI attempt 1 source proof and seventeen-case
synthetic native report are accepted. Invalid notes are identified beside their
editors; My Watchlist can focus the first invalid note before explicit correction
and Save watchlist.

Website release
[37679537485](https://github.com/liangzixuan/investing-pro/actions/runs/37679537485),
attempt 1, promoted the accepted staging archive after normal production
approval. Staging `6ac6a67c69f9a2103249` and production
`6ac6ac75b756f9d2ff49` used the same archive, SHA-256
`16980483c6a111fec3d41eaec63d72afe7793f9df7fabb7e07ab815ee808cc00`. Production
replaced `6ac5943a7a5065198fd7`; its receipt verified activation on October 7
at 20:33:24 UTC. This records that observation, not continuing availability.

Signed Android 1.13.0, code 14, passed build, complete artifact and delivery
review with the existing package and production signer. The delivered APK is
6,655,320 bytes, SHA-256
`388c45c0af01e2f76234f4b834e0cc201bbb3e2b58223b2188e87f45a9d6459a`.
Its source is the PR 51 main commit above. On October 8 UTC, the owner reported
physical Pixel use of Android 1.13 was fine, with no issues found. This is
owner-reported acceptance without per-step logs; it does not establish separate
screen-reader or backup/restore acceptance.

| Surface                   | Accepted outcome                                                                                                                                                                | Limits                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Managed API               | Deployment `6ac20862d12fe7560852`; authenticated catalog/watchlist/Annual/EOD routes, private storage and shared request budgets; anonymous origin/authentication checks passed | A receipt records activation at its observation time. Account-wide external provider consumption and continuing availability are not known                                                                                                                        |
| Managed website           | `https://app.investingpro.app`; deployment `6ac6ac75b756f9d2ff49`; PR 51 staging archive promoted after normal approval                                                         | BrowserStack covered the exact-build inert staging shell at desktop and narrow widths. Authenticated note and watchlist workflows were outside that check. The October 6 live AAPL comparison is a separate bounded read, without a continuing-availability claim |
| Signed Android artifact   | Investment 1.13.0, code 14, package `app.investingpro.android`; same production signer; independently accepted assets/manifest and delivered exact APK                          | Owner reported Pixel use of 1.13 without issues on October 8 UTC; no per-step logs or separate screen-reader/backup-restore proof                                                                                                                                 |
| Automated Android         | PR 51: seventeen passing invented-data API-36 emulator cases on actual-main attempt 1; six of thirty-nine original frames received visual review                                | Full note, focus/ARIA, save/reload and request counts rely on native assertions; scoped frames do not establish production sign-in, live-provider or physical-device acceptance                                                                                   |
| Previous physical Android | Owner-reported 1.1 in-place upgrade and supplied checklist passed on Pixel 10 Pro XL / Android 17                                                                               | No per-step logs; 1.2 through 1.12 retain their historical acceptance limits; 1.13 has the separate owner report above                                                                                                                                            |
| Local research app        | Preserved local release and encrypted vault, with broader research/portfolio tools                                                                                              | No automatic migration or claim that these panels are available in the managed product                                                                                                                                                                            |

The previous release, PR 48, is merged as `29181d805eb33a1af80823458ff67f1b5a6cae25`, from candidate
`41acd386ab6a4d6a2d32af317212f8c0a66fa2cb`, with tree
`ee9be8b4cc9c953615f6a8298a4b5d0f45262781`. Its five required actual-main
workflows and six jobs, original CI attempt 1 source proof and seventeen-case
synthetic native report are accepted. Company Price can append a selected
comparison to an existing watchlist note draft, followed by explicit review and
Save watchlist.

Website release
[37550772891](https://github.com/liangzixuan/investing-pro/actions/runs/37550772891),
attempt 1, promoted the accepted staging archive after normal
production approval. Staging `6ac58eae4a6880c35612` and production
`6ac5943a7a5065198fd7` used the same archive, SHA-256
`1b28a710e3fab32d84df8db0c641fe3e5ed057f4f4aea6aa6e72c8ad95aea038`. Production replaced
`6ac4f5af7ae73ae9f88c`. Signed Android
1.12.0, code 13, passed build, artifact
and delivery review with the existing package and production signer.

The previously accepted 1.12 APK is 6,654,948 bytes, SHA-256
`3a4b7370b8edc2595d358498254abc19aeaf2ce75872ee0ffb025252aeb308a1`. It was built from the PR 48 main commit above. Its signed
package and delivered bytes are covered by separate artifact and delivery reviews.

PR 46 is merged as `662ca9e02e3d5836c8e3d3bb36126c01d7bd4d0c`, from candidate
`2800792c52add84e911de7e2e550dcea5a0fa3a7`, with tree
`b26005998188a9207624b7b1202c73775f2c82a2`. Its five required actual-main
workflows and six jobs, original CI attempt 1 source proof and sixteen-case
synthetic native report are accepted. The shared Markets and company Price chart
can compare an earlier observed close with the latest loaded close.

Website release
[37466898815](https://github.com/liangzixuan/investing-pro/actions/runs/37466898815)
promoted the same staging archive after normal production approval. Production
`6ac4f5af7ae73ae9f88c` replaced `6ac472728a6e13d44cc8`. Signed Android 1.11.0,
code 12, passed build, artifact and delivery review with the existing package and
production signer.

The previously accepted 1.11 APK is 6,654,152 bytes, SHA-256
`696a7d165e05a849343ead51c3bcad188cf37dc933c4e520ffc9aa390a2a3b54`.
It was built from the PR 46 main commit above. Its signed package and delivered
bytes are covered by separate artifact and delivery reviews.

The previously accepted 1.10 APK is 6,653,708 bytes, SHA-256
`2662bc1fd4ccfdc9a7db5766ed277b1996bedc56a80b91568ee76d613939bf2a`.
It was built from PR 44 main `0e970dc6dd6ae90387f4486e95434b8bab780830`,
whose tree matches the published candidate. The PR 44 website at
`6ac472728a6e13d44cc8` replaced `6ac41ece3facc2368045`. The delivered 1.9 APK
(6,652,672 bytes, SHA-256
`05d7ece436d62f4aeb1b9f75de0db7a41695c22edd133cda96ca916113d950b3`),
earlier packages and rollback identities remain preserved. API source continuity
covers 109 selected inputs with its recorded historical exceptions. It does not
establish fresh API activation or continuing availability. Signed packages and
operational evidence are not part of the public source tree.

For PR 40, isolated Brave checks covered desktop pointer selection, narrow exact-decimal
wrapping, readout cleanup and keyboard focus reaching the table. The native
report covers real touches on first, last and replacement rows with unchanged
request/save counters; one tooltip frame received visual review. Unpressed
hover, horizontal keyboard scrolling, a live provider journey and physical-phone
use remain unverified.

## What works in the managed product

[Markets](MANAGED_MARKETS_HOME.md) is the initial managed view on the website
and in signed Android 1.14. An explicit board load requests AAPL, GOOG and GOOGL
sequentially. Each row keeps its own trading dates and shows the raw USD difference
and four-decimal percentage between its final two observations, with both dates
and a split/dividend disclosure. One-row history reports an unavailable change.
Selecting a row reuses its chart and exact-value table. Load or Refresh for the
named selection requests only that listing. Changing selection
while it runs does not retarget the request; the other rows stay unchanged.
Research opens without another price load, and Back returns to the board opener.
Leaving Markets clears prices without changing the mounted watchlist draft.
The board covers three listings for two issuers; it has no mover rankings,
live quotes, index or whole-market coverage.

The fixed catalog contains AAPL, GOOG and GOOGL, preserving separate listing and
share-class identities. Discover and My Watchlist support shared notes, order,
removal, explicit saves, conflicts and uncertain-save reconciliation. Catalog
startup and search failures name their explicit recovery action.

An explicit [Annual report](MANAGED_SEC_ANNUAL.md) panel uses bounded SEC evidence.
A refresh keeps the prior validated report visible through supported transient
failure, cooldown and Cancel, with its original dates. The separate
[EOD close history](MANAGED_EOD_HISTORY.md) panel loads one calendar month of raw
USD closes for AAPL, GOOG and GOOGL. Explicit refresh, Cancel, checked cooldowns
and supported transient failures retain the previous validated history with its
original dates. Back, retirement and fatal validation failures clear prices.
There is no automatic request or persistent price cache.
Both sections share a [company research visit](MANAGED_RESEARCH_NAVIGATION.md)
with a stable listing header. Switching cancels pending local work and retains
validated results and provenance; returning sends no request. Back returns to
the original opener, or Markets for a direct link, and preserves the mounted
watchlist draft. Leaving the visit,
selecting another listing, or catalog, session or watchlist-identity invalidation
clears both sections. Reopening through a URL starts unloaded; PR 53 carries
validated history from loaded Markets rows. Android Back uses the same
close/focus action. Markets board snapshots remain separate from company Price.

A bookmarkable root URL identifies the exact listing and its Price or Annual
section. Opening it resolves current catalog metadata and starts research
unloaded. Section changes replace the company history entry; browser
Back/Forward and Android Back use the same visit lifecycle. Review in My
Watchlist closes the research URL without saving the draft.

At 03:55 UTC on October 3, one explicit authenticated AAPL `1m` UI load succeeded.
It showed Tiingo/raw USD history with 21 unique increasing dates from September 3
through October 2, within the requested September 3 to October 3 window. Back
restored focus; saved state was unchanged. No Refresh or watchlist write was
performed. On October 4, one explicit GOOG load and one GOOGL load each returned
20 unique increasing dates from September 4 through October 2, within their
September 4 to October 4 window. Each Back preserved the saved workspace.
At 15:46 UTC on October 4, one production Markets board load returned 20 dated
rows for each listing, from September 4 through October 2. GOOG and GOOGL stayed
separate. Back preserved the loaded board and focused its opener; My Watchlist
was unchanged. Returning to Markets cleared prices without reloading. This
journey used no Refresh, separate panel Load or watchlist mutation.
After PR 34 website delivery, one live AAPL visit loaded Price and Annual
explicitly. The twenty dated price rows, report and displayed provenance stayed
unchanged across section returns. Back restored opener focus; a new visit started
unloaded and the saved watchlist remained unchanged.
On October 5, one explicit board load returned 19 dated rows per listing. Each
raw-close comparison matched the final two observations. Back preserved the
comparisons; leaving Markets cleared them. An initial saved-watchlist read failed
and recovered through one explicit Load saved watchlist action. No owner-record
write, Refresh or separate company-price load occurred.
After PR 38 website delivery, a separate bounded browser check observed Price
and Annual URLs, reloaded the Annual link with an existing session, and returned
to Markets. The direct visit remained unloaded. No provider-load or watchlist-save
action was used; this UI observation did not measure network request counts.
At 22:58 UTC on October 5, one explicit selected AAPL load on the PR 42 website
displayed 20 dated raw USD closes from September 8 through October 5, within the
requested September 5 to October 5 window. GOOG and GOOGL stayed unloaded.
Switching to GOOG and back preserved AAPL's chart; company Price opened unloaded,
and Back restored the board and opener focus. My Watchlist remained saved and
unchanged. No Refresh, full-board load, separate panel Load or watchlist mutation
was used. This UI observation did not measure network request counts.
These cases establish their bounded live journeys, not other fields, ongoing
availability, repeat reliability or physical-phone coverage.

## Current task and next acceptance

PR 53 carries a loaded Markets row into company Price without another provider
request. It preserves full listing identity, original dates and previous-history
status, including Annual-first visits. Direct entry stays unloaded; Refresh
remains explicit. Shared cooldowns, watchlist drafts and the board's own snapshot
retain their existing lifetimes. The accepted release is recorded above.

PR 53's first two native runs each passed all fourteen managed-workspace cases
and failed the disconnected recreation case. The first recorded a delayed tap;
the second found an extra Markets history entry after tap recovery. Both failures
remain recorded. The final source makes same-location disconnected navigation
replace the current entry and explicitly checks repeated Home taps before Back.
Its required hosted checks and original actual-main native report passed.

[Invalid-note recovery](MANAGED_RESEARCH_NAVIGATION.md#correct-an-invalid-note)
is delivered on the website and in signed Android 1.13.
Company and watchlist editors show feedback beside invalid text. My Watchlist
can focus the first invalid note in the current order. Correction keeps the raw
draft, other notes and listing identities; Save watchlist still saves the whole
draft explicitly. Note policy, provider scope, catalog checks and saved-data
contracts are unchanged.

Actual-main Android run
[37671834807](https://github.com/liangzixuan/investing-pro/actions/runs/37671834807),
attempt 1, passed all seventeen synthetic cases. Its original report, tested
source and complete note/date-comparison assertions are independently accepted.
Six of thirty-nine original frames received visual review, including invalid notes, corrected
Save controls and date comparisons. The focused editor outline slightly crowds
the first error-message line; the text remains readable and controls accessible.
The complete corrected note, focus/ARIA checks, save/reload and request counts
rely on native assertions and original diagnostics, not on those six frames alone.

The original PR 50 main run
[37575074337](https://github.com/liangzixuan/investing-pro/actions/runs/37575074337),
attempt 1, ran seventeen cases with one failure. Its invalid-note journey passed,
but a tap on the comparison date selector became a long press and the native
option did not appear. That failure remains retained. PR 51 adds
Espresso's bounded Escape rollback only to that selector, preserving exact
option, date, draft and request assertions. The successful journey does not prove
that the rare rollback branch ran or that every cause of a stalled tap is fixed.

The website and signed-package delivery are complete. The owner reports physical
Pixel use of Android 1.13 without issues. Versions 1.2 through 1.12 retain their
historical limits; backup/restore, live owner-note writes and separate
screen-reader acceptance remain open. Full M1/M2 and broader source coverage
remain separate roadmap work.

PR 48 delivers [price comparison evidence in the existing note draft](MANAGED_EOD_HISTORY.md#add-a-price-comparison-to-a-note-draft)
on the website and in signed Android 1.12. In company Price,
Add comparison to note draft appends the selected observed endpoints, exact raw
USD change, percentage and original provenance to the existing member's latest
prose. Review in My Watchlist opens the draft; Save watchlist explicitly saves
the whole draft. Appending adds no provider request, membership, API, schema,
dependency or automatic save.

Types, scoped lint/format, boundary and fixture checks and all 5,099 web tests
passed. Isolated browser checks covered the invented append/review/save journey.
The original actual-main Android attempt 1 passed all seventeen cases. Three
frames covering source, draft and replaced history received scoped visual review.
The complete 503-character note and explicit save/reload are native-assertion
evidence; the draft screenshot
shows only its visible portion. The website check covers the inert staging shell.
No live owner-note write or physical-phone use is accepted by these checks.

The first PR native attempt failed after a logged tap oversleep; its underlying
cause remains unknown. An unchanged rerun passed, but does not establish repeat
reliability. Local release classification remains unverified after its timeout,
and full local verification is not claimed. CodeScene retains a failed advisory
result for two complexity warnings; review found no concrete defect in the cited
formatter. Original failures, including the acquisition preflight refusal, are
retained in operational receipts. Full M1/M2 and broader sources remain open.

The [Annual-to-note workflow](MANAGED_RESEARCH_NAVIGATION.md#add-annual-evidence-to-a-note-draft)
is accepted on main and in website release
[37410478504](https://github.com/liangzixuan/investing-pro/actions/runs/37410478504).
An explicit action appends one chosen eligible pair with exact values, its named
basis, original dates and filing link. It preserves the latest user prose and
uses the existing membership and draft. **Save watchlist** saves the whole draft,
including other changes. Appending sends no
source request or automatic save. While Annual work is pending, wait for it to
finish or use Cancel before appending the retained report.

The original native evidence covers the invented note append, review, explicit
save and reload journey. Two frames received scoped visual review; the full
580-character value and ordering are checked by native assertions. BrowserStack
covers the inert staged shell. Neither establishes live owner-note writes.
Original PR Windows failure, CodeScene advisory outcome and earlier verification
and Android capture failures remain retained; the accepted results do not erase
them.

PR 44 delivered signed Android 1.10.0, code 11, with the same package and
production signer. All ten build commands passed, both outer output streams were collected,
and the APK, merged manifest and delivered bytes passed review. The earlier 1.9
capture failure and separate recovery remain in the record.

Physical use of 1.2 through 1.12 and backup/restore acceptance retain their
historical limits. The separate October 8 UTC owner report accepts general
Pixel use of 1.13 without issues; it does not supply per-step workflow evidence.

The [earlier-date raw-close comparison](MANAGED_EOD_HISTORY.md#compare-an-earlier-observed-close)
is accepted on PR 46 main. Choose an earlier observed date from the loaded
history; the latest loaded observation stays fixed as the endpoint. Both dates
and original raw USD decimals remain visible beside the exact signed difference
and four-place percentage. Tiny nonzero percentages retain their direction.
The comparison is unadjusted for splits and dividends, adds no request or saved
state, and uses the existing decimal calculator. A replacement response resets
the choice even when its values match; listing changes and chart retirement also
reset it. Retained previous history keeps its choice and original provenance.

Twenty-two component cases, twenty-five fixture cases and 204 workspace
regressions passed, with types, scoped lint/format and boundary checks. Isolated
Brave checks covered keyboard selection, exact endpoints, narrow layout and
history/section lifetimes without live providers or owner records. Actual-main
Android attempt 2 passed all sixteen cases, retaining 33 PNGs, 30 managed capture
callbacks and 13 source markers. Two comparison frames received scoped visual
review. Attempt 1's initial date-picker interaction failed after a logged tap
oversleep; the original failure remains and its cause is unknown. The unchanged
rerun does not establish repeat reliability. The earlier PR Windows timeout and
reviewed CodeScene advisory also remain recorded.

The comparison is delivered on the website and in signed Android 1.11. BrowserStack
covers the inert staged shell; the native assertions use invented data. On
October 6, one explicit live AAPL load returned 20 dated rows for the requested
month. The selected earlier/latest comparison agreed with independent exact
decimal arithmetic. Listing selection reset the choice; company Price opened
unloaded, and Back restored the still-mounted Markets chart and choice. Returning
to My Watchlist preserved its saved state. No note or other watchlist change was
made. Network request counts and the loaded bundle hash were not measured in this
journey. Physical-phone and backup/restore acceptance remain unperformed.
Full M1/M2 and broader source coverage remain open.

PR 47 published the PR 46 release-status documentation at
`6306faf438dc295a698539a7d362f21afb29d0ea`. Its four required actual-main jobs
and original CI attempt 2 source proof are accepted. The original Windows
five-second API-test timeout remains retained; a focused local run passed and
its cause is unknown. The documentation change required no new deployment or APK.

PR 45 published the PR 44 release-status documentation at
`6c5007e829c14ba2beaf5f32e8d7e839cacc6d47`. Its six required actual-main jobs
and original CI attempt 1 source proof are accepted. It changed no app behavior
and required no new deployment or APK.

The preceding PR 42 selected-price website and signed Android 1.9 release remain
recorded above, including the bounded live selected-AAPL journey on October 5.
PR 43 published its release-status documentation; its six required actual-main
jobs and original source proof were accepted at
`2bc04282d551abe74fe2ca0ed04cd2c11ab6dd2c`. It changed no app behavior and
required no new deployment or APK.

The portable documentation update in PR 28 is accepted on main
`f18d80153e94dcb6236e31fd8324ee3e23a3bde0`. Its original source proof, applicable
main jobs and nine-case synthetic native report were accepted. It changed no
application behavior and required no deployment. Repomix remains unmerged in
[PR 27](https://github.com/liangzixuan/investing-pro/pull/27): its required
Dependency Review failed on `braces@3.0.3`,
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
As of October 3, the upstream investigation found no suitable mature released fix.
The security check stays unchanged. The Repomix package and workflow remain
held in the unmerged PR. [AI context](AI_CONTEXT.md) gives a
manual reading guide and distinguishes its reviewed artifact from the source in
this documentation tree.

The [three-listing Markets home](MANAGED_MARKETS_HOME.md) implementation is
merged in [PR 31](https://github.com/liangzixuan/investing-pro/pull/31), followed
by the staging smoke-copy correction in
[PR 32](https://github.com/liangzixuan/investing-pro/pull/32). Website release
[37210783945](https://github.com/liangzixuan/investing-pro/actions/runs/37210783945)
passed staging and promoted the same archive to production.

The prior website run
[37200994777](https://github.com/liangzixuan/investing-pro/actions/runs/37200994777)
failed its BrowserStack step and skipped production. Its original failure is
retained. The source mismatch in two expected text strings was confirmed; that
remote failure's specific assertion remains unobserved. Earlier PR failures in
the staging heading and native screenshot framing also remain in the record.

Signed Android 1.3.0/code 4 has passed build and artifact review and was copied
with its original acceptance receipts to a fresh delivery folder. It carries
Markets, direct research switching and retained refresh histories in the existing
production package with the same signer. Preserve the installed account and data;
do not uninstall or clear storage. Physical-device acceptance remains separate
from source, emulator, website and signed-artifact checks.

PR 33 records that delivery and adds bounded retries when cleaning invented
Windows test directories. Its actual main checks and original source proof passed;
the fresh eleven-case native report passed without claiming another phone or
visual acceptance. Application behavior and deployments were unchanged.

The [company research visit](MANAGED_RESEARCH_NAVIGATION.md) is delivered through
[PR 34](https://github.com/liangzixuan/investing-pro/pull/34), website release
[37233816744](https://github.com/liangzixuan/investing-pro/actions/runs/37233816744)
and signed Android 1.4.0/code 5. Focused model, screen and invented-fixture tests,
types, scoped lint/formatting and boundary checks passed, followed by the required
actual-main CI, parser, source proof and native evidence. The corrected native
run passed with separate header and provenance captures. The original framing
failure, Windows CI timeout and source-proof caller comparison failure remain
retained. CodeScene's reviewed complexity failure remains advisory; not every
check was green.

The signed 1.4 APK and its complete merged manifest passed independent review
and were delivered with the original acceptance receipts. Keep the installed
account and data when updating; do not uninstall or clear storage. Physical
installation, use and backup/restore acceptance remain open.

This completes the selected company-visit step. Full M2, broader feed coverage
and persistent research storage remain open.

The shared watchlist research-note draft is delivered through
[PR 35](https://github.com/liangzixuan/investing-pro/pull/35), website release
[37245361723](https://github.com/liangzixuan/investing-pro/actions/runs/37245361723)
and signed Android 1.5.0/code 6. Its main
`801e0cda114a09f4e8190ad6554a1e1f23603acb` merged candidate
`03ff2e0bb97bc508740bab74a1574c183709a0ff`, with tree
`a97a9d8c36f9de150b8559f13606ac8c81c3d04c`. The company editor shares the existing
member note; Add to watchlist draft appends an absent listing's captured identity.
Review in My Watchlist opens the existing full-list save and reconciliation
workflow. Focused local checks, independent source review, required actual-main
checks and the original twelve-case native evidence passed. The invented native
journey covers explicit editing, review, save and reload. A bounded live browser
check saw the note controls and returned to the unchanged saved watchlist without
editing, saving or loading provider data. It does not establish live note writes.

The dated raw-close change is delivered through
[PR 36](https://github.com/liangzixuan/investing-pro/pull/36), website release
[37263213244](https://github.com/liangzixuan/investing-pro/actions/runs/37263213244)
and signed Android 1.6.0/code 7. It reuses existing analytics and response
lifetimes, with no new provider requests, coverage, API, schema or dependency.
Actual-main CI attempt 2 passed; the original Windows timeout remains retained.
The earlier native row-capture failure and its fixture framing correction also
remain recorded. Reviewed CodeScene findings remain advisory; no security or
merge protection was weakened.

Bookmarkable company visits are delivered through
[PR 38](https://github.com/liangzixuan/investing-pro/pull/38), website release
[37288958138](https://github.com/liangzixuan/investing-pro/actions/runs/37288958138)
and signed Android 1.7.0/code 8. The existing catalog resolver, research models
and mounted watchlist coordinator retain identity, explicit loads and drafts.
Local regression, type and boundary checks, required actual-main checks, original
source proof, native evidence, website promotion and signed-artifact delivery
passed. See [company navigation](MANAGED_RESEARCH_NAVIGATION.md) for the route
and lifecycle contract.

Exact dated close inspection is delivered through
[PR 40](https://github.com/liangzixuan/investing-pro/pull/40), website release
[37318829193](https://github.com/liangzixuan/investing-pro/actions/runs/37318829193)
and signed Android 1.8.0/code 9. Point to or tap an observed date in the shared
Markets or company Price chart to read its original raw USD decimal. It reuses
the loaded response and ECharts, with the full exact-value table available for
keyboard and screen-reader use. No entitlement, source, request, dependency or
persistent data was added.

The chart outcome is complete. Full M1/M2 and broader source coverage remain
open. Repomix PR 27 stays held under resolved Option A.

## Open limits

- Managed EOD admission covers three exact listings for two issuers. No complete
  market, adjusted-return or index coverage follows from those bounded reads.
- Shared quota enforcement covers this application. It cannot measure other
  clients' account consumption; provider rate limits still apply.
- Unsaved drafts live in the mounted session. Same-Activity resume is covered;
  durable offline editing and process-death draft restoration are not implemented.
  Bookmarkable URLs do not register external Android app links or establish
  process-death restoration.
- Managed storage is not the local vault's application-layer encryption. Owner
  data migration and a managed data-recovery design require separate acceptance.
- Full local financials, comparisons, valuation, screening, portfolio and updates
  are not yet integrated into the managed browser/Android surface.
- Native iOS, public app-store distribution, a full accessibility audit, broad
  performance coverage and sustained daily-use reliability remain separate work.
- Existing CodeScene findings are advisory, source-reviewed maintenance evidence;
  a score is not a correctness or product-coverage result.

## Working loop

Read [AGENTS.md](../AGENTS.md), this status and the feature guide. Reuse existing
contracts, providers and state owners; choose a bounded change. Verify affected
behavior and required types/lint/format/boundaries, then the applicable hosted
checks for the actual candidate. Preserve failures and existing deployments.

A source merge does not deploy the API, promote the website or update Android.
Website delivery promotes the same accepted archive. API and Android have their
own configuration, artifact and acceptance gates. See
[website delivery](APPWRITE_DELIVERY.md), [Android](ANDROID_CLIENT.md) and
[delivery source checks](APPWRITE_DELIVERY.md#release-sequence).

Earlier local coverage is retained in [capability status](CAPABILITY_STATUS.md),
[historical README](history/README-2026-10-03.md), [build history](BUILD_ROADMAP.md)
and [ADRs](adr/). Their dated profiles and pending claims are historical, not
instructions to repeat an operation or override this status.
