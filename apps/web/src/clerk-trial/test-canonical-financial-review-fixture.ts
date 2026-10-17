import type { FinancialReviewFixtureOptions } from "./financial-review-fixture";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
import { row } from "../features/research/test-canonical-annual-ui-fixture";
import { operatingRow } from "../features/research/sec-annual-operating-fixture";
import { cashRow } from "../features/research/sec-annual-cash-fixture";
import { liquidityRow } from "../features/research/sec-annual-liquidity-fixture";
import { balanceSheetRow } from "../features/research/sec-annual-balance-sheet-fixture";
export async function financialReviewResponse(
  options: FinancialReviewFixtureOptions = {},
) {
  const value = (
    key: Exclude<
      keyof FinancialReviewFixtureOptions,
      "cutoffAt" | "includeIncome"
    >,
    fallback: string,
  ) => (options[key] === undefined ? fallback : options[key]);
  const operating = value("operatingIncome", "250.125"),
    cash = value("operatingCashFlow", "120.125"),
    purchases = value("ppePurchases", "200.25"),
    assets = value("currentAssets", "180.025"),
    liabilities = value("currentLiabilities", "180.025"),
    equity = value("shareholdersEquity", "-7.5");
  return annualComparisonResponse("left", {
    ...(options.cutoffAt === undefined ? {} : { cutoffAt: options.cutoffAt }),
    rows: options.includeIncome ? [row(), row("NetIncomeLoss", "100")] : [],
    operatingRows: operating === null ? [] : [operatingRow(operating)],
    cashRows: [
      ...(cash === null ? [] : [cashRow("operating_cash_flow", cash)]),
      ...(purchases === null ? [] : [cashRow("ppe_purchases", purchases)]),
    ],
    liquidityRows: [
      ...(assets === null ? [] : [liquidityRow("current_assets", assets)]),
      ...(liabilities === null
        ? []
        : [liquidityRow("current_liabilities", liabilities)]),
    ],
    balanceRows: [
      balanceSheetRow("total_assets", "500"),
      balanceSheetRow("total_liabilities", "600"),
      ...(equity === null
        ? []
        : [balanceSheetRow("shareholders_equity", equity)]),
    ],
  });
}
