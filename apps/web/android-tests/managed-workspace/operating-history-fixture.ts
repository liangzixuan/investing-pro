import { row } from "../../src/features/research/sec-annual-evidence-fixture";
import {
  operatingResponse,
  operatingRow,
} from "../../src/features/research/sec-annual-operating-fixture";

/** Invented adjacent comparatives in one filing; net income is absent. */
export function operatingHistoryPacket(replacement = false, late = false) {
  const periods = [
    {
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      durationDays: 365,
      frame: "CY2025",
    },
    {
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      durationDays: 366,
      frame: "CY2024",
    },
    {
      startDate: "2023-01-01",
      endDate: "2023-12-31",
      durationDays: 365,
      frame: "CY2023",
    },
  ];
  const selected = replacement ? periods.slice(0, 2) : periods;
  return operatingResponse(
    selected.map((period, index) =>
      operatingRow(
        index === 0
          ? late
            ? "999.875"
            : replacement
              ? "125.25"
              : "-250.125"
          : index === 1
            ? "0"
            : "80.125",
        {
          ...period,
          sourceLocator: `/facts/us-gaap/OperatingIncomeLoss/units/USD/${index}`,
        },
      ),
    ),
    [
      ...selected.map((period, index) =>
        row(
          "Revenues",
          (replacement ? ["750", "600"] : ["1000", "800", "640"])[index],
          {
            ...period,
            sourceLocator: `/facts/us-gaap/Revenues/units/USD/${index}`,
          },
        ),
      ),
      ...periods.slice(0, 2).map((period, index) =>
        row("SalesRevenueNet", index === 0 ? "800" : "400", {
          ...period,
          sourceLocator: `/facts/us-gaap/SalesRevenueNet/units/USD/${index}`,
        }),
      ),
      row("RevenueFromContractWithCustomerExcludingAssessedTax", "500"),
    ],
    replacement || late ? "2026-09-21T00:00:00.000Z" : undefined,
  );
}
