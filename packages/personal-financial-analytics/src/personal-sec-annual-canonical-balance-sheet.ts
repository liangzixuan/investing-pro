import type { PersonalSecAnnualCanonicalEvidenceDto } from "@research-cockpit/contracts";
import { derivePersonalSecAnnualFinancialInputs } from "./personal-sec-annual-financial-inputs";
import {
  resolvePersonalSecAnnualBalanceSheetCore,
  resolvePersonalSecAnnualBalanceSheetHistoryCore,
  type PersonalSecAnnualBalanceSheetCoreInput,
} from "./personal-sec-annual-balance-sheet-core";

function input(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualBalanceSheetCoreInput {
  const projected = derivePersonalSecAnnualFinancialInputs(canonical);
  return {
    cik: canonical.cik,
    generation: canonical.generation,
    target: canonical.target,
    balanceSheet: projected.balanceSheet,
  };
}
/** Original v6 graph; source hashes must have been verified by its transport owner. */
export function resolvePersonalSecAnnualCanonicalBalanceSheet(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
) {
  return resolvePersonalSecAnnualBalanceSheetCore(input(canonical));
}
export function resolvePersonalSecAnnualCanonicalBalanceSheetHistory(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
) {
  return resolvePersonalSecAnnualBalanceSheetHistoryCore(input(canonical));
}
