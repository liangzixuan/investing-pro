import type {
  PersonalPricePerformanceComparisonAvailableRow,
  PersonalPricePerformanceComparisonRow,
} from "@research-cockpit/personal-market-analytics";

import type { MarketCohortComparisonModel } from "./market-cohort-comparison";

export interface MarketCohortComparisonProps {
  readonly model: MarketCohortComparisonModel;
  readonly cohortName: string;
}

const unavailableMessages = {
  single_member: "Choose and load at least two listings to compare this board.",
  incomplete_cohort:
    "Comparison unavailable. Every listing in this board needs a successful, matching price history. No subset was compared.",
  invalid_snapshot:
    "Comparison unavailable. The loaded cohort or its price histories could not be verified.",
} as const;

export function MarketCohortComparison({
  model,
  cohortName,
}: MarketCohortComparisonProps) {
  if (model === null) return null;

  return (
    <section
      className="markets-cohort-comparison"
      aria-labelledby="markets-cohort-comparison-title"
    >
      <h2 id="markets-cohort-comparison-title">Compare this board</h2>
      <p className="markets-cohort-name">{cohortName}</p>
      {model.status === "unavailable" ? (
        <p role="status">{unavailableMessages[model.reason]}</p>
      ) : (
        <>
          {model.status === "available" ? (
            <>
              <p className="markets-cohort-window">
                Shared window: <DateLabel value={model.comparison.firstDate} />
                {" to "}
                <DateLabel value={model.comparison.lastDate} />
                {" · "}
                {model.comparison.sharedSessionCount} shared observations.
              </p>
              <table className="markets-cohort-table">
                <caption>
                  All {model.members.length} loaded listings in original cohort
                  order. Percentages use the shared observations.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Listing</th>
                    <th scope="col">Adjusted-price change</th>
                    <th scope="col">Maximum drawdown</th>
                  </tr>
                </thead>
                <tbody>
                  {model.comparison.rows.map((row, index) => {
                    const member = model.members[index];
                    return (
                      <tr key={row.listingId}>
                        <th scope="row">
                          {member?.symbol}
                          <span>{member?.exchangeMic}</span>
                          <span className="markets-cohort-security">
                            {member?.securityName}
                          </span>
                        </th>
                        <td>{row.selectedWindowReturn.valuePercent}%</td>
                        <td>
                          {row.maximumDrawdown.valuePercent}%
                          <DrawdownExplanation row={row} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <p role="status">
              Comparison needs at least two dates observed for every listing;{" "}
              {model.comparison.sharedSessionCount} shared observations loaded.
              {model.comparison.firstDate !== null && (
                <>
                  {" "}
                  Shared date: <DateLabel value={model.comparison.firstDate} />.
                </>
              )}
            </p>
          )}
          <details className="markets-cohort-details">
            <summary>History coverage and calculation details</summary>
            <div className="markets-cohort-coverage">
              {model.comparison.rows.map((row, index) => {
                const member = model.members[index];
                return (
                  <section key={row.listingId}>
                    <h3>
                      {member?.symbol} · {member?.exchangeMic}
                    </h3>
                    <Coverage row={row} />
                  </section>
                );
              })}
            </div>
            <p>
              Change = (last adjusted close / first adjusted close − 1) × 100.
              Results are rounded to four decimal places. Drawdown is the
              largest peak-to-later-trough decline in adjusted closes on shared
              dates, expressed as a nonnegative percentage.
            </p>
            <p>
              Omitted dates are loaded observations outside the shared window's
              date set. Missing dates are not filled. A requested 1M range does
              not guarantee a full month of observations. Omitted or missing
              observations can hide intervening declines.
            </p>
          </details>
          <p className="markets-cohort-limits">
            Tiingo provider-adjusted prices from this loaded board. This is not
            an independently reconstructed total return or a full daily-history
            drawdown. No additional data is loaded for this comparison.
          </p>
        </>
      )}
    </section>
  );
}

function DateLabel({ value }: { readonly value: string | null }) {
  return value === null ? <>None</> : <time dateTime={value}>{value}</time>;
}

function DrawdownExplanation({
  row,
}: {
  readonly row: PersonalPricePerformanceComparisonAvailableRow;
}) {
  if (row.maximumDrawdown.valuePercent !== "0.0000") return null;
  return (
    <small>
      {row.maximumDrawdown.peakDate === row.maximumDrawdown.troughDate
        ? "No decline observed on shared dates"
        : "Positive decline rounded to four decimals"}
    </small>
  );
}

function Coverage({
  row,
}: {
  readonly row:
    | PersonalPricePerformanceComparisonRow
    | PersonalPricePerformanceComparisonAvailableRow;
}) {
  return (
    <dl>
      <div>
        <dt>Requested bounds</dt>
        <dd>
          <DateLabel value={row.startDate} /> to{" "}
          <DateLabel value={row.endDate} />
        </dd>
      </div>
      <div>
        <dt>Observed bars</dt>
        <dd>{row.loadedSessionCount}</dd>
      </div>
      <div>
        <dt>First / latest observed dates</dt>
        <dd>
          <DateLabel value={row.observedFirstDate} /> /{" "}
          <DateLabel value={row.observedLastDate} />
        </dd>
      </div>
      <div>
        <dt>Omitted dates</dt>
        <dd>{row.excludedSessionCount}</dd>
      </div>
      {"firstAdjustedClose" in row && (
        <>
          <div>
            <dt>First / last shared adjusted close (USD)</dt>
            <dd>
              {row.firstAdjustedClose} / {row.lastAdjustedClose}
            </dd>
          </div>
          <div>
            <dt>Drawdown peak / trough</dt>
            <dd>
              {row.maximumDrawdown.valuePercent === "0.0000" &&
              row.maximumDrawdown.peakDate ===
                row.maximumDrawdown.troughDate ? (
                "No decline observed on shared dates"
              ) : (
                <>
                  <DateLabel value={row.maximumDrawdown.peakDate} /> /{" "}
                  <DateLabel value={row.maximumDrawdown.troughDate} />
                </>
              )}
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}
