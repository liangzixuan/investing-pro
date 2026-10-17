import { describe, expect, it, vi } from "vitest";
import type {
  PersonalSecAnnualCanonicalResponseDto,
  PersonalSecAnnualLiquidityResolutionDto,
  PersonalSecAnnualLiquidityObservationDto,
} from "@research-cockpit/contracts";
import { liquidityRow } from "../features/research/sec-annual-liquidity-fixture";
import { cashRow } from "../features/research/sec-annual-cash-fixture";
import { row } from "../features/research/sec-annual-evidence-fixture";
import { admitUiPacket } from "../features/research/test-canonical-annual-ui-fixture";
import {
  annualComparisonResponse,
  viewOf as view,
} from "./test-canonical-annual-comparison-fixture";
import { annualLiquidityNoteExcerpt } from "./managed-annual-liquidity-note";

type Report = PersonalSecAnnualCanonicalResponseDto;
const liquidityResponse = (
  inputs: readonly PersonalSecAnnualLiquidityObservationDto[],
  cutoffAt?: string,
) =>
  annualComparisonResponse("left", {
    rows: [row(), row("NetIncomeLoss", "100")],
    liquidityRows: inputs,
    ...(cutoffAt ? { cutoffAt } : {}),
  });
const rows = () => [
  liquidityRow("current_assets", "120.125"),
  liquidityRow("current_liabilities", "80.025"),
];
const fixture = () => liquidityResponse(rows());
const expected =
  "Observed Annual liquidity: ZERO (XNAS); CIK 0000000001; 10-K balances at 2025-12-31. Reported current assets (AssetsCurrent) USD 120.125; reported current liabilities (LiabilitiesCurrent) USD 80.025. App calculations: working capital USD 40.1; current ratio 1.50 multiple (two decimal places, half up). Same filing and date. Current assets are not all cash. Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.";
async function admitted(wire: Report) {
  return admitUiPacket(wire);
}
function patch(
  report: Report,
  changes: Partial<PersonalSecAnnualLiquidityResolutionDto>,
): Report {
  // V6 has no serialized result slots; forged overlays have no decoder ownership.
  const unowned = {
    ...report,
    evidence: {
      ...report.evidence,
      liquidity: {
        resolution: { ...view(report).liquidity.resolution, ...changes },
      },
    },
  };
  return unowned;
}

