import {
  balanceSheet,
  balanceSheetRow,
} from "../../src/features/research/sec-annual-balance-sheet-fixture";
import { response } from "../../src/features/research/sec-annual-evidence-fixture";

/** Invented same-filing balances; current totals remain independent of absent income. */
export async function balanceSheetPacket(late = false) {
  const base = await response(
    [],
    late ? "2026-09-21T00:00:00.000Z" : undefined,
  );
  return {
    ...base,
    evidence: {
      ...base.evidence,
      balanceSheet: await balanceSheet(base.evidence, [
        balanceSheetRow("total_assets", late ? "999.875" : "1000.125"),
        balanceSheetRow("total_liabilities", late ? "888.625" : "1200.25"),
        balanceSheetRow("shareholders_equity", late ? "777.375" : "-200.125"),
        balanceSheetRow("total_assets", late ? "901.5" : "900.5", {
          endDate: "2024-12-31",
          frame: "CY2024Q4I",
          sourceLocator: "/facts/us-gaap/Assets/units/USD/1",
        }),
        balanceSheetRow("total_assets", "800.875", {
          endDate: "2023-09-30",
          frame: "CY2023Q3I",
          sourceLocator: "/facts/us-gaap/Assets/units/USD/2",
        }),
        balanceSheetRow("total_liabilities", "900", {
          endDate: "2023-09-30",
          frame: "CY2023Q3I",
          sourceLocator: "/facts/us-gaap/Liabilities/units/USD/1",
        }),
        balanceSheetRow("shareholders_equity", "0", {
          endDate: "2024-12-31",
          frame: "CY2024Q4I",
          sourceLocator: "/facts/us-gaap/StockholdersEquity/units/USD/1",
        }),
        balanceSheetRow("shareholders_equity", "-98.625", {
          endDate: "2023-09-30",
          frame: "CY2023Q3I",
          sourceLocator: "/facts/us-gaap/StockholdersEquity/units/USD/2",
        }),
      ]),
    },
  };
}
