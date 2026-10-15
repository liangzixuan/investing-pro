import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualLiquidityHistory,
  type PersonalSecAnnualLiquidityHistoryBalance,
  type PersonalSecAnnualLiquidityHistoryReason,
} from "@research-cockpit/personal-financial-analytics";
import { annualLiquidityUnavailableReasonText } from "./SecAnnualLiquidity";

export function SecAnnualLiquidityHistory({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const history = resolvePersonalSecAnnualLiquidityHistory(response.evidence);
  const { generation, target } = response.evidence;
  return (
    <details className="managed-annual-liquidity-history">
      <summary>Reported liquidity history</summary>
      {history.status === "unavailable" ? (
        <p className="managed-annual-unavailable">
          Liquidity history unavailable. {historyReason(history.reason)}
        </p>
      ) : (
        <>
          <div
            className="managed-annual-financials managed-liquidity-history-table"
            role="region"
            aria-label="Reported liquidity history balances"
            tabIndex={0}
          >
            <table>
              <caption>
                Reported balances · {history.balances.length}{" "}
                {history.balances.length === 1 ? "date" : "dates"} · newest
                first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  {history.balances.map((balance) => (
                    <th scope="col" key={balance.asOfDate}>
                      <time dateTime={balance.asOfDate}>
                        {balance.asOfDate}
                      </time>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["currentAssets", "Current assets"],
                    ["currentLiabilities", "Current liabilities"],
                  ] as const
                ).map(([key, label]) => (
                  <tr key={key}>
                    <th scope="row">
                      {label}
                      <small>Reported · USD</small>
                    </th>
                    {history.balances.map((balance) => (
                      <td key={balance.asOfDate}>{balance[key]}</td>
                    ))}
                  </tr>
                ))}
                {(
                  [
                    ["workingCapital", "Working capital", "USD"],
                    ["currentRatio", "Current ratio", "multiple"],
                  ] as const
                ).map(([key, label, unit]) => (
                  <tr key={key}>
                    <th scope="row">
                      {label}
                      <small>App calculation · {unit}</small>
                    </th>
                    {history.balances.map((balance) => (
                      <td key={balance.asOfDate}>
                        <Calculation value={balance[key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.stopped !== null && (
            <p className="managed-annual-unavailable">
              History stops at reported balance date{" "}
              <time dateTime={history.stopped.asOfDate}>
                {history.stopped.asOfDate}
              </time>
              . {historyReason(history.stopped.reason)} Older dates are not
              substituted.
            </p>
          )}
          <p className="managed-annual-basis-help">
            Up to three reported balance dates from filing{" "}
            {history.accessionNumber}. Selected filing report date{" "}
            {target.status === "target" ? (
              <time dateTime={target.reportDate ?? undefined}>
                {target.reportDate ?? "Unavailable"}
              </time>
            ) : (
              "Unavailable"
            )}
            . These dates need not be consecutive fiscal year-ends. Earlier
            dates are historical comparatives in this filing. Date gaps,
            accounting changes and restatements are unadjusted. These balances
            do not establish a complete timeline, as-originally-filed history or
            a forecast.
          </p>
          <p className="managed-annual-basis-help">
            Working capital subtracts current liabilities from current assets.
            Current ratio divides current assets by positive current
            liabilities, rounded to two decimal places, half up. Both
            calculations require nonnegative balances from the same filing and
            date. A refused calculation does not hide reported balances.
          </p>
          <p className="managed-annual-basis-help">
            Original Annual cutoff {generation.cutoffAt}. Company Facts captured{" "}
            {generation.sources.companyFacts.fetchedAt ?? "Unavailable"}.
            Submissions captured{" "}
            {generation.sources.submissions.fetchedAt ?? "Unavailable"}.
            Original load completed {generation.completedAt}. Opening history
            does not refresh the sources.
          </p>
          <details className="managed-liquidity-history-references">
            <summary>History calculation references</summary>
            <p>
              These original observations appear in Liquidity sources and
              calculation inputs.
            </p>
            <dl>
              {history.balances.map((balance) => (
                <div key={balance.asOfDate}>
                  <dt>
                    <time dateTime={balance.asOfDate}>{balance.asOfDate}</time>
                  </dt>
                  <dd>{balance.observationIds.join(" · ")}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </details>
  );
}

function Calculation({
  value,
}: {
  readonly value:
    | PersonalSecAnnualLiquidityHistoryBalance["workingCapital"]
    | PersonalSecAnnualLiquidityHistoryBalance["currentRatio"];
}) {
  return value.status === "available" ? (
    <>
      {value.value}
      {value.unit === "multiple" ? "×" : ""}
    </>
  ) : (
    <span className="managed-annual-unavailable">
      Unavailable. {annualLiquidityUnavailableReasonText(value.reason)}
    </span>
  );
}

function historyReason(
  reason: PersonalSecAnnualLiquidityHistoryReason,
): string {
  if (reason === "current_use_unavailable")
    return "The selected liquidity report is outside the current-use limits at this load. Reported amounts remain above.";
  if (reason === "no_report_date")
    return "One or both reported balances are missing at the required date.";
  if (reason === "report_end_mismatch")
    return "A balance date is after the selected report date, or its filing report date does not match the selected filing.";
  return annualLiquidityUnavailableReasonText(reason);
}
