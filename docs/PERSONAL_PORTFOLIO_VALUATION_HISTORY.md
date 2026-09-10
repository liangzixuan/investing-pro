# My Portfolio: historical value and period returns

The fourth partial Cycle 3m-a delivery reconstructs daily end-of-day holdings
and cash from the recorded ledger, values them using exact-date raw EOD closes,
and compares two explicitly dated complete observations. The fifth partial
delivery adds an endpoint percentage return for intervals without recorded
deposits or withdrawals. The sixth partial delivery adds a Modified Dietz
estimate for intervals with recorded cash flows, using an explicit end-of-day
timing convention. Exact TWR, XIRR, benchmark performance and tax results remain
separate work.

## Workflow

Load a schema 2 or 3 ledger, choose the existing history window and select
**Review history**. The same sequential, identity-admitted Tiingo requests now
feed both the corporate-action review and portfolio valuation. There is no
second provider request or new endpoint. A cash-only ledger can be reviewed
without a provider request.

The value panel shows a dot chart and paginated daily table. It reports calendar
dates with complete values, missing exact closing prices, unknown cash and
unresolved split reviews. The chart never joins observations across missing
dates. Each daily row reports holdings, cash, complete total and the recorded
external cash flow for that date. Partial loads, cancellation and individual
listing failures keep missing observations explicit.

The comparison uses the **first and last fully valued dates**, shown by date
alongside their values. These can differ from the requested window endpoints.
It does not silently claim that an unpriced endpoint was valued. At least two
distinct complete dates are required. The net external flow and dollar change
refer only to that explicitly dated comparison interval. When eligible, the
endpoint percentage and Modified Dietz estimate use the same two dates, not
unpriced window boundaries. The comparison's expandable methodology describes
their eligibility and timing conventions.

## Date and value conventions

The review captures its requested UTC end date when the owner starts it. Range
starts use the existing month/year subtraction with calendar-day clamping;
year-to-date starts on January 1. Display begins at the later of the requested
start and the ledger's end-of-day opening date. The engine emits at most 3,660
calendar dates. Individual provider responses keep their actual window bounds,
including a batch that crosses midnight.

Opening quantities and cash form the first state. On each later date, apply all
ledger activities through that date in their existing order, including same-day
order, before valuation. Purchases subtract gross amount plus fee from cash;
sales add gross proceeds less fee. Deposits, withdrawals, recorded dividends and
standalone fees affect cash as recorded. Splits change shares and preserve cash.

For each active position:

`holding value = recorded end-of-day shares * exact-date raw closing price`

`portfolio value = sum(holding values) + recorded end-of-day cash`

Raw price decimals, share millionths and cash cents use exact integer arithmetic.
Position values are summed before rounding the displayed aggregate to cents,
half up. No binary floating-point arithmetic determines financial results. The
chart's coordinates are a display approximation of those calculated values.

Unknown cash leaves the complete portfolio value unavailable, even if all
positions are priced. Unknown acquisition basis does not prevent market-value
calculation. A clean position with zero remaining shares needs no later price.
Missing raw closes are never replaced by current quotes, adjusted prices,
nearest observations or carried-forward prices. Nontrading calendar dates can
therefore be unavailable; the product does not infer an exchange calendar or
claim that every missing date is a provider error.

## Split evidence and limits

The valuation engine reuses split assessments and the session's retained dated
warnings. A mismatch, unrecorded observed split, or recorded split without an
exact-date observation blocks affected-date totals from that split onward.
This remains true after an apparent position closure: an unrecorded split can
make the ledger's zero-share balance incorrect. The priced subtotal can still
show unaffected positions, but it is not presented as a complete portfolio.

A warning before the displayed window stays relevant. A shorter window or a
failed fetch cannot clear it. Exact-date re-observation under the current ledger
can resolve it. Recorded splits outside the fetched history need a wider review
before later totals become available. The engine cannot discover an unrecorded
action outside supplied observations; values remain conditional on the owner’s
ledger and available evidence, not proof that every corporate action is known.

