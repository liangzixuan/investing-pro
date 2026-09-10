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

## Runtime and bounds

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
facts. A global limit never reports a partial prefix as complete evidence.
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

These checks establish the bounded engineering behavior. Live parsing coverage
remains unproven until configured sources and supported filings are independently
checked. Fiscal-calendar, flow-basis and revision admission remain later work.
