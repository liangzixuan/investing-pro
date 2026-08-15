import type { MetricDto } from "@research-cockpit/contracts";

import type { EvidenceSelection } from "./evidence-selection";

export function MetricGrid({
  metrics,
  onInspect,
}: {
  metrics: MetricDto[];
  onInspect: (selection: EvidenceSelection) => void;
}) {
  return (
    <div className="metric-grid">
      {metrics.map((metric) => (
        <button
          className="metric-card"
          type="button"
          key={metric.key}
          onClick={() =>
            onInspect({
              title: metric.label,
              formula: metric.formula,
              formulaInputs: metric.formulaInputs,
              evidenceIds: metric.evidenceIds,
            })
          }
          aria-label={`Inspect evidence and formula for ${metric.label}`}
        >
          <span className="metric-label">{metric.label}</span>
          <strong>{metric.displayValue}</strong>
          <span className="metric-meta">
            <span
              className={
                metric.qualityState === "restated_fixture"
                  ? "status-restated"
                  : "status-verified"
              }
            >
              {metric.qualityState === "restated_fixture"
                ? "Restated"
                : "Verified fixture"}
            </span>
            <span aria-hidden="true">↗</span>
          </span>
        </button>
      ))}
    </div>
  );
}
