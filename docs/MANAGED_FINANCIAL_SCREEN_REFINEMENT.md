# Refine filters on a loaded Annual screen

Updated November 5, 2026.

Use **Try different filters on this run** in Discover after an Annual screen
settles. A completed, partial or cancelled run keeps its admitted reports and
unread rows. The refinement uses those reports locally; it does not load newer
financial evidence or expand the supported cohort.

## Complete workflow

1. Open the local filter editor. Its raw criteria are independent of the criteria
   for a new source run. Use the existing six fields and up to seven clauses.
2. Select **Preview revised filters**. Inspect original and revised results for
   every selected listing, every clause, all six metric values or refusal reasons,
   full listing identities and the original Annual source clocks. The local
   evaluation time is separate. Historical evidence remains ineligible for current
   filters; missing evidence is not zero.
3. Select **Keep original screen** to discard the preview. The original criteria,
   comparison, shortlist and packets remain unchanged. Editing the local draft
   also consumes its previous preview.
4. Select **Apply reviewed filters and results** to install the complete reviewed
   definition and results together. A changed definition clears the earlier
   comparison and shortlist. An identical definition retains them. The source
   run handle, status, original dates and packets remain unchanged.
5. Inspect any admitted result in Research, including nonmatches or unknowns.
   Back retains the applied run. The passive original/revised comparison remains
   visible until cleared or another preview replaces it. **Clear comparison**
   after Apply does not undo the applied filters.
6. Choose a shortlist and review its Watchlist handoff separately. Save and fresh
   Load remain explicit resource actions. Use **Run screen** separately when new
   Annual evidence is needed.

## Lifetime and source boundaries

Preview, Apply and Cancel make no source requests and do not save personal data.
Refinement does not require Watchlist Load. Its possible later Watchlist handoff
binds the current resource state without modifying notes or order.

A preview belongs to its exact settled run and Discover visit. Changes to the
screen, navigation, session, Watchlist resource or file activity retire it.
Leaving and returning cannot renew it. Late callbacks cannot apply retired
criteria. An accepted Apply consumes the preview before publishing its result.

Full source inspection remains available for loaded reports. Cancelled or failed
reads stay explicit, and refinement does not resume them. The established Annual
projection, eligibility rules and decimal comparisons are unchanged.

## Verification status

The local source increment includes model/controller, mounted-control and complete
workspace regressions. The native journey covers preview, Cancel, Apply,
Research/Back and independent Watchlist Save/fresh Load.

At PR 281 head `6243e8cb1732ca870b9b2375e74c604688442f90`, original Ubuntu,
Windows and parser checks passed, along with all 158 native cases. The prior 157
cases remain unchanged. The two current scoped Preview and Return frames were
inspected. [PR 281](https://github.com/liangzixuan/investing-pro/pull/281) merged
at `91f7c61f1576694bccbf1c6edcbb3bfdf4c4a2d1`. That main revision is accepted
after its original source/parser checks and all 158 native cases passed. Its
current scoped Preview frame was inspected; the Return frame exactly matches
the previously inspected frame. CodeScene structural findings remain
unsuppressed; scoped source review found no functional defect. This increment
has no Android delivery, browser inspection or phone acceptance.

The subsequent [missing-read continuation](MANAGED_FINANCIAL_SCREEN_CONTINUATION.md)
remains unaccepted. PR 282 head `e6ed7a4` passed original source, parser and
dependency checks, but its new native case failed a Research fixture comparison
after the earlier missing-packet correction. Both failures remain recorded.
The explicit post-continuation capture correction passes local checks; hosted
acceptance for the next exact revision is pending. The accepted source baseline
remains `91f7c61f1576694bccbf1c6edcbb3bfdf4c4a2d1`.
