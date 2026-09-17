# Prices in a financial comparison

Select two or three distinct companies in the financial screen and open
**Compare companies**. **Load prices** requests Tiingo price context for those
exact listings. Each company shows its own loading, available or unavailable
state. Opening the comparison or changing its financial columns makes no price
request. Prices are separate from the reported annual financial amounts.

The comparison uses the existing overview API with its shortest supported
history range, 1m. Requests run one company at a time; each overview uses the
existing quote and EOD operations. There is no automatic retry or refresh.
Credential, entitlement, configuration, session and rate-limit failures stop
the remaining batch. Ordinary missing company coverage remains visible without
hiding another company's result.

## Read the price context

A **Tiingo reference price** is provider-derived and is not an executable quote.
Its time is the provider's reference refresh timestamp. An **End-of-day close**
uses the latest admitted EOD bar only when the existing adapter permits fallback.
Its date is a trading-session date; the app assumes the regular 16:00 New York
close. Early closes are not modeled and the time is not an observed closing trade.

Freshness describes the quote when loaded, with the existing 36-hour threshold.
Prices do not update in the background. The provider and source date/time remain
visible so an older reference or prior close is not presented as a current trade.
The annual financial periods remain independent. No price-to-earnings, yield,
market-capitalization estimate or valuation ranking is inferred from this view.

## Lifetime and boundaries

Only the quote, provider and EOD bar date needed for display are retained in
active component memory. The history payload is not kept by the comparison.
Removing or replacing a company, invalidating its financial/catalog context,
losing the owner session or closing the comparison clears the price context and
cancels pending work. Late callbacks cannot repopulate former selections. A
display-only column change retains the comparison context.

Prices are not written to saved financial views, the vault, browser storage,
URLs, exports or logs. Existing financial criteria, columns, presets, metrics
and saved payload versions retain their meaning. Company research still has its
own explicit price-loading action.

## Verification

Cover explicit-only requests, sequential batches, independent failures, batch
stops, complete listing identity, stale callbacks, abort/unmount and session or
snapshot changes. Exercise current/stale reference prices, EOD fallback and an
early-close date with an explicit assumed-time label using synthetic responses.
Verify desktop/narrow layouts and keyboard access in external Brave. Any retained
screenshots or fixtures contain only synthetic prices. The workspace checkpoint
records the actual released revision and dated configured-source observations;
this guide does not establish broad coverage or provider entitlement.
