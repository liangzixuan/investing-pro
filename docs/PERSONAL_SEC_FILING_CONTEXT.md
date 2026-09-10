# Inspect an SEC primary filing context

Partial Cycle 3h-a7 adds **Inspect filing context** for a selected SEC observation
with matched filing metadata, a known start date and form `10-Q` or `10-Q/A`.
The action starts acquisition. The inspector shows the selected Company Facts
amount beside structured primary-filing candidates, preserving exact values,
entity identifiers, concept namespaces, context/unit references and dates.
Refresh, cancellation and dismissal are explicit. Existing observations and
same-period comparisons remain usable when inspection fails.

## Source binding

The owner-authenticated route is
`POST /v1/personal-filing/workspace/sec-filing-context`. It resolves the issuer
from the current catalog digest, listing and symbol. The request contains an
exact observation selection, never a document URL, CIK, source path or HTML.

The server makes at most three GETs. It first reloads Company Facts using the
existing lossless normalization and retention rules. The observation ID and all
selected fields must match a retained row. An ID or browser metadata flag alone
is not source proof. A changed or no-longer-retained selection requires an
explicit evidence refresh and reselection; no replacement is chosen.

Current Submissions must then match the issuer, accession, form and filed date.
The server validates the selected `primaryDocument` basename and constructs its
SEC Archives URL. Missing or conflicting membership stops document acquisition.
No older-history files, other documents, linkbases, schemas or assets are fetched.
The response records source retrieval times and the primary document's SHA-256
and byte count. Retrieval time is distinct from filing acceptance or first public
availability. See the [SEC API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).

## Interpretation

The worker compares the full selected entity, supported US-GAAP concept, USD unit
and exact duration before comparing canonical decimal values. It retains fact
IDs or deterministic element locators, context/unit IDs, namespace-resolved
names, entity scheme and identifier, dimensions, raw numeric text, format,
sign, scale, precision and decimals. Equivalent duplicate references remain
visible; differing values and scope ambiguity do not receive a preferred fact.

Outcomes distinguish matching values, different values, ambiguous evidence,
no corresponding fact and unsupported constructs. Unsupported transforms,
continuations, complex units, dimensions, malformed contexts and parser limits
stay explicit. A source or worker failure is separately unavailable.

Correspondence does not establish consolidated accounting scope, a standalone
quarter rather than YTD, the issuer's historical fiscal calendar, a usable
revision operand, a restatement or point-in-time history. The inspector does not
replace loaded observations or calculate TTM. The existing annual ten-fact
extractor, wrapper, normalizer and evidence pins remain unchanged.

