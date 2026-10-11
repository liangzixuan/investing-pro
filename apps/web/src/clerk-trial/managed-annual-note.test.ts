import { describe, expect, it } from "vitest";
import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualPairDto,
} from "@research-cockpit/contracts";
import {
  annualComparativeRows,
  annualHistoryRows,
  response,
} from "../features/research/sec-annual-evidence-fixture";
import { annualNoteExcerpt } from "./managed-annual-note";

const expected =
  "Observed Annual report: ZERO (XNAS); 10-K 2025-01-01 to 2025-12-31; Revenues revenue USD 1000; NetIncomeLoss USD 100; net margin 10%. Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.";

function replacePair(
  report: PersonalSecAnnualEvidenceResponseDto,
  changes: Partial<PersonalSecAnnualPairDto>,
) {
  const basis = report.evidence.resolution.bases.find(
    (item) => item.status === "eligible",
  )!;
  const pair = { ...basis.pairs[0]!, ...changes };
  return {
    pair,
    report: {
      ...report,
      evidence: {
        ...report.evidence,
        resolution: {
          ...report.evidence.resolution,
          bases: [{ ...basis, pairs: [pair] }],
        },
      },
    },
  };
}

describe("managed Annual note excerpt", () => {
  it.each(["0", "-640"])(
    "keeps the third-period amounts with an unavailable margin for revenue %s",
    async (value) => {
      const report = await response(
        annualHistoryRows().map((r) =>
          r.metric === "revenue" && r.endDate === "2023-12-31"
            ? { ...r, value }
            : r,
        ),
      );
      const pair = report.evidence.resolution.bases.find(
        (b) => b.status === "eligible",
      )!.pairs[0]!;
      const text = annualNoteExcerpt(report, pair, false)!;
      expect(text).toContain(
        `Additional same-filing annual period: 2023-01-01 to 2023-12-31; Revenues revenue USD ${value}; NetIncomeLoss USD 32; net margin unavailable because revenue is not positive.`,
      );
      expect(text).toContain(
        "Revenues revenue USD 800 to 1000, change USD 200 (25%)",
      );
      expect(text).not.toContain("Infinity");
      expect(text).toContain(
        `Revenues revenue change USD ${value === "0" ? "800" : "1440"} (Unavailable: prior value is ${value === "0" ? "zero" : "negative"})`,
      );
    },
  );
  it("adds the admitted third period to the same explicit draft excerpt with original provenance", async () => {
    const report = await response(annualHistoryRows());
    const pair = report.evidence.resolution.bases.find(
      (b) => b.status === "eligible",
    )!.pairs[0]!;
    const text = annualNoteExcerpt(report, pair, false)!;
    expect(text).toContain(
      "Earlier same-filing annual comparison: prior 2023-01-01 to 2023-12-31; current 2024-01-01 to 2024-12-31; Revenues revenue change USD 160 (25%); NetIncomeLoss change USD 48 (150%).",
    );
    expect(text.length).toBeLessThan(2000);
    expect(text).toContain(
      "Additional same-filing annual period: 2023-01-01 to 2023-12-31; Revenues revenue USD 640; NetIncomeLoss USD 32; net margin 5%.",
    );
    expect(text).toContain("Original load cutoff 2026-09-20T00:00:00.000Z");
    expect(text.length).toBeLessThan(2000);
    expect(annualNoteExcerpt(report, pair, true)).toContain(
      "Retained previous report.",
    );
  });
  it("adds available same-filing comparison to the same dated excerpt without changing original-load provenance", async () => {
    const report = await response(annualComparativeRows());
    const pair = report.evidence.resolution.bases.find(
      (basis) => basis.status === "eligible",
    )!.pairs[0]!;
    const text = annualNoteExcerpt(report, pair, true)!;
    expect(text).toContain(
      "Same-filing annual comparison: prior 2024-01-01 to 2024-12-31; Revenues revenue USD 800 to 1000, change USD 200 (25%); NetIncomeLoss USD 80 to 100, change USD 20 (25%).",
    );
    expect(text).toContain(
      "Period length, accounting changes and restatements are unadjusted",
    );
    expect(text).toContain(
      "Reported net margin 10% to 10%, change 0 percentage points.",
    );
    expect(text).toContain("Original load cutoff 2026-09-20T00:00:00.000Z");
    expect(text).toContain("Retained previous report.");
    expect(text.length).toBeLessThan(2000);
    const historical = await response(
      annualComparativeRows(),
      "2027-09-20T00:00:00.000Z",
    );
    const oldPair = historical.evidence.resolution.bases.find(
      (basis) => basis.status === "eligible",
    )!.pairs[0]!;
    expect(annualNoteExcerpt(historical, oldPair, false)).not.toContain(
      "Same-filing annual comparison",
    );
  });

  it("adds loss-to-profit margin change while keeping nonpositive prior income change unavailable", async () => {
    const input = annualComparativeRows().map((r) =>
      r.metric === "net_income" && r.endDate === "2024-12-31"
        ? { ...r, value: "-80" }
        : r,
    );
    const report = await response(input);
    const pair = report.evidence.resolution.bases.find(
      (basis) => basis.status === "eligible",
    )!.pairs[0]!;
    const text = annualNoteExcerpt(report, pair, false)!;
    expect(text).toContain(
      "NetIncomeLoss USD -80 to 100, change USD 180 (Unavailable: prior value is negative).",
    );
    expect(text).toContain(
      "Reported net margin -10% to 10%, change 20 percentage points.",
    );
  });

  it.each(["0", "-800"])(
    "explains unavailable margin for prior revenue %s without dropping exact annual comparison",
    async (value) => {
      const input = annualComparativeRows().map((r) =>
        r.metric === "revenue" && r.endDate === "2024-12-31"
          ? { ...r, value }
          : r,
      );
      const report = await response(input);
      const pair = report.evidence.resolution.bases.find(
        (basis) => basis.status === "eligible",
      )!.pairs[0]!;
      const text = annualNoteExcerpt(report, pair, false)!;
      expect(text).toContain(`Revenues revenue USD ${value} to 1000`);
      expect(text).toContain(
        `Reported net-margin comparison unavailable: prior revenue is ${value === "0" ? "zero" : "negative"}.`,
      );
      expect(text).not.toContain("Infinity");
    },
  );
  it("retains exact values, named basis, filing and original source times in one paragraph", async () => {
    const report = await response();
    const pair = report.evidence.resolution.bases.find(
      (basis) => basis.status === "eligible",
    )!.pairs[0]!;
    expect(annualNoteExcerpt(report, pair, false)).toBe(expected);
    expect(annualNoteExcerpt(report, pair, true)).toBe(
      expected.replace(
        "Evidence dates are unchanged;",
        "Retained previous report. Evidence dates are unchanged;",
      ),
    );
    expect(annualNoteExcerpt(report, { ...pair }, false)).toBeNull();
  });

  it("copies decimal strings without Number conversion or scaling", async () => {
    const { report, pair } = replacePair(await response(), {
      revenue: "9007199254740993123.0000000001",
      netIncome: "-0.000000001",
      netMarginPercent: "-0.01",
    });
    const text = annualNoteExcerpt(report, pair, false)!;
    expect(text).toContain(
      "Revenues revenue USD 9007199254740993123.0000000001",
    );
    expect(text).toContain("NetIncomeLoss USD -0.000000001; net margin -0.01%");
    expect(text).not.toMatch(/[\r\n]/u);
  });

  it("qualifies historical evidence against the original load rather than the current clock", async () => {
    const report = await response(undefined, "2027-09-20T00:00:00.000Z");
    const pair = report.evidence.resolution.bases.find(
      (basis) => basis.status === "eligible",
    )!.pairs[0]!;
    expect(report.evidence.resolution.currentTargetEligible).toBe(false);
    const text = annualNoteExcerpt(report, pair, true)!;
    expect(text).toContain(
      "Historical evidence; current-use policy at original load: unavailable. Retained previous report.",
    );
    expect(text).toContain("Original load cutoff 2027-09-20T00:00:00.000Z");
  });

  it.each([
    { status: "nonpositive_revenue" as const },
    { accessionNumber: "0000000001-25-000001" },
    { endDate: "2024-12-31" },
    { startDate: null },
    { revenue: null },
    { netIncome: null },
    { netMarginPercent: null },
  ])("rejects an ineligible or mismatched pair %j", async (changes) => {
    const { report, pair } = replacePair(await response(), changes);
    expect(annualNoteExcerpt(report, pair, false)).toBeNull();
  });

  it.each(["missing", "rejected", "withheld"] as const)(
    "rejects a pair inside a %s basis even when the pair says eligible",
    async (status) => {
      const { report, pair } = replacePair(await response(), {});
      const refused = {
        ...report,
        evidence: {
          ...report.evidence,
          resolution: {
            ...report.evidence.resolution,
            bases: report.evidence.resolution.bases.map((basis) => ({
              ...basis,
              status,
            })),
          },
        },
      };
      expect(annualNoteExcerpt(refused, pair, false)).toBeNull();
    },
  );

  it("rejects refused completeness, an unresolved target and missing source capture", async () => {
    const { report, pair } = replacePair(await response(), {});
    expect(
      annualNoteExcerpt(
        {
          ...report,
          evidence: {
            ...report.evidence,
            completeness: { status: "refused", reason: "source_unavailable" },
          },
        },
        pair,
        false,
      ),
    ).toBeNull();
    expect(
      annualNoteExcerpt(
        {
          ...report,
          evidence: {
            ...report.evidence,
            target: {
              status: "unresolved",
              reason: "no_observed_annual_target",
            },
          },
        },
        pair,
        false,
      ),
    ).toBeNull();
    expect(
      annualNoteExcerpt(
        {
          ...report,
          evidence: {
            ...report.evidence,
            generation: {
              ...report.evidence.generation,
              sources: {
                ...report.evidence.generation.sources,
                companyFacts: {
                  ...report.evidence.generation.sources.companyFacts,
                  fetchedAt: null,
                },
              },
            },
          },
        },
        pair,
        false,
      ),
    ).toBeNull();
  });
});
