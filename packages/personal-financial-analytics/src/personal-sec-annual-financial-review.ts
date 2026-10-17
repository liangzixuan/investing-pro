import type {
  PersonalSecAnnualBalanceSheetValueDto,
  PersonalSecAnnualCashValueDto,
  PersonalSecAnnualLiquidityValueDto,
  PersonalSecAnnualOperatingValueDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import type { PersonalSecAnnualResolvedFinancials } from "./personal-sec-annual-resolved-financials";

const D = Decimal.clone({ defaults: true, precision: 256 });

export type PersonalSecAnnualFinancialReviewSign =
  "positive" | "zero" | "negative";

type Row<Key, Section, Value, Operands = null> = Readonly<{
  key: Key;
  label: string;
  section: Section;
  unit: "USD";
  sign: PersonalSecAnnualFinancialReviewSign | null;
  value: Value;
  operands: Operands;
}>;

export type PersonalSecAnnualFinancialReviewRow =
  | Row<
      "operatingIncome",
      "operating",
      PersonalSecAnnualOperatingValueDto<"USD">
    >
  | Row<"operatingCashFlow", "cash", PersonalSecAnnualCashValueDto>
  | Row<
      "operatingCashFlowLessPpePurchases",
      "cash",
      PersonalSecAnnualCashValueDto,
      Readonly<{
        operatingCashFlow: PersonalSecAnnualCashValueDto;
        ppePurchases: PersonalSecAnnualCashValueDto;
      }>
    >
  | Row<
      "workingCapital",
      "liquidity",
      PersonalSecAnnualLiquidityValueDto<"USD">,
      Readonly<{
        currentAssets: PersonalSecAnnualLiquidityValueDto<"USD">;
        currentLiabilities: PersonalSecAnnualLiquidityValueDto<"USD">;
      }>
    >
  | Row<
      "shareholdersEquity",
      "balanceSheet",
      PersonalSecAnnualBalanceSheetValueDto
    >;

export type PersonalSecAnnualFinancialReviewKey =
  PersonalSecAnnualFinancialReviewRow["key"];

type Value = PersonalSecAnnualFinancialReviewRow["value"];

function copyValue<T extends Value>(value: T): T {
  const copy: T = {
    ...value,
    observationIds: Object.freeze([...value.observationIds]),
  };
  return Object.freeze(copy);
}

function sign(value: Value): PersonalSecAnnualFinancialReviewSign | null {
  if (value.status === "unavailable") return null;
  const amount = new D(value.value);
  if (!amount.isFinite())
    throw new TypeError("Invalid resolved financial value.");
  if (amount.isZero()) return "zero";
  return amount.isPositive() ? "positive" : "negative";
}

/**
 * Derive independent checks from an already decoded Annual evidence graph.
 * This is typed derived-model input, not a raw-packet validator. Admission,
 * calculations and original-load eligibility remain with the existing resolvers.
 * No income-pair eligibility, clock, threshold or overall verdict is introduced.
 */
export function derivePersonalSecAnnualFinancialReview(
  evidence: PersonalSecAnnualResolvedFinancials,
): readonly PersonalSecAnnualFinancialReviewRow[] {
  const operating = evidence.operatingResults.resolution;
  const cash = evidence.cashGeneration.resolution;
  const liquidity = evidence.liquidity.resolution;
  const balance = evidence.balanceSheet.resolution;
  const rows: PersonalSecAnnualFinancialReviewRow[] = [
    {
      key: "operatingIncome",
      label: "Reported operating income",
      section: "operating",
      unit: "USD",
      sign: sign(operating.operatingIncome),
      value: copyValue(operating.operatingIncome),
      operands: null,
    },
    {
      key: "operatingCashFlow",
      label: "Reported operating cash flow",
      section: "cash",
      unit: "USD",
      sign: sign(cash.operatingCashFlow),
      value: copyValue(cash.operatingCashFlow),
      operands: null,
    },
    {
      key: "operatingCashFlowLessPpePurchases",
      label: "Operating cash flow less PP&E purchases",
      section: "cash",
      unit: "USD",
      sign: sign(cash.operatingCashFlowLessPpePurchases),
      value: copyValue(cash.operatingCashFlowLessPpePurchases),
      operands: Object.freeze({
        operatingCashFlow: copyValue(cash.operatingCashFlow),
        ppePurchases: copyValue(cash.ppePurchases),
      }),
    },
    {
      key: "workingCapital",
      label: "Working capital",
      section: "liquidity",
      unit: "USD",
      sign: sign(liquidity.workingCapital),
      value: copyValue(liquidity.workingCapital),
      operands: Object.freeze({
        currentAssets: copyValue(liquidity.currentAssets),
        currentLiabilities: copyValue(liquidity.currentLiabilities),
      }),
    },
    {
      key: "shareholdersEquity",
      label: "Reported parent equity",
      section: "balanceSheet",
      unit: "USD",
      sign: sign(balance.shareholdersEquity),
      value: copyValue(balance.shareholdersEquity),
      operands: null,
    },
  ];
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}
