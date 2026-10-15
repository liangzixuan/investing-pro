import {
  balanceSheet,
  balanceSheetRow,
} from "../../src/features/research/sec-annual-balance-sheet-fixture";
import { response } from "../../src/features/research/sec-annual-evidence-fixture";

/** Three invented instant totals, independent of absent revenue and net income. */
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
      ]),
    },
  };
}
