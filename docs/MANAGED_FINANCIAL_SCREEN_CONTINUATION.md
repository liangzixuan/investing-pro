# Complete missing Annual reads

Updated November 5, 2026.

Use **Review missing Annual reads** in Discover after an Annual screen settles
with missing responses. Keep admitted packets, including partial or historical
evidence, while completing only the finite reviewed list. **Run screen** remains
the separate action for a full source refresh.

## Complete workflow

1. Review every selected listing and its complete identity. The plan marks each
   row as a retained packet or a missing Annual read. It shows the exact ordered
   request list, applied filters and all retained values or refusal reasons.
   Preview makes no source request and leaves the current pair and shortlist intact.
2. Select **Keep current screen** to discard the preview without changing reports,
   filters, comparison, shortlist or personal drafts.
3. Select **Run reviewed reads** to read only the missing rows. Starting the pass
   clears the earlier pair and shortlist. Requests use the existing shared Annual
   admission rules and at least 20 seconds between dispatches. Failed reads are
   recorded; they are not retried automatically.
4. Select **Cancel continuation** to stop a queued or pending read. Completed
   packets remain available. A later explicit preview can review what is still
   missing. A remote request already admitted can finish without changing a
   cancelled pass.
5. Inspect the completed or cancelled pass. Keep original run dates, each packet's
   cutoff and completion, and earlier local filter evaluation separate from the
   continuation's preparation, start, completion and per-attempt evaluation times.
   Historical evidence remains excluded from current filters. Missing values are
   never zero. Each pass retains its ordered requests and actual outcomes.
6. Open any admitted result in Research, including an unknown or nonmatch. Back
   keeps the continued run and passive reading. **Clear continuation reading**
   removes that reading without undoing the screen's completed work. Shortlist
   handoff, Watchlist Save and fresh Load remain separate actions.

## Lifetime and source boundaries

The preview belongs to the exact settled screen, selected listings, applied
criteria and Discover visit. Navigation, session retirement, Watchlist resource
changes or draft-file activity retire its authority. Leaving and returning does
not revive a preview. During a pass these guards stop further dispatches and
refuse late results. A settled reading has no authority to request more data.

Continuation does not require Watchlist Load. It does not change notes, resource
order, saved versions, coverage, formulas, source eligibility or provider settings.
Rows with an admitted response remain retained even when a metric is unavailable,
the evidence is historical or the response is partial. Continue is unavailable
when no Annual responses are missing; use the separate full Run for a refresh.

## Verification status

The local increment includes model/controller, mounted UI and complete workspace
regressions. The UI checks cover full identities and source clocks, explicit
requests, cancellation, stale callbacks, route/file/session retirement and passive
Research/Back. The native journey extends the source roster to 159 cases.

The original [PR 282](https://github.com/liangzixuan/investing-pro/pull/282)
native run at `9e07524f7b07e2c7bb9ad72a577e6a56f622d9ff` failed because the
fixture omitted a missing packet instead of serializing `null`. At corrected
head `e6ed7a419d523d26d4cc7d136e40cf4fa5cad2f3`, original Ubuntu, Windows,
parser and dependency checks passed. The new native case reached Research, then
failed a packet comparison against a fixture baseline that this journey never
captured. The original log confirms the correct Annual route and response origin,
with two Annual reads and no rejected or unexpected requests. Both failed runs
remain preserved.

At PR 282 head `a930e93fe58fd4503e24639f8e355a326c28a401`, original
source/parser checks and all 159 native cases passed. The prior 158 cases remained
unchanged. The merged main revision
`b6c852a42022edce10de48cd53a05fc4661958ac` passed its own original source/parser
checks and all 159 native cases. Scoped Preview and Return frames were inspected.
The earlier fixture serialization and uncaptured-baseline failures remain history.

Android 1.77.0, code 78, was delivered locally on November 5 with the existing
signer. All four automated checks and the copied APK checksum readback passed.
This delivery includes Watchlist screen selection, local filter refinement and
missing Annual reads. Browser and physical phone acceptance are not claimed.
CodeScene structural findings remain unsuppressed.

See [current work](CURRENT_WORK.md) for the next increment.
