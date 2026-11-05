# Watchlist companies in an Annual screen

Updated November 5, 2026.

Use the current Watchlist to choose companies for the existing Annual screen.
The Watchlist keeps its complete identities, order and raw notes, including unsaved
notes. Screening uses the current supported cohort and Annual coverage. It does
not add coverage or treat a ticker match as the same listing.

## Complete workflow

1. Load the Watchlist in its own tab. Open Discover and load the screening cohort.
2. Open **Watchlist companies**. Read every eligibility outcome. Each entry is
   included, outside the cohort, unavailable for Annual, an identity mismatch,
   waiting for a share-class choice, another watched class, or waiting for the
   cohort. Complete listing identities remain available for each row.
3. If more than one watched share class belongs to an issuer, choose the exact
   watched class. The workflow never substitutes an unwatched class.
4. Select **Preview Watchlist selection**. Inspect the complete ordered selection
   and every exclusion before **Apply companies**, or keep the current selection.
5. Run the screen separately. Inspect the original Annual evidence, choose a
   shortlist and comparison, and open Research. Back retains the run, criteria,
   original packets and their independent source clocks.
6. Return to Watchlist for its separate catalog review, Save and fresh Load.

The list supports all 10,000 admitted Watchlist entries. Only 25 eligibility rows
mount per page; counts cover the complete list. Previous, Next and a page selector
make every entry reachable. Paging does not change the selection or start reads.

## Action boundaries

Preview and Apply make no source requests and do not save or edit any personal
resource. Criteria, raw criterion text and sorting stay unchanged. Applying a
changed ordered company list clears the earlier run, shortlist and comparison.
Applying an identical ordered list retains them. An empty or unsupported list
cannot clear the screen. Any identity mismatch blocks Apply.

A preview belongs to the captured Watchlist draft, saved baseline, current
catalog, cohort, criteria, selection, session and Discover route. Edits, Load,
Save, recovery, file activity, navigation or changed choices retire it. Returning
to equal values cannot revive the old preview. Apply validates the whole capture
before changing the selection; a stale or repeated action does nothing.

## Verification and status

Local checks cover full eligibility, exact share-class choices, stale and
reentrant actions, all 10,000 paged entries, and the complete real-workspace
workflow. The invented fixture checks full Watchlist values and original Annual
packets through paced Run, comparison, Research/Back and separate Save/fresh Load.
At PR 280 head `7a9be968359b4911132cfe81e8293c6f9874389e`, the original native
run passed all 157 cases, including all 156 prior cases and the complete new
journey through independent Save and fresh Load. The two current scoped Preview
and Return frames are byte-identical to the frames already inspected. Original
Ubuntu, Windows and parser checks pass.
[PR 280](https://github.com/liangzixuan/investing-pro/pull/280) merged at
`519fec426c368bff700b0db57a45eafa73c15e43`. That main revision passed Ubuntu,
parser and all 157 native cases. Its original Windows check timed out in the
synthetic runtime prerequisite before the release gate, so main acceptance was
not established. The failed outcome remains recorded.

PR 281 then passed its own original Ubuntu, Windows and parser checks and all
158 native cases, preserving the prior 157 cases. The two current refinement
Preview and Return frames were inspected.
[PR 281](https://github.com/liangzixuan/investing-pro/pull/281) merged at
`91f7c61f1576694bccbf1c6edcbb3bfdf4c4a2d1`. That main revision is accepted
after its original source/parser checks and all 158 native cases passed. Its
current scoped Preview frame was inspected; Return exactly matches the previously
inspected frame. This selection workflow has no Android delivery. CodeScene
findings remain unsuppressed; scoped review found no new functional defect.
No browser or phone acceptance is claimed.

Earlier original failures remain separate: `c908f45e` stopped at the new frame
helper's return type and had a Windows paging-test timeout; `35891278` stopped at
post-Back preview readiness; `6f5511ab` passed that step but used the wrong
Watchlist navigation label. Their failed outcomes have not been reclassified.

The last delivered baseline is main `57cc61c083fe8b1f2557b975667695125722c6ea`, which
passed original source, parser and all 156 native cases. Android 1.76.0, code 77,
was verified and delivered locally from that baseline, and delivery is closed.
It does not include this later Watchlist selection increment.

The subsequent [missing-read continuation](MANAGED_FINANCIAL_SCREEN_CONTINUATION.md)
remains unaccepted. PR 282 head `e6ed7a4` passed original source, parser and
dependency checks, but its new native case failed a Research fixture comparison
after the earlier missing-packet correction. Both failures remain recorded.
The explicit post-continuation capture correction passes local checks; hosted
acceptance for the next exact revision is pending. The accepted source baseline
remains `91f7c61f1576694bccbf1c6edcbb3bfdf4c4a2d1`.
