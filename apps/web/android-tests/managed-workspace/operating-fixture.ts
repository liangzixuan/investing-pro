import { row } from "../../src/features/research/test-canonical-annual-ui-fixture";
import {
  operatingResponse,
  operatingRow,
} from "../../src/features/research/test-canonical-annual-operating-ui-fixture";

/** Invented same-filing operating loss with three separate revenue bases and no net income. */
export async function inventedOperatingPacket(
  cutoffAt = "2026-09-20T00:00:00.000Z",
  operatingIncome = "-250.125",
) {
  return operatingResponse(
    [operatingRow(operatingIncome)],
    [
      row("Revenues", "1000"),
      row("SalesRevenueNet", "800"),
      row("RevenueFromContractWithCustomerExcludingAssessedTax", "500"),
    ],
    cutoffAt,
  );
}
