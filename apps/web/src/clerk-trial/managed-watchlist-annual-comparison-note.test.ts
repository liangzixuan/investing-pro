import { describe, expect, it, vi } from "vitest";
import {
  annualComparisonCashRows,
  annualComparisonMemberships,
  annualComparisonResponse,
  annualComparisonRows,
} from "./annual-comparison-fixture";
import {
  getAnnualComparisonNoteEvidence,
  type AnnualComparisonNoteCapture,
  type AnnualComparisonNoteGroup,
} from "./managed-watchlist-annual-comparison-note";

type Column = AnnualComparisonNoteCapture["left"];
type Options = Parameters<typeof annualComparisonResponse>[1];
async function capture(
  group: AnnualComparisonNoteGroup = "income",
  left?: Options,
  right?: Options,
): Promise<AnnualComparisonNoteCapture> {
  const column = async (
    side: "left" | "right",
    options?: Options,
  ): Promise<Column> => ({
    member: {
      handle: Symbol(side),
      listing: annualComparisonMemberships[side],
    },
    response: await annualComparisonResponse(side, options),
    selectedBasis: side === "left" ? "Revenues" : "SalesRevenueNet",
    showingPrevious: false,
  });
  return {
    group,
    left: await column("left", left),
    right: await column("right", right),
  };
}

const leftSource =
  "CIK 0000000001; filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current use eligible at original load.";
const rightSource =
  "CIK 0000000002; filed 2025-08-01; accession 0000000002-25-000001; filing https://www.sec.gov/Archives/edgar/data/2/0000000002-25-000001-index.htm. Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current use eligible at original load.";
const ending =
  "Company periods may differ; no cross-company calculation or ranking. Evidence dates are unchanged; this action does not refresh sources.";
const expectedIncome = [
  "Observed Annual income comparison; exact, unscaled USD.",
  "ZERO (Zero Company; Zero Class A; Class A; XNAS, US): 10-K 2025-01-01 to 2025-12-31; Revenues revenue USD 1000; NetIncomeLoss USD 100; net margin 10%.",
  "Reported revenue change: 2024-01-01 to 2024-12-31 versus 2025-01-01 to 2025-12-31, USD 200 (25%).",
  leftSource,
  "ONE (One Company; One Class A; Class A; XNAS, US): 10-K 2024-07-01 to 2025-06-30; SalesRevenueNet revenue USD 750; NetIncomeLoss USD 150; net margin 20%.",
  "Reported revenue change: 2023-07-01 to 2024-06-30 versus 2024-07-01 to 2025-06-30, USD 150 (25%).",
  rightSource,
  "Period length, accounting changes and restatements are unadjusted; not as-originally-filed history or organic growth.",
  ending,
].join(" ");
const expectedCash = [
  "Observed Annual cash comparison; exact, unscaled USD. OCF = NetCashProvidedByUsedInOperatingActivities; PP&E = PaymentsToAcquirePropertyPlantAndEquipment.",
  "ZERO (Zero Company; Zero Class A; Class A; XNAS, US): 10-K 2025-01-01 to 2025-12-31; reported OCF USD 1000; reported PP&E USD 250; app calculation OCF less PP&E USD 750.",
  leftSource,
  "ONE (One Company; One Class A; Class A; XNAS, US): 10-K 2024-07-01 to 2025-06-30; reported OCF USD 900; reported PP&E USD 300; app calculation OCF less PP&E USD 600.",
  rightSource,
  "The app calculation uses each company's same filing and period; no adjustment for leases, acquisitions or other investing cash flows.",
  ending,
].join(" ");

