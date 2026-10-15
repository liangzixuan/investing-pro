import {
  liquidity,
  liquidityRow,
} from "../../src/features/research/sec-annual-liquidity-fixture";
import { response } from "../../src/features/research/sec-annual-evidence-fixture";

/** Invented reported dates in one filing; no annual-adjacency or income assumption. */
export async function liquidityHistoryPacket(
  replacement = false,
  late = false,
) {
  const base = await response(
    [],
    replacement || late ? "2026-09-21T00:00:00.000Z" : undefined,
  );
  const balances = replacement
    ? ([
        ["2025-12-31", "200.125", "100"],
        ["2024-12-28", "60", "0"],
        ["2024-06-29", "25", null],
        ["2023-12-30", "500", "100"],
      ] as const)
    : ([
        ["2025-12-31", late ? "999.875" : "120.125", "180.025"],
        ["2024-12-28", "-5", "2"],
        ["2023-12-30", "0", "0"],
      ] as const);
  let liabilityIndex = 0;
  const rows = balances.flatMap(([endDate, assets, liabilities], index) => [
    liquidityRow("current_assets", assets, {
      endDate,
      frame: null,
      sourceLocator: `/facts/us-gaap/AssetsCurrent/units/USD/${index}`,
    }),
    ...(liabilities === null
      ? []
      : [
          liquidityRow("current_liabilities", liabilities, {
            endDate,
            frame: null,
            sourceLocator: `/facts/us-gaap/LiabilitiesCurrent/units/USD/${liabilityIndex++}`,
          }),
        ]),
  ]);
  return {
    ...base,
    evidence: {
      ...base.evidence,
      liquidity: await liquidity(base.evidence, rows),
    },
  };
}
