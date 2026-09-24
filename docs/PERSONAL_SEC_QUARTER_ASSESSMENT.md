# Assess one SEC filing's fiscal quarter

The workspace checkpoint records actual verification and release status.
This guide describes the bounded selected-quarter outcome;
it does not claim live coverage or admission of the retained filing examples.

Select **Assess quarter** beside an observation with matched current filing
metadata in company research. The action checks the selected accession rather
than the clicked amount. It can support directly reported revenue and net income
attributable to the parent for one current Q1, Q2 or Q3. Supported amounts retain
their exact signed USD decimal and dates. A missing premise leaves the metric
unavailable; disagreement between usable current USD occurrences produces a
conflict. The pair exposes values only when both metrics share the same quarter.

Refresh, retry, cancellation and dismissal are explicit. Changing the company,
catalog, loaded evidence generation or session retires pending requests and
results. The panel preserves the original SEC observation table and its independent
same-period comparison and filing-context inspector. It writes no owner records.

## Source boundary

The new route is `POST /v1/personal-filing/workspace/sec-quarter-assessment`, schema
`1.0.0`. Its request contains the catalog snapshot, listing ID, symbol, accession,
form, filed date and report-end date. It accepts no CIK, amount, concept, document
URL, source text, witness or supported flag. The catalog resolves the full company
identity. Current Submissions must agree on all selected filing metadata and
provide a safe primary-document basename.

The provider makes at most three serial GETs: current Submissions, Company Facts
and the selected primary document. It retains original raw byte hashes, byte counts
and retrieval clocks, then binds the ordered descriptors, complete target and
parser/projector/profile versions. The browser independently checks the binding
and exact response schema. Hashes establish consistency, not accounting meaning.
No history files, assets, external schemas, alternate documents or redirects are
followed. The existing local-access, owner-session, origin and request guards apply.

Company Facts projection scans all four supported concepts across every unit and
accession. Equal duplicates retain separate source pointers. Missing or malformed
accession membership stays unresolved. The primary parser scans all four concepts
in one bounded child operation, retaining hidden, comparative, dimensioned,
off-table and unsupported occurrences. Raw context/unit grammar and sparse source
structure preserve the evidence required to validate exclusions and witnesses.
Limits refuse the whole incomplete result; they never select a convenient prefix.

## Meaning and limits

The source rules are shared across companies. They require affirmative fiscal-year
and quarter evidence, a principal consolidated income/operations statement, full
current three-month column ownership and source-supported metric scope. A filing's
`fy`, `fp`, DEI focus or duration length alone cannot establish a quarter. Revenue
concept alternatives are counted before witness success; an unresolved competing
concept cannot disappear because another one is easier to read.

Current Company Facts occurrences must map to exact primary statement witnesses.
Current hidden or off-table contradictions still participate in conflicts. Parent
income cannot be substituted with a common-share/EPS numerator or a total including
unresolved noncontrolling interests. Source visibility uses a finite static-markup
profile; scripts, external styles and unsupported hiding/layout syntax remain
unresolved. The application neither executes filing scripts nor claims computed
browser visibility.

Amendments, fourth quarters, week-based calendars, transition/stub periods, currency
conversion, alias stitching and subtraction-derived quarters remain unsupported.
No later filing is selected as a preferred revision. TTM retains
`source_not_admitted`. Acceptance time does not establish freshness or first public
availability.

| Boundary                                               |                       Limit |
| ------------------------------------------------------ | --------------------------: |
| Whole operation, including queueing                    |                  60 seconds |
| Each request after its scheduler permit                |                  10 seconds |
| Submissions / Company Facts / primary                  |              8 / 8 / 32 MiB |
| Worker lifetime / stdout / stderr                      | 10 seconds / 1 MiB / 16 KiB |
| Primary occurrences per concept / total                |                 512 / 2,048 |
| Inspected Company Facts rows                           |                      20,000 |
| Retained Company Facts occurrences per concept / total |                 512 / 2,048 |
| Company Facts projection                               |                     256 KiB |
| Structural records / serialized structure              |             4,096 / 256 KiB |
| Reporting metadata                                     |   40 observations / 128 KiB |
| Relevant tables / rows per table / logical columns     |               64 / 256 / 64 |
| Final HTTP response, exact UTF-8 bytes                 |                       2 MiB |

Structure and metadata share the worker's 1 MiB output budget. Counts below their
ceilings do not guarantee that complete evidence fits. Monotonic checks around
synchronous parsing and serialization detect deadline overruns; a JavaScript timer
cannot preempt synchronous work. Cancellation propagates through queueing, fetch
and the owned parser child, whose busy guard remains until the child closes.

## Current verification and coverage

The actual raw synthetic path passes through acquisition, Company Facts projection,
the Python worker, assessment rules, the authorized route and browser decoding.
Cases cover equal duplicates, an unresolved income display, hidden conflicting
values, current non-USD evidence and unresolved scripts. Saved responses also
verify genuine zero and amounts beyond JavaScript's safe numeric range. These
invented examples test behavior; they do not establish real-company coverage.

One combined measurement used the retained AMGN, GILD, MSFT and ORCL filings.
All four primary documents returned `structural_limit`. None produced a complete
primary evidence graph or a supported quarter. Company Facts projection reconciled
24 selected rows across 2,373 inspected rows. The worker processes closed within
their deadlines, but the current structural representation cannot fit these
populations under the frozen retention budgets. The first failing budget branch
was not recorded, so the result does not identify a single limiting counter.

Complete, more compact structural retention remains a coverage prerequisite.
No cap was widened, source population truncated or filing replayed to change the
measurement. The small sample cannot establish a universal coverage rate.
Synthetic Brave checks covered explicit loading, signed values, partial support,
conflicts, huge values, genuine zero, retry, cancellation, stale responses,
same-row dismissal/reopening, identity changes, source disclosures and narrow
keyboard scrolling. They used only invented responses through the actual parent,
assessment and client. Native and exact-revision hosted release gates and final
acceptance are required before activation; CURRENT.md records their actual status.
