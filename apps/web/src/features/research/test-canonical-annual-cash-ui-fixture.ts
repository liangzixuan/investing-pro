import type {
  PersonalSecAnnualCashObservationDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../../lib/test-personal-sec-annual-api-fixture";
import {
  response,
  admitUiPacket,
  row,
} from "./test-canonical-annual-ui-fixture";
import { cashRow } from "./sec-annual-cash-fixture";
export { cashRow, annualCashHistoryRows } from "./sec-annual-cash-fixture";
export { viewOf, admitUiPacket, row } from "./test-canonical-annual-ui-fixture";

/** Add only invented normalized cash source fields to the real canonical graph. */
export async function cashResponse(
  rows: readonly PersonalSecAnnualCashObservationDto[] = [],
  cutoffAt?: string,
  incomeRows: readonly PersonalSecQuarterlyObservationDto[] = [
    row(),
    row("NetIncomeLoss", "100"),
  ],
) {
  const packet = structuredClone(
    await response(incomeRows, cutoffAt),
  ) as TestAnnualPacket;
  for (const concept of [
    "NetCashProvidedByUsedInOperatingActivities",
    "PaymentsToAcquirePropertyPlantAndEquipment",
  ] as const) {
    const values = rows.filter((row) => row.concept === concept);
    const included = values.length <= 100 ? values : [];
    packet.evidence.facts.observations.push(
      ...included.map(({ metric, ...fields }, index) => {
        void metric;
        return {
          ...fields,
          sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
        };
      }),
    );
    packet.evidence.facts.scans.find(
      (entry) => entry.concept === concept,
    )!.scan = {
      status: "available",
      absence: values.length === 0 ? "concept_missing" : null,
      coverage: {
        full: {
          candidateRows: values.length,
          inspectedRows: values.length,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: values.length,
        },
        selected: values.length,
        otherAccessions: 0,
        returned: included.length,
        omittedSelected: values.length - included.length,
      },
    };
  }
  return admitUiPacket(await bindAnnualPacket(packet));
}
export async function cashMarginsResponse({
  revenueRows = [
    row("Revenues", "1000"),
    row("RevenueFromContractWithCustomerExcludingAssessedTax", "500"),
    row("SalesRevenueNet", "800"),
  ],
  cashRows = [
    cashRow("operating_cash_flow", "120.125"),
    cashRow("ppe_purchases", "20.025"),
  ],
  cutoffAt,
}: {
  readonly revenueRows?: readonly PersonalSecQuarterlyObservationDto[];
  readonly cashRows?: readonly PersonalSecAnnualCashObservationDto[];
  readonly cutoffAt?: string;
} = {}) {
  return cashResponse(cashRows, cutoffAt, revenueRows);
}
