import type {
  PersonalSecQuarterlyObservationDto,
  PersonalSecAnnualCashObservationDto,
  PersonalSecAnnualOperatingObservationDto,
} from "@research-cockpit/contracts";

export function ObservationDetails({
  row,
}: {
  readonly row:
    | PersonalSecQuarterlyObservationDto
    | PersonalSecAnnualCashObservationDto
    | PersonalSecAnnualOperatingObservationDto;
}) {
  return (
    <details className="sec-quarterly-row-details">
      <summary>
        {row.concept} · {row.startDate ?? "Unknown start"} to {row.endDate} ·{" "}
        {row.value} USD
      </summary>
      <dl className="sec-quarterly-comparison-coordinates">
        <div>
          <dt>Exact USD observation</dt>
          <dd>{row.value}</dd>
        </div>
        <div>
          <dt>Inclusive duration</dt>
          <dd>
            {row.durationDays === null ? "Unknown" : `${row.durationDays} days`}
          </dd>
        </div>
        <div>
          <dt>Filing focus, not observation year</dt>
          <dd>
            {row.filingFocusYear ?? "Unknown"} ·{" "}
            {row.filingFocusPeriod ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Calendar frame</dt>
          <dd>{row.frame ?? "Not supplied"}</dd>
        </div>
        <div>
          <dt>Reported form / filed date</dt>
          <dd>
            {row.form} · {row.filedDate}
          </dd>
        </div>
        <div>
          <dt>Accession</dt>
          <dd>{row.accessionNumber}</dd>
        </div>
        <div>
          <dt>Joined filing metadata</dt>
          <dd>
            {row.filing.status === "matched"
              ? "Matched to current submissions"
              : "Filing metadata conflict"}{" "}
            · {row.filing.form} · {row.filing.filedDate}
          </dd>
        </div>
        <div>
          <dt>Joined report / accepted time</dt>
          <dd>
            {row.filing.reportDate ?? "Unknown"} ·{" "}
            {row.filing.acceptedAt ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Company Facts source pointer</dt>
          <dd>{row.sourceLocator}</dd>
        </div>
        <div>
          <dt>Observation identifier</dt>
          <dd>{row.id}</dd>
        </div>
      </dl>
    </details>
  );
}
