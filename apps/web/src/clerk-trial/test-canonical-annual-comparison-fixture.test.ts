import { describe, expect, it } from "vitest";
import {
  annualComparisonResponse,
  annualComparisonCashRows,
  viewOf,
} from "./test-canonical-annual-comparison-fixture";
import { isOwnedSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";

describe("canonical comparison invented graph", () => {
  it.each([
    "default",
    "multiple-bases",
    "exact-decimal",
    "missing-prior",
    "current-use-unavailable",
    "income-invalid",
    "source-unavailable",
  ] as const)("admits independent source mode %s", async (mode) => {
    for (const side of ["left", "right"] as const) {
      const packet = await annualComparisonResponse(side, { mode });
      expect(isOwnedSecAnnualCanonicalResponse(packet)).toBe(true);
      expect(packet.evidence.facts.scans).toHaveLength(32);
      expect(viewOf(packet).canonical).toBe(packet.evidence);
      expect(packet.security.symbol).toBe(side === "left" ? "ZERO" : "ONE");
      expect(packet.evidence.target.status).toBe("target");
    }
  });
  it("counts foreign accessions but never returns or substitutes them", async () => {
    const rows = annualComparisonCashRows("left");
    const foreign = { ...rows[0]!, accessionNumber: "0000000001-25-000001" };
    const packet = await annualComparisonResponse("left", {
      cashRows: [...rows, foreign],
    });
    const scan = packet.evidence.facts.scans.find(
      (item) => item.concept === "NetCashProvidedByUsedInOperatingActivities",
    )!.scan;
    expect(scan.coverage?.full.candidateRows).toBe(2);
    expect(scan.coverage?.otherAccessions).toBe(1);
    expect(scan.coverage?.returned).toBe(1);
    expect(
      viewOf(packet).cashGeneration.resolution.operatingCashFlow,
    ).toMatchObject({ status: "available", value: "1000" });
  });
});
