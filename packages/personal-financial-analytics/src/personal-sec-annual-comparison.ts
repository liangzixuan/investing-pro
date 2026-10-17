import type {
  PersonalSecAnnualPairDto,
  PersonalSecAnnualResolutionInput,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualEvidence } from "./personal-sec-annual-evidence";
import {
  resolvePersonalSecAnnualHistoryCore,
  comparePersonalSecAnnualIncomeCore,
  type PersonalSecAnnualHistory,
  type PersonalSecAnnualComparison,
} from "./personal-sec-annual-comparison-core";
export type {
  PersonalSecAnnualChange,
  PersonalSecAnnualComparison,
  PersonalSecAnnualMarginComparison,
  PersonalSecAnnualPeriod,
  PersonalSecAnnualHistory,
} from "./personal-sec-annual-comparison-core";
export function resolvePersonalSecAnnualHistory(
  input: PersonalSecAnnualResolutionInput,
  concept: PersonalSecAnnualPairDto["concept"],
): PersonalSecAnnualHistory {
  return resolvePersonalSecAnnualHistoryCore(
    input,
    concept,
    resolvePersonalSecAnnualEvidence(input),
  );
}
export function comparePersonalSecAnnualEvidence(
  input: PersonalSecAnnualResolutionInput,
  concept: PersonalSecAnnualPairDto["concept"],
): PersonalSecAnnualComparison {
  return comparePersonalSecAnnualIncomeCore(
    input,
    concept,
    resolvePersonalSecAnnualEvidence(input),
  );
}
