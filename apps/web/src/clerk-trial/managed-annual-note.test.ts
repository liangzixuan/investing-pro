import { describe, expect, it } from "vitest";
import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualPairDto,
} from "@research-cockpit/contracts";
import { response } from "../features/research/sec-annual-evidence-fixture";
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
