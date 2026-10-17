import type { PersonalSecAnnualBalanceSheetObservationDto } from "@research-cockpit/contracts";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../../lib/test-personal-sec-annual-api-fixture";
import {
  admitUiPacket,
  response,
  row,
} from "./test-canonical-annual-ui-fixture";
import { balanceSheetRow } from "./sec-annual-balance-sheet-fixture";

// Reuse invented row fields only; the old packet builder is never called.
export { balanceSheetRow } from "./sec-annual-balance-sheet-fixture";
export { viewOf } from "./test-canonical-annual-ui-fixture";
export async function balanceSheetResponse(
  rows: readonly PersonalSecAnnualBalanceSheetObservationDto[],
  cutoffAt?: string,
) {
  const packet = structuredClone(
    await response([], cutoffAt),
  ) as TestAnnualPacket;
  packet.evidence.facts.observations = [
    row(),
    row("NetIncomeLoss", "100"),
    ...rows,
  ].map((item) => {
    const fields = structuredClone(item);
    Reflect.deleteProperty(fields, "metric");
    return fields;
  });
  for (const item of packet.evidence.facts.scans) {
    const count = packet.evidence.facts.observations.filter(
      (row) => row.concept === item.concept,
    ).length;
    item.scan = {
      status: "available",
      absence: count === 0 ? "concept_missing" : null,
      coverage: {
        full: {
          candidateRows: count,
          inspectedRows: count,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: count,
        },
        selected: count,
        otherAccessions: 0,
        returned: count,
        omittedSelected: 0,
      },
    };
  }
  return admitUiPacket(await bindAnnualPacket(packet));
}
export function balanceSheetPacket(late = false) {
  return balanceSheetResponse(
    [
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
    ],
    late ? "2026-09-21T00:00:00.000Z" : undefined,
  );
}
