import type { PersonalSecAnnualStatementObservationDto } from "@research-cockpit/contracts";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../../lib/test-personal-sec-annual-api-fixture";
import {
  admitUiPacket,
  response,
  row,
} from "./test-canonical-annual-ui-fixture";
import { operatingRow } from "./sec-annual-operating-fixture";

// Only invented source-row fields from the old fixture; never its packet builder.
export { operatingRow } from "./sec-annual-operating-fixture";
export { row, viewOf } from "./test-canonical-annual-ui-fixture";

export async function operatingResponse(
  operatingRows: readonly PersonalSecAnnualStatementObservationDto[] = [
    operatingRow(),
  ],
  incomeRows: readonly PersonalSecAnnualStatementObservationDto[] = [
    row(),
    row("NetIncomeLoss", "100"),
  ],
  cutoffAt?: string,
) {
  const packet = structuredClone(
    await response([], cutoffAt),
  ) as TestAnnualPacket;
  const rows = [...operatingRows, ...incomeRows].map((item) => {
    const fields = structuredClone(item);
    Reflect.deleteProperty(fields, "metric");
    return fields;
  });
  packet.evidence.facts.observations = rows;
  for (const item of packet.evidence.facts.scans) {
    const count = rows.filter((row) => row.concept === item.concept).length;
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

/** Invented adjacent comparatives in one filing; net income is absent. */
export function operatingHistoryPacket() {
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
  return operatingResponse(
    periods.map((period, index) =>
      operatingRow(["-250.125", "0", "80.125"][index], {
        ...period,
        sourceLocator: `/facts/us-gaap/OperatingIncomeLoss/units/USD/${index}`,
      }),
    ),
    [
      ...periods.map((period, index) =>
        row("Revenues", ["1000", "800", "640"][index], {
          ...period,
          sourceLocator: `/facts/us-gaap/Revenues/units/USD/${index}`,
        }),
      ),
      ...periods.slice(0, 2).map((period, index) =>
        row("SalesRevenueNet", index === 0 ? "800" : "400", {
          ...period,
          sourceLocator: `/facts/us-gaap/SalesRevenueNet/units/USD/${index}`,
        }),
      ),
      row("RevenueFromContractWithCustomerExcludingAssessedTax", "500"),
    ],
  );
}