## Dollar change after external cash flows

For first complete end-of-day value `V0` and last complete end-of-day value `V1`:

`net external flows = deposits - withdrawals, strictly after first date through last date`

`change after external cash flows = V1 - V0 - net external flows`

The bridge uses the displayed, rounded endpoint cents, so its amounts reconcile
exactly with the two shown values. An external flow on the first date is already
inside `V0` and is excluded from
the comparison's flow sum. Buys and sells move value between holdings and cash;
they are not external flows. Recorded dividends and fees remain in the observed
change through their cash effects. The ledger is a cash-basis reconstruction:
provider dividend ex-date observations do not create cash, receivables, accruals
or reinvestment. Missing intermediate prices do not supply daily return factors.
This dollar bridge is not a percentage return or an annualized result.

## Endpoint percentage return

The comparison shows an endpoint return only when it has two distinct complete
dates, the displayed first value is greater than zero, and no deposit or
withdrawal is recorded strictly after the first date through the last date.
Every such activity counts: equal deposits and withdrawals do not make the
interval eligible. A flow on the first date is already included in its end-of-day
value; a flow on the last date makes the interval ineligible. Activities before
the first or after the last compared date do not affect this eligibility rule.

`endpoint return (%) = (displayed last value - displayed first value) / displayed first value * 100`

Both values are the same rounded USD cents shown in the comparison. The ratio
uses exact integer arithmetic and is rounded to two percentage decimal places,
with halfway values rounded away from zero. A rounded zero is displayed as
`0.00%`, never negative zero. A positive underlying value that rounds to `0.00 USD`
does not supply a usable displayed denominator and is ineligible. This rounding
policy makes the result reproducible from the displayed amounts; cent rounding
can materially affect percentages for very small portfolios.

For example, `100.00 USD` to `110.00 USD` with no external activity yields
`10.00%`. With a `100.00 USD` deposit, `100.00 USD` to `210.00 USD` retains the
`10.00 USD` dollar change after flows, but the endpoint percentage is unavailable.
The separate Modified Dietz estimate can account for that deposit's date.
The panel states whether it lacks two complete values, has external flows, or
has a nonpositive starting value. It never substitutes zero for an unavailable
return. If multiple conditions apply, insufficient endpoints take precedence,
then external flows, then the starting-value check.

This is the return over the displayed interval, without annualization or daily
linking. Intermediate missing prices remain visible but do not prevent this
endpoint calculation. They cannot establish daily returns, drawdown or a
complete trading-day history. Recorded internal trades, dividends and fees
remain reflected in the ledger's holdings and cash. The existing cash-basis,
corporate-action and raw-price limits still apply; provider dividend observations
do not add income. The result is not a benchmark comparison or a claim of TWR,
XIRR or GIPS compliance.

## Cash-flow-adjusted return estimate: Modified Dietz

This estimate uses recorded deposit and withdrawal dates to weight the capital
available over the compared interval. It assumes every external flow occurs
at the end of its recorded date. This is a declared convention, not observed
intraday timing. The existing endpoint return and dollar bridge remain visible.

For displayed first value `V0`, displayed last value `V1`, and `D` UTC calendar
days between their dates, each signed external flow `C_i` receives weight:

`w_i = (D - days from first date to flow date) / D`

`weighted capital = V0 + sum(w_i * C_i)`

`Modified Dietz estimate (%) = (V1 - V0 - sum(C_i)) / weighted capital * 100`

Only deposits and withdrawals strictly after the first through the last date
enter either flow sum. First-date flows are already inside the initial EOD
value. Last-date flows have zero weight but are still subtracted from value
change. Same-date offsetting flows cancel in this estimate; flows on different
dates can have zero net amount and still change weighted capital. Neither case
makes the separate endpoint return eligible.

The two endpoint values use the displayed rounded cents. Flow amounts and date
weights remain exact: the engine multiplies through by `D`, checks the integer
capital numerator, and divides only for the final percentage. It never rounds
weighted capital to cents before eligibility or calculation. Percentages use
two decimals, with halfway values away from zero and no negative zero, matching
the endpoint percentage's output convention.

