import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  type PersonalSecAnnualCashResolutionDto,
  type PersonalSecAnnualCashResolutionInput,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualCashCore,
  resolvePersonalSecAnnualCashHistoryCore,
  type PersonalSecAnnualCashHistory,
} from "./personal-sec-annual-cash-core";

export type {
  PersonalSecAnnualCashHistoryReason,
  PersonalSecAnnualCashHistoryPeriod,
  PersonalSecAnnualCashHistory,
} from "./personal-sec-annual-cash-core";

/** Existing v5 boundary; arithmetic and period/history rules remain in one core. */
export function resolvePersonalSecAnnualCashGeneration(
  input: PersonalSecAnnualCashResolutionInput,
): PersonalSecAnnualCashResolutionDto {
  admitMetricTags(input);
  return resolvePersonalSecAnnualCashCore(input, versionRefusal(input));
}
export function resolvePersonalSecAnnualCashHistory(
  input: PersonalSecAnnualCashResolutionInput,
): PersonalSecAnnualCashHistory {
  admitMetricTags(input);
  return resolvePersonalSecAnnualCashHistoryCore(input, versionRefusal(input));
}
function versionRefusal(
  input: PersonalSecAnnualCashResolutionInput,
): "invalid_clock" | null {
  return input.generation.definitionVersion ===
    PERSONAL_SEC_ANNUAL_DEFINITION_VERSION
    ? null
    : "invalid_clock";
}
function admitMetricTags(input: PersonalSecAnnualCashResolutionInput): void {
  for (const row of input.cashGeneration.operatingCashFlow.observations)
    if (row.metric !== "operating_cash_flow")
      throw new TypeError("Invalid annual cash generation evidence.");
  for (const row of input.cashGeneration.ppePurchases.observations)
    if (row.metric !== "ppe_purchases")
      throw new TypeError("Invalid annual cash generation evidence.");
}
