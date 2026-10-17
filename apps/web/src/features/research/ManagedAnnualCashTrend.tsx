import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import { useId, useState } from "react";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import {
  MANAGED_ANNUAL_CASH_TREND_METRICS,
  cashTrendChartInput,
  cashTrendMetricLabel,
  projectManagedAnnualCashTrend,
  type ManagedAnnualCashTrendMetric,
} from "./managed-annual-cash-trend-input";
import { ManagedAnnualTrendChart } from "./ManagedAnnualTrendChart";

export function ManagedAnnualCashTrend({
  response,
  view,
  open,
}: {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly view: PersonalSecAnnualCanonicalView;
  readonly open: boolean;
}) {
  const id = useId();
  const [metric, setMetric] =
    useState<ManagedAnnualCashTrendMetric>("operatingCashFlow");
  const projection = projectManagedAnnualCashTrend(response, view);
  return (
    <div className="managed-annual-cash-trend">
      <label className="managed-annual-cash-trend-control">
        <span>Cash trend metric</span>
        <select
          id={`${id}-metric`}
          data-cash-trend-metric
          aria-describedby={`${id}-selected-metric`}
          value={metric}
          onChange={(event) => {
            const value = MANAGED_ANNUAL_CASH_TREND_METRICS.find(
              (item) => item === event.currentTarget.value,
            );
            if (value) setMetric(value);
          }}
        >
          {MANAGED_ANNUAL_CASH_TREND_METRICS.map((value) => (
            <option key={value} value={value}>
              {cashTrendMetricLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <p id={`${id}-selected-metric`} data-cash-trend-selected-metric>
        Selected metric: {cashTrendMetricLabel(metric)} ·{" "}
        {metric === "operatingCashFlowLessPpePurchases"
          ? "App calculation"
          : "Reported"}
      </p>
      {projection.status === "unavailable" ? (
        <p role="status" className="managed-annual-unavailable">
          {projection.reason === "insufficient_periods"
            ? "Cash trend unavailable: at least two adjacent annual periods from this filing are required."
            : "Cash trend unavailable. Inspect the cash history explanation below."}
        </p>
      ) : (
        <>
          {open && (
            <ManagedAnnualTrendChart
              input={cashTrendChartInput(projection, metric)}
            />
          )}
          <p className="managed-annual-basis-help">
            Same-filing amounts in USD, oldest to newest. Chart coordinates are
            approximate; exact amounts and dates remain in the table below.
          </p>
        </>
      )}
    </div>
  );
}
