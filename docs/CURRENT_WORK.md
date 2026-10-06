# Current work

Updated October 6, 2026. This is the portable status summary for the public
repository. [Product roadmap](PRODUCT_ROADMAP.md) owns the goals and delivery
order; [architecture](ARCHITECTURE.md) explains the runtime boundaries. Private
operational receipts are retained separately and are not required to understand
or develop the repository.

## Accepted release

PR 44 is merged as `0e970dc6dd6ae90387f4486e95434b8bab780830`, from candidate
`9e73bead4bf873282a221a7ea1af2f82b26081cd`, with tree
`d602b1e123b586cca91d39052cb1a553d5544d12`. Its five required actual-main
workflows and six jobs, original CI attempt 1 source proof and fifteen-case
synthetic native report are accepted. The website now offers an explicit action
to append a chosen eligible Annual pair to an existing watchlist-note draft.
Staging passed its configured BrowserStack gate, and normal production approval
promoted the same archive. Signed Android 1.10 passed build, artifact and delivery
review with the existing production signer.

| Surface                   | Accepted outcome                                                                                                                                                                | Limits                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Managed API               | Deployment `6ac20862d12fe7560852`; authenticated catalog/watchlist/Annual/EOD routes, private storage and shared request budgets; anonymous origin/authentication checks passed | A receipt records activation at its observation time. Account-wide external provider consumption and continuing availability are not known |
| Managed website           | `https://app.investingpro.app`; deployment `6ac472728a6e13d44cc8`; PR 44 staging archive promoted after normal approval                                                         | BrowserStack covers the inert staged shell; no new live Annual-to-note journey or continuing-availability claim                            |
| Signed Android artifact   | Investment 1.10.0, code 11, package `app.investingpro.android`; same production signer; independently accepted assets/manifest and delivered exact APK                          | Physical installation and use of 1.2 through 1.10 remain unperformed                                                                       |
| Automated Android         | PR 44: fifteen passing invented-data API-36 emulator cases; two Annual-note frames received scoped visual review                                                                | Full note equality, order, save and reload rely on native assertions; no production sign-in, live provider or physical-device claim        |
| Previous physical Android | Owner-reported 1.1 in-place upgrade and supplied checklist passed on Pixel 10 Pro XL / Android 17                                                                               | No per-step logs; this report does not accept 1.2 through 1.10                                                                             |
| Local research app        | Preserved local release and encrypted vault, with broader research/portfolio tools                                                                                              | No automatic migration or claim that these panels are available in the managed product                                                     |

The accepted 1.10 APK is 6,653,708 bytes, SHA-256
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
and in signed Android 1.10. An explicit board load requests AAPL, GOOG and GOOGL
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
clears both sections. Reopening starts unloaded. Android Back uses the same
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

Signed Android 1.10.0, code 11, is delivered with the same package and production
signer. All ten build commands passed, both outer output streams were collected,
and the APK, merged manifest and delivered bytes passed review. The earlier 1.9
capture failure and separate recovery remain in the record.

Physical installation and use of 1.2 through 1.10, and backup/restore acceptance,
remain unperformed. The owner-reported 1.1 result does not accept later packages.
The next selected outcome is an [earlier-date raw-close comparison](MANAGED_EOD_HISTORY.md#compare-an-earlier-observed-close)
in the shared Markets and company Price chart. Choose an earlier date from the
loaded history and compare its exact raw USD close with the latest loaded close.
The existing decimal calculator supplies the signed difference and four-place
percentage. Comparison adds no request or saved state. Replacing the history,
changing listing or unmounting the chart clears the choice; retained previous
history keeps its original dates and qualification.

The candidate is implemented. Twenty-two component cases, twenty-five fixture
cases and 204 workspace regressions pass, along with types, scoped lint/format,
fixture integrity and dependency boundaries. Independent source review found no
blocking issue. An isolated Brave fixture passed keyboard selection, exact
earlier/latest values, narrow layout, retained refresh/Cancel/late-response states,
replacement and section resets, and Back focus with an unsaved invented draft.
These checks used no live provider or owner records. The new native interaction
case is written but has not yet executed.

Normal publication and hosted checks are next. Website promotion, signed Android
delivery and physical use require their separate evidence. The accepted product
above remains unchanged until those steps pass. Full M1/M2 and broader source
coverage remain open.

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
