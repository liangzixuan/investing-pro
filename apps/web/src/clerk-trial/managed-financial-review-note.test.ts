import { getManagedAnnualView } from "./managed-annual-view";
import { normalizeWatchlistNote } from "@research-cockpit/contracts";
import { type PersonalSecAnnualFinancialReviewKey } from "@research-cockpit/personal-financial-analytics";
import { describe, expect, it, vi } from "vitest";
import { balanceSheetRow } from "../features/research/sec-annual-balance-sheet-fixture";
import { cashRow } from "../features/research/sec-annual-cash-fixture";
import { liquidityRow } from "../features/research/sec-annual-liquidity-fixture";
import { operatingRow } from "../features/research/sec-annual-operating-fixture";
import {
  annualComparisonResponse,
  parseAnnualComparisonFixture,
} from "./test-canonical-annual-comparison-fixture";
import { proposeFinancialReviewNote } from "./managed-financial-review-note";

type Options = Parameters<typeof annualComparisonResponse>[1];
function view(packet: Parameters<typeof getManagedAnnualView>[0]) {
  const value = getManagedAnnualView(packet);
  expect(value).not.toBeNull();
  return value!;
}
const allKeys = [
  "operatingIncome",
  "operatingCashFlow",
  "operatingCashFlowLessPpePurchases",
  "workingCapital",
  "shareholdersEquity",
] as const;

/** Existing builders and the complete response decoder own every test packet. */
function admitted(options: Options = {}) {
  return annualComparisonResponse("left", {
    rows: [],
    operatingRows: [operatingRow("125.125")],
    cashRows: [
      cashRow("operating_cash_flow", "100.125"),
      cashRow("ppe_purchases", "200.25"),
    ],
    liquidityRows: [
      liquidityRow("current_assets", "80.5"),
      liquidityRow("current_liabilities", "80.5"),
    ],
    balanceRows: [balanceSheetRow("shareholders_equity", "-15.25")],
    ...options,
  });
}