describe("Annual comparison note evidence", () => {
  it.each([
    ["income", expectedIncome],
    ["cash", expectedCash],
  ] as const)(
    "formats exact %s evidence with both identities, periods and original provenance",
    async (group, expected) => {
      const input = await capture(group);
      const before = JSON.stringify(input);
      expect(getAnnualComparisonNoteEvidence(input)).toEqual({
        excerpt: expected,
        reason: null,
      });
      expect([...expected].length).toBeLessThan(2000);
      expect(expected).not.toMatch(/[\r\n]/u);
      expect(JSON.stringify(input)).toBe(before);
    },
  );

  it("uses the explicit income basis without changing the cash group", async () => {
    const input = await capture("income", { mode: "multiple-bases" });
    const selected = {
      ...input,
      left: {
        ...input.left,
        selectedBasis: "RevenueFromContractWithCustomerExcludingAssessedTax",
      },
    };
    const excerpt = getAnnualComparisonNoteEvidence(selected).excerpt!;
    expect(excerpt).toContain(
      "RevenueFromContractWithCustomerExcludingAssessedTax revenue USD 500; NetIncomeLoss USD 100; net margin 20%.",
    );
    expect(excerpt).toContain("USD 250 (100%)");
    expect(
      getAnnualComparisonNoteEvidence({ ...selected, group: "cash" }).excerpt,
    ).toBe(expectedCash);
  });

  it.each([null, "SalesRevenueNet", "unrecognized-concept"])(
    "refuses a missing or invalid chosen income basis %s without fallback",
    async (selectedBasis) => {
      const input = await capture();
      const result = getAnnualComparisonNoteEvidence({
        ...input,
        left: { ...input.left, selectedBasis },
      });
      expect(result.excerpt).toBeNull();
      expect(result.reason).toMatch(/^First company:/u);
      expect(
        getAnnualComparisonNoteEvidence({
          ...input,
          group: "cash",
          left: { ...input.left, selectedBasis },
        }).excerpt,
      ).toBe(expectedCash);
    },
  );

  it("records the actual missing-prior reason instead of inventing a change", async () => {
    const result = getAnnualComparisonNoteEvidence(
      await capture("income", { mode: "missing-prior" }),
    );
    expect(result.reason).toBeNull();
    expect(result.excerpt).toContain(
      "Reported revenue change unavailable: The immediately preceding annual revenue and net-income period is missing for this basis.",
    );
    expect(result.excerpt).toContain("Revenues revenue USD 1000");
    expect(result.excerpt).toContain("USD 150 (25%)");
  });

  it("keeps historical and retained qualifiers per company using the original clocks", async () => {
    const input = await capture("cash", { mode: "current-use-unavailable" });
    const retained = {
      ...input,
      left: { ...input.left, showingPrevious: true },
    };
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2035-01-01T00:00:00.000Z"));
      const result = getAnnualComparisonNoteEvidence(retained);
      expect(result.reason).toBeNull();
      expect(result.excerpt).toContain(
        "Original cutoff 2028-09-20T00:00:00.000Z",
      );
      expect(result.excerpt).toContain(
        "Historical evidence; current use unavailable at original load. Retained previous report.",
      );
      expect(result.excerpt).toContain(rightSource);
      expect(result.excerpt).not.toContain("2035");
      const income = getAnnualComparisonNoteEvidence({
        ...retained,
        group: "income",
      }).excerpt;
      expect(income).toContain(
        "Reported revenue change unavailable: The report is outside the current-use policy at its original load.",
      );
      expect(income).toContain("Revenues revenue USD 1000");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps each group's eligibility independent", async () => {
    const refusedIncome = await capture(
      "cash",
      { mode: "income-invalid" },
      { rows: [] },
    );
    expect(getAnnualComparisonNoteEvidence(refusedIncome).excerpt).toBe(
      expectedCash,
    );
    expect(
      getAnnualComparisonNoteEvidence({ ...refusedIncome, group: "income" })
        .excerpt,
    ).toBeNull();
    const missingCash = await capture("income", { cashRows: [] });
    expect(getAnnualComparisonNoteEvidence(missingCash).excerpt).toBe(
      expectedIncome,
    );
    const refusedCash = getAnnualComparisonNoteEvidence({
      ...missingCash,
      group: "cash",
    });
    expect(refusedCash.excerpt).toBeNull();
    expect(refusedCash.reason).toMatch(/^First company:/u);
  });

  it.each(["missing", "negative-purchases", "different-period"] as const)(
    "refuses %s cash on the second company without a partial excerpt",
    async (mode) => {
      const rows = annualComparisonCashRows("right");
      const cashRows =
        mode === "missing"
          ? rows.slice(0, 1)
          : rows.map((row) =>
              row.metric !== "ppe_purchases"
                ? row
                : mode === "negative-purchases"
                  ? { ...row, value: "-300" }
                  : { ...row, startDate: "2024-06-24", durationDays: 372 },
            );
      const result = getAnnualComparisonNoteEvidence(
        await capture("cash", undefined, { cashRows }),
      );
      expect(result).toEqual({
        excerpt: null,
        reason:
          "Second company: Cash comparison needs available operating cash flow and PP&E purchases from the same filing and annual period.",
      });
    },
  );

  it("preserves signed cash, zero purchases and a sub-cent exact subtraction", async () => {
    const cashRows = annualComparisonCashRows().map((row) => ({
      ...row,
      value:
        row.metric === "operating_cash_flow" ? "-0.000000000000000001" : "0",
    }));
    const result = getAnnualComparisonNoteEvidence(
      await capture("cash", { cashRows }),
    );
    expect(result.reason).toBeNull();
    expect(result.excerpt).toContain(
      "reported OCF USD -0.000000000000000001; reported PP&E USD 0; app calculation OCF less PP&E USD -0.000000000000000001.",
    );
  });

  it("preserves long exact amounts and does not own the full-note length limit", async () => {
    const value = "9".repeat(64);
    const cashRows = annualComparisonCashRows().map((row) => ({
      ...row,
      value: row.metric === "operating_cash_flow" ? value : "0",
    }));
    const input = await capture("cash", { cashRows });
    const longIdentity = (column: Column): Column => ({
      ...column,
      member: {
        ...column.member,
        listing: {
          ...column.member.listing,
          issuerName: "名".repeat(128),
          securityName: "株".repeat(128),
          shareClassName: "類".repeat(128),
        },
      },
      response: {
        ...column.response,
        security: {
          ...column.response.security,
          issuerName: "名".repeat(128),
          securityName: "株".repeat(128),
        },
      },
    });
    const result = getAnnualComparisonNoteEvidence({
      ...input,
      left: longIdentity(input.left),
      right: longIdentity(input.right),
    });
    expect(result.reason).toBeNull();
    expect(result.excerpt).toContain(`reported OCF USD ${value}`);
    expect(result.excerpt).toContain(`OCF less PP&E USD ${value}`);
    expect([...result.excerpt!].length).toBeGreaterThan(2000);
  });

  it("uses exact income decimals and the displayed unavailable percentage for zero prior revenue", async () => {
    const rows = annualComparisonRows().map((row) => ({
      ...row,
      value:
        row.metric === "revenue"
          ? row.endDate === "2025-12-31"
            ? "1"
            : "0"
          : "-0.000000000000000001",
    }));
    const result = getAnnualComparisonNoteEvidence(
      await capture("income", { rows }),
    );
    expect(result.reason).toBeNull();
    expect(result.excerpt).toContain(
      "Revenues revenue USD 1; NetIncomeLoss USD -0.000000000000000001; net margin 0%.",
    );
    expect(result.excerpt).toContain(
      "USD 1 (Unavailable: prior value is zero)",
    );
  });

  it("refuses current nonpositive revenue under the existing income admission rules", async () => {
    const rows = annualComparisonRows().map((row) =>
      row.metric === "revenue" ? { ...row, value: "0" } : row,
    );
    expect(
      getAnnualComparisonNoteEvidence(await capture("income", { rows })),
    ).toEqual({
      excerpt: null,
      reason:
        "First company: No valid same-filing annual revenue and net-income pair is available for this basis. Inspect its source details.",
    });
  });

  it("preserves the displayed exact long revenue and sub-percent change", async () => {
    const exact = `1000.${"0".repeat(58)}1`;
    const rows = annualComparisonRows().map((row) =>
      row.metric === "revenue"
        ? { ...row, value: row.endDate === "2025-12-31" ? exact : "1000" }
        : row,
    );
    const result = getAnnualComparisonNoteEvidence(
      await capture("income", { rows }),
    );
    expect(result.reason).toBeNull();
    expect(result.excerpt).toContain(`Revenues revenue USD ${exact}`);
    expect(result.excerpt).toContain(
      `USD 0.${"0".repeat(58)}1 (Less than 0.01% higher)`,
    );
  });

  it.each([
    "same-handle",
    "same-issuer",
    "same-cik",
    "wrong-listing",
    "wrong-security",
    "blank-share-class",
    "different-catalog",
  ] as const)("refuses invalid comparison identity: %s", async (mode) => {
    const input = await capture("cash");
    const right = {
      ...input.right,
      member: {
        ...input.right.member,
        listing: { ...input.right.member.listing },
      },
      response: {
        ...input.right.response,
        security: { ...input.right.response.security },
      },
    };
    if (mode === "same-handle") right.member.handle = input.left.member.handle;
    if (mode === "same-issuer")
      right.member.listing.issuerId = input.left.member.listing.issuerId;
    if (mode === "same-cik")
      right.response.security.cik = input.left.response.security.cik;
    if (mode === "wrong-listing")
      right.response.security.listingId = "listing-other";
    if (mode === "wrong-security")
      right.response.security.securityName = "Wrong class";
    if (mode === "blank-share-class") right.member.listing.shareClassName = "";
    if (mode === "different-catalog")
      right.response.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
    expect(getAnnualComparisonNoteEvidence({ ...input, right })).toEqual({
      excerpt: null,
      reason: "Choose two distinct companies with matching report identities.",
    });
  });

  it.each(["source-unavailable", "wrong-source-url", "wrong-clock"] as const)(
    "refuses unusable source provenance: %s",
    async (mode) => {
      const input = await capture(
        "cash",
        mode === "source-unavailable" ? { mode } : undefined,
      );
      const response = structuredClone(input.left.response);
      const generation = response.evidence.generation;
      const altered =
        mode === "wrong-source-url"
          ? {
              ...generation,
              sources: {
                ...generation.sources,
                companyFacts: {
                  ...generation.sources.companyFacts,
                  sourceUrl:
                    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000002.json",
                },
              },
            }
          : mode === "wrong-clock"
            ? { ...generation, completedAt: "2020-01-01T00:00:00.000Z" }
            : generation;
      const result = getAnnualComparisonNoteEvidence({
        ...input,
        left: {
          ...input.left,
          response: {
            ...response,
            evidence: { ...response.evidence, generation: altered },
          },
        },
      });
      expect(result).toEqual({
        excerpt: null,
        reason: "First company: Annual source or filing is unavailable.",
      });
    },
  );

  it.each(["value", "period", "reference", "current-use"] as const)(
    "refuses inconsistent cash resolution: %s",
    async (mode) => {
      const input = await capture("cash");
      const evidence = input.left.response.evidence;
      const original =
        evidence.cashGeneration.resolution.operatingCashFlowLessPpePurchases;
      expect(original.status).toBe("available");
      const changed =
        mode === "value"
          ? { ...original, value: "751" }
          : mode === "period"
            ? { ...original, startDate: "2025-01-02" }
            : mode === "reference"
              ? {
                  ...original,
                  observationIds: [`sec-fact:${"a".repeat(64)}` as const],
                }
              : { ...original, currentUseEligible: false };
      const response = {
        ...input.left.response,
        evidence: {
          ...evidence,
          cashGeneration: {
            ...evidence.cashGeneration,
            resolution: {
              ...evidence.cashGeneration.resolution,
              operatingCashFlowLessPpePurchases: changed,
            },
          },
        },
      };
      expect(
        getAnnualComparisonNoteEvidence({
          ...input,
          left: { ...input.left, response },
        }),
      ).toEqual({
        excerpt: null,
        reason: "First company: Cash evidence could not be validated.",
      });
    },
  );
});
