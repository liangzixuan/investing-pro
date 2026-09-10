"use client";

import { useEffect, useState } from "react";
import type { PersonalPortfolioValuationHistoryResult } from "../../lib/personal-portfolio-valuation-history";

export interface PersonalPortfolioValuationHistoryProps {
  readonly result: PersonalPortfolioValuationHistoryResult;
}

type AvailableHistory = Extract<
  PersonalPortfolioValuationHistoryResult,
  { status: "available" }
>;
type HistoryPoint = AvailableHistory["points"][number];
const PAGE_SIZE = 25;

export function PersonalPortfolioValuationHistory({
  result,
}: PersonalPortfolioValuationHistoryProps) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [result]);

  if (result.status === "invalid") {
    return (
      <section
        className="portfolio-valuation-history"
        aria-label="Portfolio value by date"
      >
        <h3>Portfolio value by date</h3>
        <p role="status">
          Valuation history is unavailable for this ledger and observation
          window. Resolve the history review issues and review history again.
        </p>
      </section>
    );
  }

  const pages = Math.max(1, Math.ceil(result.points.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const newestFirst = [...result.points].reverse();
  const visible = newestFirst.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const { comparison, coverage } = result;
  const compared =
    comparison.firstDate !== null && comparison.lastDate !== null;

  return (
    <section
      className="portfolio-valuation-history"
      aria-label="Portfolio value by date"
    >
      <h3>Portfolio value by date</h3>
      <p>
        Requested window {result.startDate} to {result.endDate}. Ledger values
        begin on {result.effectiveStartDate}. {coverage.completeDates} of{" "}
        {coverage.totalDates} calendar dates have a complete value.
      </p>
      <p className="portfolio-valuation-note">
        Exact-date raw EOD closes value recorded end-of-day shares, plus
        recorded cash. Missing dates, including unobserved weekends, are not
        filled.
      </p>

      <div className="portfolio-valuation-comparison">
        <h4>Compared observations</h4>
        <p>
          {compared
            ? `${comparison.firstDate} to ${comparison.lastDate}: first and last complete values in this window.`
            : "At least two complete dated values are needed for a comparison."}{" "}
          This does not establish values at unpriced window endpoints.
        </p>
        <dl className="portfolio-valuation-summary">
          <div>
            <dt>
              First complete value
              {comparison.firstDate ? ` · ${comparison.firstDate}` : ""}
            </dt>
            <dd>{money(comparison.firstValueUsd)}</dd>
          </div>
          <div>
            <dt>
              Last complete value
              {comparison.lastDate ? ` · ${comparison.lastDate}` : ""}
            </dt>
            <dd>{money(comparison.lastValueUsd)}</dd>
          </div>
          <div>
            <dt>Return between compared dates</dt>
            <dd>
              {comparison.endpointReturn.status === "available" ? (
                `${comparison.endpointReturn.percent}%`
              ) : (
                <>
                  Unavailable
                  <small>
                    {returnUnavailableReason(comparison.endpointReturn.reason)}
                  </small>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Recorded net external flows</dt>
            <dd>{money(comparison.netExternalFlowsUsd)}</dd>
          </div>
          <div>
            <dt>Change after external cash flows</dt>
            <dd>{money(comparison.changeAfterExternalFlowsUsd)}</dd>
          </div>
          <div>
            <dt>Cash-flow-adjusted return estimate</dt>
            <dd>
              {comparison.modifiedDietzReturn.status === "available" ? (
                `${comparison.modifiedDietzReturn.percent}%`
              ) : (
                <>
                  Unavailable
                  <small>
                    {dietzUnavailableReason(
                      comparison.modifiedDietzReturn.reason,
                    )}
                  </small>
                </>
              )}
              <small>Modified Dietz · end-of-day flows</small>
            </dd>
          </div>
        </dl>
        <p className="portfolio-valuation-note">
          Percentages cover the compared dates and are not annualized. Modified
          Dietz estimates the effect of recorded cash-flow timing using an
          end-of-day convention.
        </p>
        <details className="portfolio-valuation-methods">
          <summary>How these comparisons are calculated</summary>
          <p>
            The return between compared dates uses the change in displayed
            endpoint values divided by the positive starting value. It requires
            no deposits or withdrawals after the first date through the last,
            even if they net to zero.
          </p>
          <p>
            External flows are recorded deposits minus withdrawals strictly
            after the first compared date through the last. The USD change
            subtracts those flows from the change in value.
          </p>
          <p>
            Modified Dietz divides that USD change by the displayed starting
            value plus weighted external flows. Each signed flow is weighted by
            the fraction of calendar days remaining after its end-of-day date; a
            flow on the last compared date has weight zero. The displayed
            starting value and weighted capital must both be positive.
          </p>
          <p>
            Large cash flows and market swings can distort this estimate.
            Estimates below -100% are withheld rather than clamped. Modified
            Dietz is not an exact time-weighted return. Dates between compared
            observations may still have unavailable values.
          </p>
        </details>
      </div>

      {result.points.length > 0 ? (
        <HistoryChart result={result} />
      ) : (
        <p role="status">No dated values are available in this window.</p>
      )}

      <p className="portfolio-valuation-coverage">
        Unavailable-date reasons: missing prices on {coverage.missingPriceDates}{" "}
        dates; unknown cash on {coverage.unknownCashDates}; split review on{" "}
        {coverage.splitReviewDates}. Reasons can overlap.
      </p>
      {visible.length > 0 && (
        <>
          <div
            className="portfolio-valuation-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Exact dated portfolio values"
          >
            <table>
              <caption>Exact dated values · newest first · USD</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Coverage</th>
                  <th scope="col">Holdings value</th>
                  <th scope="col">Recorded cash</th>
                  <th scope="col">Total value</th>
                  <th scope="col">Net external flow that date</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((point) => (
                  <tr key={point.date}>
                    <th scope="row">{point.date}</th>
                    <td>{coverageLabel(point)}</td>
                    <td>
                      {money(point.holdingsValueUsd)}
                      {point.holdingsValueUsd === null && (
                        <small>
                          Priced subtotal {money(point.pricedHoldingsValueUsd)}{" "}
                          ({point.pricedHoldings} of {point.activeHoldings}{" "}
                          holdings)
                        </small>
                      )}
                    </td>
                    <td>{money(point.cashUsd, "Unknown")}</td>
                    <td>{money(point.totalValueUsd)}</td>
                    <td>{money(point.netExternalFlowUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav
              className="portfolio-valuation-pagination"
              aria-label="Dated value pages"
            >
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Newer dates
              </button>
              <span role="status">
                Page {currentPage + 1} of {pages}
              </span>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={currentPage === pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Older dates
              </button>
            </nav>
          )}
        </>
      )}
      <p className="portfolio-valuation-note">
        Tiingo supplies the raw closes. Dividend observations never create cash
        receipts; only recorded ledger activity changes cash. These values stay
        in active session memory and are not saved or exported. This is a
        reconstruction from your current ledger, not a point-in-time account
        statement.
      </p>
    </section>
  );
}

function HistoryChart({ result }: { readonly result: AvailableHistory }) {
  const plotted = result.points.flatMap((point, index) => {
    const value =
      point.totalValueUsd === null ? null : Number(point.totalValueUsd);
    return value !== null && Number.isFinite(value) && value >= 0
      ? [{ point, index, value }]
      : [];
  });
  const maximum = plotted.reduce(
    (prior, entry) => Math.max(prior, entry.value),
    0,
  );
  const scale = maximum || 1;
  const x = (index: number) =>
    90 + (index / Math.max(1, result.points.length - 1)) * 680;
  const gaps = result.points.flatMap((point, index) =>
    point.totalValueUsd === null ? [index] : [],
  );
  const gapMarks = gaps
    .map((index) => {
      const position = x(index);
      return `M${position - 2} 229l4 4m0 -4l-4 4`;
    })
    .join(" ");
  const unplottable = result.coverage.completeDates - plotted.length;

  return (
    <figure className="portfolio-valuation-chart">
      <div
        className="portfolio-valuation-chart-scroll"
        tabIndex={0}
        role="region"
        aria-label="Portfolio value chart"
      >
        <svg
          viewBox="0 0 800 290"
          role="img"
          aria-label={`Portfolio value by calendar date. ${plotted.length} complete values shown as separate dots; ${gaps.length} unavailable dates shown as crosses below the value axis. Exact values and coverage are in the dated table.`}
        >
          <title>Portfolio value by calendar date</title>
          <desc>
            Dots show complete USD values only. No line connects dates. Crosses
            below the value axis indicate unavailable dates, not zero values.
          </desc>
          <line
            x1="90"
            y1="35"
            x2="90"
            y2="210"
            className="portfolio-valuation-axis"
          />
          <line
            x1="90"
            y1="210"
            x2="770"
            y2="210"
            className="portfolio-valuation-axis"
          />
          <line
            x1="90"
            y1="35"
            x2="770"
            y2="35"
            className="portfolio-valuation-grid"
          />
          <text x="80" y="39" textAnchor="end">
            {axisValue(maximum)} USD
          </text>
          <text x="80" y="214" textAnchor="end">
            0 USD
          </text>
          <text x="80" y="236" textAnchor="end">
            Unavailable
          </text>
          <text x="90" y="265">
            {result.effectiveStartDate}
          </text>
          <text x="770" y="265" textAnchor="end">
            {result.endDate}
          </text>
          {plotted.map(({ point, index, value }) => (
            <circle
              key={point.date}
              data-date={point.date}
              cx={x(index)}
              cy={210 - (value / scale) * 175}
              r="2.5"
              className="portfolio-valuation-dot"
            >
              <title>
                {point.date}: {money(point.totalValueUsd)}
              </title>
            </circle>
          ))}
          {gapMarks !== "" && (
            <path d={gapMarks} className="portfolio-valuation-gap" />
          )}
        </svg>
      </div>
      <figcaption>
        Dots are complete dated values. Crosses mark unavailable dates below the
        value axis, not zero values. Dots are not connected across dates. Scroll
        the chart horizontally on narrow screens.
        {unplottable > 0 &&
          " Some values cannot be drawn at this scale; exact values remain in the table."}
      </figcaption>
    </figure>
  );
}

function money(value: string | null, unknown = "Unavailable") {
  return value === null ? unknown : `${value} USD`;
}

function returnUnavailableReason(
  reason: Extract<
    AvailableHistory["comparison"]["endpointReturn"],
    { status: "unavailable" }
  >["reason"],
) {
  return {
    insufficient_complete_dates:
      "At least two complete dated values are required.",
    external_flows:
      "Deposits or withdrawals occurred between the compared endpoints, including any that offset each other.",
    non_positive_starting_value:
      "The displayed starting value must be greater than zero.",
  }[reason];
}

function dietzUnavailableReason(
  reason: Extract<
    AvailableHistory["comparison"]["modifiedDietzReturn"],
    { status: "unavailable" }
  >["reason"],
) {
  return {
    insufficient_complete_dates:
      "At least two complete dated values are required.",
    non_positive_starting_value:
      "The displayed starting value must be greater than zero.",
    non_positive_weighted_capital:
      "Starting value plus weighted external flows must be greater than zero.",
    estimate_below_total_loss:
      "Cash-flow timing produces an estimate below -100%; use the dollar comparison or a valuation at each flow.",
  }[reason];
}

function coverageLabel(point: HistoryPoint) {
  if (point.totalValueUsd !== null) return "Complete";
  const reasons: string[] = [];
  if (point.missingPriceListingIds.length > 0)
    reasons.push(
      `${point.missingPriceListingIds.length} missing exact-date ${point.missingPriceListingIds.length === 1 ? "price" : "prices"}`,
    );
  if (point.cashUsd === null) reasons.push("unknown opening cash");
  if (point.splitReviewListingIds.length > 0)
    reasons.push(
      `${point.splitReviewListingIds.length} ${point.splitReviewListingIds.length === 1 ? "listing needs" : "listings need"} split review`,
    );
  return reasons.length > 0
    ? `Unavailable: ${reasons.join("; ")}`
    : "Unavailable";
}

function axisValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1e15 ? "scientific" : "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
