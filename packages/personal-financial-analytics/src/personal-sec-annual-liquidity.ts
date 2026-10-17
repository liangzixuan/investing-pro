import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  type PersonalSecAnnualLiquidityResolutionDto,
  type PersonalSecAnnualLiquidityResolutionInput,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualLiquidityCore,
  resolvePersonalSecAnnualLiquidityHistoryCore,
  type PersonalSecAnnualLiquidityHistory,
} from "./personal-sec-annual-liquidity-core";
export type {
  PersonalSecAnnualLiquidityHistoryReason,
  PersonalSecAnnualLiquidityHistoryCalculation,
  PersonalSecAnnualLiquidityHistoryBalance,
  PersonalSecAnnualLiquidityHistory,
} from "./personal-sec-annual-liquidity-core";

type Input = PersonalSecAnnualLiquidityResolutionInput;

/** Admit the version-5 metric tags before using the protocol-independent kernel. */
function admit(input: Input): "invalid_clock" | null {
  for (const [metric, expected] of [
    [input.liquidity.currentAssets, "current_assets"],
    [input.liquidity.currentLiabilities, "current_liabilities"],
  ] as const)
    for (const row of metric.observations)
      if (row.metric !== expected)
        throw new TypeError("Invalid annual liquidity evidence.");
  return input.generation.definitionVersion ===
    PERSONAL_SEC_ANNUAL_DEFINITION_VERSION
    ? null
    : "invalid_clock";
}

/** Resolve only the selected annual filing's exact report-date balances. */
export function resolvePersonalSecAnnualLiquidity(
  input: Input,
): PersonalSecAnnualLiquidityResolutionDto {
  return resolvePersonalSecAnnualLiquidityCore(input, admit(input));
}

/** Complete observed balance dates in one filing; no annual adjacency inference. */
export function resolvePersonalSecAnnualLiquidityHistory(
  input: Input,
): PersonalSecAnnualLiquidityHistory {
  return resolvePersonalSecAnnualLiquidityHistoryCore(input, admit(input));
}