describe("financial review note proposal", () => {
  it("fits two selected facts in fixed order with exact references and once-only original context", async () => {
    const packet = await admitted();
    const before = JSON.stringify(packet);
    expect(Object.isFrozen(packet)).toBe(true);
    expect(view(packet).income.resolution.currentTargetEligible).toBe(false);
    const proposal = proposeFinancialReviewNote(
      "Café 😀 thesis",
      packet,
      ["shareholdersEquity", "operatingIncome"],
      false,
    );
    expect(proposal.reason).toBeNull();
    const excerpt = proposal.excerpt!;
    expect(proposal.note).toBe(`Café 😀 thesis ${excerpt}`);
    expect([...proposal.note!].length).toBeLessThanOrEqual(2000);
    expect(excerpt).toContain(
      "ZERO (XNAS), listing listing-zero, CIK 0000000001.",
    );
    expect(excerpt).toContain(
      "Reported operating income (positive): USD 125.125; period 2025-01-01 to 2025-12-31; accession 0000000001-26-000001;",
    );
    expect(excerpt).toContain(
      "Reported parent equity (negative): USD -15.25; as of 2025-12-31; accession 0000000001-26-000001;",
    );
    expect(excerpt.indexOf("Reported operating income")).toBeLessThan(
      excerpt.indexOf("Reported parent equity"),
    );
    for (const value of [
      view(packet).operatingResults.resolution.operatingIncome,
      view(packet).balanceSheet.resolution.shareholdersEquity,
    ]) {
      for (const id of value.observationIds) expect(excerpt).toContain(id);
    }
    expect(excerpt.match(/current use eligible/gu)).toHaveLength(2);
    expect(excerpt).toContain(
      "Target 10-K; report date 2025-12-31; filed 2026-02-01; accepted 2026-02-01T00:00:00.000Z; accession 0000000001-26-000001;",
    );
    const context = [
      "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
      "cutoff 2026-09-20T00:00:00.000Z",
      "completed 2026-09-20T00:00:02.000Z",
      "Company Facts available, captured 2026-09-20T00:00:01.000Z",
      "Submissions available, captured 2026-09-20T00:00:02.000Z",
      packet.evidence.generation.sha256,
    ];
    for (const text of context) expect(excerpt.split(text)).toHaveLength(2);
    expect(excerpt).not.toContain("operating cash flow");
    expect(excerpt).not.toMatch(/[\r\n]/u);
    expect(JSON.stringify(packet)).toBe(before);
  });

  it("preserves all exact calculation and operand references without rounded arithmetic", async () => {
    const packet = await admitted({
      cashRows: [
        cashRow("operating_cash_flow", "9007199254740993123.0000000001"),
        cashRow("ppe_purchases", "9007199254740993123.0000000002"),
      ],
    });
    const proposal = proposeFinancialReviewNote(
      "",
      packet,
      ["operatingCashFlowLessPpePurchases"],
      false,
    );
    expect(proposal.reason).toBeNull();
    const text = proposal.note!;
    expect(text).toContain(
      "App calculation Operating cash flow less PP&E purchases (negative): USD -0.0000000001;",
    );
    expect(text).toContain(
      "operating cash flow {USD 9007199254740993123.0000000001; period 2025-01-01 to 2025-12-31; accession 0000000001-26-000001;",
    );
    expect(text).toContain(
      "less PP&E purchases {USD 9007199254740993123.0000000002; period 2025-01-01 to 2025-12-31; accession 0000000001-26-000001;",
    );
    const cash = view(packet).cashGeneration.resolution;
    for (const value of [cash.operatingCashFlow, cash.ppePurchases]) {
      for (const id of value.observationIds)
        expect(text.split(id)).toHaveLength(3);
    }
    expect(text.match(/current use eligible/gu)).toHaveLength(3);
    expect(text).not.toMatch(/audited|free cash flow/iu);
  });

  it("keeps zero working capital and both instant operands", async () => {
    const packet = await admitted();
    const proposal = proposeFinancialReviewNote(
      "",
      packet,
      ["workingCapital"],
      false,
    );
    expect(proposal.reason).toBeNull();
    expect(proposal.note).toContain(
      "App calculation Working capital (zero): USD 0; as of 2025-12-31;",
    );
    for (const label of ["current assets", "current liabilities"])
      expect(proposal.note).toContain(
        `${label} {USD 80.5; as of 2025-12-31; accession 0000000001-26-000001;`,
      );
    for (const value of [
      view(packet).liquidity.resolution.currentAssets,
      view(packet).liquidity.resolution.currentLiabilities,
    ]) {
      for (const id of value.observationIds)
        expect(proposal.note!.split(id)).toHaveLength(3);
    }
  });

  it("keeps independent flow periods and refuses to present mismatched operands as a calculated amount", async () => {
    const packet = await admitted({
      cashRows: [
        cashRow("operating_cash_flow", "100.125", {
          startDate: "2025-01-02",
          durationDays: 364,
        }),
        cashRow("ppe_purchases", "200.25"),
      ],
    });
    const selected = proposeFinancialReviewNote(
      "",
      packet,
      ["operatingCashFlow", "operatingIncome"],
      false,
    );
    expect(selected.reason).toBeNull();
    expect(selected.note).toContain("period 2025-01-01 to 2025-12-31");
    expect(selected.note).toContain("period 2025-01-02 to 2025-12-31");
    const calculated = proposeFinancialReviewNote(
      "",
      packet,
      ["operatingCashFlowLessPpePurchases"],
      false,
    );
    expect(calculated.reason).toBeNull();
    expect(calculated.note).toContain("USD unavailable (period_mismatch)");
    expect(calculated.note).toContain("operating cash flow {USD 100.125;");
    expect(calculated.note).toContain("PP&E purchases {USD 200.25;");
    expect(calculated.note).toContain("period 2025-01-02 to 2025-12-31");
    expect(calculated.note).toContain("period 2025-01-01 to 2025-12-31");
    expect(calculated.note).not.toContain("USD -100.125");
    for (const id of view(packet).cashGeneration.resolution
      .operatingCashFlowLessPpePurchases.observationIds)
      expect(calculated.note!.split(id)).toHaveLength(3);
  });

  it("preserves all observation IDs when equal amounts have multiple admitted observations", async () => {
    const packet = await admitted({
      operatingRows: [
        operatingRow("125.125"),
        operatingRow("125.125", {
          frame: null,
          sourceLocator: "/facts/us-gaap/OperatingIncomeLoss/units/USD/1",
        }),
      ],
    });
    const value = view(packet).operatingResults.resolution.operatingIncome;
    expect(value.status).toBe("available");
    expect(value.observationIds).toHaveLength(2);
    const proposal = proposeFinancialReviewNote(
      "",
      packet,
      ["operatingIncome"],
      false,
    );
    expect(proposal.reason).toBeNull();
    for (const id of value.observationIds)
      expect(proposal.note!.split(id)).toHaveLength(2);
  });

  it("preserves refusal reasons independently of another available selection", async () => {
    const packet = await admitted({ operatingRows: [] });
    const proposal = proposeFinancialReviewNote(
      "",
      packet,
      ["operatingIncome", "shareholdersEquity"],
      false,
    );
    expect(proposal.reason).toBeNull();
    expect(proposal.note).toContain(
      "Reported operating income: USD unavailable (concept_missing); observations [none].",
    );
    expect(proposal.note).toContain(
      "Reported parent equity (negative): USD -15.25",
    );
  });

  it("preserves source refusal and absent capture time rather than inventing a successful load", async () => {
    const packet = await admitted({ mode: "source-unavailable" });
    const proposal = proposeFinancialReviewNote(
      "",
      packet,
      ["operatingIncome", "shareholdersEquity"],
      true,
    );
    expect(proposal.reason).toBeNull();
    expect(
      proposal.note!.match(/USD unavailable \(source_unavailable\)/gu),
    ).toHaveLength(2);
    expect(proposal.note).toContain(
      "Company Facts upstream_unavailable, captured unavailable",
    );
    expect(proposal.note).toContain(
      "Submissions available, captured 2026-09-20T00:00:02.000Z",
    );
    expect(proposal.note).toContain("Retained previous report.");
    expect(proposal.note).not.toContain("current use eligible");
  });

  it("retains an unresolved target and its reason without constructing a filing index", async () => {
    const raw = await admitted({
      operatingRows: [],
      cashRows: [],
      liquidityRows: [],
      balanceRows: [],
    });
    const packet = await parseAnnualComparisonFixture({
      ...raw,
      evidence: {
        ...raw.evidence,
        target: { status: "unresolved", reason: "no_observed_annual_target" },
        targetScan: {
          currentFilings: 0,
          annualFilings: 0,
          olderHistoryAvailable: false,
        },
        facts: {
          ...raw.evidence.facts,
          observations: [],
          scans: raw.evidence.facts.scans.map((item) => ({
            ...item,
            scan:
              item.scan.status === "available"
                ? {
                    ...item.scan,
                    coverage: {
                      ...item.scan.coverage,
                      selected: null,
                      otherAccessions: null,
                      returned: 0,
                      omittedSelected: null,
                    },
                  }
                : item.scan,
          })),
        },
      },
    });
    const proposal = proposeFinancialReviewNote(
      "",
      packet,
      ["operatingIncome"],
      false,
    );
    expect(proposal.reason).toBeNull();
    expect(proposal.note).toContain(
      "Target unresolved (no_observed_annual_target); filing index unavailable.",
    );
    expect(proposal.note).not.toContain("https://www.sec.gov/Archives/");
  });

  it("keeps each historical value and operand qualified at the original clock without a refresh", async () => {
    const packet = await admitted({ cutoffAt: "2028-09-20T00:00:00.000Z" });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2040-01-01T00:00:00.000Z"));
      const proposal = proposeFinancialReviewNote(
        "",
        packet,
        ["workingCapital"],
        true,
      );
      expect(proposal.reason).toBeNull();
      expect(
        proposal.note!.match(/historical; current use ineligible/gu),
      ).toHaveLength(3);
      expect(proposal.note).toContain("cutoff 2028-09-20T00:00:00.000Z");
      expect(proposal.note).toContain(
        "Retained previous report. No source refresh.",
      );
      expect(proposal.note).not.toContain("2040");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(
    [
      [],
      ["operatingIncome", "operatingIncome"],
      ["not-a-check"],
      ["operatingIncome", "not-a-check"],
      [...allKeys, "sixth-check"],
    ].map((keys) => ({ keys })),
  )(
    "refuses empty, duplicate, oversized or unknown selection $keys",
    async ({ keys }) => {
      const packet = await admitted();
      const proposal = proposeFinancialReviewNote(
        "keep this",
        packet,
        keys as PersonalSecAnnualFinancialReviewKey[],
        false,
      );
      expect(proposal.note).toBeNull();
      expect(proposal.excerpt).toBeNull();
      expect(proposal.reason).toContain("Select at least one");
    },
  );

  it.each(["😀".repeat(2001), "draft\nnext", "draft\u0000next", "draft\ud800"])(
    "refuses invalid current notes without partial proposals",
    async (note) => {
      const proposal = proposeFinancialReviewNote(
        note,
        await admitted(),
        ["operatingIncome"],
        false,
      );
      expect(proposal).toEqual({
        note: null,
        excerpt: null,
        reason: "Correct the current note before adding this review.",
      });
    },
  );

  it("preserves raw Unicode and whitespace while checking the whole normalized note at exactly 2,000 code points", async () => {
    const packet = await admitted();
    const excerpt = proposeFinancialReviewNote(
      "",
      packet,
      ["operatingIncome"],
      false,
    ).excerpt!;
    const prefix = `  Cafe\u0301 ${"😀".repeat(2000 - [...excerpt].length - 8)}  `;
    const exact = proposeFinancialReviewNote(
      prefix,
      packet,
      ["operatingIncome"],
      false,
    );
    expect(exact.reason).toBeNull();
    expect(exact.note).toBe(`${prefix} ${excerpt}`);
    expect(exact.note!.slice(0, prefix.length)).toBe(prefix);
    const normalized = normalizeWatchlistNote(exact.note!);
    expect([...normalized!]).toHaveLength(2000);
    expect(normalized).toBe(
      `Café ${"😀".repeat(2000 - [...excerpt].length - 8)}   ${excerpt}`,
    );
    const over = proposeFinancialReviewNote(
      `${prefix}😀`,
      packet,
      ["operatingIncome"],
      false,
    );
    expect(over.note).toBeNull();
    expect(over.excerpt).toBe(excerpt);
    expect(over.reason).toContain("2,000-character limit");
  });

  it("refuses an append that would turn trailing whitespace into an invalid interior line break", async () => {
    const note = "keep this raw draft\n";
    expect(normalizeWatchlistNote(note)).toBe("keep this raw draft");
    const proposal = proposeFinancialReviewNote(
      note,
      await admitted(),
      ["operatingIncome"],
      false,
    );
    expect(proposal.note).toBeNull();
    expect(proposal.reason).toContain("single-line");
    expect(proposal.excerpt).not.toBeNull();
  });

  it("refuses the entire oversized selection and leaves every selected fact in the preview", async () => {
    const packet = await admitted();
    const proposal = proposeFinancialReviewNote(
      "preserve this draft",
      packet,
      allKeys,
      false,
    );
    expect(proposal.note).toBeNull();
    expect(proposal.reason).toContain("2,000-character limit");
    expect([...proposal.excerpt!].length).toBeGreaterThan(2000);
    for (const row of view(packet).financialReview)
      expect(proposal.excerpt).toContain(row.label);
    expect(proposal.excerpt).toContain("generation ");
    expect(proposal.excerpt).toContain("No source refresh.");
  });

  it("refuses the same complete suffix even after selection reordering and surrounding whitespace", async () => {
    const packet = await admitted();
    const first = proposeFinancialReviewNote(
      "my thesis",
      packet,
      ["operatingIncome", "shareholdersEquity"],
      false,
    );
    expect(first.reason).toBeNull();
    const duplicate = proposeFinancialReviewNote(
      ` ${first.note!} `,
      packet,
      ["shareholdersEquity", "operatingIncome"],
      false,
    );
    expect(duplicate.note).toBeNull();
    expect(duplicate.excerpt).toBe(first.excerpt);
    expect(duplicate.reason).toContain("already at the end");
  });
});
