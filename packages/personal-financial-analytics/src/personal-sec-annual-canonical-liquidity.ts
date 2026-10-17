import type {
  PersonalSecAnnualCanonicalEvidenceDto,
  PersonalSecAnnualLiquidityResolutionDto,
} from "@research-cockpit/contracts";
import { derivePersonalSecAnnualFinancialInputs } from "./personal-sec-annual-financial-inputs";
import {
  resolvePersonalSecAnnualLiquidityCore,
  resolvePersonalSecAnnualLiquidityHistoryCore,
  type PersonalSecAnnualLiquidityCoreInput,
  type PersonalSecAnnualLiquidityHistory,
} from "./personal-sec-annual-liquidity-core";

function input(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualLiquidityCoreInput {
  const derived = derivePersonalSecAnnualFinancialInputs(canonical);
  return {
    cik: canonical.cik,
    generation: canonical.generation,
    target: canonical.target,
    liquidity: derived.liquidity,
  };
}

/** Resolve balances from actual v6 scans and original observations, without metric tags. */
export function resolvePersonalSecAnnualCanonicalLiquidity(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualLiquidityResolutionDto {
  return resolvePersonalSecAnnualLiquidityCore(input(canonical));
}

/** Same-filing balance history keeps the existing current-use and stop policies. */
export function resolvePersonalSecAnnualCanonicalLiquidityHistory(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
): PersonalSecAnnualLiquidityHistory {
  return resolvePersonalSecAnnualLiquidityHistoryCore(input(canonical));
}
