import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { useState } from "react";
import { ManagedAnnualCashTrend } from "./ManagedAnnualCashTrend";
import { type PersonalSecAnnualCashHistoryReason } from "@research-cockpit/personal-financial-analytics";
import { annualCashUnavailableReasonText } from "./SecAnnualCashGeneration";

export function SecAnnualCashHistory({
  response,
  view,
}: {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly view: PersonalSecAnnualCanonicalView;
}) {
  const [open, setOpen] = useState(false);
  const history = view.cashGeneration.history;
  return (
    <details
      className="managed-annual-cash-history"
      onToggle={(event) => {
        if (event.target === event.currentTarget)
          setOpen(event.currentTarget.open);
      }}
    >
      <summary>Reported cash history</summary>
      <ManagedAnnualCashTrend response={response} view={view} open={open} />
      {history.status === "unavailable" ? (
        <p className="managed-annual-unavailable">
          Cash history unavailable. {historyReason(history.reason)}
        </p>
      ) : (
        <>
          <div
            className="managed-annual-financials managed-cash-history-table"
            role="region"
            aria-label="Reported cash history amounts"
            tabIndex={0}
          >
            <table>
              <caption>
                Annual cash amounts · {history.periods.length}{" "}
                {history.periods.length === 1 ? "period" : "periods"} · newest
                first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Metric · USD</th>
                  {history.periods.map((period) => (
                    <th scope="col" key={period.endDate}>
                      <time dateTime={period.startDate}>
                        {period.startDate}
                      </time>
                      <span>to</span>
                      <time dateTime={period.endDate}>{period.endDate}</time>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["operatingCashFlow", "Operating cash flow", "Reported"],
                    ["ppePurchases", "PP&E purchases", "Reported"],
                    [
                      "operatingCashFlowLessPpePurchases",
                      "Operating cash flow less PP&E purchases",
                      "App calculation",
                    ],
                  ] as const
                ).map(([key, label, basis]) => (
                  <tr key={key}>
                    <th scope="row">
                      {label}
                      <small>{basis}</small>
                    </th>
                    {history.periods.map((period) => (
                      <td key={period.endDate}>{period[key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.stoppedReason !== null && (
            <p className="managed-annual-unavailable">
              The next earlier period is unavailable.{" "}
              {historyReason(history.stoppedReason)}
            </p>
          )}
          <p className="managed-annual-basis-help">
            Up to three adjacent annual periods from filing{" "}
            {history.accessionNumber}. Earlier periods are historical
            comparatives in this filing. Period lengths, accounting changes and
            restatements are unadjusted. These amounts do not establish
            as-originally-filed history or a forecast.
          </p>
          <p className="managed-annual-basis-help">
            Original load completed {response.evidence.generation.completedAt}.
            Opening history does not refresh the sources.
          </p>
          <details className="managed-cash-history-references">
            <summary>History calculation references</summary>
            <p>
              Original observations remain in Cash sources and calculation
              inputs.
            </p>
            <dl>
              {history.periods.map((period) => (
                <div key={period.endDate}>
                  <dt>
                    {period.startDate} to {period.endDate}
                  </dt>
                  <dd>{period.observationIds.join(" · ")}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </details>
  );
}

function historyReason(reason: PersonalSecAnnualCashHistoryReason): string {
  if (reason === "current_use_unavailable")
    return "The selected cash report is outside the current-use limits at this load. Reported amounts remain above.";
  if (reason === "no_report_period")
    return "One or both cash inputs are missing for the required annual period. Older periods are not substituted.";
  if (reason === "report_end_mismatch")
    return "The observation’s filing report date does not match the selected filing.";
  return annualCashUnavailableReasonText(reason);
}
