# Raw close research studies

Company Price uses its explicitly loaded close history to show seven descriptive
studies. Opening the company, changing a choice or preparing a note makes no
source request. A staged history range does not relabel the loaded packet.

| Study                                              | Observed sample and meaning                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Loaded-window raw close change                     | At least two closes; percentage change from the first to the last loaded observation                                                            |
| Maximum observed drawdown                          | Largest nonnegative decline from an earlier running peak; retains peak and trough dates                                                         |
| Annualized volatility                              | Sample standard deviation of the last 20 log returns, requiring 21 closes; annualized with the 252-observation convention                       |
| Last close versus 20-, 50- and 200-observation SMA | Last close above, below or at each arithmetic mean, with percentage distance from that mean                                                     |
| Trailing observed close-range position             | Requires 200 closes and uses at most 252; position between the sampled minimum and maximum; equal closes have an independent zero-range refusal |

Each result keeps its own count and first/last observed dates. The calculation
date is the last observed close date. Request-window end, completion time and
report preparation time remain separate. Missing observations are not filled.
The range is not a verified calendar-year high/low, and the volatility convention
does not establish a complete trading calendar.

These are raw USD closes, unadjusted for splits or dividends. They do not measure
total return or provide a recommendation or forecast. The existing versioned
analytics engine uses 80-significant-digit decimal arithmetic and rounds derived
percentages half-up to four decimal places. Its raw-close entry point does not
invent an adjusted series. No provider, source budget or response limit changes.

## Add selected results to a note

Choose available results and open **Review selected study results**. Select
**Preview complete note** to inspect the existing note and the whole proposed
addition. The addition includes result samples, raw-price basis, loaded window,
original request/completion times, formula version and any retained-history warning.

**Add study results to note draft** consumes that preview once. It changes only
the selected company's note draft. Use **Review in My Watchlist**, then the normal
whole-watchlist Save. Other membership edits and the independent Follow-ups draft
remain intact. Preview and Append do not Save or load a source.

The complete note must fit the existing single-line, 2,000-character limit.
An oversized proposal is refused whole. A changed choice, note, source, selected
range, visit, save/recovery state, catalog or session invalidates the preview.
Restoring identical text does not restore an old action. Cancellation and failed
refreshes retain admitted history with its original dates and warning, while late
responses cannot revive an old preview. Conflict and uncertain-save recovery use
the existing watchlist reconciliation flow.

## Capture a report

[Research reports](MANAGED_COMPANY_REPORT.md) capture the raw packet once and
the versioned calculation with independent samples, formulas and refusals.
Current schema 4 replaces schema 3; the current Android receiver requires schema 4.
The passive preview and HTML copy show the studies without selection or Append
controls. A forged or changed calculation, malformed packet or different company
identity is refused at the report boundary.

The JSON ceiling remains 2,850,816 bytes and HTML remains 8 MiB. Oversized output
is refused whole. The document does not refresh prices, prove a saved note or
establish that an exported file was received. Source checks, native execution,
visual acceptance and publication are recorded separately in [Current work](CURRENT_WORK.md).
