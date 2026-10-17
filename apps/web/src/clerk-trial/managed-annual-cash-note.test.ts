import type {
  PersonalSecAnnualCashResolutionDto,
  PersonalSecAnnualCashObservationDto,
  PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { describe, expect, it, vi } from "vitest";
import { cashRow } from "../features/research/sec-annual-cash-fixture";
import { row } from "../features/research/sec-annual-evidence-fixture";
import { admitUiPacket } from "../features/research/test-canonical-annual-ui-fixture";
import {
  annualComparisonResponse,
  viewOf as view,
} from "./test-canonical-annual-comparison-fixture";
import { annualCashNoteExcerpt } from "./managed-annual-cash-note";

type Report = PersonalSecAnnualCanonicalResponseDto;
const cashResponse = (
  inputs: readonly PersonalSecAnnualCashObservationDto[],
  cutoffAt?: string,
) =>
  annualComparisonResponse("left", {
    rows: [row(), row("NetIncomeLoss", "100")],
    cashRows: inputs,
    ...(cutoffAt ? { cutoffAt } : {}),
  });
const rows = () => [
  cashRow("operating_cash_flow", "1000"),
  cashRow("ppe_purchases", "250"),
];
const fixture = () => cashResponse(rows());
const expected =
  "Observed Annual cash generation: ZERO (XNAS); CIK 0000000001; 10-K 2025-01-01 to 2025-12-31. Reported operating cash flow (NetCashProvidedByUsedInOperatingActivities) USD 1000; reported PP&E purchases (PaymentsToAcquirePropertyPlantAndEquipment) USD 250. App calculation: operating cash flow less PP&E purchases USD 750. Same filing and period; no adjustments for leases, acquisitions or other investing cash flows. Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.";

async function admitted(wire: Report): Promise<Report> {
  return admitUiPacket(wire);
}

function resolutionPatch(
  report: Report,
  changes: Partial<PersonalSecAnnualCashResolutionDto>,
): Report {
  // Serialized calculation overlays are closed-wire/ownership refusals in v6.
  const unowned = {
    ...report,
    evidence: {
      ...report.evidence,
      cashGeneration: {
        resolution: { ...view(report).cashGeneration.resolution, ...changes },
      },
    },
  };
  return unowned;
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
    const report = await annualComparisonResponse("left", {
      rows: [],
      cashRows: rows(),
    });
    expect(view(report).income.resolution.currentTargetEligible).toBe(false);
    expect(annualCashNoteExcerpt(report, false)).toBe(expected);
  });

  it("keeps valid cash when the independent income scan failed", async () => {
    const report = await annualComparisonResponse("left", {
      mode: "income-invalid",
      cashRows: rows(),
    });
    expect(view(report).income.reason).toBe("invalid_response");
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
  ])(
    "refuses an opaque serialized calculation/provenance overlay %j",
    async (changes) => {
      const report = await fixture();
      const value =
        view(report).cashGeneration.resolution
          .operatingCashFlowLessPpePurchases;
      expect(value.status).toBe("available");
      await expect(
        admitUiPacket(
          resolutionPatch(report, {
            operatingCashFlowLessPpePurchases: { ...value, ...changes },
          }),
        ),
      ).rejects.toThrow("Invented canonical UI evidence was refused");
      expect(
        annualCashNoteExcerpt(
          resolutionPatch(report, {
            operatingCashFlowLessPpePurchases: { ...value, ...changes },
          }),
          false,
        ),
      ).toBeNull();
    },
  );

  it("refuses a resolution imported from another report and stale changed operands", async () => {
    const report = await fixture();
    const other = await cashResponse([
      cashRow("operating_cash_flow", "2000"),
      cashRow("ppe_purchases", "250"),
    ]);
    expect(
      annualCashNoteExcerpt(
        resolutionPatch(report, view(other).cashGeneration.resolution),
        false,
      ),
    ).toBeNull();
    const changed = {
      ...report,
      evidence: {
        ...report.evidence,
        facts: {
          ...report.evidence.facts,
          observations: report.evidence.facts.observations.map((item) =>
            item.concept === "NetCashProvidedByUsedInOperatingActivities"
              ? other.evidence.facts.observations.find(
                  (row) => row.concept === item.concept,
                )!
              : item,
          ),
        },
      },
    };
    expect(annualCashNoteExcerpt(changed, false)).toBeNull();
    await expect(admitUiPacket(changed)).rejects.toThrow(
      "Invented canonical UI evidence was refused",
    );
    expect(annualCashNoteExcerpt(other, false)).toContain(
      "operating cash flow less PP&E purchases USD 1750",
    );
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
    const foreign = {
      ...report,
      evidence: {
        ...report.evidence,
        facts: {
          ...report.evidence.facts,
          observations: report.evidence.facts.observations.map((item) =>
            item.concept === "PaymentsToAcquirePropertyPlantAndEquipment"
              ? {
                  ...item,
                  filing: {
                    ...item.filing,
                    sourceUrl:
                      "https://www.sec.gov/Archives/edgar/data/2/0000000002-26-000001-index.htm",
                  },
                }
              : item,
          ),
        },
      },
    };
    expect(annualCashNoteExcerpt(foreign, false)).toBeNull();
    await expect(admitUiPacket(foreign)).rejects.toThrow(
      "Invented canonical UI evidence was refused",
    );
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
    const inconsistent = {
      ...report,
      evidence: {
        ...report.evidence,
        facts: {
          ...report.evidence.facts,
          scans: report.evidence.facts.scans.map((item) =>
            item.concept === "NetCashProvidedByUsedInOperatingActivities" &&
            item.scan.status === "available"
              ? {
                  ...item,
                  scan: {
                    ...item.scan,
                    coverage: { ...item.scan.coverage, selected: 10001 },
                  },
                }
              : item,
          ),
        },
      },
    };
    const before = JSON.stringify(inconsistent);
    expect(annualCashNoteExcerpt(inconsistent, false)).toBeNull();
    await expect(admitUiPacket(inconsistent)).rejects.toThrow(
      "Invented canonical UI evidence was refused",
    );
    expect(JSON.stringify(inconsistent)).toBe(before);
  });
});
