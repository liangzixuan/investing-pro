import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import { balanceSheetHistoryReason } from "./sec-annual-balance-sheet-history-display";

const metrics = [
  ["totalAssets", "Total assets change"],
  ["totalLiabilities", "Total liabilities change"],
  ["shareholdersEquity", "Parent equity change"],
] as const;

export function SecAnnualBalanceSheetChange({
  change,
}: {
  readonly change: PersonalSecAnnualCanonicalView["balanceSheet"]["change"];
}) {
  return (
    <section
      className="managed-annual-balance-sheet-change"
      aria-label="Reported balance sheet change"
    >
      <h6>Reported balance sheet change</h6>
      {change.status === "unavailable" ? (
        <p className="managed-annual-unavailable">
          Balance sheet change unavailable.{" "}
          {balanceSheetHistoryReason(change.reason)}
        </p>
      ) : (
        <>
          <p className="managed-annual-basis-help">
            Prior:{" "}
            {change.priorDate === null ? (
              "No earlier reported date."
            ) : (
              <>
                <time dateTime={change.priorDate}>{change.priorDate}</time>.
              </>
            )}{" "}
            Current:{" "}
            <time dateTime={change.currentDate}>{change.currentDate}</time>.
          </p>
          <dl>
            {metrics.map(([key, label]) => {
              const value = change[key];
              return (
                <div key={key} data-balance-change={key}>
                  <dt>
                    {label} · USD<small>App calculation</small>
                  </dt>
                  <dd>
                    {value.status === "available" ? (
                      <span className="managed-balance-sheet-change-amount">
                        {value.difference}
                      </span>
                    ) : (
                      <span className="managed-annual-unavailable">
                        Unavailable.{" "}
                        {value.current.status === "unavailable" && (
                          <span>
                            Current amount:{" "}
                            {balanceSheetHistoryReason(
                              value.current.reason,
                            )}{" "}
                          </span>
                        )}
                        {value.prior === null ? (
                          <span>No earlier reported date.</span>
                        ) : value.prior.status === "unavailable" ? (
                          <span>
                            Prior amount:{" "}
                            {balanceSheetHistoryReason(value.prior.reason)}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="managed-annual-basis-help">
            Current minus prior, using the first two displayed dates. Signed USD
            differences, checked independently for each measure. Older dates do
            not replace missing or refused inputs.
          </p>
        </>
      )}
    </section>
  );
}
