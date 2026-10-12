import { useId, useState } from "react";
import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualEvidenceResponseDto,
  type PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import {
  MANAGED_ANNUAL_TREND_METRICS,
  projectManagedAnnualTrend,
  type ManagedAnnualTrendMetric,
  type ManagedAnnualTrendProjection,
} from "./managed-annual-trend-input";
import { ManagedAnnualTrendChart } from "./ManagedAnnualTrendChart";

export function ManagedAnnualTrend({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [concept, setConcept] = useState(() => initialConcept(response));
  const [metric, setMetric] = useState<ManagedAnnualTrendMetric>("revenue");
  const projection = projectManagedAnnualTrend(response, concept);
  return (
    <details
      className="managed-annual-trend"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Reported annual trend</summary>
      <TrendControls
        id={id}
        concept={concept}
        metric={metric}
        onConcept={setConcept}
        onMetric={setMetric}
      />
      <TrendResult projection={projection} metric={metric} open={open} />
      <p className="managed-annual-basis-help">
        Same-filing reported amounts in USD, oldest to newest. Period lengths,
        accounting changes and restatements are unadjusted. Chart coordinates
        are approximate; exact amounts and dates remain in the tables below.
      </p>
    </details>
  );
}

function initialConcept(response: PersonalSecAnnualEvidenceResponseDto) {
  const bases = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) => ({
    concept,
    projection: projectManagedAnnualTrend(response, concept),
  }));
  return (
    bases.find(({ projection }) => projection.status === "ready")?.concept ??
    bases.find(
      ({ projection }) =>
        projection.status === "unavailable" &&
        projection.reason !== "current_report_unavailable",
    )?.concept ??
    PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS[0]
  );
}

function TrendControls({
  id,
  concept,
  metric,
  onConcept,
  onMetric,
}: {
  readonly id: string;
  readonly concept: PersonalSecAnnualRevenueConcept;
  readonly metric: ManagedAnnualTrendMetric;
  readonly onConcept: (value: PersonalSecAnnualRevenueConcept) => void;
  readonly onMetric: (value: ManagedAnnualTrendMetric) => void;
}) {
  return (
    <div className="managed-annual-trend-controls">
      <label>
        <span>Revenue basis</span>
        <select
          id={`${id}-basis`}
          data-annual-trend-basis
          value={concept}
          onChange={(event) => {
            const value = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.find(
              (item) => item === event.currentTarget.value,
            );
            if (value) onConcept(value);
          }}
        >
          {PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Trend metric</span>
        <select
          id={`${id}-metric`}
          data-annual-trend-metric
          value={metric}
          onChange={(event) => {
            const value = MANAGED_ANNUAL_TREND_METRICS.find(
              (item) => item === event.currentTarget.value,
            );
            if (value) onMetric(value);
          }}
        >
          <option value="revenue">Revenue</option>
          <option value="net_income">Net income</option>
        </select>
      </label>
    </div>
  );
}

function TrendResult({
  projection,
  metric,
  open,
}: {
  readonly projection: ManagedAnnualTrendProjection;
  readonly metric: ManagedAnnualTrendMetric;
  readonly open: boolean;
}) {
  if (projection.status === "unavailable")
    return (
      <p role="status" className="managed-annual-unavailable">
        {unavailableMessage(projection.reason)}
      </p>
    );
  return (
    <>
      <p className="managed-annual-trend-source">
        {projection.concept} · {projection.periods.length} periods · filing{" "}
        {projection.accessionNumber} · loaded{" "}
        <time dateTime={projection.completedAt}>{projection.completedAt}</time>
      </p>
      {open && (
        <ManagedAnnualTrendChart projection={projection} metric={metric} />
      )}
      {projection.stoppedReason && (
        <p className="managed-annual-basis-help">
          An earlier period could not be admitted. The named basis below
          explains the available history; the chart includes only its admitted
          periods.
        </p>
      )}
    </>
  );
}

function unavailableMessage(
  reason: Extract<
    ManagedAnnualTrendProjection,
    { status: "unavailable" }
  >["reason"],
) {
  if (reason === "current_use_unavailable")
    return "Trend unavailable under the current-use policy at this load. Valid historical amounts may remain in the table below.";
  if (reason === "insufficient_periods")
    return "Trend unavailable: at least two adjacent annual periods from this filing are required. The table below retains the admitted amounts and history explanation.";
  return "Trend unavailable: this revenue basis has no valid current annual pair. Choose another basis or inspect its explanation below.";
}
