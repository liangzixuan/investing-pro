import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { annualReportPacket } from "./test-annual-report-fixture";
import { getManagedAnnualView } from "./managed-annual-view";
import { annualNoteExcerpt } from "./managed-annual-note";
import { annualCashNoteExcerpt } from "./managed-annual-cash-note";
import { annualLiquidityNoteExcerpt } from "./managed-annual-liquidity-note";
import { annualOperatingNoteExcerpt } from "./managed-annual-operating-note";
import { proposeFinancialReviewNote } from "./managed-financial-review-note";
import { getAnnualComparisonNoteEvidence } from "./managed-watchlist-annual-comparison-note";
import { projectAnnualComparison } from "./managed-annual-comparison-display";
import { eodSelection } from "./eod-history-fixture";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("canonical Annual note actions", () => {
  it("keeps exact amounts, original source dates and references through all existing note groups", async () => {
    const fetch = vi.fn(() => {
      throw new Error("No source request");
    });
    vi.stubGlobal("fetch", fetch);
    const response = await annualReportPacket();
    const view = getManagedAnnualView(response)!;
    const pair = view.income.resolution.bases[1]!.pairs[0]!;
    const operating = view.operatingResults.resolution.margins[1]!;
    const snippets = [
      annualNoteExcerpt(response, pair, false),
      annualCashNoteExcerpt(response, false),
      annualLiquidityNoteExcerpt(response, false),
      annualOperatingNoteExcerpt(response, operating, false),
    ];
    for (const text of snippets) {
      expect(text).not.toBeNull();
      expect(text).toContain("9007199254740993.000000000000000001");
      expect(text).toContain(response.evidence.generation.cutoffAt);
      expect(text).toContain("https://www.sec.gov/Archives/edgar/data/1/");
      expect(text).toContain("does not refresh sources");
    }
    const proposal = proposeFinancialReviewNote(
      "Authored note.",
      response,
      ["shareholdersEquity"],
      false,
    );
    expect(proposal.reason).toBeNull();
    expect(proposal.note).toContain("Authored note.");
    expect(proposal.note).toContain("-9007199254740993.000000000000000001");
    expect(proposal.note).toContain(response.evidence.generation.sha256);
    expect(fetch).not.toHaveBeenCalled();
    expect(getManagedAnnualView(response)).toBe(view);
  });

  it("requires the exact selected pair and basis from the cached current graph", async () => {
    const response = await annualReportPacket();
    const view = getManagedAnnualView(response)!;
    const pair = view.income.resolution.bases[1]!.pairs[0]!;
    const basis = view.operatingResults.resolution.margins[1]!;
    expect(
      annualNoteExcerpt(response, structuredClone(pair), false),
    ).toBeNull();
    expect(
      annualOperatingNoteExcerpt(response, structuredClone(basis), false),
    ).toBeNull();
    const other = await annualReportPacket();
    expect(annualNoteExcerpt(other, pair, false)).toBeNull();
    expect(annualOperatingNoteExcerpt(other, basis, false)).toBeNull();
  });

  it("preserves independent cash and balance notes when income failed", async () => {
    const response = await annualReportPacket("left", {
      mode: "income-invalid",
    });
    const view = getManagedAnnualView(response)!;
    expect(view.income.resolution.pairs).toEqual([]);
    expect(annualCashNoteExcerpt(response, true)).toContain(
      "Retained previous report",
    );
    expect(annualLiquidityNoteExcerpt(response, true)).toContain(
      "Retained previous report",
    );
    expect(
      annualOperatingNoteExcerpt(
        response,
        view.operatingResults.resolution.margins[1]!,
        false,
      ),
    ).toBeNull();
    expect(
      proposeFinancialReviewNote("", response, ["operatingIncome"], false).note,
    ).not.toBeNull();
  });

  it("refuses whole overlong notes without clipping authored text or provenance", async () => {
    const response = await annualReportPacket();
    const note = "a".repeat(2000);
    const proposal = proposeFinancialReviewNote(
      note,
      response,
      ["shareholdersEquity"],
      false,
    );
    expect(proposal.note).toBeNull();
    expect(proposal.reason).toContain("2,000-character limit");
    expect(proposal.excerpt).toContain(response.evidence.generation.sha256);
    expect(proposal.excerpt).toContain("-9007199254740993.000000000000000001");
    expect(note).toHaveLength(2000);
  });

  it("rejects unowned responses without invoking their fields", async () => {
    const response = await annualReportPacket();
    const view = getManagedAnnualView(response)!;
    const getter = vi.fn();
    const forged = new Proxy(
      {},
      { get: getter, ownKeys: getter },
    ) as PersonalSecAnnualCanonicalResponseDto;
    expect(
      annualNoteExcerpt(
        forged,
        view.income.resolution.bases[1]!.pairs[0]!,
        false,
      ),
    ).toBeNull();
    expect(annualCashNoteExcerpt(forged, false)).toBeNull();
    expect(annualLiquidityNoteExcerpt(forged, false)).toBeNull();
    expect(
      annualOperatingNoteExcerpt(
        forged,
        view.operatingResults.resolution.margins[1]!,
        false,
      ),
    ).toBeNull();
    expect(
      proposeFinancialReviewNote("", forged, ["operatingIncome"], false).note,
    ).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it("keeps each company's admitted graph, basis and original qualifications in comparison notes", async () => {
    const left = await annualReportPacket();
    const right = await annualReportPacket("right", { mode: "exact-decimal" });
    const leftMember = { handle: Symbol(), listing: eodSelection.listing };
    const rightMember = {
      handle: Symbol(),
      listing: {
        ...eodSelection.listing,
        issuerId: right.security.issuerId,
        issuerName: right.security.issuerName,
        listingId: right.security.listingId,
        securityName: right.security.securityName,
        symbol: right.security.symbol,
        shareClassId: "class-one",
        shareClassName: "Common Stock",
      },
    };
    const capture = {
      left: {
        member: leftMember,
        response: left,
        selectedBasis: "Revenues",
        showingPrevious: false,
      },
      right: {
        member: rightMember,
        response: right,
        selectedBasis: "Revenues",
        showingPrevious: true,
      },
    };
    for (const group of ["income", "cash", "liquidity", "operating"] as const) {
      const result = getAnnualComparisonNoteEvidence({ ...capture, group });
      expect(result.reason).toBeNull();
      expect(result.excerpt).toContain(left.security.symbol);
      expect(result.excerpt).toContain(right.security.symbol);
      expect(result.excerpt).toContain("Retained previous report");
    }
    const projection = projectAnnualComparison(
      left,
      getManagedAnnualView(left),
      "Revenues",
    );
    expect(projection.current?.revenueUSD).toBe(
      "9007199254740993.000000000000000001",
    );
    expect(
      projectAnnualComparison(left, getManagedAnnualView(right), "Revenues")
        .current,
    ).toBeNull();
  });
});
