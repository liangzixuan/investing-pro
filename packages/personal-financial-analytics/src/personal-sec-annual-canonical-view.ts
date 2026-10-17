import { PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS } from "@research-cockpit/contracts";
import type { PersonalSecAnnualCanonicalEvidenceDto } from "@research-cockpit/contracts";
import { derivePersonalSecAnnualFinancialInputs } from "./personal-sec-annual-financial-inputs";
import { resolvePersonalSecAnnualStatements } from "./personal-sec-annual-statements";
import { resolvePersonalSecAnnualIncomeCore } from "./personal-sec-annual-income-core";
import {
  comparePersonalSecAnnualIncomeCore,
  resolvePersonalSecAnnualHistoryCore,
} from "./personal-sec-annual-comparison-core";
import {
  resolvePersonalSecAnnualCashCore,
  resolvePersonalSecAnnualCashHistoryCore,
} from "./personal-sec-annual-cash-core";
import {
  resolvePersonalSecAnnualLiquidityCore,
  resolvePersonalSecAnnualLiquidityHistoryCore,
} from "./personal-sec-annual-liquidity-core";
import {
  resolvePersonalSecAnnualOperatingCore,
  resolvePersonalSecAnnualOperatingHistoryCore,
  comparePersonalSecAnnualOperatingCore,
} from "./personal-sec-annual-operating-core";
import {
  resolvePersonalSecAnnualBalanceSheetCore,
  resolvePersonalSecAnnualBalanceSheetHistoryCore,
} from "./personal-sec-annual-balance-sheet-core";
import { comparePersonalSecAnnualBalanceSheetHistory } from "./personal-sec-annual-balance-sheet-change";
import { derivePersonalSecAnnualCashMargins } from "./personal-sec-annual-cash-margins";
import { derivePersonalSecAnnualFinancialReview } from "./personal-sec-annual-financial-review";

/**
 * Build the in-memory view from an owned, hash-verified canonical packet.
 * This is not a wire shape. Report serializers must capture canonical explicitly.
 */
export function derivePersonalSecAnnualCanonicalView(
  canonical: PersonalSecAnnualCanonicalEvidenceDto,
) {
  const source = derivePersonalSecAnnualFinancialInputs(canonical);
  requireFrozen(canonical);
  const context = {
    cik: canonical.cik,
    generation: canonical.generation,
    target: canonical.target,
  };
  const incomeInput = {
    ...context,
    observations: source.income.observations,
  };
  const incomeResolution = resolvePersonalSecAnnualIncomeCore(
    incomeInput,
    source.income.reason !== null,
  );
  const cashInput = { ...context, cashGeneration: source.cashGeneration };
  const liquidityInput = { ...context, liquidity: source.liquidity };
  const operatingInput = {
    ...context,
    observations: source.income.observations,
    incomeReason: source.income.reason,
    operatingResults: source.operatingResults,
  };
  const balanceInput = { ...context, balanceSheet: source.balanceSheet };
  const cashGeneration = Object.freeze({
    resolution: resolvePersonalSecAnnualCashCore(cashInput),
    history: resolvePersonalSecAnnualCashHistoryCore(cashInput),
  });
  const liquidity = Object.freeze({
    resolution: resolvePersonalSecAnnualLiquidityCore(liquidityInput),
    history: resolvePersonalSecAnnualLiquidityHistoryCore(liquidityInput),
  });
  const operatingResults = Object.freeze({
    resolution: resolvePersonalSecAnnualOperatingCore(operatingInput),
    bases: Object.freeze(
      PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) =>
        Object.freeze({
          concept,
          history: resolvePersonalSecAnnualOperatingHistoryCore(
            operatingInput,
            concept,
          ),
          comparison: comparePersonalSecAnnualOperatingCore(
            operatingInput,
            concept,
          ),
        }),
      ),
    ),
  });
  const balanceHistory =
    resolvePersonalSecAnnualBalanceSheetHistoryCore(balanceInput);
  const balanceSheet = Object.freeze({
    resolution: resolvePersonalSecAnnualBalanceSheetCore(balanceInput),
    history: balanceHistory,
    change: comparePersonalSecAnnualBalanceSheetHistory(balanceHistory),
  });
  const resolved = {
    cashGeneration,
    liquidity,
    operatingResults,
    balanceSheet,
  };
  return Object.freeze({
    canonical,
    statements: resolvePersonalSecAnnualStatements(canonical),
    income: Object.freeze({
      resolution: incomeResolution,
      reason: source.income.reason,
      scanStatus: source.income.scanStatus,
      coverage: source.income.coverage,
      summaryReturned: source.income.summaryReturned,
      bases: Object.freeze(
        PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) =>
          Object.freeze({
            concept,
            history: resolvePersonalSecAnnualHistoryCore(
              incomeInput,
              concept,
              incomeResolution,
            ),
            comparison: comparePersonalSecAnnualIncomeCore(
              incomeInput,
              concept,
              incomeResolution,
            ),
          }),
        ),
      ),
    }),
    ...resolved,
    cashMargins: derivePersonalSecAnnualCashMargins(resolved),
    financialReview: derivePersonalSecAnnualFinancialReview(resolved),
  });
}

export type PersonalSecAnnualCanonicalView = ReturnType<
  typeof derivePersonalSecAnnualCanonicalView
>;

function requireFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (!Object.isFrozen(value))
    throw new TypeError(
      "Canonical Annual view requires owned frozen evidence.",
    );
  Object.values(value).forEach(requireFrozen);
}
