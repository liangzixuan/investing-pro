import type {
  MetricDto,
  MetricUnit,
  QualityState,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

import type { FinancialFact } from "./model";

interface MetricSpec {
  key: string;
  label: string;
  category: MetricDto["category"];
  unit: MetricUnit;
  definitionId: string;
  formula: string;
  inputs: string[];
  calculate: (facts: ReadonlyMap<string, FinancialFact>) => Decimal | null;
}

const metricSpecs: MetricSpec[] = [
  rawMetric("revenue", "Revenue", "scale", "USD_MILLIONS"),
  {
    key: "revenue_growth",
    label: "Revenue growth",
    category: "growth",
    unit: "PERCENT",
    definitionId: "metric.revenue-growth",
    formula: "(revenue ÷ prior revenue − 1) × 100",
    inputs: ["revenue", "prior_revenue"],
    calculate: (facts) =>
      binary(facts, "revenue", "prior_revenue", (revenue, prior) =>
        revenue.div(prior).minus(1).mul(100),
      ),
  },
  rawMetric("ebitda", "Adjusted EBITDA", "profitability", "USD_MILLIONS"),
  {
    key: "ebitda_margin",
    label: "EBITDA margin",
    category: "profitability",
    unit: "PERCENT",
    definitionId: "metric.ebitda-margin",
    formula: "adjusted EBITDA ÷ revenue × 100",
    inputs: ["ebitda", "revenue"],
    calculate: (facts) =>
      binary(facts, "ebitda", "revenue", (ebitda, revenue) =>
        ebitda.div(revenue).mul(100),
      ),
  },
  rawMetric("free_cash_flow", "Free cash flow", "cash", "USD_MILLIONS"),
  {
    key: "fcf_margin",
    label: "FCF margin",
    category: "cash",
    unit: "PERCENT",
    definitionId: "metric.fcf-margin",
    formula: "free cash flow ÷ revenue × 100",
    inputs: ["free_cash_flow", "revenue"],
    calculate: (facts) =>
      binary(facts, "free_cash_flow", "revenue", (fcf, revenue) =>
        fcf.div(revenue).mul(100),
      ),
  },
  {
    key: "net_debt",
    label: "Net debt",
    category: "leverage",
    unit: "USD_MILLIONS",
    definitionId: "metric.net-debt",
    formula: "debt − cash",
    inputs: ["debt", "cash"],
    calculate: (facts) =>
      binary(facts, "debt", "cash", (debt, cash) => debt.minus(cash)),
  },
  {
    key: "net_debt_to_ebitda",
    label: "Net debt / EBITDA",
    category: "leverage",
    unit: "RATIO",
    definitionId: "metric.net-debt-to-ebitda",
    formula: "(debt − cash) ÷ adjusted EBITDA",
    inputs: ["debt", "cash", "ebitda"],
    calculate: (facts) => {
      const debt = valueOf(facts, "debt");
      const cash = valueOf(facts, "cash");
      const ebitda = valueOf(facts, "ebitda");
      return debt && cash && ebitda && !ebitda.isZero()
        ? debt.minus(cash).div(ebitda)
        : null;
    },
  },
  rawMetric("diluted_shares", "Diluted shares", "scale", "MILLIONS_SHARES"),
  rawMetric(
    "synthetic_price",
    "Synthetic reference price",
    "market",
    "USD_PER_SHARE",
  ),
];

export function evaluateMetrics(facts: FinancialFact[]): MetricDto[] {
  const factMap = new Map(facts.map((fact) => [fact.key, fact]));

  return metricSpecs.flatMap((spec) => {
    const value = spec.calculate(factMap);
    if (value === null) return [];

    const sourceFacts = spec.inputs.flatMap((key) => {
      const fact = factMap.get(key);
      return fact ? [fact] : [];
    });
    const qualityState: QualityState = sourceFacts.some(
      (fact) => fact.qualityState === "restated_fixture",
    )
      ? "restated_fixture"
      : "verified_fixture";
    const asOf = sourceFacts.reduce(
      (latest, fact) =>
        fact.sourceAvailableAt > latest ? fact.sourceAvailableAt : latest,
      "1970-01-01T00:00:00Z",
    );

    return [
      {
        key: spec.key,
        label: spec.label,
        category: spec.category,
        value: canonicalValue(value, spec.unit),
        displayValue: displayValue(value, spec.unit),
        unit: spec.unit,
        definitionId: spec.definitionId,
        definitionVersion: "1.0.0",
        formula: spec.formula,
        formulaInputs: sourceFacts.map((fact) => fact.id),
        evidenceIds: [...new Set(sourceFacts.map((fact) => fact.evidenceId))],
        qualityState,
        asOf,
      },
    ];
  });
}

function rawMetric(
  key: string,
  label: string,
  category: MetricDto["category"],
  unit: MetricUnit,
): MetricSpec {
  return {
    key,
    label,
    category,
    unit,
    definitionId: `metric.${key.replaceAll("_", "-")}`,
    formula: "Reported synthetic fact",
    inputs: [key],
    calculate: (facts) => valueOf(facts, key),
  };
}

function valueOf(
  facts: ReadonlyMap<string, FinancialFact>,
  key: string,
): Decimal | null {
  const fact = facts.get(key);
  return fact ? new Decimal(fact.value) : null;
}

function binary(
  facts: ReadonlyMap<string, FinancialFact>,
  leftKey: string,
  rightKey: string,
  operation: (left: Decimal, right: Decimal) => Decimal,
): Decimal | null {
  const left = valueOf(facts, leftKey);
  const right = valueOf(facts, rightKey);
  if (!left || !right || right.isZero()) return null;
  return operation(left, right);
}

function canonicalValue(value: Decimal, unit: MetricUnit): string {
  const decimals =
    unit === "USD_PER_SHARE"
      ? 2
      : unit === "PERCENT" || unit === "RATIO"
        ? 2
        : 3;
  return value
    .toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
    .toFixed(decimals);
}

function displayValue(value: Decimal, unit: MetricUnit): string {
  switch (unit) {
    case "USD_MILLIONS":
      return `$${value.toDecimalPlaces(1).toFixed(1)}M`;
    case "USD_PER_SHARE":
      return `$${value.toDecimalPlaces(2).toFixed(2)}`;
    case "MILLIONS_SHARES":
      return `${value.toDecimalPlaces(1).toFixed(1)}M`;
    case "PERCENT":
      return `${value.toDecimalPlaces(1).toFixed(1)}%`;
    case "RATIO":
      return `${value.toDecimalPlaces(1).toFixed(1)}×`;
  }
}
