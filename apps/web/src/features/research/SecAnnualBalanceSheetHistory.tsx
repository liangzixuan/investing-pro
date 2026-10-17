import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { SecAnnualBalanceSheetChange } from "./SecAnnualBalanceSheetChange";
import { balanceSheetHistoryReason } from "./sec-annual-balance-sheet-history-display";

const metrics = [
  ["totalAssets", "Total assets"],
  ["totalLiabilities", "Total liabilities"],
  ["shareholdersEquity", "Shareholders’ equity · parent"],
] as const;

export function SecAnnualBalanceSheetHistory({
  response,
  view,
}: {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly view: PersonalSecAnnualCanonicalView;
}) {
  const { generation, target } = response.evidence;
  const history = view.balanceSheet.history;
  return (
    <details className="managed-annual-balance-sheet-history">
      <summary>Reported balance sheet history</summary>
      {history.status === "unavailable" ? (
        <p className="managed-annual-unavailable">
          Balance sheet history unavailable.{" "}
          {balanceSheetHistoryReason(history.reason)}
        </p>
      ) : (
        <>
          <div
            className="managed-annual-financials managed-balance-sheet-history-table"
            role="region"
            aria-label="Reported balance sheet history amounts"
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
                {metrics.map(([key, label]) => (
                  <tr key={key}>
                    <th scope="row">
                      {label}
                      <small>Reported · USD</small>
                    </th>
                    {history.balances.map((balance) => {
                      const value = balance[key];
                      return (
                        <td key={balance.asOfDate}>
                          {value.status === "available" ? (
                            <span className="managed-balance-sheet-history-amount">
                              {value.value}
                            </span>
                          ) : (
                            <span className="managed-annual-unavailable">
                              Unavailable.{" "}
                              {balanceSheetHistoryReason(value.reason)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SecAnnualBalanceSheetChange change={view.balanceSheet.change} />
          <p className="managed-annual-basis-help">
            Up to three reported dates from filing {history.accessionNumber}.
            Selected filing report date{" "}
            {target.status === "target" ? target.reportDate : "Unavailable"}.
            Each amount is checked independently; a missing or refused amount
            does not hide the other cells. Parent equity excludes noncontrolling
            interests. No balance equation or ratio is inferred.
          </p>
          <p className="managed-annual-basis-help">
            Earlier dates are historical comparatives in this filing, not
            current-use values. Dates need not be consecutive fiscal year-ends.
            Gaps, accounting changes and restatements are unadjusted. This is
            not a complete timeline, as-originally-filed history or a forecast.
          </p>
          <p className="managed-annual-basis-help">
            Original Annual cutoff {generation.cutoffAt}. Company Facts captured{" "}
            {generation.sources.companyFacts.fetchedAt ?? "Unavailable"}.
            Submissions captured{" "}
            {generation.sources.submissions.fetchedAt ?? "Unavailable"}.
            Original load completed {generation.completedAt}. Opening history
            does not refresh the sources.
          </p>
          <details className="managed-balance-sheet-history-references">
            <summary>History source references</summary>
            <p>
              These original observations appear in Balance sheet sources and
              reported inputs. References on a refused cell identify the inputs
              that caused its refusal; a missing cell has none.
            </p>
            <dl>
              {history.balances.map((balance) => (
                <div key={balance.asOfDate}>
                  <dt>
                    <time dateTime={balance.asOfDate}>{balance.asOfDate}</time>
                  </dt>
                  <dd>
                    {metrics.map(([key, label]) => (
                      <p key={key} data-balance-history-references={key}>
                        {label}:{" "}
                        {balance[key].observationIds.join(" · ") || "None"}
                      </p>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </details>
  );
}
