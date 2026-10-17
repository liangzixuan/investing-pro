import type {
  PersonalSecAnnualCanonicalEvidenceDto,
  PersonalSecAnnualResolutionDto,
  PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import { derivePersonalSecAnnualFinancialInputs } from "./personal-sec-annual-financial-inputs";
import {
  resolvePersonalSecAnnualIncomeCore,
  type PersonalSecAnnualIncomeCoreInput,
} from "./personal-sec-annual-income-core";
import {
  comparePersonalSecAnnualIncomeCore,
  resolvePersonalSecAnnualHistoryCore,
  type PersonalSecAnnualComparison,
  type PersonalSecAnnualHistory,
} from "./personal-sec-annual-comparison-core";

/** Admit v6 and recompute the effective income summary; callers verify source hashes. */
export function resolvePersonalSecAnnualCanonicalIncome(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualResolutionDto {
  return admittedIncome(canonical).resolution;
}
export function comparePersonalSecAnnualCanonicalIncome(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
  concept: PersonalSecAnnualRevenueConcept,
): PersonalSecAnnualComparison {
  const { input, resolution } = admittedIncome(canonical);
  return comparePersonalSecAnnualIncomeCore(input, concept, resolution);
}
export function resolvePersonalSecAnnualCanonicalIncomeHistory(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
  concept: PersonalSecAnnualRevenueConcept,
): PersonalSecAnnualHistory {
  const { input, resolution } = admittedIncome(canonical);
  return resolvePersonalSecAnnualHistoryCore(input, concept, resolution);
}
function admittedIncome(canonical: PersonalSecAnnualCanonicalEvidenceDto): {
  readonly input: PersonalSecAnnualIncomeCoreInput;
  readonly resolution: PersonalSecAnnualResolutionDto;
} {
  const source = derivePersonalSecAnnualFinancialInputs(canonical);
  const input: PersonalSecAnnualIncomeCoreInput = {
    generation: source.canonical.generation,
    target: source.canonical.target,
    observations: source.income.observations,
  };
  return {
    input,
    resolution: resolvePersonalSecAnnualIncomeCore(
      input,
      source.income.reason !== null,
    ),
  };
}
