import { describe, expect, it } from "vitest";
import {
  annualComparisonBalanceRows,
  annualComparisonResponse,
} from "./annual-comparison-fixture";

describe("explicit invented Annual comparison balance packets", () => {
  it.each(["left", "right"] as const)(
    "opts %s balances in without changing any original evidence group",
    async (side) => {
      const original = await annualComparisonResponse(side);
      const opted = await annualComparisonResponse(side, {
        balanceRows: annualComparisonBalanceRows(side),
      });
      const { balanceSheet: empty, ...oldGroups } = original.evidence;
      const { balanceSheet: added, ...newGroups } = opted.evidence;
      expect(newGroups).toEqual(oldGroups);
      expect(original.security).toEqual(opted.security);
      expect(empty.totalAssets.observations).toEqual([]);
      expect(added.totalAssets.observations).toHaveLength(1);
      expect(added.resolution.totalAssets).toMatchObject({
        status: "available",
        asOfDate: side === "left" ? "2025-12-31" : "2025-06-30",
      });
      for (const evidence of [
        added.totalAssets,
        added.totalLiabilities,
        added.shareholdersEquity,
      ])
        for (const row of evidence.observations) {
          expect(row.filing.reportDate).toBe(
            side === "left" ? "2025-12-31" : "2025-06-30",
          );
          expect(row.accessionNumber).toBe(
            side === "left" ? "0000000001-26-000001" : "0000000002-25-000001",
          );
          expect(row.sourceLocator).toBe(
            `/facts/us-gaap/${row.concept}/units/USD/0`,
          );
        }
    },
  );
});
