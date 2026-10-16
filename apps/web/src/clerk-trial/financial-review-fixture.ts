import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import {
  response,
  request,
  row,
} from "../features/research/sec-annual-evidence-fixture";
import {
  operatingResults,
  operatingRow,
} from "../features/research/sec-annual-operating-fixture";
import {
  cashGeneration,
  cashRow,
} from "../features/research/sec-annual-cash-fixture";
import {
  liquidity,
  liquidityRow,
} from "../features/research/sec-annual-liquidity-fixture";
import {
  balanceSheet,
  balanceSheetRow,
} from "../features/research/sec-annual-balance-sheet-fixture";
import { parseSecAnnualEvidenceResponse } from "../lib/sec-annual-evidence-response";

export interface FinancialReviewFixtureOptions {
  cutoffAt?: string;
  includeIncome?: boolean;
  operatingIncome?: string | null;
  operatingCashFlow?: string | null;
  ppePurchases?: string | null;
  currentAssets?: string | null;
  currentLiabilities?: string | null;
  shareholdersEquity?: string | null;
}

/** Invented, strictly admitted mixed facts. No requests, storage or test runtime. */
export async function financialReviewResponse(
  options: FinancialReviewFixtureOptions = {},
): Promise<PersonalSecAnnualEvidenceResponseDto> {
  const base = await response(
    options.includeIncome ? [row(), row("NetIncomeLoss", "100")] : [],
    options.cutoffAt,
  );
  const value = <
    K extends Exclude<
      keyof FinancialReviewFixtureOptions,
      "cutoffAt" | "includeIncome"
    >,
  >(
    key: K,
    fallback: string,
  ) => (options[key] === undefined ? fallback : options[key]);
  const operating = value("operatingIncome", "250.125");
  const cash = value("operatingCashFlow", "120.125");
  const purchases = value("ppePurchases", "200.25");
  const assets = value("currentAssets", "180.025");
  const liabilities = value("currentLiabilities", "180.025");
  const equity = value("shareholdersEquity", "-7.5");
  const packet = {
    ...base,
    evidence: {
      ...base.evidence,
      operatingResults: await operatingResults(
        base.evidence,
        operating === null ? [] : [operatingRow(operating)],
      ),
      cashGeneration: await cashGeneration(base.evidence, [
        ...(cash === null ? [] : [cashRow("operating_cash_flow", cash)]),
        ...(purchases === null ? [] : [cashRow("ppe_purchases", purchases)]),
      ]),
      liquidity: await liquidity(base.evidence, [
        ...(assets === null ? [] : [liquidityRow("current_assets", assets)]),
        ...(liabilities === null
          ? []
          : [liquidityRow("current_liabilities", liabilities)]),
      ]),
      balanceSheet: await balanceSheet(base.evidence, [
        balanceSheetRow("total_assets", "500"),
        balanceSheetRow("total_liabilities", "600"),
        ...(equity === null
          ? []
          : [balanceSheetRow("shareholders_equity", equity)]),
      ]),
    },
  };
  const admitted = await parseSecAnnualEvidenceResponse(
    packet,
    request(),
    new AbortController().signal,
  );
  if (!admitted) throw new Error("Invalid invented financial review packet");
  return admitted;
}
