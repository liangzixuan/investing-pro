# Review a dated Portfolio composition

This M4 candidate connects the existing dated holdings review to exact-company
research, a dated Follow-ups question and the private Portfolio reading report.
It uses the current authored ledger and explicitly loaded raw closes. Source,
synthetic native and Android delivery acceptance remain separate.

## Read the complete composition

Load Portfolio, finish its current catalog review and apply or reset open forms.
Open **Dated holdings review**, explicitly load holding closes and choose an
observed date. **Composition at this close** shows every exact holding in ledger
order, its displayed USD value and its share of the complete value including
authored cash. Cash has its own row. The denominator and original dates remain
visible. Share classes remain separate listings.

Each holding value uses the existing shares multiplied by the exact-date raw
close, rounded half-up to USD cents. Add those displayed line values and known
authored cash to obtain the complete total. Each percentage is:

`displayed line value / complete total including authored cash * 100`

Percentages use decimal arithmetic and round half-up to two decimal places.
They are rounded independently, so their displayed sum can differ from 100%.
For example, USD 60 and USD 30 of holdings plus USD 10 of cash give a USD 100
total and shares of 60.00%, 30.00% and 10.00%. The app does not adjust a row to
force a rounded sum.

All percentages are unavailable when any holding lacks an eligible close, cash
is unknown, the complete total is zero, or an authored balance is later than the
selected close date. Available line values remain readable. A partially priced
subset never becomes a 100% portfolio. Known zero cash is 0.00% when the total
is positive. A valid dated cash-only calculation is 100.00% cash; this does not
create an observed close date for a Portfolio without loaded price history.

## Continue the review

Use the existing holding **Research** action to inspect that exact company.
Its authored position and dates remain distinct from source evidence. The
existing [dated next-check workflow](MANAGED_HOLDING_FOLLOWUP.md) can create an
independent Follow-ups draft after a full question and UTC due-date preview.
Back retains the authored drafts. Follow-ups and Portfolio keep their separate
Review, Save and fresh Load actions. Reading a percentage sends no request and
does not change either draft.

**Capture holdings report** copies the same canonical review, including its
composition, into the existing [private reading report](MANAGED_PORTFOLIO_REVIEW_REPORT.md).
Inspect its complete values, exact identities, dates and original sources, then
choose **Save report (HTML)** separately. The full JSON appendix includes the
calculation method and unavailable reasons. Capture makes no source request or
online Save. Existing report ownership, cancellation and 8 MiB limits remain.

Changing the ledger, observed date, source state, catalog, form, save/recovery
state, route or session keeps the existing review and report retirement rules.
The composition is derived from the current accepted review. It has no separate
saved setting or cached lifetime.

## Scope and design reference

This view describes current authored holdings at one observed close date. It
does not reconstruct holdings on a past date, group issuers or sectors, set a
target allocation, suggest trades, or calculate returns or benchmarks. Existing
coverage and unsupported holding reasons remain explicit. No source, storage
resource, schema, dependency, fee or deployment is added.

[Portfolio Performance's Statement of Assets](https://help.portfolio-performance.info/en/reference/view/accounts/security-account/#statement-of-assets)
places position identity, shares, value and percentage of the portfolio in one
table. We use that adjacent value-and-share pattern with this application's
exact-date and complete-total rules. Precision Desk supplies the existing dark
hierarchy, wrapping identities, labelled tables and visible controls.

Invented-data checks cover exact decimal rounding, missing inputs, zero totals,
cash-only composition, distinct share classes, report consistency and retirement.
Automated acceptance does not establish owner-record use, installation or
physical-phone acceptance. The browser stop remains in force.