The supported numeric subset includes unformatted nonnegative decimals, sign
and integer scale from -100 to 100; `numdotdecimal`, `numcommadecimal` and
`zerodash` from the [2015 XBRL registry](https://www.xbrl.org/Specification/inlineXBRL-transformationRegistry/REC-2015-02-26/inlineXBRL-transformationRegistry-REC-2015-02-26.html);
and `num-dot-decimal`, `num-comma-decimal` and `fixed-zero` from the
[2020 registry](https://www.xbrl.org/Specification/inlineXBRL-transformationRegistry/REC-2020-02-12/inlineXBRL-transformationRegistry-REC-2020-02-12.html)
and [2022 registry](https://www.xbrl.org/Specification/inlineXBRL-transformationRegistry/REC-2022-02-16/inlineXBRL-transformationRegistry-REC-2022-02-16.html).
Other transformations or unsupported lexical forms remain explicit. Numeric
strings retain at most 64 characters. The entity scheme must be exactly
`http://www.sec.gov/CIK`, as described in the [SEC XBRL guide](https://www.sec.gov/files/edgar/filer-information/specifications/xbrl-guide.pdf).
Supported US-GAAP namespace dates are calendar-valid years 2009–2099. These
checks establish bounded correspondence, not full taxonomy or DTS validation.

## Explain unresolved references

Partial Cycle 3h-a12 adds **Why this value remains unresolved** when retained
candidate issues prevent correspondence. Groups use the complete reported issue
set and whether explicit, typed or unknown scope is retained. Each reference
shows its own observed dimension details. Equivalent references
remain separate, with a control for opening each exact candidate context. The
control changes the candidate page when needed, opens the disclosure and moves
keyboard focus to it. It does not reload source data. Later ordinary paging does
not replay a prior jump; refresh, cancellation and selection changes clear the
inspection and its pending navigation.

The grouping uses the existing validated response and preserves its numeric
decision. The parser currently excludes a numeric row from uncertainty if its
issues include an issuer or period mismatch, even alongside other issues. Those
references remain inspectable with their additional issues. Their exclusion is
not presented as proof of well-formed scope. Changing this rule needs separate
review and tests; this explanation does not admit additional numerical facts.

An `unsupported_dimensions` issue is broader than projected explicit or typed
members. When no such members are retained, the explanation states that scope
details are unavailable. It does not call the context dimension-free. Resolved
axis/member identifiers show what the projection observed; they do not establish
container grammar, taxonomy defaults, consolidated scope or full XBRL validity.
Typed-member text stays in the existing candidate disclosure. Matched, differing,
ambiguous and empty/global-failure outcomes retain their distinct meanings.

## Filing-declared reporting metadata

Partial Cycle 3h-a8 uses the same primary document to collect `DocumentType`,
`DocumentPeriodEndDate`, `DocumentFiscalYearFocus` and
`DocumentFiscalPeriodFocus`. The inspector shows these filing declarations beside
the selected fact's actual dates and inclusive duration. For example, a filing
can declare FY2026 Q3 while a selected comparative fact covers January through
March 2025. Filing focus does not classify the selected fact's duration.

The declared report end is compared separately with the refreshed Submissions
report date. Agreement, difference, missingness and unresolved declarations are
explicit. Neither source silently replaces the other. Equivalent references
remain separate; differing eligible values receive no preferred reference.
Unresolved relevant scope or content prevents an observed field value. Explicitly
wrong-issuer rows remain visible as excluded references.

Supported DEI namespace identifiers are exactly `http://xbrl.sec.gov/dei/2024`,
`http://xbrl.sec.gov/dei/2025` and `http://xbrl.sec.gov/dei/2026`, verified against
the SEC's [2024 schema](https://xbrl.sec.gov/dei/2024/dei-2024.xsd),
[2025 schema](https://xbrl.sec.gov/dei/2025/dei-2025.xsd) and
[2026 schema](https://xbrl.sec.gov/dei/2026/dei-2026.xsd). Prefix spelling alone
never establishes a namespace. These identifiers are not runtime fetch targets.
The supported document-type subset is `10-Q`, `10-Q/A`, `10-K` and `10-K/A`;
the inspector's acquisition remains restricted to selected `10-Q`/`10-Q/A`
observations. Fiscal-period values are `FY`, `Q1`, `Q2` and `Q3`, as enumerated
by the schemas. Fiscal years require four digits; report ends require a
calendar-valid ISO date. Text normalization collapses only XML whitespace.

The initial metadata subset accepts direct text-only `ix:nonNumeric` values in
well-formed duration contexts for the selected issuer without dimensions.
Context dates are preserved and need not equal the selected financial fact's
period. Nested markup, continuations, tuples, alternate targets, nil and escape
semantics remain unsupported. The report-end transform below is the only supported
metadata transform. Unsupported or unfamiliar declarations are not inferred from
visible prose. The underlying context and entity checks are shared with numeric
inspection, whose correspondence rules remain unchanged.

Partial Cycle 3h-a11 supports `date-monthname-day-year-en` in the exact
`http://www.xbrl.org/inlineXBRL/transformation/2020-02-12` namespace, only for
`DocumentPeriodEndDate`. The [2020 registry's input type and function definition](https://www.xbrl.org/Specification/inlineXBRL-transformationRegistry/REC-2020-02-12/inlineXBRL-transformationRegistry-REC-2020-02-12.html)
specify the English month spellings, nonnumeric separators, one/two/four-digit
years, first-month selection and calendar validity. One- and two-digit years
expand into the 2000s. The application retains its 4,096-character input bound
and supported date years 1000–9999; it does not use locale-dependent date parsing.

The worker retains the original text and namespace-resolved format beside the
canonical date. Node and browser validators share a pure normalizer and recompute
the result before admitting either an eligible reference or a proven wrong-issuer
exclusion. Unknown formats stay `unsupported_transform`; invalid input to the
supported transform stays `invalid_metadata_value`. A valid sibling cannot hide
an unresolved or conflicting declaration. The existing panel displays the date
and its source reference, then compares it independently with Submissions. That
agreement does not establish the selected fact's fiscal period or flow basis.

Route request/response and worker input/output use schema version `2.0.0`, with
a required structured metadata projection. Quarterly evidence and stored data
schemas do not change. The client validates field status, values and reference
membership against the returned observations before displaying them.

## Runtime and bounds

Partial Cycle 3h-a9 adds bounded support for `ASCII` and `US-ASCII` XML declarations,
as observed in the configured NVDA sample. The declaration must agree with the
actual document bytes, including any byte-order marker. XML 1.0 with optional UTF-8
remains supported; standalone declarations and other encodings remain unsupported.
Names, order, paired quotes and XML whitespace follow the supported subset of the
[XML declaration grammar](https://www.w3.org/TR/xml/#sec-prolog-dtd). Case-insensitive
encoding matching is restricted to ASCII letters. Malformed declarations and
encoding conflicts remain global failures. Source requests and numeric/reporting-
metadata projections are unchanged.

Partial Cycle 3h-a10 recognizes additional canonical attribute casing on specific
Inline XBRL linking elements. The 2013 `relationship` element uses `fromRefs`,
`toRefs` and `linkRole`; its `footnote` element uses `footnoteRole`. The 2008
`footnote` element uses `footnoteID`, `footnoteLinkRole` and `footnoteRole`, as
defined by the normative [1.1 schema](https://www.xbrl.org/specification/inlinexbrl-part2/rec-2013-11-18/inlinexbrl-part2-rec-2013-11-18.html)
and [1.0 schema](https://www.xbrl.org/specification/inlinexbrl-part2/rec-2010-04-20/inlinexbrl-part2-rec-2010-04-20.html).
Lowercase/wrong-case variants, duplicates and unquoted semantic attributes remain
invalid. These names are scoped to their declared namespace and element; they do
not grant corresponding casing support to unrelated XBRLI/XBRLDI or inline nodes.
The inspector traverses the markup without resolving relationships or footnotes,
and existing numeric and metadata eligibility rules still apply.

Use the existing owner SEC contact setting and a Python 3 runtime available to
the API process. Tiingo remains independent. Missing Python produces an explicit
runtime-unavailable result. The source worker ships with the API build.

Company Facts and Submissions retain their 8 MiB, 20,000 fact-candidate,
10,000 submission-row and 200 retained-observation limits. All requests use the
shared SEC scheduler and reject redirects. The primary document is limited to
32 MiB and a 10-second acquisition deadline after its request permit, with
validated media type and UTF-8 encoding.

A separate asynchronous process uses fixed arguments, no shell and a hidden
window on Windows. Input, output and error streams are bounded; the worker has
a 10-second deadline and a 1 MiB structured-output limit. Parsing is limited to
one million elements, depth 256, 20,000 contexts, 5,000 units and 100 candidate
facts. Metadata has a separate 40-candidate and 128 KiB structured-output budget.
A metadata limit clears the whole metadata projection and reports it as limited,
while preserving an independently complete numeric comparison. Global malformed
document, process and output failures clear all projections. A global limit never
reports a partial prefix as complete evidence.
Cancellation and shutdown terminate active work. Selection, catalog, evidence
generation and owner-session changes discard results and suppress late replies.
Raw HTML stays ephemeral on the server and is never rendered or executed by the
browser. The response is private and non-cacheable; no source cache is added.

## Acceptance and remaining coverage

Synthetic tests exercise exact large, negative and zero values, scale/sign,
different periods with the same end date, duplicate and conflicting references,
entity/namespace spoofing, dimensions, unsupported constructs, source and parser
limits, runtime failure, cancellation and stale requests. Real-worker integration
and external Chrome desktop/mobile/keyboard QA are required release checks.
Metadata acceptance covers comparative dates, three- and nine-month selections,
non-calendar fiscal years, amendments, identical/conflicting references, missing
fields, spoofed namespaces, malformed scope and metadata limits without extra
source requests or changes to numeric eligibility.

These checks establish the bounded engineering behavior. Live parsing coverage
must be reported for the exact independently checked documents. The first configured
sample retrieved five selections across three documents successfully, but parsing
failed globally. A subsequent pinned-digest check with the declaration repair
parsed the three NVDA selections and GOOGL selection. Numeric comparison remained
unsupported because of dimensions; each filing exposed three DEI labels while its
report-end date transform remained unsupported. AVGO still returned a global
`invalid_document`. A further exact-digest diagnosis located its first rejection
at canonical `fromRefs` on an Inline XBRL 2013 `relationship`. The final linking
repair comparison used all five original selections and three original document
digests: 21 successful GETs, with unchanged NVDA/GOOGL summaries. AVGO reaches 72
numeric candidates and observes document type, fiscal year and fiscal-period
focus. All report ends identify the same 2020 English date transform addressed
above. The final report-date comparison on release `ec9b302` repeated the
original five selections and three document digests with 21 successful GETs.
All report ends are observed and agree with fresh Submissions; the comparative
NVDA selection retains its older actual fact period. Numeric summaries and the
other metadata summaries are unchanged. Dimensional numeric scope remains
unsupported. The separate context-explanation diagnostic remains pending at
source freeze. Any eventual result applies only to its declared selection and
document; its actual status is recorded in the local handoff. Every earlier
failure and result remains preserved separately.
No eligible amendment was retained in the sample. These are
specific observed outcomes, not general filing coverage. Fiscal-calendar, flow-
basis and revision admission remain later work.
