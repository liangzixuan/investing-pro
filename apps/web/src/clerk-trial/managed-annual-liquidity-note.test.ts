import { operatingResults } from "../features/research/sec-annual-operating-fixture";
import { describe, expect, it, vi } from "vitest";
import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualLiquidityResolutionDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualEvidence } from "@research-cockpit/personal-financial-analytics";
import {
  liquidity,
  liquidityResponse,
  liquidityRow,
} from "../features/research/sec-annual-liquidity-fixture";
import {
  cashGeneration,
  cashRow,
} from "../features/research/sec-annual-cash-fixture";
import {
  request,
  response,
} from "../features/research/sec-annual-evidence-fixture";
import { parseSecAnnualEvidenceResponse } from "../lib/sec-annual-evidence-response";
import { annualLiquidityNoteExcerpt } from "./managed-annual-liquidity-note";

type Report = PersonalSecAnnualEvidenceResponseDto;
const rows = () => [
  liquidityRow("current_assets", "120.125"),
  liquidityRow("current_liabilities", "80.025"),
];
const fixture = () => liquidityResponse(rows());
const expected =
  "Observed Annual liquidity: ZERO (XNAS); CIK 0000000001; 10-K balances at 2025-12-31. Reported current assets (AssetsCurrent) USD 120.125; reported current liabilities (LiabilitiesCurrent) USD 80.025. App calculations: working capital USD 40.1; current ratio 1.50 multiple (two decimal places, half up). Same filing and date. Current assets are not all cash. Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.";
async function admitted(wire: Report) {
  const parsed = await parseSecAnnualEvidenceResponse(
    wire,
    request(),
    new AbortController().signal,
  );
  expect(parsed).not.toBeNull();
  return parsed!;
}
function patch(
  report: Report,
  changes: Partial<PersonalSecAnnualLiquidityResolutionDto>,
): Report {
  return {
    ...report,
    evidence: {
      ...report.evidence,
      liquidity: {
        ...report.evidence.liquidity,
        resolution: { ...report.evidence.liquidity.resolution, ...changes },
      },
    },
  };
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
      expect(report.evidence.liquidity.resolution.currentRatio).toMatchObject({
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
      const base = await response([]);
      const evidence =
        income === "invalid"
          ? {
              ...base.evidence,
              incomeScanStatus: "invalid_response" as const,
              coverage: null,
              completeness: {
                status: "refused" as const,
                reason: "source_unavailable" as const,
              },
            }
          : base.evidence;
      const report = await admitted({
        ...base,
        evidence: {
          ...evidence,
          resolution: resolvePersonalSecAnnualEvidence(evidence),
          operatingResults: await operatingResults(evidence),
          liquidity: await liquidity(evidence, rows()),
        },
      });
      expect(report.evidence.resolution.currentTargetEligible).toBe(false);
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
  ])("refuses changed calculation/provenance %j", async (change) => {
    const report = await fixture();
    expect(
      annualLiquidityNoteExcerpt(
        patch(report, {
          workingCapital: {
            ...report.evidence.liquidity.resolution.workingCapital,
            ...change,
          },
        }),
        false,
      ),
    ).toBeNull();
  });

  it("does not invent a zero-liability refusal or accept an unrelated unavailable ratio", async () => {
    const report = await fixture();
    const currentRatio = report.evidence.liquidity.resolution.currentRatio;
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
              zero.evidence.liquidity.resolution.currentRatio.observationIds,
          },
        }),
        false,
      ),
    ).toBeNull();
  });

  it.each(["income", "operating", "purchases"])(
    "reserves existing %s observation identities",
    async (metric) => {
      const base = await fixture();
      const report = await admitted({
        ...base,
        evidence: {
          ...base.evidence,
          cashGeneration: await cashGeneration(base.evidence, [
            cashRow("operating_cash_flow", "100"),
            cashRow("ppe_purchases", "25"),
          ]),
        },
      });
      const changed = structuredClone(report);
      const target =
        metric === "income"
          ? changed.evidence.observations[0]!
          : metric === "operating"
            ? changed.evidence.cashGeneration.operatingCashFlow.observations[0]!
            : changed.evidence.cashGeneration.ppePurchases.observations[0]!;
      Reflect.set(
        target,
        "id",
        changed.evidence.liquidity.currentAssets.observations[0]!.id,
      );
      expect(annualLiquidityNoteExcerpt(changed, false)).toBeNull();
    },
  );

  it.each([
    "wrong issuer",
    "unresolved target",
    "foreign filing URL",
    "changed source value",
  ])("refuses %s", async (kind) => {
    const report = await fixture();
    if (kind === "wrong issuer")
      Reflect.set(report.security, "cik", "0000000002");
    else if (kind === "unresolved target")
      Reflect.set(report.evidence, "target", {
        status: "unresolved",
        reason: "no_observed_annual_target",
      });
    else if (kind === "foreign filing URL")
      Reflect.set(
        report.evidence.liquidity.currentAssets.observations[0]!.filing,
        "sourceUrl",
        "https://example.invalid/",
      );
    else
      Reflect.set(
        report.evidence.liquidity.currentAssets.observations[0]!,
        "value",
        "121",
      );
    expect(annualLiquidityNoteExcerpt(report, false)).toBeNull();
  });

  it.each(["companyFacts", "submissions"] as const)(
    "refuses unavailable, missing or stale %s timestamps",
    async (source) => {
      for (const change of [
        { status: "upstream_unavailable" },
        { fetchedAt: null },
        { fetchedAt: "2026-09-01T00:00:00.000Z" },
      ]) {
        const report = await fixture();
        Object.assign(report.evidence.generation.sources[source], change);
        expect(annualLiquidityNoteExcerpt(report, false)).toBeNull();
      }
    },
  );
});
