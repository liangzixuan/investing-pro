import type {
  PersonalSecAnnualCanonicalEvidenceDto,
  PersonalSecAnnualCashResolutionDto,
} from "@research-cockpit/contracts";
import { derivePersonalSecAnnualFinancialInputs } from "./personal-sec-annual-financial-inputs";
import {
  resolvePersonalSecAnnualCashCore,
  resolvePersonalSecAnnualCashHistoryCore,
  type PersonalSecAnnualCashCoreInput,
  type PersonalSecAnnualCashHistory,
} from "./personal-sec-annual-cash-core";

/** Admit v6 and reuse the shared cash kernel; this does not read sources or verify SHA. */
export function resolvePersonalSecAnnualCanonicalCashGeneration(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualCashResolutionDto {
  return resolvePersonalSecAnnualCashCore(cashInput(canonical));
}
/** Same-filing contiguous annual cash periods; statement-table axes do not select history. */
export function resolvePersonalSecAnnualCanonicalCashHistory(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualCashHistory {
  return resolvePersonalSecAnnualCashHistoryCore(cashInput(canonical));
}
function cashInput(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualCashCoreInput {
  const source = derivePersonalSecAnnualFinancialInputs(canonical);
  return {
    cik: source.canonical.cik,
    generation: source.canonical.generation,
    target: source.canonical.target,
    cashGeneration: source.cashGeneration,
  };
}
