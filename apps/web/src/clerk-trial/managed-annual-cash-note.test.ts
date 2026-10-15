import { operatingResults } from "../features/research/sec-annual-operating-fixture";
import type {
  PersonalSecAnnualCashResolutionDto,
  PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualEvidence } from "@research-cockpit/personal-financial-analytics";
import { describe, expect, it, vi } from "vitest";
import {
  cashGeneration,
  cashResponse,
  cashRow,
} from "../features/research/sec-annual-cash-fixture";
import {
  request,
  response,
} from "../features/research/sec-annual-evidence-fixture";
import { parseSecAnnualEvidenceResponse } from "../lib/sec-annual-evidence-response";
import { annualCashNoteExcerpt } from "./managed-annual-cash-note";

type Report = PersonalSecAnnualEvidenceResponseDto;
const rows = () => [
  cashRow("operating_cash_flow", "1000"),
  cashRow("ppe_purchases", "250"),
];
const fixture = () => cashResponse(rows());
const expected =
  "Observed Annual cash generation: ZERO (XNAS); CIK 0000000001; 10-K 2025-01-01 to 2025-12-31. Reported operating cash flow (NetCashProvidedByUsedInOperatingActivities) USD 1000; reported PP&E purchases (PaymentsToAcquirePropertyPlantAndEquipment) USD 250. App calculation: operating cash flow less PP&E purchases USD 750. Same filing and period; no adjustments for leases, acquisitions or other investing cash flows. Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.";

async function admitted(wire: Report): Promise<Report> {
  const parsed = await parseSecAnnualEvidenceResponse(
    wire,
    request(),
    new AbortController().signal,
  );
  expect(parsed).not.toBeNull();
  return parsed!;
}

function resolutionPatch(
  report: Report,
  changes: Partial<PersonalSecAnnualCashResolutionDto>,
): Report {
  return {
    ...report,
    evidence: {
      ...report.evidence,
      cashGeneration: {
        ...report.evidence.cashGeneration,
        resolution: {
          ...report.evidence.cashGeneration.resolution,
          ...changes,
        },
      },
    },
  };
}