Eligibility requires two distinct complete endpoints, positive displayed
starting cents, and positive exact weighted capital. The panel reports those
unavailable reasons in that order. It also withholds an exact, unrounded
estimate strictly below `-100%`. This last condition is a conservative product
display policy for this long-only ledger, not a statement that the formula is
undefined. It is checked before percentage rounding; exactly `-100%` is allowed.
There is no gain cap and no blanket exclusion for a depleted and re-funded
portfolio. Unavailable results are never clamped or replaced with zero.

For a ten-day interval starting at `100.00 USD`, a `100.00 USD` deposit on day
five and ending value `220.00 USD` give weighted capital `150.00 USD`, dollar
change after flows `20.00 USD`, and estimated return `13.33%`. If the deposit
occurs on the final day, weighted capital is `100.00 USD` and the estimate is
`20.00%`. The assumption about timing therefore matters even with equal endpoint
values and equal net deposits.

The estimate needs no complete intermediate or flow-date valuation. Existing
missing-price rows remain visible; the tool does not claim daily linked returns
or fill those gaps. Large flows and market swings can distort this approximation,
and a small positive weighted capital can amplify the result. For example, a
ten-day cash portfolio starting at `100.00 USD`, withdrawing `100.00 USD` on day
one, depositing `100.00 USD` on day nine and paying a `30.00 USD` fee ends at
`70.00 USD`. Its `20.00 USD` weighted capital implies `-150%`; the product
withholds that estimate and retains the `-30.00 USD` dollar bridge.

No return is annualized, no period is geometrically linked, and no exact TWR or
XIRR is claimed. Unknown cash and unresolved split evidence still prevent
complete affected endpoints. All values remain conditional on recorded ledger
activities and observed raw prices; fees and recorded dividends retain their
existing cash effects, while provider dividend observations add no cash.

## Source and methodology context

Tiingo describes both raw and adjusted fields in its
[EOD documentation](https://www.tiingo.com/documentation/end-of-day). Raw closes
are used here with the ledger's already adjusted share quantities to avoid
applying splits twice. CFA Institute's
[GIPS methodology handbook](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)
describes Modified Dietz, end-of-day flow weighting and the limitations of an
estimate without valuations at each flow. The handbook was checked on
2026-09-10. This product chooses EOD timing, displayed-cent endpoints and the
eligibility rules above; it does not implement the handbook's full performance
framework or claim GIPS compliance.

## Storage, bounds and validation

Stored schemas and the encrypted portfolio/main record remain unchanged. The
loader retains only admitted identity/history associations in active session
memory. Provider histories, derived values and comparisons are never saved,
exported or logged. Ledger, version, catalog, range and session changes clear
the detailed review; stale callbacks cannot restore it. Dated warning updates
recompute values without starting another fetch. Existing owner-session and
catalog admission checks remain in force.

Limits remain 20 identities, 250 ledger activities and 4,096 observations per
listing. The engine validates the ledger and uses a single chronological activity
cursor, with work bounded by supplied bars plus daily listing checks. Input
identity mismatches, duplicate histories, malformed prices/dates and excess
bounds are rejected. Calculated results are immutable.

Synthetic tests cover exact arithmetic, same-day cash and share events, splits,
missing dates, unknown cash, closed positions, comparison flow boundaries,
request/session invalidation and responsive presentation. Live owner Tiingo
coverage still requires the configured runtime. Exact TWR, XIRR, dividend
accruals, other corporate actions and benchmarks remain separate work.
Percentage tests include offsetting flows, dated boundaries,
zero starting values, gains/losses, rounding ties, exact large amounts and raw
split-adjusted share quantities. Loader tests verify that eligibility updates
reuse the existing observations and clear with the owner context. Dietz tests
also cover different-date weights, missing flow-date prices, zero and negative
weighted capital, near-zero exact capital, the unrounded loss-range boundary,
and equality with the endpoint return when no external flows occur.
