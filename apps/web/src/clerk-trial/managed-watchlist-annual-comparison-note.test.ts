import { describe, expect, it, vi } from "vitest";
import {
  annualComparisonCashRows,
  annualComparisonLiquidityRows,
  annualComparisonOperatingRows,
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

const expectedLiquidity = [
  "Observed Annual liquidity comparison; exact, unscaled USD; current ratio is a multiple.",
  "ZERO (Zero Company; Zero Class A; Class A; XNAS, US): Observed Annual liquidity: ZERO (XNAS); CIK 0000000001; 10-K balances at 2025-12-31. Reported current assets (AssetsCurrent) USD 1500; reported current liabilities (LiabilitiesCurrent) USD 600. App calculations: working capital USD 900; current ratio 2.50 multiple (two decimal places, half up). Same filing and date. Current assets are not all cash. Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.",
  "ONE (One Company; One Class A; Class A; XNAS, US): Observed Annual liquidity: ONE (XNAS); CIK 0000000002; 10-K balances at 2025-06-30. Reported current assets (AssetsCurrent) USD 900; reported current liabilities (LiabilitiesCurrent) USD 1200. App calculations: working capital USD -300; current ratio 0.75 multiple (two decimal places, half up). Same filing and date. Current assets are not all cash. Filed 2025-08-01; accession 0000000002-25-000001; filing https://www.sec.gov/Archives/edgar/data/2/0000000002-25-000001-index.htm. Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.",
  "Company balance dates may differ; no cross-company calculation or ranking.",
].join(" ");
const liquidityRefusal =
  "Liquidity comparison needs available current assets, current liabilities and working capital from the same filing and date, with a checked ratio or zero-liability refusal.";

describe("Annual liquidity comparison note evidence", () => {
  it("copies both complete, separately dated reports without changing frozen evidence", async () => {
    const input = await capture("liquidity");
    const before = JSON.stringify(input);
    expect(getAnnualComparisonNoteEvidence(input)).toEqual({
      excerpt: expectedLiquidity,
      reason: null,
    });
    expect([...expectedLiquidity]).toHaveLength(1819);
    expect(expectedLiquidity).not.toMatch(/[\r\n]/u);
    expect(Object.isFrozen(input.left.response)).toBe(true);
    expect(Object.isFrozen(input.right.response)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    null,
    "unavailable-basis",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
  ])(
    "keeps liquidity independent of income, cash and selected basis %s",
    async (selectedBasis) => {
      const input = await capture(
        "liquidity",
        { mode: "income-invalid", cashRows: [] },
        { rows: [], cashRows: [] },
      );
      const selected = {
        ...input,
        left: { ...input.left, selectedBasis },
        right: { ...input.right, selectedBasis },
      };
      expect(getAnnualComparisonNoteEvidence(selected).excerpt).toBe(
        expectedLiquidity,
      );
      for (const group of ["income", "cash"] as const)
        expect(
          getAnnualComparisonNoteEvidence({ ...selected, group }).excerpt,
        ).toBeNull();
    },
  );

  it("leaves income and cash available when the liquidity group refuses", async () => {
    const input = await capture("liquidity", { liquidityRows: [] });
    expect(getAnnualComparisonNoteEvidence(input)).toEqual({
      excerpt: null,
      reason: `First company: ${liquidityRefusal}`,
    });
    expect(
      getAnnualComparisonNoteEvidence({ ...input, group: "income" }).excerpt,
    ).toBe(expectedIncome);
    expect(
      getAnnualComparisonNoteEvidence({ ...input, group: "cash" }).excerpt,
    ).toBe(expectedCash);
  });

  it.each(["left", "right"] as const)(
    "preserves a checked zero-liability refusal on the %s",
    async (side) => {
      const liquidityRows = annualComparisonLiquidityRows(side).map((row) => ({
        ...row,
        value: row.metric === "current_liabilities" ? "0" : row.value,
      }));
      const input = await capture(
        "liquidity",
        side === "left" ? { liquidityRows } : undefined,
        side === "right" ? { liquidityRows } : undefined,
      );
      const oldAmount = side === "left" ? "600" : "1200";
      const oldCalculation =
        side === "left"
          ? "working capital USD 900; current ratio 2.50 multiple (two decimal places, half up)."
          : "working capital USD -300; current ratio 0.75 multiple (two decimal places, half up).";
      const assets = side === "left" ? "1500" : "900";
      const expected = expectedLiquidity
        .replace(
          `current liabilities (LiabilitiesCurrent) USD ${oldAmount}`,
          "current liabilities (LiabilitiesCurrent) USD 0",
        )
        .replace(
          oldCalculation,
          `working capital USD ${assets}; current ratio unavailable because current liabilities are zero.`,
        );
      expect(getAnnualComparisonNoteEvidence(input)).toEqual({
        excerpt: expected,
        reason: null,
      });
      expect([...expected]).toHaveLength(side === "left" ? 1823 : 1820);
    },
  );

  it("qualifies only the historical retained side with its original clocks", async () => {
    const input = await capture("liquidity", {
      mode: "current-use-unavailable",
    });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2035-01-01T00:00:00.000Z"));
      const expected = expectedLiquidity.replaceAll("2026-09-20", "2028-09-20");
      const leftEnd = expected.indexOf(" ONE (One Company;");
      const left = expected
        .slice(0, leftEnd)
        .replace(
          "Current-use policy at original load: eligible.",
          "Historical evidence; current-use policy at original load: unavailable.",
        )
        .replace(
          "Evidence dates are unchanged;",
          "Retained previous report. Evidence dates are unchanged;",
        );
      const right = expectedLiquidity.slice(leftEnd);
      const result = getAnnualComparisonNoteEvidence({
        ...input,
        left: { ...input.left, showingPrevious: true },
      });
      expect(result).toEqual({ excerpt: left + right, reason: null });
      expect(result.excerpt).not.toContain("2035");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the complete both-retained historical paragraph within the measured short-prefix budget", async () => {
    const input = await capture(
      "liquidity",
      { mode: "current-use-unavailable" },
      {
        mode: "current-use-unavailable",
        liquidityRows: annualComparisonLiquidityRows("right").map((row) => ({
          ...row,
          value: row.metric === "current_liabilities" ? "0" : row.value,
        })),
      },
    );
    const result = getAnnualComparisonNoteEvidence({
      ...input,
      left: { ...input.left, showingPrevious: true },
      right: { ...input.right, showingPrevious: true },
    });
    const expected = expectedLiquidity
      .replaceAll("2026-09-20", "2028-09-20")
      .replaceAll(
        "Current-use policy at original load: eligible.",
        "Historical evidence; current-use policy at original load: unavailable.",
      )
      .replaceAll(
        "Evidence dates are unchanged;",
        "Retained previous report. Evidence dates are unchanged;",
      )
      .replace(
        "current liabilities (LiabilitiesCurrent) USD 1200",
        "current liabilities (LiabilitiesCurrent) USD 0",
      )
      .replace(
        "working capital USD -300; current ratio 0.75 multiple (two decimal places, half up).",
        "working capital USD 900; current ratio unavailable because current liabilities are zero.",
      );
    expect(result).toEqual({ excerpt: expected, reason: null });
    expect([...expected]).toHaveLength(1920);
    expect([...`${"x".repeat(32)} ${expected}`]).toHaveLength(1953);
  });

  it.each([
    "missing-assets",
    "missing-liabilities",
    "negative-assets",
    "negative-liabilities",
    "wrong-date",
    "wrong-filing",
    "duration-row",
    "conflicting-assets",
  ] as const)(
    "refuses %s on the second company without partial output",
    async (mode) => {
      const rows = annualComparisonLiquidityRows("right");
      const liquidityRows =
        mode === "missing-assets"
          ? rows.filter((row) => row.metric !== "current_assets")
          : mode === "missing-liabilities"
            ? rows.filter((row) => row.metric !== "current_liabilities")
            : mode === "conflicting-assets"
              ? [
                  ...rows,
                  {
                    ...rows[0]!,
                    value: "901",
                    sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/1",
                  },
                ]
              : rows.map((row) => {
                  if (
                    mode === "negative-assets" &&
                    row.metric === "current_assets"
                  )
                    return { ...row, value: "-900" };
                  if (row.metric !== "current_liabilities") return row;
                  if (mode === "negative-liabilities")
                    return { ...row, value: "-1200" };
                  if (mode === "wrong-date")
                    return { ...row, endDate: "2025-06-29" };
                  if (mode === "wrong-filing")
                    return { ...row, accessionNumber: "0000000002-24-000001" };
                  if (mode === "duration-row")
                    return {
                      ...row,
                      startDate: "2024-07-01",
                      durationDays: 365,
                    };
                  return row;
                });
      expect(
        getAnnualComparisonNoteEvidence(
          await capture("liquidity", undefined, { liquidityRows }),
        ),
      ).toEqual({
        excerpt: null,
        reason: `Second company: ${liquidityRefusal}`,
      });
    },
  );

  it.each([
    "working-capital",
    "ratio",
    "date",
    "reference",
    "current-use",
    "source-value",
    "filing-url",
    "fake-zero-ratio",
    "other-family-id",
  ] as const)("refuses externally changed liquidity %s", async (mode) => {
    const input = await capture("liquidity");
    const response = structuredClone(input.left.response);
    const liquidity = response.evidence.liquidity;
    if (mode === "working-capital")
      Reflect.set(liquidity.resolution.workingCapital, "value", "901");
    if (mode === "ratio")
      Reflect.set(liquidity.resolution.currentRatio, "value", "2.51");
    if (mode === "date")
      Reflect.set(
        liquidity.resolution.workingCapital,
        "asOfDate",
        "2025-12-30",
      );
    if (mode === "reference")
      Reflect.set(liquidity.resolution.workingCapital, "observationIds", [
        `sec-fact:${"a".repeat(64)}`,
      ]);
    if (mode === "current-use")
      Reflect.set(
        liquidity.resolution.workingCapital,
        "currentUseEligible",
        false,
      );
    if (mode === "source-value")
      Reflect.set(liquidity.currentAssets.observations[0]!, "value", "1501");
    if (mode === "filing-url")
      Reflect.set(
        liquidity.currentAssets.observations[0]!.filing,
        "sourceUrl",
        "https://example.invalid/",
      );
    if (mode === "fake-zero-ratio")
      Reflect.set(liquidity.resolution, "currentRatio", {
        status: "unavailable",
        unit: "multiple",
        reason: "nonpositive_current_liabilities",
        observationIds: liquidity.resolution.currentRatio.observationIds,
      });
    if (mode === "other-family-id")
      Reflect.set(
        response.evidence.observations[0]!,
        "id",
        liquidity.currentAssets.observations[0]!.id,
      );
    expect(
      getAnnualComparisonNoteEvidence({
        ...input,
        left: { ...input.left, response },
      }),
    ).toEqual({ excerpt: null, reason: `First company: ${liquidityRefusal}` });
  });

  it.each(["source-unavailable", "wrong-source-url", "wrong-clock"] as const)(
    "retains the shared %s source guard for liquidity",
    async (mode) => {
      const input = await capture(
        "liquidity",
        mode === "source-unavailable" ? { mode } : undefined,
      );
      const response = structuredClone(input.left.response);
      if (mode === "wrong-source-url")
        Reflect.set(
          response.evidence.generation.sources.submissions,
          "sourceUrl",
          "https://data.sec.gov/submissions/CIK0000000002.json",
        );
      if (mode === "wrong-clock")
        Reflect.set(
          response.evidence.generation,
          "completedAt",
          "2020-01-01T00:00:00.000Z",
        );
      expect(
        getAnnualComparisonNoteEvidence({
          ...input,
          left: { ...input.left, response },
        }),
      ).toEqual({
        excerpt: null,
        reason: "First company: Annual source or filing is unavailable.",
      });
    },
  );

  it.each([
    "same-handle",
    "same-issuer",
    "same-cik",
    "wrong-listing",
    "wrong-security",
    "different-catalog",
  ] as const)(
    "retains the shared identity guard for liquidity: %s",
    async (mode) => {
      const input = await capture("liquidity");
      const member = {
        ...input.right.member,
        listing: { ...input.right.member.listing },
      };
      const response = structuredClone(input.right.response);
      if (mode === "same-handle") member.handle = input.left.member.handle;
      if (mode === "same-issuer")
        member.listing.issuerId = input.left.member.listing.issuerId;
      if (mode === "same-cik")
        Reflect.set(response.security, "cik", input.left.response.security.cik);
      if (mode === "wrong-listing")
        Reflect.set(response.security, "listingId", "listing-other");
      if (mode === "wrong-security")
        Reflect.set(response.security, "securityName", "Other Class");
      if (mode === "different-catalog")
        Reflect.set(
          response,
          "catalogSnapshotSha256",
          `sha256:${"b".repeat(64)}`,
        );
      expect(
        getAnnualComparisonNoteEvidence({
          ...input,
          right: { ...input.right, member, response },
        }),
      ).toEqual({
        excerpt: null,
        reason:
          "Choose two distinct companies with matching report identities.",
      });
    },
  );

  it("preserves exact long values and refuses no text on behalf of the whole-note limit", async () => {
    const liquidityRows = annualComparisonLiquidityRows().map((row) => ({
      ...row,
      value:
        row.metric === "current_assets"
          ? "9007199254740993123.0000000001"
          : "0.0000000002",
    }));
    const input = await capture("liquidity", { liquidityRows });
    const listing = {
      ...input.left.member.listing,
      issuerName: "名".repeat(128),
      securityName: "株".repeat(128),
      shareClassName: "類".repeat(128),
    };
    const response = {
      ...input.left.response,
      security: {
        ...input.left.response.security,
        issuerName: listing.issuerName,
        securityName: listing.securityName,
      },
    };
    const result = getAnnualComparisonNoteEvidence({
      ...input,
      left: {
        ...input.left,
        member: { ...input.left.member, listing },
        response,
      },
    });
    expect(result.reason).toBeNull();
    expect(result.excerpt).toContain(
      `ZERO (${listing.issuerName}; ${listing.securityName}; ${listing.shareClassName}; XNAS, US)`,
    );
    expect(result.excerpt).toContain(
      "current assets (AssetsCurrent) USD 9007199254740993123.0000000001; reported current liabilities (LiabilitiesCurrent) USD 0.0000000002.",
    );
    expect(result.excerpt).toContain(
      "working capital USD 9007199254740993122.9999999999; current ratio 45035996273704965615000000000.50 multiple",
    );
    expect([...result.excerpt!].length).toBeGreaterThan(2000);
    expect(result.excerpt).toContain(
      "CIK 0000000002; 10-K balances at 2025-06-30",
    );
  });

  it("refuses an unrecognized external group instead of silently choosing liquidity", async () => {
    const input = await capture("liquidity");
    Reflect.set(input, "group", "other");
    expect(getAnnualComparisonNoteEvidence(input)).toEqual({
      excerpt: null,
      reason: "Choose income, cash, liquidity or operating evidence.",
    });
  });
});

async function operatingCapture(left?: Options, right?: Options) {
  const options = (side: "left" | "right", changes?: Options): Options => ({
    rows: annualComparisonRows(side).filter((row) => row.metric === "revenue"),
    operatingRows: annualComparisonOperatingRows(side),
    ...changes,
  });
  return capture("operating", options("left", left), options("right", right));
}

const operatingFormula =
  "App calculation: operating margin = operating income / positive revenue * 100, rounded to two decimal places, half up; each company's inputs use the same filing and exact period.";
const expectedOperating = [
  "Observed Annual operating comparison; exact, unscaled USD.",
  "ZERO (Zero Company; Zero Class A; Class A; XNAS, US): 10-K 2025-01-01 to 2025-12-31; reported OperatingIncomeLoss USD -250.125; Revenues revenue USD 1000; operating margin -25.01%.",
  leftSource,
  "ONE (One Company; One Class A; Class A; XNAS, US): 10-K 2024-07-01 to 2025-06-30; reported OperatingIncomeLoss USD 125.25; SalesRevenueNet revenue USD 750; operating margin 16.7%.",
  rightSource,
  operatingFormula,
  ending,
].join(" ");

describe("Annual operating comparison note evidence", () => {
  it("copies exact independently admitted amounts, separate periods and original clocks with no net income", async () => {
    const input = await operatingCapture();
    const before = JSON.stringify(input);
    expect(getAnnualComparisonNoteEvidence(input)).toEqual({
      excerpt: expectedOperating,
      reason: null,
    });
    for (const side of [input.left, input.right]) {
      expect(
        side.response.evidence.observations.every(
          (row) => row.metric === "revenue",
        ),
      ).toBe(true);
      expect(side.response.evidence.resolution.selectedReportPairEligible).toBe(
        false,
      );
    }
    expect([...`Café 東京📈 ${expectedOperating}`].length).toBeLessThan(2000);
    expect(expectedOperating.split(operatingFormula)).toHaveLength(2);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("uses only the chosen basis and retains the complete left-previous native example within the note budget", async () => {
    const input = await operatingCapture({
      rows: annualComparisonRows()
        .filter((row) => row.metric === "revenue")
        .flatMap((row) => [
          row,
          {
            ...row,
            concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
            value: "500",
          },
        ]),
    });
    const selected = {
      ...input,
      left: {
        ...input.left,
        selectedBasis: "RevenueFromContractWithCustomerExcludingAssessedTax",
        showingPrevious: true,
      },
    };
    const expected = expectedOperating
      .replace(
        "Revenues revenue USD 1000; operating margin -25.01%.",
        "RevenueFromContractWithCustomerExcludingAssessedTax revenue USD 500; operating margin -50.03%.",
      )
      .replace(leftSource, `${leftSource} Retained previous report.`);
    expect(getAnnualComparisonNoteEvidence(selected)).toEqual({
      excerpt: expected,
      reason: null,
    });
    expect([...`Café 東京📈 ${expected}`].length).toBeLessThan(2000);
    expect(getAnnualComparisonNoteEvidence(input).excerpt).toBe(
      expectedOperating,
    );
  });

  it("preserves both retained historical qualifiers, long concepts and all source clocks without using the view clock", async () => {
    const options = (side: "left" | "right"): Options => ({
      mode: "current-use-unavailable",
      rows: annualComparisonRows(side)
        .filter((row) => row.metric === "revenue")
        .map((row) => ({
          ...row,
          concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
        })),
    });
    const input = await operatingCapture(options("left"), options("right"));
    const captured = {
      ...input,
      left: {
        ...input.left,
        selectedBasis: "RevenueFromContractWithCustomerExcludingAssessedTax",
        showingPrevious: true,
      },
      right: {
        ...input.right,
        selectedBasis: "RevenueFromContractWithCustomerExcludingAssessedTax",
        showingPrevious: true,
      },
    };
    const expected = expectedOperating
      .replace(
        "Revenues revenue",
        "RevenueFromContractWithCustomerExcludingAssessedTax revenue",
      )
      .replace(
        "SalesRevenueNet revenue",
        "RevenueFromContractWithCustomerExcludingAssessedTax revenue",
      )
      .replaceAll("2026-09-20", "2028-09-20")
      .replaceAll(
        "Current use eligible at original load.",
        "Historical evidence; current use unavailable at original load. Retained previous report.",
      );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2035-01-01T00:00:00Z"));
    try {
      expect(getAnnualComparisonNoteEvidence(captured)).toEqual({
        excerpt: expected,
        reason: null,
      });
      expect([...`${"x".repeat(32)} ${expected}`].length).toBeLessThanOrEqual(
        2000,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([null, "UnknownRevenue", "SalesRevenueNet"])(
    "refuses the unavailable selected basis %s without borrowing another",
    async (selectedBasis) => {
      const input = await operatingCapture();
      const actual = getAnnualComparisonNoteEvidence({
        ...input,
        left: { ...input.left, selectedBasis },
      });
      expect(actual.excerpt).toBeNull();
      expect(actual.reason).toMatch(/^First company:/u);
      expect(getAnnualComparisonNoteEvidence(input).excerpt).toBe(
        expectedOperating,
      );
    },
  );

  it.each([
    "missing-operating",
    "missing-revenue",
    "zero-revenue",
    "negative-revenue",
    "different-period",
    "conflicting-operating",
  ] as const)(
    "refuses %s on the second company without partial evidence",
    async (mode) => {
      const rows = annualComparisonRows("right").filter(
        (row) => row.metric === "revenue",
      );
      const operatingRows = annualComparisonOperatingRows("right");
      const options: Options = {
        rows:
          mode === "missing-revenue"
            ? []
            : rows.map((row) => ({
                ...row,
                value:
                  mode === "zero-revenue"
                    ? "0"
                    : mode === "negative-revenue"
                      ? "-750"
                      : row.value,
              })),
        operatingRows:
          mode === "missing-operating"
            ? []
            : mode === "conflicting-operating"
              ? [
                  operatingRows[0]!,
                  {
                    ...operatingRows[0]!,
                    value: "126",
                    sourceLocator:
                      "/facts/us-gaap/OperatingIncomeLoss/units/USD/1",
                  },
                ]
              : operatingRows.map((row) =>
                  mode === "different-period"
                    ? { ...row, startDate: "2024-07-02", durationDays: 364 }
                    : row,
                ),
      };
      expect(
        getAnnualComparisonNoteEvidence(
          await operatingCapture(undefined, options),
        ),
      ).toEqual({
        excerpt: null,
        reason:
          "Second company: Operating comparison needs available operating income and positive revenue from the same filing and exact annual period.",
      });
    },
  );

  it.each([
    "value",
    "period",
    "reference",
    "current-use",
    "cross-section-id",
    "coverage",
  ] as const)("refuses forged operating evidence %s", async (mode) => {
    const input = await operatingCapture();
    const response = structuredClone(input.left.response);
    const graph = response.evidence.operatingResults;
    const margin = graph.resolution.margins.find(
      (basis) => basis.concept === "Revenues",
    )!.operatingMargin;
    if (mode === "value") Reflect.set(margin, "value", "99");
    else if (mode === "period") Reflect.set(margin, "startDate", "2025-01-02");
    else if (mode === "reference") Reflect.set(margin, "observationIds", []);
    else if (mode === "current-use")
      Reflect.set(margin, "currentUseEligible", false);
    else if (mode === "cross-section-id")
      Reflect.set(
        graph.operatingIncome.observations[0]!,
        "id",
        response.evidence.cashGeneration.operatingCashFlow.observations[0]!.id,
      );
    else Reflect.set(graph.operatingIncome.scan.coverage!, "returned", 0);
    expect(
      getAnnualComparisonNoteEvidence({
        ...input,
        left: { ...input.left, response },
      }),
    ).toEqual({
      excerpt: null,
      reason: "First company: Operating evidence could not be validated.",
    });
  });

  it("preserves unsafe-number exact source amounts and leaves full-note overflow to the workspace", async () => {
    const exact = "9007199254740993123.0000000001";
    const input = await operatingCapture({
      rows: annualComparisonRows()
        .filter((row) => row.metric === "revenue")
        .map((row) => ({ ...row, value: "1" })),
      operatingRows: annualComparisonOperatingRows().map((row) => ({
        ...row,
        value: exact,
      })),
    });
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
    expect(result.excerpt).toContain(
      `reported OperatingIncomeLoss USD ${exact}; Revenues revenue USD 1; operating margin 900719925474099312300%.`,
    );
    expect(result.excerpt).toContain(leftSource);
    expect(result.excerpt).toContain(rightSource);
    expect([...result.excerpt!].length).toBeGreaterThan(2000);
  });
});