describe("managed Annual cash note excerpt", () => {
  it("copies all three exact amounts, both raw concepts and original provenance from a strictly admitted report", async () => {
    const report = await admitted(await fixture());
    const before = JSON.stringify(report);
    expect(annualCashNoteExcerpt(report, false)).toBe(expected);
    expect(annualCashNoteExcerpt(report, true)).toBe(
      expected.replace(
        "Evidence dates are unchanged;",
        "Retained previous report. Evidence dates are unchanged;",
      ),
    );
    expect(expected).not.toMatch(/[\r\n]/u);
    expect(expected.length).toBeLessThan(2000);
    expect(JSON.stringify(report)).toBe(before);
    expect(Object.isFrozen(report)).toBe(true);
  });

  it.each([
    [
      "9007199254740993123.0000000001",
      "0.0000000002",
      "9007199254740993122.9999999999",
    ],
    ["-0.0000000001", "0.0000000002", "-0.0000000003"],
    ["0", "0", "0"],
    ["100", "125", "-25"],
    [`${"9".repeat(62)}.1`, "0", `${"9".repeat(62)}.1`],
  ])(
    "preserves exact USD arithmetic for %s less %s",
    async (operating, purchases, difference) => {
      const report = await admitted(
        await cashResponse([
          cashRow("operating_cash_flow", operating),
          cashRow("ppe_purchases", purchases),
        ]),
      );
      const excerpt = annualCashNoteExcerpt(report, false)!;
      expect(excerpt).toContain(`OperatingActivities) USD ${operating}`);
      expect(excerpt).toContain(`PlantAndEquipment) USD ${purchases}`);
      expect(excerpt).toContain(
        `App calculation: operating cash flow less PP&E purchases USD ${difference}.`,
      );
      expect(excerpt.length).toBeLessThan(2000);
    },
  );

  it("uses cash current-use policy independently of missing revenue and income", async () => {
    const base = await response([]);
    const report = await admitted({
      ...base,
      evidence: {
        ...base.evidence,
        cashGeneration: await cashGeneration(base.evidence, rows()),
      },
    });
    expect(report.evidence.resolution.currentTargetEligible).toBe(false);
    expect(annualCashNoteExcerpt(report, false)).toBe(expected);
  });

  it("keeps valid cash when the independent income scan failed", async () => {
    const base = await fixture();
    const evidence = {
      ...base.evidence,
      incomeScanStatus: "invalid_response" as const,
      coverage: null,
      observations: [],
      completeness: {
        status: "refused" as const,
        reason: "source_unavailable" as const,
      },
    };
    const report = await admitted({
      ...base,
      evidence: {
        ...evidence,
        resolution: resolvePersonalSecAnnualEvidence(evidence),
        operatingResults: await operatingResults(evidence),
      },
    });
    expect(annualCashNoteExcerpt(report, false)).toBe(expected);
  });

  it("qualifies retained historical cash using only the original load clock", async () => {
    const report = await admitted(
      await cashResponse(rows(), "2028-09-20T00:00:00.000Z"),
    );
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2035-01-01T00:00:00.000Z"));
      const excerpt = annualCashNoteExcerpt(report, true)!;
      expect(excerpt).toContain(
        "Historical evidence; current-use policy at original load: unavailable. Retained previous report.",
      );
      expect(excerpt).toContain(
        "Original load cutoff 2028-09-20T00:00:00.000Z; completed 2028-09-20T00:00:02.000Z",
      );
      expect(excerpt).not.toContain("2035");
      expect(excerpt).toContain("purchases USD 750.");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(
    [
      [],
      [cashRow("operating_cash_flow", "1000")],
      [cashRow("ppe_purchases", "250")],
      [
        cashRow("operating_cash_flow", "1000"),
        cashRow("ppe_purchases", "-250"),
      ],
      [
        cashRow("operating_cash_flow", "1000"),
        cashRow("ppe_purchases", "250", {
          startDate: "2025-01-02",
          durationDays: 364,
        }),
      ],
    ].map((inputs) => ({ inputs })),
  )(
    "withholds incomplete or unavailable cash rather than producing a partial excerpt %#",
    async ({ inputs }) => {
      expect(
        annualCashNoteExcerpt(
          await admitted(await cashResponse(inputs)),
          false,
        ),
      ).toBeNull();
    },
  );

  it.each([
    { value: "751" },
    { startDate: "2025-01-02" },
    { endDate: "2025-12-30" },
    { accessionNumber: "0000000001-25-000001" },
    { observationIds: [`sec-fact:${"a".repeat(64)}` as const] },
    { currentUseEligible: false },
  ])("refuses an altered calculation or provenance %j", async (changes) => {
    const report = await fixture();
    const value =
      report.evidence.cashGeneration.resolution
        .operatingCashFlowLessPpePurchases;
    expect(value.status).toBe("available");
    expect(
      annualCashNoteExcerpt(
        resolutionPatch(report, {
          operatingCashFlowLessPpePurchases: { ...value, ...changes },
        }),
        false,
      ),
    ).toBeNull();
  });

  it("refuses a resolution imported from another report and stale changed operands", async () => {
    const report = await fixture();
    const other = await cashResponse([
      cashRow("operating_cash_flow", "2000"),
      cashRow("ppe_purchases", "250"),
    ]);
    expect(
      annualCashNoteExcerpt(
        resolutionPatch(report, other.evidence.cashGeneration.resolution),
        false,
      ),
    ).toBeNull();
    expect(
      annualCashNoteExcerpt(
        {
          ...report,
          evidence: {
            ...report.evidence,
            cashGeneration: {
              ...report.evidence.cashGeneration,
              operatingCashFlow:
                other.evidence.cashGeneration.operatingCashFlow,
            },
          },
        },
        false,
      ),
    ).toBeNull();
  });

  it("refuses a wrong issuer, unresolved target and foreign filing URL", async () => {
    const report = await fixture();
    expect(
      annualCashNoteExcerpt(
        { ...report, security: { ...report.security, cik: "0000000002" } },
        false,
      ),
    ).toBeNull();
    expect(
      annualCashNoteExcerpt(
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
        false,
      ),
    ).toBeNull();
    const cash = report.evidence.cashGeneration;
    expect(
      annualCashNoteExcerpt(
        {
          ...report,
          evidence: {
            ...report.evidence,
            cashGeneration: {
              ...cash,
              ppePurchases: {
                ...cash.ppePurchases,
                observations: cash.ppePurchases.observations.map((row) => ({
                  ...row,
                  filing: {
                    ...row.filing,
                    sourceUrl:
                      "https://www.sec.gov/Archives/edgar/data/2/0000000002-26-000001-index.htm",
                  },
                })),
              },
            },
          },
        },
        false,
      ),
    ).toBeNull();
  });

  it.each(["companyFacts", "submissions"] as const)(
    "refuses unavailable or uncaptured %s source",
    async (source) => {
      const report = await fixture();
      const generation = report.evidence.generation;
      for (const change of [
        { status: "upstream_unavailable" as const },
        { fetchedAt: null },
      ]) {
        expect(
          annualCashNoteExcerpt(
            {
              ...report,
              evidence: {
                ...report.evidence,
                generation: {
                  ...generation,
                  sources: {
                    ...generation.sources,
                    [source]: { ...generation.sources[source], ...change },
                  },
                },
              },
            },
            false,
          ),
        ).toBeNull();
      }
    },
  );

  it("refuses invalid counts without throwing or changing the packet", async () => {
    const report = await fixture();
    const cash = report.evidence.cashGeneration;
    const scan = cash.operatingCashFlow.scan;
    if (scan.status !== "available")
      throw new Error("Expected available fixture scan");
    const inconsistent = {
      ...report,
      evidence: {
        ...report.evidence,
        cashGeneration: {
          ...cash,
          operatingCashFlow: {
            ...cash.operatingCashFlow,
            scan: { ...scan, coverage: { ...scan.coverage, selected: 10001 } },
          },
        },
      },
    };
    const before = JSON.stringify(inconsistent);
    expect(annualCashNoteExcerpt(inconsistent, false)).toBeNull();
    expect(JSON.stringify(inconsistent)).toBe(before);
  });
});
