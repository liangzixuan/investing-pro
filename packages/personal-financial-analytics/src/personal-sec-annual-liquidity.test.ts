import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  type PersonalSecAnnualLiquidityAbsence,
  type PersonalSecAnnualLiquidityMetricEvidenceDto,
  type PersonalSecAnnualLiquidityObservationDto,
  type PersonalSecAnnualLiquidityResolutionInput,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import { resolvePersonalSecAnnualLiquidity as resolve } from "./personal-sec-annual-liquidity";

type Row = PersonalSecAnnualLiquidityObservationDto;
type Input = PersonalSecAnnualLiquidityResolutionInput;
const accession = "0000999999-26-000001";
const reportDate = "2025-09-30";

function row(id: number, liability = false, locator = 0): Row {
  const common = {
    id: `sec-fact:${id.toString(16).padStart(64, "0")}` as const,
    taxonomy: "us-gaap" as const,
    unit: "USD" as const,
    value: liability ? "80" : "120",
    startDate: null,
    endDate: reportDate,
    durationDays: null,
    periodBasis: "unresolved" as const,
    filingFocusYear: 2026,
    filingFocusPeriod: "FY",
    frame: null,
    accessionNumber: accession,
    form: "10-K",
    filedDate: "2026-02-01",
    sourceLocator: `/facts/us-gaap/${liability ? "LiabilitiesCurrent" : "AssetsCurrent"}/units/USD/${locator}`,
    filing: {
      status: "matched" as const,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate,
      acceptedAt: "2026-02-01T16:00:00.000Z",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/42/${accession}-index.htm`,
    },
  };
  return liability
    ? {
        ...common,
        metric: "current_liabilities",
        concept: "LiabilitiesCurrent",
      }
    : { ...common, metric: "current_assets", concept: "AssetsCurrent" };
}

function metric(
  observations: readonly Row[],
  absence: PersonalSecAnnualLiquidityAbsence | null = null,
): PersonalSecAnnualLiquidityMetricEvidenceDto {
  const count = observations.length;
  return {
    scan: {
      status: "available",
      absence,
      coverage: {
        full: {
          candidateRows: count,
          inspectedRows: count,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: count,
        },
        selected: count,
        otherAccessions: 0,
        returned: count,
        omittedSelected: 0,
      },
    },
    observations,
  };
}

function input(assets = [row(1)], liabilities = [row(2, true)]): Input {
  return {
    cik: "0000000042",
    generation: {
      definitionVersion: PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
      cutoffAt: "2026-09-20T06:00:00.000Z",
      completedAt: "2026-09-20T06:00:03.000Z",
      sha256: `sha256:${"a".repeat(64)}`,
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:02.000Z",
          bytes: 1000,
          sha256: `sha256:${"b".repeat(64)}`,
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:01.000Z",
          bytes: 500,
          sha256: `sha256:${"c".repeat(64)}`,
        },
      },
    },
    target: {
      status: "target",
      accessionNumber: accession,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate,
      acceptedAt: "2026-02-01T16:00:00.000Z",
    },
    liquidity: {
      currentAssets: metric(assets),
      currentLiabilities: metric(liabilities),
    },
  };
}

describe("Annual instant liquidity", () => {
  it("resolves a non-Q4 fiscal-end without a flow or calendar-year assumption", () => {
    const packet = input();
    const before = structuredClone(packet);
    const result = resolve(packet);
    expect(result.currentAssets).toEqual({
      status: "available",
      unit: "USD",
      value: "120",
      asOfDate: reportDate,
      accessionNumber: accession,
      observationIds: [row(1).id],
      currentUseEligible: true,
    });
    expect(result.currentLiabilities).toMatchObject({
      status: "available",
      value: "80",
    });
    expect(result.workingCapital).toMatchObject({
      status: "available",
      unit: "USD",
      value: "40",
      observationIds: [row(1).id, row(2, true).id],
    });
    expect(result.currentRatio).toMatchObject({
      status: "available",
      unit: "multiple",
      value: "1.50",
      asOfDate: reportDate,
    });
    expect(packet).toEqual(before);
    expect(Object.isFrozen(packet)).toBe(false);
    expect(Object.isFrozen(result.currentRatio.observationIds)).toBe(true);
  });

  it("uses the exact report-end while retaining comparative balances as evidence", () => {
    const prior = { ...row(3, false, 1), endDate: "2024-09-30", value: "999" };
    expect(resolve(input([row(1), prior])).currentAssets).toMatchObject({
      value: "120",
      observationIds: [row(1).id],
    });
    expect(
      resolve(input([{ ...row(1), endDate: "2025-09-29" }])).currentAssets,
    ).toMatchObject({ status: "unavailable", reason: "no_report_date" });
  });

  it("keeps agreeing references and refuses conflicting target-date amounts", () => {
    const other = { ...row(3, false, 1), frame: "CY2025Q3I" };
    expect(resolve(input([row(1), other])).currentAssets).toMatchObject({
      status: "available",
      observationIds: [row(1).id, other.id],
    });
    const result = resolve(input([row(1), { ...other, value: "121" }]));
    expect(result.currentAssets).toMatchObject({
      status: "unavailable",
      reason: "ambiguous_value",
    });
    expect(result.currentLiabilities).toMatchObject({
      status: "available",
      value: "80",
    });
    expect(result.workingCapital.status).toBe("unavailable");
  });

  it.each([
    [{ startDate: "2025-01-01", durationDays: 273 }, "invalid_instant_period"],
    [{ durationDays: 0 }, "invalid_instant_period"],
    [{ filingFocusPeriod: "Q3" }, "missing_or_non_FY_focus"],
    [{ filingFocusPeriod: null }, "missing_or_non_FY_focus"],
    [{ form: "10-K/A" }, "unsupported_form"],
    [{ filedDate: "2026-02-02" }, "filing_unmatched_or_conflicted"],
  ] satisfies [Partial<Row>, string][])(
    "refuses inadmissible instant metadata %#",
    (change, reason) => {
      const result = resolve(input([{ ...row(1), ...change }]));
      expect(result.currentAssets).toMatchObject({
        status: "unavailable",
        reason,
      });
      expect(result.currentLiabilities.status).toBe("available");
    },
  );

  it.each([
    { status: "metadata_conflict" as const },
    { acceptedAt: "2026-02-01T17:00:00.000Z" },
    { sourceUrl: "https://www.sec.gov/Archives/edgar/data/43/other-index.htm" },
  ])("refuses conflicting joined filing metadata %#", (change) => {
    const original = row(1);
    expect(
      resolve(
        input([{ ...original, filing: { ...original.filing, ...change } }]),
      ).currentAssets,
    ).toMatchObject({
      status: "unavailable",
      reason: "filing_unmatched_or_conflicted",
    });
  });

  it.each(["concept_missing", "usd_missing", "empty_usd"] as const)(
    "preserves the other operand for %s",
    (absence) => {
      const packet = input();
      const result = resolve({
        ...packet,
        liquidity: { ...packet.liquidity, currentAssets: metric([], absence) },
      });
      expect(result.currentAssets).toMatchObject({
        status: "unavailable",
        reason: absence,
      });
      expect(result.currentLiabilities.status).toBe("available");
      expect(result.currentRatio.status).toBe("unavailable");
    },
  );

  it.each(["invalid_response", "candidate_limit"] as const)(
    "contains a %s scan to one balance",
    (status) => {
      const packet = input();
      const result = resolve({
        ...packet,
        liquidity: {
          ...packet.liquidity,
          currentAssets: {
            scan: { status, absence: null, coverage: null },
            observations: [],
          },
        },
      });
      expect(result.currentAssets).toMatchObject({
        status: "unavailable",
        reason: status,
      });
      expect(result.currentLiabilities.status).toBe("available");
    },
  );

  it("does not use valid samples from an invalid full scan or an over-limit selected set", () => {
    const packet = input();
    const bad: PersonalSecAnnualLiquidityMetricEvidenceDto = {
      scan: {
        status: "available",
        absence: null,
        coverage: {
          full: {
            candidateRows: 2,
            inspectedRows: 2,
            invalidRows: 1,
            duplicateRows: 0,
            uniqueObservations: 1,
          },
          selected: 1,
          otherAccessions: 0,
          returned: 1,
          omittedSelected: 0,
        },
      },
      observations: [row(1)],
    };
    expect(
      resolve({
        ...packet,
        liquidity: { ...packet.liquidity, currentAssets: bad },
      }).currentAssets,
    ).toMatchObject({ reason: "invalid_source_rows" });
    const overflow: PersonalSecAnnualLiquidityMetricEvidenceDto = {
      scan: {
        status: "available",
        absence: null,
        coverage: {
          full: {
            candidateRows: 101,
            inspectedRows: 101,
            invalidRows: 0,
            duplicateRows: 0,
            uniqueObservations: 101,
          },
          selected: 101,
          otherAccessions: 0,
          returned: 0,
          omittedSelected: 101,
        },
      },
      observations: [],
    };
    expect(
      resolve({
        ...packet,
        liquidity: { ...packet.liquidity, currentAssets: overflow },
      }).currentAssets,
    ).toMatchObject({ reason: "selected_report_overflow" });
  });

  it("preserves reported signs while refusing only the unsupported calculations", () => {
    const result = resolve(input([{ ...row(1), value: "-5" }]));
    expect(result.currentAssets).toMatchObject({
      status: "available",
      value: "-5",
    });
    expect(result.currentLiabilities.status).toBe("available");
    expect(result.workingCapital).toMatchObject({ reason: "unsupported_sign" });
    expect(result.currentRatio).toMatchObject({ reason: "unsupported_sign" });
    const zero = resolve(input(undefined, [{ ...row(2, true), value: "0" }]));
    expect(zero.workingCapital).toMatchObject({
      status: "available",
      value: "120",
    });
    expect(zero.currentRatio).toMatchObject({
      reason: "nonpositive_current_liabilities",
    });
  });

  it.each([485, 486])(
    "applies the captured inclusive report age at %d days",
    (days) => {
      const packet = input();
      const cutoff = new Date(
        Date.parse(`${reportDate}T06:00:00.000Z`) + days * 86_400_000,
      ).toISOString();
      const result = resolve({
        ...packet,
        generation: {
          ...packet.generation,
          cutoffAt: cutoff,
          completedAt: cutoff,
          sources: {
            companyFacts: {
              ...packet.generation.sources.companyFacts,
              fetchedAt: cutoff,
            },
            submissions: {
              ...packet.generation.sources.submissions,
              fetchedAt: cutoff,
            },
          },
        },
      });
      expect(result.currentAssets).toMatchObject({
        status: "available",
        value: "120",
        currentUseEligible: days === 485,
      });
      expect(result.currentRatio).toMatchObject({
        currentUseEligible: days === 485,
      });
    },
  );

  it("refuses source clocks beyond the current seven-day window", () => {
    const packet = input();
    const result = resolve({
      ...packet,
      generation: {
        ...packet.generation,
        completedAt: "2026-09-27T06:00:03.001Z",
      },
    });
    expect(result.currentAssets).toMatchObject({ reason: "source_stale" });
  });

  it("does not admit another accession or fabricated scan identities", () => {
    expect(() =>
      resolve(input([{ ...row(1), accessionNumber: "0000999999-26-000002" }])),
    ).toThrow(TypeError);
    expect(() => resolve(input([row(1), row(1)]))).toThrow(TypeError);
    expect(() =>
      resolve(
        input([
          {
            ...row(1),
            sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/1",
          },
        ]),
      ),
    ).toThrow(TypeError);
    const packet = input();
    expect(() =>
      resolve({
        ...packet,
        liquidity: { ...packet.liquidity, currentAssets: metric([], null) },
      }),
    ).toThrow(TypeError);
  });

  it("admits all 100 selected references and accounts for exact raw duplicates", () => {
    const rows = Array.from({ length: 100 }, (_, index) =>
      row(index + 3, false, index),
    );
    expect(resolve(input(rows)).currentAssets.observationIds).toHaveLength(100);
    const packet = input();
    const single = packet.liquidity.currentAssets;
    if (single.scan.status !== "available")
      throw new Error("Fixture must be scanned");
    const duplicate = {
      ...single,
      scan: {
        ...single.scan,
        coverage: {
          ...single.scan.coverage,
          full: {
            ...single.scan.coverage.full,
            candidateRows: 2,
            inspectedRows: 2,
            duplicateRows: 1,
          },
        },
      },
    };
    expect(
      resolve({
        ...packet,
        liquidity: { ...packet.liquidity, currentAssets: duplicate },
      }).currentAssets,
    ).toMatchObject({
      status: "available",
      value: "120",
      observationIds: [row(1).id],
    });
  });

  it("cannot resolve an unknown target and does not manufacture selected counts", () => {
    const packet = input();
    const unknown: PersonalSecAnnualLiquidityMetricEvidenceDto = {
      scan: {
        status: "available",
        absence: null,
        coverage: {
          full: {
            candidateRows: 1,
            inspectedRows: 1,
            invalidRows: 0,
            duplicateRows: 0,
            uniqueObservations: 1,
          },
          selected: null,
          otherAccessions: null,
          returned: 0,
          omittedSelected: null,
        },
      },
      observations: [],
    };
    const result = resolve({
      ...packet,
      target: { status: "unresolved", reason: "no_observed_annual_target" },
      liquidity: { currentAssets: unknown, currentLiabilities: unknown },
    });
    expect(result.currentAssets).toMatchObject({ reason: "target_unresolved" });
    expect(result.currentRatio).toMatchObject({ reason: "target_unresolved" });
  });

  it("preserves the source-unavailable boundary without fabricated rows", () => {
    const packet = input();
    const unavailable: PersonalSecAnnualLiquidityMetricEvidenceDto = {
      scan: { status: "source_unavailable", absence: null, coverage: null },
      observations: [],
    };
    const generation = {
      ...packet.generation,
      sources: {
        ...packet.generation.sources,
        companyFacts: {
          ...packet.generation.sources.companyFacts,
          status: "upstream_unavailable" as const,
          fetchedAt: null,
          sha256: null,
          bytes: null,
        },
      },
    };
    expect(
      resolve({
        ...packet,
        generation,
        liquidity: {
          currentAssets: unavailable,
          currentLiabilities: unavailable,
        },
      }).currentAssets,
    ).toMatchObject({ reason: "source_unavailable" });
    expect(() => resolve({ ...packet, generation })).toThrow(TypeError);
  });

  it("requires the target cutoff clock even when balance metadata agrees", () => {
    const packet = input();
    if (packet.target.status !== "target")
      throw new Error("Fixture must have target");
    const cutoff = "2026-02-01T15:00:00.000Z";
    const generation = {
      ...packet.generation,
      cutoffAt: cutoff,
      completedAt: cutoff,
      sources: {
        companyFacts: {
          ...packet.generation.sources.companyFacts,
          fetchedAt: cutoff,
        },
        submissions: {
          ...packet.generation.sources.submissions,
          fetchedAt: cutoff,
        },
      },
    };
    expect(resolve({ ...packet, generation }).currentAssets).toMatchObject({
      reason: "future_or_inconsistent_dates",
    });
    expect(
      resolve({
        ...packet,
        generation,
        target: { ...packet.target, acceptedAt: null },
      }).currentAssets,
    ).toMatchObject({ reason: "cutoff_time_unresolved" });
  });

  it.each([0, 1])(
    "keeps the inclusive seven-day source edge with %d ms excess",
    (excess) => {
      const packet = input();
      const completedAt = new Date(
        Date.parse("2026-09-27T06:00:01.000Z") + excess,
      ).toISOString();
      const result = resolve({
        ...packet,
        generation: { ...packet.generation, completedAt },
      });
      expect(result.currentAssets.status).toBe(
        excess === 0 ? "available" : "unavailable",
      );
    },
  );
});