describe("Annual liquidity note excerpt", () => {
  it("copies the complete admitted instant paragraph without changing frozen evidence", async () => {
    const report = await admitted(await fixture());
    const before = JSON.stringify(report);
    expect(annualLiquidityNoteExcerpt(report, false)).toBe(expected);
    expect(annualLiquidityNoteExcerpt(report, true)).toBe(
      expected.replace(
        "Evidence dates are unchanged;",
        "Retained previous report. Evidence dates are unchanged;",
      ),
    );
    expect([...expected]).toHaveLength(782);
    expect(expected).not.toMatch(/[\r\n]/u);
    expect(Object.isFrozen(report)).toBe(true);
    expect(JSON.stringify(report)).toBe(before);
  });

  it.each([
    ["100", "125", "-25", "0.80"],
    ["0", "125", "-125", "0.00"],
    [
      "9007199254740993123.0000000001",
      "0.0000000002",
      "9007199254740993122.9999999999",
      "45035996273704965615000000000.50",
    ],
  ])(
    "keeps exact balances and checked calculations for %s / %s",
    async (assets, liabilities, difference, ratio) => {
      const report = await admitted(
        await liquidityResponse([
          liquidityRow("current_assets", assets),
          liquidityRow("current_liabilities", liabilities),
        ]),
      );
      const text = annualLiquidityNoteExcerpt(report, false)!;
      expect(text).toContain(
        `(AssetsCurrent) USD ${assets}; reported current liabilities (LiabilitiesCurrent) USD ${liabilities}.`,
      );
      expect(text).toContain(
        `App calculations: working capital USD ${difference}; current ratio ${ratio} multiple`,
      );
      expect([...text].length).toBeLessThan(2000);
    },
  );

  it.each(["120.125", "0"])(
    "records the checked zero-liability refusal with assets %s",
    async (assets) => {
      const report = await admitted(
        await liquidityResponse([
          liquidityRow("current_assets", assets),
          liquidityRow("current_liabilities", "0"),
        ]),
      );
      expect(view(report).liquidity.resolution.currentRatio).toMatchObject({
        status: "unavailable",
        reason: "nonpositive_current_liabilities",
      });
      const text = annualLiquidityNoteExcerpt(report, false)!;
      expect(text).toContain(
        `App calculations: working capital USD ${assets}; current ratio unavailable because current liabilities are zero.`,
      );
      expect(text).not.toContain("Infinity");
      expect(text).not.toContain("current ratio 0");
    },
  );

  it("labels historical and retained evidence using only the original clock", async () => {
    const report = await admitted(
      await liquidityResponse(rows(), "2028-09-20T00:00:00.000Z"),
    );
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2035-01-01T00:00:00.000Z"));
      const text = annualLiquidityNoteExcerpt(report, true)!;
      expect(text).toContain(
        "Historical evidence; current-use policy at original load: unavailable. Retained previous report.",
      );
      expect(text).toContain("Original load cutoff 2028-09-20T00:00:00.000Z");
      expect(text).not.toContain("2035");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["missing", "invalid"])(
    "keeps valid liquidity independent of %s income and absent cash",
    async (income) => {
      const report = await annualComparisonResponse("left", {
        rows: [],
        cashRows: [],
        liquidityRows: rows(),
        ...(income === "invalid" ? { mode: "income-invalid" } : {}),
      });
      expect(view(report).income.resolution.currentTargetEligible).toBe(false);
      expect(
        view(report).cashGeneration.resolution.operatingCashFlow.status,
      ).toBe("unavailable");
      expect(annualLiquidityNoteExcerpt(report, false)).toBe(expected);
    },
  );

  it.each(
    [
      [],
      [liquidityRow("current_assets", "120")],
      [liquidityRow("current_liabilities", "80")],
      [
        liquidityRow("current_assets", "-120"),
        liquidityRow("current_liabilities", "80"),
      ],
      [
        liquidityRow("current_assets", "120"),
        liquidityRow("current_liabilities", "-80"),
      ],
      [
        liquidityRow("current_assets", "120", {
          startDate: "2025-01-01",
          durationDays: 365,
        }),
        liquidityRow("current_liabilities", "80"),
      ],
      [
        liquidityRow("current_assets", "120"),
        liquidityRow("current_liabilities", "80", { endDate: "2025-12-30" }),
      ],
      [
        liquidityRow("current_assets", "120"),
        liquidityRow("current_liabilities", "80", {
          accessionNumber: "0000000001-25-000001",
        }),
      ],
      [
        liquidityRow("current_assets", "120"),
        liquidityRow("current_assets", "121", {
          sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/1",
        }),
        liquidityRow("current_liabilities", "80"),
      ],
    ].map((inputs) => ({ inputs })),
  )(
    "refuses incomplete, negative, conflicting or incompatible operands %#",
    async ({ inputs }) => {
      const report = await admitted(await liquidityResponse(inputs));
      expect(annualLiquidityNoteExcerpt(report, false)).toBeNull();
    },
  );

  it.each([
    { value: "40.2" },
    { asOfDate: "2025-12-30" },
    { accessionNumber: "0000000001-25-000001" },
    { currentUseEligible: false },
    { observationIds: [`sec-fact:${"a".repeat(64)}` as const] },
  ])(
    "refuses opaque serialized calculation/provenance overlays %j",
    async (change) => {
      const report = await fixture();
      await expect(
        admitUiPacket(
          patch(report, {
            workingCapital: {
              ...view(report).liquidity.resolution.workingCapital,
              ...change,
            },
          }),
        ),
      ).rejects.toThrow("Invented canonical UI evidence was refused");
      expect(
        annualLiquidityNoteExcerpt(
          patch(report, {
            workingCapital: {
              ...view(report).liquidity.resolution.workingCapital,
              ...change,
            },
          }),
          false,
        ),
      ).toBeNull();
    },
  );

  it("does not invent a zero-liability refusal or accept an unrelated unavailable ratio", async () => {
    const report = await fixture();
    const currentRatio = view(report).liquidity.resolution.currentRatio;
    expect(
      annualLiquidityNoteExcerpt(
        patch(report, {
          currentRatio: {
            status: "unavailable",
            unit: "multiple",
            reason: "nonpositive_current_liabilities",
            observationIds: currentRatio.observationIds,
          },
        }),
        false,
      ),
    ).toBeNull();
    const zero = await liquidityResponse([
      liquidityRow("current_assets", "120"),
      liquidityRow("current_liabilities", "0"),
    ]);
    expect(
      annualLiquidityNoteExcerpt(
        patch(zero, {
          currentRatio: {
            status: "unavailable",
            unit: "multiple",
            reason: "source_stale",
            observationIds:
              view(zero).liquidity.resolution.currentRatio.observationIds,
          },
        }),
        false,
      ),
    ).toBeNull();
  });

  it.each(["income", "operating", "purchases"])(
    "reserves existing %s observation identities",
    async (metric) => {
      const report = await annualComparisonResponse("left", {
        liquidityRows: rows(),
        cashRows: [
          cashRow("operating_cash_flow", "100"),
          cashRow("ppe_purchases", "25"),
        ],
      });
      const changed = structuredClone(report);
      const concept =
        metric === "income"
          ? "NetIncomeLoss"
          : metric === "operating"
            ? "NetCashProvidedByUsedInOperatingActivities"
            : "PaymentsToAcquirePropertyPlantAndEquipment";
      const target = changed.evidence.facts.observations.find(
        (row) => row.concept === concept,
      )!;
      Reflect.set(
        target,
        "id",
        changed.evidence.facts.observations.find(
          (row) => row.concept === "AssetsCurrent",
        )!.id,
      );
      expect(annualLiquidityNoteExcerpt(changed, false)).toBeNull();
      await expect(admitUiPacket(changed)).rejects.toThrow(
        "Invented canonical UI evidence was refused",
      );
    },
  );

  it.each([
    "wrong issuer",
    "unresolved target",
    "foreign filing URL",
    "changed source value",
  ])("refuses %s", async (kind) => {
    const report = structuredClone(await fixture());
    if (kind === "wrong issuer")
      Reflect.set(report.security, "cik", "0000000002");
    else if (kind === "unresolved target")
      Reflect.set(report.evidence, "target", {
        status: "unresolved",
        reason: "no_observed_annual_target",
      });
    else if (kind === "foreign filing URL")
      Reflect.set(
        report.evidence.facts.observations.find(
          (row) => row.concept === "AssetsCurrent",
        )!.filing,
        "sourceUrl",
        "https://example.invalid/",
      );
    else
      Reflect.set(
        report.evidence.facts.observations.find(
          (row) => row.concept === "AssetsCurrent",
        )!,
        "value",
        "121",
      );
    expect(annualLiquidityNoteExcerpt(report, false)).toBeNull();
    await expect(admitUiPacket(report)).rejects.toThrow(
      "Invented canonical UI evidence was refused",
    );
  });

  it.each(["companyFacts", "submissions"] as const)(
    "refuses unavailable, missing or stale %s timestamps",
    async (source) => {
      for (const change of [
        { status: "upstream_unavailable" },
        { fetchedAt: null },
        { fetchedAt: "2026-09-01T00:00:00.000Z" },
      ]) {
        const report = structuredClone(await fixture());
        Object.assign(report.evidence.generation.sources[source], change);
        expect(annualLiquidityNoteExcerpt(report, false)).toBeNull();
        await expect(admitUiPacket(report)).rejects.toThrow(
          "Invented canonical UI evidence was refused",
        );
      }
    },
  );
});
