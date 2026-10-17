import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type {
  PersonalSecAnnualCanonicalResponseDto,
  PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import {
  SecAnnualOperatingChange,
  annualOperatingHistoryReasonText,
} from "./SecAnnualOperatingChange";
import { managedAnnualBasisLabel } from "./managed-annual-basis-label";

export function SecAnnualOperatingHistory({
  response,
  view,
  concept,
}: {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly view: PersonalSecAnnualCanonicalView;
  readonly concept: PersonalSecAnnualRevenueConcept;
}) {
  const history = view.operatingResults.bases.find(
    (basis) => basis.concept === concept,
  )!.history;
  return (
    <details
      className="managed-annual-operating-history"
      aria-label={`Reported operating history ${concept}`}
    >
      <summary>Reported operating history</summary>
      {history.status === "unavailable" ? (
        <p className="managed-annual-unavailable">
          Operating history unavailable.{" "}
          {annualOperatingHistoryReasonText(history.reason)}
        </p>
      ) : (
        <div
          className="managed-annual-financials managed-operating-history-table"
          role="region"
          aria-label={`Reported operating history amounts ${concept}`}
          tabIndex={0}
        >
          <table>
            <caption>
              {managedAnnualBasisLabel(concept)} · {history.periods.length}{" "}
              {history.periods.length === 1 ? "period" : "periods"} · newest
              first
            </caption>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {history.periods.map((period) => (
                  <th scope="col" key={period.endDate}>
                    <time dateTime={period.startDate}>{period.startDate}</time>
                    <span>to</span>
                    <time dateTime={period.endDate}>{period.endDate}</time>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["operatingIncome", "Operating income · USD", "Reported"],
                  ["revenue", "Revenue · USD", "Reported"],
                  [
                    "operatingMarginPercent",
                    "Operating margin · %",
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
                    <td key={period.endDate}>
                      {period[key]}
                      {key === "operatingMarginPercent" ? "%" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SecAnnualOperatingChange
        response={response}
        view={view}
        concept={concept}
      />
      {history.status === "available" && (
        <>
          {history.stoppedReason !== null && (
            <p className="managed-annual-unavailable">
              The next earlier period is unavailable.{" "}
              {annualOperatingHistoryReasonText(history.stoppedReason)}
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
            Operating margin divides reported operating income by this named
            positive revenue, multiplied by 100 and rounded to two decimal
            places, half up. Original load completed{" "}
            {response.evidence.generation.completedAt}. Opening history does not
            refresh the sources.
          </p>
          <details className="managed-operating-history-references">
            <summary>History calculation references</summary>
            <p>
              These original observations also appear in Operating sources and
              calculation inputs.
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
