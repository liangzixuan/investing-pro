import type { PersonalSecurityMasterScreenRowDto } from "@research-cockpit/contracts";
import {
  calculatePersonalPricePerformanceComparison,
  type PersonalPricePerformanceComparisonAvailableRow,
  type PersonalPricePerformanceComparisonResult,
  type PersonalPricePerformanceComparisonSeries,
} from "@research-cockpit/personal-market-analytics";

export interface PersonalComparisonPerformanceProps {
  readonly listings: readonly PersonalSecurityMasterScreenRowDto[];
  readonly series: readonly PersonalPricePerformanceComparisonSeries[];
  readonly state: "idle" | "loading" | "incomplete" | "ready";
}

export function PersonalComparisonPerformance({
  listings,
  series,
  state,
}: PersonalComparisonPerformanceProps) {
  let result: PersonalPricePerformanceComparisonResult | null = null;
  if (state === "ready") {
    try {
      result = calculatePersonalPricePerformanceComparison({ series });
    } catch {
      // Fail closed if an admitted history cannot support the calculation.
    }
  }

  return (
    <section
      className="comparison-performance"
      aria-labelledby="comparison-performance-title"
    >
      <h5 id="comparison-performance-title">Adjusted-price performance</h5>
      {result?.status === "available" ? (
        <p className="comparison-performance-window">
          Shared window:{" "}
          <time dateTime={result.firstDate}>{result.firstDate}</time>
          {" to "}
          <time dateTime={result.lastDate}>{result.lastDate}</time>
          {" · "}
          {result.sharedSessionCount} shared observations.
        </p>
      ) : (
        <p role="status">
          {state === "idle"
            ? "Performance not loaded. Load prices to compare all selected companies."
            : state === "loading"
              ? "Waiting for every selected company's history before comparing performance."
              : state === "incomplete"
                ? "Performance unavailable: every selected company needs a successful price load. No subset was compared."
                : result?.status === "insufficient_history"
                  ? `Performance unavailable: at least 2 dates observed for every selected company are required; ${result.sharedSessionCount} shared observations loaded.`
                  : "Performance unavailable: the loaded histories could not be compared."}
        </p>
      )}
      {result !== null && (
        <div
          className="comparison-performance-table-wrap"
          role="region"
          aria-label="Adjusted-price performance and history coverage"
          tabIndex={0}
        >
          <table className="comparison-performance-table">
            <caption>
              {result.status === "available"
                ? "Adjusted-price change and maximum drawdown on shared observations; adjusted closes in USD and loaded history coverage."
                : "Loaded history coverage; percentage changes are unavailable without a shared window."}
            </caption>
            <thead>
              <tr>
                <th scope="col">Company</th>
                {result.status === "available" && (
                  <>
                    <th scope="col">Adjusted-price change</th>
                    <th scope="col">Maximum drawdown on shared observations</th>
                    <th scope="col">Start adjusted close (USD)</th>
                    <th scope="col">End adjusted close (USD)</th>
                  </>
                )}
                <th scope="col">Loaded history</th>
                <th scope="col">Omitted dates</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const listing = listings.find(
                  (item) => item.listingId === row.listingId,
                );
                return (
                  <tr key={row.listingId}>
                    <th scope="row">
                      {listing?.symbol ?? row.listingId}
                      {listing ? ` · ${listing.exchangeMic}` : ""}
                    </th>
                    {"selectedWindowReturn" in row && (
                      <>
                        <td className="comparison-performance-change">
                          {`${row.selectedWindowReturn.valuePercent}%`}
                        </td>
                        <td>
                          <ComparisonDrawdown metric={row.maximumDrawdown} />
                        </td>
                        <td>{row.firstAdjustedClose}</td>
                        <td>{row.lastAdjustedClose}</td>
                      </>
                    )}
                    <td>
                      <dl className="comparison-performance-coverage">
                        <div>
                          <dt>Requested bounds</dt>
                          <dd>
                            {row.startDate} to {row.endDate}
                          </dd>
                        </div>
                        <div>
                          <dt>Observed bars</dt>
                          <dd>{row.loadedSessionCount}</dd>
                        </div>
                        <div>
                          <dt>First history bar</dt>
                          <dd>{row.observedFirstDate ?? "None"}</dd>
                        </div>
                        <div>
                          <dt>Latest history bar</dt>
                          <dd>{row.observedLastDate ?? "None"}</dd>
                        </div>
                      </dl>
                    </td>
                    <td>{row.excludedSessionCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="market-scope-note">
        Change = (last adjusted close / first adjusted close − 1) × 100. Only
        dates observed for every selected company are included; missing dates
        are not filled. Omitted dates count each company's loaded bars outside
        those shared observations. A requested range does not guarantee full
        coverage. Latest history-bar dates show the history's recency; quote
        freshness does not establish history freshness.
      </p>
      <p className="market-scope-note">
        Maximum drawdown is the largest peak-to-later-trough decline in adjusted
        closes on the shared observations, shown as a nonnegative percentage.
        Omitted or missing observations can hide intervening declines. This is
        not a full daily-history drawdown or a risk score.
      </p>
      <p className="market-scope-note">
        These are provider-adjusted prices, not an independently reconstructed
        total return. Reference quotes above are not used in this calculation.
        This comparison does not produce valuations or trading signals.
      </p>
    </section>
  );
}

function ComparisonDrawdown({
  metric,
}: {
  readonly metric: PersonalPricePerformanceComparisonAvailableRow["maximumDrawdown"];
}) {
  const roundsToZero = metric.valuePercent === "0.0000";
  const noDecline = roundsToZero && metric.peakDate === metric.troughDate;

  return (
    <div className="comparison-performance-drawdown">
      <p>
        <strong>{`${metric.valuePercent}%`}</strong>
        {noDecline
          ? " — no decline observed on shared dates"
          : roundsToZero
            ? " — positive decline rounded to four decimals"
            : null}
      </p>
      {!noDecline && (
        <dl className="comparison-performance-coverage">
          <div>
            <dt>Peak</dt>
            <dd>
              <time dateTime={metric.peakDate}>{metric.peakDate}</time>
            </dd>
          </div>
          <div>
            <dt>Trough</dt>
            <dd>
              <time dateTime={metric.troughDate}>{metric.troughDate}</time>
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
