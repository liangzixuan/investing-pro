import {
  response,
  row,
} from "../../src/features/research/sec-annual-evidence-fixture";
import {
  operatingResults,
  operatingRow,
} from "../../src/features/research/sec-annual-operating-fixture";

/** Invented same-filing operating loss with three separate revenue bases and no net income. */
export async function inventedOperatingPacket(
  cutoffAt = "2026-09-20T00:00:00.000Z",
  operatingIncome = "-250.125",
) {
  const base = await response(
    [
      row("Revenues", "1000"),
      row("SalesRevenueNet", "800"),
      row("RevenueFromContractWithCustomerExcludingAssessedTax", "500"),
    ],
    cutoffAt,
  );
  return {
    ...base,
    evidence: {
      ...base.evidence,
      operatingResults: await operatingResults(base.evidence, [
        operatingRow(operatingIncome),
      ]),
    },
  };
}
