import type { PersonalSecAnnualLiquidityObservationDto } from "@research-cockpit/contracts";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../../lib/test-personal-sec-annual-api-fixture";
import { admitUiPacket, response } from "./test-canonical-annual-ui-fixture";

// Reuse invented instant source-row fields, never the old packet builder.
export { liquidityRow } from "./sec-annual-liquidity-fixture";
export { viewOf } from "./test-canonical-annual-ui-fixture";

export async function liquidityResponse(
  rows: readonly PersonalSecAnnualLiquidityObservationDto[],
  cutoffAt?: string,
) {
  const packet = structuredClone(
    await response(undefined, cutoffAt),
  ) as TestAnnualPacket;
  for (const row of rows) {
    const { metric, ...fields } = row;
    void metric;
    packet.evidence.facts.observations.push(structuredClone(fields));
  }
  for (const concept of ["AssetsCurrent", "LiabilitiesCurrent"] as const) {
    const count = rows.filter((row) => row.concept === concept).length;
    packet.evidence.facts.scans.find((item) => item.concept === concept)!.scan =
      {
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
