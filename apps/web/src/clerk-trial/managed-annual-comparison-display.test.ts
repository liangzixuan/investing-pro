import { describe, expect, it } from "vitest";
import {
  annualComparativeRows,
  request,
  row,
} from "../features/research/sec-annual-evidence-fixture";
import {
  annualComparisonMemberships,
  annualComparisonResponse,
  parseAnnualComparisonFixture as admit,
} from "./test-canonical-annual-comparison-fixture";
import { projectAnnualComparison } from "./managed-annual-comparison-display";
import { viewOf } from "./test-canonical-annual-comparison-fixture";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";

function displayOf(
  response: PersonalSecAnnualCanonicalResponseDto | null,
  basis?: string,
) {
  return projectAnnualComparison(
    response,
    response ? viewOf(response) : null,
    basis,
  );
}

const packet = (
  rows = annualComparativeRows(),
  cutoffAt = "2026-09-20T00:00:00.000Z",
) => annualComparisonResponse("left", { rows, cutoffAt });

function withRevenue(current: string, prior: string) {
  return annualComparativeRows().map((item) =>
    item.concept === "Revenues"
      ? { ...item, value: item.endDate === "2025-12-31" ? current : prior }
      : item,
  );
}

describe("managed Annual comparison display", () => {
  it("refuses a financial view owned by a separately admitted equal packet", async () => {
    const input = await packet();
    const equalPacket = await packet();
    expect(equalPacket).toEqual(input);
    expect(equalPacket).not.toBe(input);
    const display = projectAnnualComparison(input, viewOf(equalPacket));
    expect(display.current).toBeNull();
    expect(display.revenueChange).toBeNull();
    expect(display.source).toBeNull();
    expect(display.currentReason).toContain("Load an Annual report");
  });

  it("keeps an unloaded column empty without inventing a basis or source dates", () => {
    const display = displayOf(null);
    expect(display).toMatchObject({
      basisChoices: [],
      selectedBasis: null,
      current: null,
      currentUse: null,
      revenueChange: null,
      source: null,
    });
    expect(display.currentReason).toContain("Load an Annual report");
    expect(displayOf(null, "Revenues").selectedBasis).toBe("Revenues");
  });

  it("projects exact current amounts, same-filing change and original source coordinates", async () => {
    const input = await packet();
    const display = displayOf(input);
    expect(display.selectedBasis).toBe("Revenues");
    expect(display.current).toMatchObject({
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      revenueUSD: "1000",
      netIncomeUSD: "100",
      netMarginPercent: "10",
    });
    expect(display.current?.observationIds).toHaveLength(2);
    expect(display.revenueChange).toMatchObject({
      differenceUSD: "200",
      percentText: "25%",
      priorStartDate: "2024-01-01",
      priorEndDate: "2024-12-31",
      currentStartDate: "2025-01-01",
      currentEndDate: "2025-12-31",
    });
    expect(display.revenueChange?.observationIds).toHaveLength(4);
    expect(display.currentReason).toBeNull();
    expect(display.revenueChangeReason).toBeNull();
    expect(display.currentUse?.eligible).toBe(true);
    expect(display.currentUse?.message).toBe(
      "Revenue and net income are within current-use limits at this load.",
    );
    expect(display.source).toEqual({
      cik: "0000000001",
      catalogSnapshotSha256: request().catalogSnapshotSha256,
      target: input.evidence.target,
      generation: input.evidence.generation,
      filingUrl:
        "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    });
    expect(display.source?.generation.cutoffAt).toBe(
      "2026-09-20T00:00:00.000Z",
    );
    expect(display.source?.generation.completedAt).toBe(
      "2026-09-20T00:00:02.000Z",
    );
  });

  it("keeps every named basis separate and uses the selected basis for all metrics", async () => {
    const rows = annualComparativeRows();
    const additional = rows
      .filter((item) => item.concept === "Revenues")
      .map((item) => ({
        ...item,
        concept: "SalesRevenueNet" as const,
        value: item.endDate === "2025-12-31" ? "500" : "250",
      }));
    const input = await packet([...rows, ...additional]);
    const display = displayOf(input, "SalesRevenueNet");
    expect(display.basisChoices).toEqual([
      {
        concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
        status: "missing",
      },
      { concept: "Revenues", status: "eligible" },
      { concept: "SalesRevenueNet", status: "eligible" },
    ]);
    expect(display.current).toMatchObject({
      revenueUSD: "500",
      netIncomeUSD: "100",
      netMarginPercent: "20",
    });
    expect(display.revenueChange).toMatchObject({
      differenceUSD: "250",
      percentText: "100%",
    });
    expect(displayOf(input, "Revenues").current?.revenueUSD).toBe("1000");
  });

  it.each(["SalesRevenueNet", "unknown-basis", ""])(
    "does not replace the explicit unavailable basis %j with a different basis",
    async (basis) => {
      const display = displayOf(await packet(), basis);
      expect(display.selectedBasis).toBe(basis);
      expect(display.current).toBeNull();
      expect(display.revenueChange).toBeNull();
      expect(display.currentReason).toContain(
        "Choose another basis explicitly",
      );
      expect(display.source).not.toBeNull();
    },
  );

  it("withholds old amounts when replacement removes the chosen basis", async () => {
    const original = await packet();
    const old = displayOf(original, "Revenues");
    const replacement = await packet(
      annualComparativeRows().map((item) =>
        item.concept === "Revenues"
          ? { ...item, concept: "SalesRevenueNet" }
          : item,
      ),
      "2026-09-21T00:00:00.000Z",
    );
    const next = displayOf(replacement, old.selectedBasis!);
    expect(next.selectedBasis).toBe("Revenues");
    expect(next.current).toBeNull();
    expect(next.revenueChange).toBeNull();
    expect(next.source?.generation.completedAt).toBe(
      "2026-09-21T00:00:02.000Z",
    );
    expect(old.current?.revenueUSD).toBe("1000");
    expect(old.source?.generation.completedAt).toBe("2026-09-20T00:00:02.000Z");
  });

  it("preserves 64-character amounts and a nonzero change that rounds below 0.01%", async () => {
    const exact = `1000.${"0".repeat(58)}1`;
    expect(exact).toHaveLength(64);
    const display = displayOf(await packet(withRevenue(exact, "1000")));
    expect(display.current?.revenueUSD).toBe(exact);
    expect(display.revenueChange?.differenceUSD).toBe(`0.${"0".repeat(58)}1`);
    expect(display.revenueChange?.percentText).toBe("Less than 0.01% higher");
  });

  it.each([
    ["0", "0"],
    ["-125", "-12.5"],
  ])(
    "preserves signed or zero net income %s and the resolver margin",
    async (income, margin) => {
      const rows = annualComparativeRows().map((item) =>
        item.concept === "NetIncomeLoss" && item.endDate === "2025-12-31"
          ? { ...item, value: income }
          : item,
      );
      const display = displayOf(await packet(rows));
      expect(display.current?.netIncomeUSD).toBe(income);
      expect(display.current?.netMarginPercent).toBe(margin);
    },
  );

  it("keeps a valid current pair when the prior annual period is missing", async () => {
    const display = displayOf(
      await packet([row(), row("NetIncomeLoss", "100")]),
    );
    expect(display.current?.revenueUSD).toBe("1000");
    expect(display.currentUse?.eligible).toBe(true);
    expect(display.revenueChange).toBeNull();
    expect(display.revenueChangeReason).toContain(
      "immediately preceding annual",
    );
  });

  it.each([
    ["0", "1000", "zero"],
    ["-10", "1010", "negative"],
  ])(
    "keeps the absolute change but refuses percent for %s prior revenue",
    async (prior, difference, reason) => {
      const display = displayOf(await packet(withRevenue("1000", prior)));
      expect(display.revenueChange?.differenceUSD).toBe(difference);
      expect(display.revenueChange?.percentText).toBe(
        `Unavailable: prior value is ${reason}`,
      );
    },
  );

  it("retains valid historical amounts but withholds change under the original current-use policy", async () => {
    const input = await packet(
      annualComparativeRows(),
      "2028-09-20T00:00:00.000Z",
    );
    const display = displayOf(input);
    expect(display.current).toMatchObject({
      revenueUSD: "1000",
      netIncomeUSD: "100",
      netMarginPercent: "10",
    });
    expect(display.currentUse?.eligible).toBe(false);
    expect(display.currentUse?.message).toContain(
      "Revenue and net income are unavailable under the current-use policy",
    );
    expect(display.currentUse?.message).toContain("remain historical");
    expect(display.revenueChange).toBeNull();
    expect(display.revenueChangeReason).toContain("at its original load");
    expect(display.source?.generation.completedAt).toBe(
      "2028-09-20T00:00:02.000Z",
    );
    expect(display.source?.target).toEqual(input.evidence.target);
  });

  it("does not display a partial or ambiguous current pair", async () => {
    for (const rows of [
      [row()],
      [row(), row("Revenues", "2000"), row("NetIncomeLoss", "100")],
    ]) {
      const display = displayOf(await packet(rows), "Revenues");
      expect(display.current).toBeNull();
      expect(display.currentReason).toContain("No valid same-filing annual");
      expect(display.revenueChange).toBeNull();
    }
  });

  it.each(["left", "right"] as const)(
    "admits the complete %s fixture presets",
    async (side) => {
      const multiple = displayOf(
        await annualComparisonResponse(side, { mode: "multiple-bases" }),
        "RevenueFromContractWithCustomerExcludingAssessedTax",
      );
      expect(multiple.current?.revenueUSD).toBe("500");
      expect(multiple.revenueChange?.percentText).toBe("100%");
      const exact = displayOf(
        await annualComparisonResponse(side, { mode: "exact-decimal" }),
      );
      expect(exact.current?.revenueUSD).toHaveLength(64);
      expect(exact.revenueChange?.percentText).toBe("Less than 0.01% higher");
      const missing = displayOf(
        await annualComparisonResponse(side, { mode: "missing-prior" }),
      );
      expect(missing.current).not.toBeNull();
      expect(missing.revenueChange).toBeNull();
      const restricted = displayOf(
        await annualComparisonResponse(side, {
          mode: "current-use-unavailable",
        }),
      );
      expect(restricted.current).not.toBeNull();
      expect(restricted.currentUse?.eligible).toBe(false);
      expect(restricted.revenueChange).toBeNull();
      const unavailable = displayOf(
        await annualComparisonResponse(side, { mode: "source-unavailable" }),
      );
      expect(unavailable.current).toBeNull();
      expect(unavailable.source?.generation.sources.companyFacts.status).toBe(
        "upstream_unavailable",
      );
    },
  );

  it("withholds incomplete evidence while retaining its failed-source coordinates", async () => {
    const raw = await packet();
    const input = await admit({
      ...raw,
      evidence: {
        ...raw.evidence,
        facts: {
          ...raw.evidence.facts,
          observations: [],
          scans: raw.evidence.facts.scans.map(({ concept }) => ({
            concept,
            scan: {
              status: "source_unavailable",
              absence: null,
              coverage: null,
            } as const,
          })),
        },
        generation: {
          ...raw.evidence.generation,
          sources: {
            ...raw.evidence.generation.sources,
            companyFacts: {
              ...raw.evidence.generation.sources.companyFacts,
              status: "upstream_unavailable",
              fetchedAt: null,
              bytes: null,
              sha256: null,
            },
          },
        },
      },
    });
    const display = displayOf(input, "Revenues");
    expect(display.current).toBeNull();
    expect(display.revenueChange).toBeNull();
    expect(display.currentReason).toContain("evidence is incomplete");
    expect(display.currentReason).toContain(
      "Revenue and net income are withheld",
    );
    expect(display.source?.generation.sources.companyFacts).toEqual(
      input.evidence.generation.sources.companyFacts,
    );
  });

  it("keeps different fiscal periods explicit without aligning them or mutating either packet", async () => {
    const calendar = await packet();
    const fiscal = await annualComparisonResponse("right");
    expect(fiscal.security).toMatchObject({
      cik: "0000000002",
      issuerId: annualComparisonMemberships.right.issuerId,
      listingId: annualComparisonMemberships.right.listingId,
    });
    expect(fiscal.evidence.generation.sources.companyFacts.sourceUrl).toContain(
      "CIK0000000002.json",
    );
    expect(
      fiscal.evidence.facts.observations.every(
        (item) => item.accessionNumber === "0000000002-25-000001",
      ),
    ).toBe(true);
    const before = JSON.stringify([calendar, fiscal]);
    expect(displayOf(calendar).current?.endDate).toBe("2025-12-31");
    const display = displayOf(fiscal);
    expect(display.current).toMatchObject({
      startDate: "2024-07-01",
      endDate: "2025-06-30",
      revenueUSD: "750",
      netIncomeUSD: "150",
      netMarginPercent: "20",
    });
    expect(JSON.stringify([calendar, fiscal])).toBe(before);
    expect(Object.isFrozen(display)).toBe(true);
    expect(Object.isFrozen(display.current)).toBe(true);
    expect(Object.isFrozen(display.current?.observationIds)).toBe(true);
    expect(Object.isFrozen(display.basisChoices)).toBe(true);
  });
});
