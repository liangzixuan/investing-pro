import { isPortfolioReportArchive } from "./portfolio-report-archive";
import { PortfolioCloseComposition } from "./PortfolioCloseComposition";
import {
  isPreparedPortfolioReviewReport,
  type PreparedPortfolioReviewReport,
} from "./portfolio-review-report";
import {
  PortfolioIdentity,
  PortfolioLedgerDetails,
} from "./ManagedPortfolioLedgerDetails";
const usd = (value: string | null) =>
  value === null ? "Unavailable" : `USD ${value}`;

export function PortfolioReviewReportSnapshot({
  report,
  compositionId = "portfolio-report-composition",
}: {
  readonly report: PreparedPortfolioReviewReport;
  readonly compositionId?:
    | "portfolio-dated-review-composition"
    | "portfolio-report-composition"
    | "portfolio-report-saved-composition"
    | "portfolio-comparison-report-saved-composition"
    | "portfolio-comparison-report-current-composition";
}) {
  if (
    !isPreparedPortfolioReviewReport(report) &&
    !isPortfolioReportArchive(report)
  )
    return null;
  const review = report.review;
  return (
    <article aria-label="Captured Portfolio holdings review">
      <h2>Portfolio holdings review</h2>
      <p>
        Prepared {report.preparedAt}. This is a private reading copy of authored
        balances and loaded evidence. It is not a saved Portfolio record or an
        importable draft.
      </p>
      <p>
        Authored balances through {review.balancesOn}; raw closes on{" "}
        {review.asOfDate}. Each holding value rounds half-up to USD cents. The
        subtotal sums those displayed line values.
      </p>
      <p>
        These reference values do not measure investment returns, profit or
        loss, or tax liability. Missing values remain unavailable; source
        coverage is limited.
      </p>
      <dl>
        <dt>Priced holdings</dt>
        <dd>
          {review.pricedHoldings} of {review.totalHoldings}
        </dd>
        <dt>Priced holdings subtotal</dt>
        <dd>{usd(review.pricedHoldingsSubtotalUsd)}</dd>
        <dt>Complete holdings value</dt>
        <dd>{usd(review.holdingsValueUsd)}</dd>
        <dt>Authored cash</dt>
        <dd>{review.cashUsd === null ? "Unknown" : usd(review.cashUsd)}</dd>
        <dt>Complete value including authored cash</dt>
        <dd>{usd(review.totalValueUsd)}</dd>
      </dl>
      <PortfolioCloseComposition
        id={compositionId}
        review={review}
        rows={report.sourceRows}
      />
      <p>{report.message}</p>
      <h3>Holdings and original sources</h3>
      {report.sourceRows.map((row, index) => {
        const line = review.holdings[index]!;
        const source = row.response;
        return (
          <section className="fact" key={line.listingId}>
            <PortfolioIdentity listing={row.holding.identity} />
            <p>
              {line.shares} shares, confirmed {line.confirmedOn}. Raw close:{" "}
              {usd(line.close)}. Holding value: {usd(line.valueUsd)}.
            </p>
            {line.reason && (
              <p>
                {line.reason === "balance_after_close"
                  ? "Authored balances are later than this close date."
                  : "No eligible close was loaded for this exact date."}
              </p>
            )}
            <p>
              {row.available
                ? "Within declared price coverage."
                : "Outside declared price coverage."}{" "}
              {row.message}
            </p>
            {row.showingPrevious && (
              <p className="warning">
                Previous history retained. The latest attempt did not confirm
                newer evidence; original dates remain unchanged.
              </p>
            )}
            {source && (
              <dl>
                <dt>Provider / basis / currency</dt>
                <dd>
                  {source.provider} / {source.priceBasis} / {source.currency}
                </dd>
                <dt>Requested range</dt>
                <dd>{source.range}</dd>
                <dt>Requested window</dt>
                <dd>
                  {source.window.startDate} through {source.window.endDate}
                </dd>
                <dt>Request started</dt>
                <dd>{source.requestStartedAt}</dd>
                <dt>Completed</dt>
                <dd>{source.completedAt}</dd>
                <dt>Catalog reference</dt>
                <dd>{source.catalogSnapshotSha256}</dd>
              </dl>
            )}
          </section>
        );
      })}
      <details>
        <summary>Complete authored ledger</summary>
        <PortfolioLedgerDetails ledger={report.ledger} />
      </details>
      <details>
        <summary>Complete report document and source packets</summary>
        <p>
          The complete captured schema3 ledger, current holdings, exact
          calculations, raw admitted responses, source clocks and
          retained-history qualifications follow. Preparation time does not
          replace source time.
        </p>
        <pre>{JSON.stringify(report, null, 2)}</pre>
      </details>
    </article>
  );
}
