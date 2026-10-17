import type {
  PersonalSecAnnualCanonicalEvidenceDto,
  PersonalSecAnnualOperatingResolutionDto,
  PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import { derivePersonalSecAnnualFinancialInputs } from "./personal-sec-annual-financial-inputs";
import {
  resolvePersonalSecAnnualOperatingCore,
  resolvePersonalSecAnnualOperatingHistoryCore,
  comparePersonalSecAnnualOperatingCore,
  type PersonalSecAnnualOperatingCoreInput,
  type PersonalSecAnnualOperatingHistory,
  type PersonalSecAnnualOperatingComparison,
} from "./personal-sec-annual-operating-core";

function operatingInput(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualOperatingCoreInput {
  const source = derivePersonalSecAnnualFinancialInputs(canonical);
  return {
    cik: source.canonical.cik,
    generation: source.canonical.generation,
    target: source.canonical.target,
    observations: source.income.observations,
    incomeReason: source.income.reason,
    operatingResults: source.operatingResults,
  };
}

/** Admit v6 and recompute independent operating amounts and exact revenue margins. */
export function resolvePersonalSecAnnualCanonicalOperatingResults(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualOperatingResolutionDto {
  return resolvePersonalSecAnnualOperatingCore(operatingInput(canonical));
}

/** Same-filing contiguous periods; statement date columns do not select history. */
export function resolvePersonalSecAnnualCanonicalOperatingHistory(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
  concept: PersonalSecAnnualRevenueConcept,
): PersonalSecAnnualOperatingHistory {
  return resolvePersonalSecAnnualOperatingHistoryCore(
    operatingInput(canonical),
    concept,
  );
}

/** Compare only the first two admitted same-basis periods. */
export function comparePersonalSecAnnualCanonicalOperatingEvidence(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
  concept: PersonalSecAnnualRevenueConcept,
): PersonalSecAnnualOperatingComparison {
  return comparePersonalSecAnnualOperatingCore(
    operatingInput(canonical),
    concept,
  );
}
