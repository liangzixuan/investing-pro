import type { ManagedValuationPriceContext as PriceContext } from "./managed-valuation-price";
import {
  valuationRefusal,
  valuationScenarioLabels,
} from "./ManagedValuationResults";

const priceReasons: Readonly<Record<string, string>> = {
  price_not_loaded:
    "Load raw closing prices explicitly in the Price section to compare this scenario.",
  price_pending:
    "A price request is in progress. Wait for it to finish or cancel it before using a comparison.",
  price_range_staged:
    "The selected price range differs from the loaded history. Load that range explicitly before using a comparison.",
  price_catalog_changed:
    "The price catalog changed. Load prices for the current listing and catalog before using a comparison.",
  price_identity_mismatch:
    "The loaded prices belong to another listing, catalog or research context.",
  price_invalid:
    "The loaded history does not provide an admitted latest raw USD close for this comparison.",
  price_comparison_input_invalid:
    "The displayed model value and dated raw close must both be valid positive amounts.",
};
export function valuationPriceRefusal(reason: string) {
  return priceReasons[reason] ?? valuationRefusal(reason);
}

/** Passive presentation shared by the live workbench and captured report. */
export function ManagedValuationPriceContext({
  context,
}: {
  readonly context: PriceContext | null;
}) {
  if (!context)
    return (
      <section
        className="managed-valuation-price-context"
        aria-label="Dated valuation price comparison"
      >
        <h3>Authored scenarios versus dated raw close</h3>
        <p>
          Calculate authored scenarios for this company to compare them with an
          explicitly loaded dated raw close.
        </p>
      </section>
    );
  const { reference, selection } = context;
  return (
    <section
      className="managed-valuation-price-context"
      aria-label="Dated valuation price comparison"
    >
      <h3>Authored scenarios versus dated raw close</h3>
      <p>
        {selection.listing.symbol} · {selection.listing.securityName} ·{" "}
        {selection.listing.shareClassName} · {selection.listing.exchangeMic}
      </p>
      <p>
        Model values use your authored diluted share counts, which are not
        source-verified. The comparison does not reconcile share counts or
        adjust for splits or dividends. Raw closes are unadjusted historical
        observations, not current quotes.
      </p>
      {context.reason && (
        <p role="status">
          Comparison unavailable. {valuationPriceRefusal(context.reason)}
        </p>
      )}
      {reference && (
        <>
          <p>
            Reference raw close: <strong>{reference.rawCloseUsd} USD</strong>{" "}
            observed on <strong>{reference.date}</strong>. Source:{" "}
            {reference.response.provider}. Request completed{" "}
            {reference.response.completedAt}.
          </p>
          {reference.showingPrevious && (
            <p className="managed-valuation-price-previous">
              Showing previous close history. A refresh has not confirmed newer
              prices. Original observation dates and request times are
              unchanged.
            </p>
          )}
          <details>
            <summary>Inspect dated price source</summary>
            <dl className="managed-valuation-facts">
              <div>
                <dt>Provider and basis</dt>
                <dd>
                  {reference.response.provider} · {reference.response.currency}{" "}
                  · raw close, unadjusted for splits or dividends
                </dd>
              </div>
              <div>
                <dt>Observed reference date</dt>
                <dd>{reference.date}</dd>
              </div>
              <div>
                <dt>Reference raw close (full USD)</dt>
                <dd>{reference.rawCloseUsd}</dd>
              </div>
              <div>
                <dt>Requested range and window</dt>
                <dd>
                  {reference.response.range} ·{" "}
                  {reference.response.window.startDate} to{" "}
                  {reference.response.window.endDate}
                </dd>
              </div>
              <div>
                <dt>Request started</dt>
                <dd>{reference.response.requestStartedAt}</dd>
              </div>
              <div>
                <dt>Request completed</dt>
                <dd>{reference.response.completedAt}</dd>
              </div>
              <div>
                <dt>Listing and share class</dt>
                <dd>
                  {reference.response.security.listingId} ·{" "}
                  {reference.response.security.securityId} ·{" "}
                  {reference.response.security.shareClassId} ·{" "}
                  {reference.response.security.shareClassName} ·{" "}
                  {reference.response.security.exchangeMic}
                </dd>
              </div>
              <div>
                <dt>Catalog snapshot</dt>
                <dd>{reference.response.catalogSnapshotSha256}</dd>
              </div>
              <div>
                <dt>Research origin and CIK</dt>
                <dd>
                  {selection.origin} · {selection.cik ?? "Unavailable"}
                </dd>
              </div>
            </dl>
          </details>
        </>
      )}
      <div
        className="managed-valuation-table"
        role="region"
        aria-label="All authored scenario price comparisons"
        tabIndex={0}
      >
        <table>
          <caption>
            Six authored scenarios and their difference from the dated raw close
          </caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Scenario</th>
              <th scope="col">Authored value (USD/share)</th>
              <th scope="col">Difference from dated raw close (%)</th>
            </tr>
          </thead>
          <tbody>
            {context.rows.map((row) => (
              <tr key={`${row.model}-${row.scenario}`}>
                <th scope="row">
                  {row.model === "dcf" ? "Cash flow DCF" : "Exit multiple"}
                </th>
                <td>{valuationScenarioLabels[row.scenario]}</td>
                <td>
                  {row.modelValuePerShareUsd ?? (
                    <>
                      Model unavailable.{" "}
                      {valuationPriceRefusal(
                        row.result.status === "unavailable"
                          ? row.result.reason
                          : "invalid_input",
                      )}
                    </>
                  )}
                </td>
                <td>
                  {row.result.status === "available" ? (
                    `${row.result.differencePercent}%`
                  ) : (
                    <>Unavailable. {valuationPriceRefusal(row.result.reason)}</>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Difference = ((displayed authored USD/share ÷ dated raw close USD) − 1)
        × 100. Each comparison uses the displayed scenario value and the same
        dated close. These differences are scenario context, not a price target
        or trading recommendation.
      </p>
    </section>
  );
}
