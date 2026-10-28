import type { AuthoredValuationScenario } from "@research-cockpit/personal-market-analytics";
import type { ValuationNoteModel } from "./valuation-note";
import {
  captureValuationCalculationGuard,
  VALUATION_SCENARIOS,
  type ManagedValuationCalculation,
} from "./managed-valuation-workbench";

export interface ValuationFollowupScenarioSummary {
  readonly model: ValuationNoteModel;
  readonly modelLabel: string;
  readonly modelVersion: string;
  readonly scenario: AuthoredValuationScenario;
  readonly scenarioLabel: string;
  readonly valuePerShareUsd: string;
  readonly text: string;
}
export interface ValuationFollowupScenarioResolution {
  readonly summary: ValuationFollowupScenarioSummary | null;
  readonly reason: string | null;
}
const scenarioLabels = {
  conservative: "Conservative",
  base: "Base",
  expansion: "Expansion",
} as const;
const modelLabels = { dcf: "DCF", exit: "Exit multiple" } as const;
const unavailable =
  "Calculate an available result for the chosen model and scenario before previewing this check.";

/** Read one current, owned authored result without recalculating or rounding it. */
export function resolveValuationFollowupScenario(
  calculation: ManagedValuationCalculation | null,
  model: string,
  scenario: string,
): ValuationFollowupScenarioResolution {
  if (!calculation || !captureValuationCalculationGuard(calculation)?.())
    return { summary: null, reason: unavailable };
  if (model !== "dcf" && model !== "exit")
    return { summary: null, reason: "Choose one valuation model." };
  if (!VALUATION_SCENARIOS.includes(scenario as AuthoredValuationScenario))
    return { summary: null, reason: "Choose one valuation scenario." };
  return selectedScenario(
    calculation,
    model,
    scenario as AuthoredValuationScenario,
  );
}

function selectedScenario(
  calculation: ManagedValuationCalculation,
  model: ValuationNoteModel,
  scenario: AuthoredValuationScenario,
): ValuationFollowupScenarioResolution {
  const result =
    model === "dcf" ? calculation.dcfResult : calculation.exitResult;
  if (result.status !== "available")
    return { summary: null, reason: unavailable };
  const row = result.scenarios[scenario];
  if (row.status !== "available") return { summary: null, reason: unavailable };
  const valuePerShareUsd =
    "valuePerShareUsd" in row ? row.valuePerShareUsd : row.valuePerShare;
  return describeScenario(
    model,
    scenario,
    result.modelVersion,
    valuePerShareUsd,
  );
}

function describeScenario(
  model: ValuationNoteModel,
  scenario: AuthoredValuationScenario,
  modelVersion: string,
  valuePerShareUsd: string,
): ValuationFollowupScenarioResolution {
  const modelLabel = modelLabels[model];
  const scenarioLabel = scenarioLabels[scenario];
  return {
    summary: Object.freeze({
      model,
      modelLabel,
      modelVersion,
      scenario,
      scenarioLabel,
      valuePerShareUsd,
      text: `Authored estimate: ${modelLabel} ${modelVersion}; ${scenarioLabel} scenario; USD/share ${valuePerShareUsd}. Summary only; inputs and source evidence not included.`,
    }),
    reason: null,
  };
}
