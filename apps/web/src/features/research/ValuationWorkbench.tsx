"use client";

import type {
  DossierDto,
  ValuationInputDto,
} from "@research-cockpit/contracts";
import { calculateValuation } from "@research-cockpit/research-core";
import { useEffect, useMemo, useState } from "react";

import type { EvidenceSelection } from "./evidence-selection";

const scenarioDefaults = {
  conservative: {
    annualRevenueGrowthPercent: "5.0",
    targetEbitdaMarginPercent: "17.0",
    discountRatePercent: "13.0",
    exitMultiple: "9.0",
  },
  base: {
    annualRevenueGrowthPercent: "10.0",
    targetEbitdaMarginPercent: "20.0",
    discountRatePercent: "10.0",
    exitMultiple: "12.0",
  },
  expansion: {
    annualRevenueGrowthPercent: "15.0",
    targetEbitdaMarginPercent: "24.0",
    discountRatePercent: "9.0",
    exitMultiple: "14.0",
  },
} as const;

export function ValuationWorkbench({
  dossier,
  onInspect,
}: {
  dossier: DossierDto;
  onInspect: (selection: EvidenceSelection) => void;
}) {
  const [inputs, setInputs] = useState<ValuationInputDto>(() =>
    toInputs(dossier),
  );
  useEffect(() => setInputs(toInputs(dossier)), [dossier]);

  const valuation = useMemo(() => {
    try {
      return calculateValuation(inputs);
    } catch {
      return null;
    }
  }, [inputs]);
  const referencePrice = dossier.metrics.find(
    (metric) => metric.key === "synthetic_price",
  );

  const update = (field: keyof ValuationInputDto, value: string | number) =>
    setInputs((current) => ({ ...current, [field]: value }));
  const selectScenario = (scenario: keyof typeof scenarioDefaults) =>
    setInputs((current) => ({ ...current, ...scenarioDefaults[scenario] }));

  return (
    <section
      className="workspace-section"
      id="value"
      aria-labelledby="valuation-title"
    >
      <div className="section-heading split-heading">
        <div>
          <p className="section-number">02 · Value</p>
          <h2 id="valuation-title">Make the assumptions visible.</h2>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() =>
            onInspect({
              title: "Valuation source inputs",
              formula:
                "Exit-multiple model v1; all editable assumptions are hypothetical",
              formulaInputs: ["base revenue", "cash", "debt", "diluted shares"],
              evidenceIds: dossier.valuationDefaults.evidenceIds,
            })
          }
        >
          Inspect source inputs
        </button>
      </div>
      <div className="valuation-layout">
        <div className="assumption-panel">
          <div
            className="scenario-switch"
            aria-label="Valuation scenario presets"
          >
            {(["conservative", "base", "expansion"] as const).map(
              (scenario) => (
                <button
                  type="button"
                  key={scenario}
                  onClick={() => selectScenario(scenario)}
                >
                  {scenario}
                </button>
              ),
            )}
          </div>
          <div className="input-grid">
            <NumberField
              label="Annual revenue growth"
              suffix="%"
              value={inputs.annualRevenueGrowthPercent}
              onChange={(value) => update("annualRevenueGrowthPercent", value)}
            />
            <NumberField
              label="Target EBITDA margin"
              suffix="%"
              value={inputs.targetEbitdaMarginPercent}
              onChange={(value) => update("targetEbitdaMarginPercent", value)}
            />
            <NumberField
              label="Discount rate"
              suffix="%"
              value={inputs.discountRatePercent}
              onChange={(value) => update("discountRatePercent", value)}
            />
            <NumberField
              label="Exit multiple"
              suffix="×"
              value={inputs.exitMultiple}
              onChange={(value) => update("exitMultiple", value)}
            />
            <NumberField
              label="Horizon"
              suffix="years"
              value={String(inputs.horizonYears)}
              onChange={(value) => update("horizonYears", Number(value))}
              min="1"
              max="10"
              step="1"
            />
          </div>
          <p className="field-note">
            Base revenue, cash, debt, and shares come from the selected
            synthetic known-time view. Assumptions do not constitute a price
            target.
          </p>
        </div>
        <div className="valuation-result" aria-live="polite">
          <p>Hypothetical value per share</p>
          <strong>{valuation ? `$${valuation.valuePerShare}` : "—"}</strong>
          {referencePrice && (
            <span>
              Synthetic reference price: {referencePrice.displayValue}
            </span>
          )}
          <div className="result-bridge">
            <div>
              <span>Year {inputs.horizonYears} revenue</span>
              <b>{valuation ? `$${valuation.yearNRevenue}M` : "—"}</b>
            </div>
            <div>
              <span>Year {inputs.horizonYears} EBITDA</span>
              <b>{valuation ? `$${valuation.yearNEbitda}M` : "—"}</b>
            </div>
            <div>
              <span>Present enterprise value</span>
              <b>{valuation ? `$${valuation.presentEnterpriseValue}M` : "—"}</b>
            </div>
          </div>
          {valuation && (
            <details>
              <summary>Show formula trace</summary>
              <ol className="formula-trace">
                {valuation.formulaTrace.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  min = "-50",
  max = "100",
  step = "0.5",
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(event.target.value)}
        />
        <em>{suffix}</em>
      </div>
    </label>
  );
}

function toInputs(dossier: DossierDto): ValuationInputDto {
  return {
    baseRevenue: dossier.valuationDefaults.baseRevenue,
    cash: dossier.valuationDefaults.cash,
    debt: dossier.valuationDefaults.debt,
    dilutedShares: dossier.valuationDefaults.dilutedShares,
    annualRevenueGrowthPercent:
      scenarioDefaults.base.annualRevenueGrowthPercent,
    targetEbitdaMarginPercent: scenarioDefaults.base.targetEbitdaMarginPercent,
    discountRatePercent: scenarioDefaults.base.discountRatePercent,
    exitMultiple: scenarioDefaults.base.exitMultiple,
    horizonYears: 5,
  };
}
