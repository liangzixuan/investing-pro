# Quarterly compatibility before TTM

Partial Cycle 3h-a4 makes the current TTM gap inspectable. After an explicit
quarterly-financials load, the selected-company view shows revenue and net-income
coverage for the latest four expected fiscal slots. It identifies missing
quarters, unknown values and the source evidence still needed. It does not
calculate a trailing total or admit a new financial-data source.

## Current response and presentation

The existing quarterly API, schema, provider request and exact browser validation
remain unchanged. The browser adapter binds all returned identity fields to the
selected catalog listing and supplies its issuer ID separately. It maps the
validated fiscal coordinates, release dates and two reported fields into the
pure assessment. No new fetch, cache, storage or independent result state is
introduced; the result disappears with the quarterly response and owner session.

The four slots end at the response's latest fiscal coordinate, including fiscal
year rollover. They are not the four latest returned or known rows. A missing
recent quarter is never replaced by an older one. Each field counts known values
independently; zero revenue and negative net income remain known values.

The current DTO does not provide actual period dates, standalone/YTD basis,
fiscal-calendar evidence, per-fact currency/scale, reporting scope, concept
semantics or revision references. Its adapter explicitly supplies missing
evidence. `statementDate` remains a provider statement/release date, `asOf`
remains request time, and global USD/most-recent declarations are not converted
into per-fact evidence. All four known values still leave TTM unavailable.

The display groups shared evidence gaps, preserves field-specific missingness,
and offers a native keyboard disclosure for the four inspected fiscal slots.
It leaves all 30 reported fields and their existing exact-value tables available.
An identity or structural failure produces no partial compatibility counts.

## Offline consistency contract

`assessPersonalQuarterlyCompatibility` lives in the existing personal financial
analytics package. It accepts one selected issuer/listing binding, an anchor
fiscal coordinate and at most 16 quarterly observations. Malformed envelopes,
duplicate coordinates, invalid dates or invalid bounded decimal values are
quarantined. Well-formed but absent or unsupported evidence is reported as
blocked, with the affected fiscal coordinates.

The initial scope is two signed USD flow fields, revenue and net income. Each
supplied field may carry period, fiscal-calendar, unit, scope, concept and source
metadata. Internal compatibility requires:

- Four exact expected fiscal coordinates with known values; no gap filling.
- Standalone three-calendar-month periods whose start/end dates match the
  declared quarter within a first-of-month fiscal-year start, with contiguous
  dates and coherent fiscal-year rollover under one calendar identifier.
  The fiscal-year start must fall in the labeled fiscal year or the preceding
  calendar year; other labeling conventions are outside this initial policy.
- USD units at scale zero; no inferred FX or scale conversion.
- The selected issuer, consolidated whole-entity scope and no dimensions.
- Consistent taxonomy, concept and reported-sign convention within each field.
- One declared source and revision set within each field, with nonempty source
  references and revision identifiers for every contributing observation.

These checks only assess internal consistency of supplied metadata. Equal
source or revision-set identifiers do not independently prove correct amendment
selection, authenticity, publication time or economic comparability. Even
`compatible_inputs` retains the fixed TTM result
`unavailable / source_not_admitted`. Synthetic fixtures exercise this branch;
the current live response cannot reach it through its adapter.

Week-based calendars, including 52/53-week years, and transition/stub periods are
unsupported in this first policy. Cumulative YTD, annual and instant values are
also blocked. There is no annual-minus-nine-month subtraction, inferred Q4,
rounding or aggregation. Balances, EPS, share denominators and other metrics are
outside this assessment. No point-in-time or screening-coverage claim is made.

## Source admission still required

The next source pilot must bind actual period metadata and fact references to
the catalog issuer, establish revision selection and units, and reconcile a
bounded independent sample. Calendar policy and any YTD subtraction need
explicit tested rules before a derived total is exposed. Four fiscal quarters
also need an honest period-span label; a fiscal label alone does not establish
an exact twelve-month interval.

The reviewed [Tiingo documentation](https://www.tiingo.com/documentation/fundamentals)
describes fiscal labels, statement release dates, units and revision options;
the current application's DTO does not retain the evidence required here.
This is not a claim that the provider can never supply richer metadata.

The [SEC EDGAR API guide](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
describes Company Facts and Submissions as possible inputs. It also warns that
Frames aligns observations to calendar periods whose actual dates can differ.
Company Facts plus filing metadata is a candidate for validation, not an admitted
replacement. This slice makes no issuer-data request or endpoint change.

The existing 30-core-metric, 500-security, 90%-knownness and independent
20-issuer gates in the [breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
remain open. Offline compatibility is preparation for source admission, not
completion of those coverage requirements.
