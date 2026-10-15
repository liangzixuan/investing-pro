import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  type PersonalSecAnnualLiquidityAbsence,
  type PersonalSecAnnualLiquidityMetricEvidenceDto,
  type PersonalSecAnnualLiquidityObservationDto,
  type PersonalSecAnnualLiquidityResolutionInput,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import {
  resolvePersonalSecAnnualLiquidity as resolve,
  resolvePersonalSecAnnualLiquidityHistory as history,
} from "./personal-sec-annual-liquidity";

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
    expect(
      history({
        ...packet,
        generation,
        liquidity: {
          currentAssets: unavailable,
          currentLiabilities: unavailable,
        },
      }),
    ).toEqual({ status: "unavailable", reason: "source_unavailable" });
    expect(() => history({ ...packet, generation })).toThrow(TypeError);
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

const priorDate = "2024-09-28";
const oldestDate = "2023-09-30";
type Side = "currentAssets" | "currentLiabilities";

function historyInput(dates = [reportDate, priorDate, oldestDate]): Input {
  return input(
    dates.map((endDate, index) => ({
      ...row(101 + index, false, index),
      endDate,
    })),
    dates.map((endDate, index) => ({
      ...row(201 + index, true, index),
      endDate,
    })),
  );
}

function withRows(packet: Input, side: Side, rows: readonly Row[]): Input {
  return {
    ...packet,
    liquidity: {
      ...packet.liquidity,
      [side]: metric(
        rows.map((value, index) => ({
          ...value,
          sourceLocator: `/facts/us-gaap/${value.concept}/units/USD/${index}`,
        })),
      ),
    },
  };
}

function withMetric(
  packet: Input,
  side: Side,
  value: PersonalSecAnnualLiquidityMetricEvidenceDto,
): Input {
  return { ...packet, liquidity: { ...packet.liquidity, [side]: value } };
}

function freezeInput<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freezeInput);
    Object.freeze(value);
  }
  return value;
}

describe("Annual reported liquidity history", () => {
  it("requires both current balances even when an earlier pair is complete", () => {
    const packet = historyInput();
    expect(
      history(
        withRows(
          packet,
          "currentAssets",
          packet.liquidity.currentAssets.observations.filter(
            (value) => value.endDate !== reportDate,
          ),
        ),
      ),
    ).toEqual({
      status: "unavailable",
      reason: "no_report_date",
    });
  });

  it("preserves target and filing refusals before traversing prior balances", () => {
    const packet = historyInput();
    if (packet.target.status !== "target") throw new Error("Expected target");
    expect(
      history({ ...packet, target: { ...packet.target, form: "20-F" } }),
    ).toEqual({
      status: "unavailable",
      reason: "filing_unmatched_or_conflicted",
    });
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
    expect(
      history({
        ...packet,
        target: { status: "unresolved", reason: "no_observed_annual_target" },
        liquidity: { currentAssets: unknown, currentLiabilities: unknown },
      }),
    ).toEqual({ status: "unavailable", reason: "target_unresolved" });
  });

  it.each([1, 2, 3, 4])(
    "owns at most three newest balances from %d observed dates",
    (count) => {
      const dates = [reportDate, priorDate, oldestDate, "2021-02-28"].slice(
        0,
        count,
      );
      const packet = historyInput([...dates].reverse());
      const before = structuredClone(packet);
      const currentBefore = JSON.stringify(resolve(packet));
      const result = history(packet);
      expect(result.status).toBe("available");
      if (result.status !== "available") throw new Error("Expected history");
      expect(result.accessionNumber).toBe(accession);
      expect(result.stopped).toBeNull();
      expect(result.balances.map((balance) => balance.asOfDate)).toEqual(
        dates.slice(0, 3),
      );
      expect(result.balances[0]).toMatchObject({
        currentAssets: "120",
        currentLiabilities: "80",
        workingCapital: { status: "available", unit: "USD", value: "40" },
        currentRatio: { status: "available", unit: "multiple", value: "1.50" },
      });
      for (const balance of result.balances) {
        expect(Object.isFrozen(balance)).toBe(true);
        expect(Object.isFrozen(balance.observationIds)).toBe(true);
        expect(Object.isFrozen(balance.workingCapital)).toBe(true);
        expect(Object.isFrozen(balance.currentRatio.observationIds)).toBe(true);
        expect(balance.workingCapital).not.toHaveProperty("currentUseEligible");
        expect(balance.currentRatio).not.toHaveProperty("asOfDate");
      }
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.balances)).toBe(true);
      expect(packet).toEqual(before);
      expect(Object.isFrozen(packet)).toBe(false);
      expect(Object.isFrozen(packet.liquidity.currentAssets.observations)).toBe(
        false,
      );
      expect(JSON.stringify(resolve(packet))).toBe(currentBefore);
      expect(history(freezeInput(packet))).toEqual(result);
    },
  );

  it("uses observed leap and widely separated dates without inventing an annual gap", () => {
    const result = history(
      historyInput(["2020-02-29", reportDate, "2024-02-29"]),
    );
    expect(result).toMatchObject({
      status: "available",
      balances: [
        { asOfDate: reportDate },
        { asOfDate: "2024-02-29" },
        { asOfDate: "2020-02-29" },
      ],
      stopped: null,
    });
  });

  it.each(["currentAssets", "currentLiabilities"] as const)(
    "stops at the first unpaired union date on %s without skipping to an older pair",
    (side) => {
      const packet = historyInput();
      const result = history(
        withRows(
          packet,
          side,
          packet.liquidity[side].observations.filter(
            (value) => value.endDate !== priorDate,
          ),
        ),
      );
      expect(result).toMatchObject({
        status: "available",
        balances: [{ asOfDate: reportDate }],
        stopped: { asOfDate: priorDate, reason: "no_report_date" },
      });
      if (result.status !== "available")
        throw new Error("Expected partial history");
      expect(result.balances).toHaveLength(1);
      expect(Object.isFrozen(result.stopped)).toBe(true);
    },
  );

  it("keeps all agreeing IDs in source order and stops on a conflicting prior value", () => {
    const packet = historyInput();
    const duplicate = {
      ...row(301, false, 3),
      endDate: priorDate,
      frame: "CY2024Q3I",
    };
    const rows = [duplicate, ...packet.liquidity.currentAssets.observations];
    const admitted = history(withRows(packet, "currentAssets", rows));
    expect(admitted.status).toBe("available");
    if (admitted.status !== "available") throw new Error("Expected history");
    const ids = [duplicate.id, row(102).id, row(202).id];
    expect(admitted.balances[1]?.observationIds).toEqual(ids);
    expect(admitted.balances[1]?.workingCapital.observationIds).toEqual(ids);
    expect(admitted.balances[1]?.currentRatio.observationIds).toEqual(ids);
    expect(
      history(
        withRows(packet, "currentAssets", [
          { ...duplicate, value: "121" },
          ...packet.liquidity.currentAssets.observations,
        ]),
      ),
    ).toMatchObject({
      status: "available",
      balances: [{ asOfDate: reportDate }],
      stopped: { asOfDate: priorDate, reason: "ambiguous_value" },
    });
  });

  it.each([
    [{ startDate: "2024-01-01", durationDays: 272 }, "invalid_instant_period"],
    [{ durationDays: 0 }, "invalid_instant_period"],
    [{ form: "10-K/A" }, "unsupported_form"],
    [{ filingFocusPeriod: "Q3" }, "missing_or_non_FY_focus"],
    [{ filedDate: "2026-02-02" }, "filing_unmatched_or_conflicted"],
    [
      { filing: { ...row(1).filing, reportDate: priorDate } },
      "report_end_mismatch",
    ],
    [
      { filing: { ...row(1).filing, acceptedAt: "2026-02-01T17:00:00.000Z" } },
      "filing_unmatched_or_conflicted",
    ],
    [
      { filing: { ...row(1).filing, status: "metadata_conflict" } },
      "filing_unmatched_or_conflicted",
    ],
  ] satisfies [Partial<Row>, string][])(
    "does not prefilter a refused observed row %#",
    (change, reason) => {
      const packet = historyInput();
      const result = history(
        withRows(
          packet,
          "currentAssets",
          packet.liquidity.currentAssets.observations.map((value) =>
            value.endDate === priorDate ? { ...value, ...change } : value,
          ),
        ),
      );
      expect(result).toMatchObject({
        status: "available",
        balances: [{ asOfDate: reportDate }],
        stopped: { asOfDate: priorDate, reason },
      });
    },
  );

  it.each([
    "2023-02-29",
    "2024-02-30",
    "2024-13-01",
    "2024-00-01",
    "2024-01-00",
    "2024-2-09",
    "24-02-09",
    "0000-01-01",
    "2024-02-09T00:00:00Z",
  ])(
    "rejects malformed selected end date %s in the new entry only",
    (endDate) => {
      const packet = historyInput([reportDate, priorDate, oldestDate, endDate]);
      expect(resolve(packet).currentAssets.status).toBe("available");
      expect(() => history(packet)).toThrow(
        "Invalid annual liquidity evidence.",
      );
    },
  );

  it.each(["currentAssets", "currentLiabilities"] as const)(
    "refuses a selected post-report date on %s",
    (side) => {
      const packet = historyInput();
      const changed = withRows(
        packet,
        side,
        packet.liquidity[side].observations.map((value) =>
          value.endDate === oldestDate
            ? { ...value, endDate: "2025-10-01" }
            : value,
        ),
      );
      const before = resolve(changed);
      expect(before.currentAssets.status).toBe("available");
      expect(history(changed)).toEqual({
        status: "unavailable",
        reason: "report_end_mismatch",
      });
      expect(resolve(changed)).toEqual(before);
    },
  );

  it.each([
    ["-5", "80", "unsupported_sign", "unsupported_sign"],
    ["120", "-1", "unsupported_sign", "nonpositive_current_liabilities"],
    ["-5", "-1", "unsupported_sign", "nonpositive_current_liabilities"],
    ["120", "0", null, "nonpositive_current_liabilities"],
    ["0", "0", null, "nonpositive_current_liabilities"],
  ] as const)(
    "retains raw %s/%s and continues after per-calculation refusals",
    (a, l, workingReason, ratioReason) => {
      let packet = historyInput();
      for (const [side, value] of [
        ["currentAssets", a],
        ["currentLiabilities", l],
      ] as const) {
        packet = withRows(
          packet,
          side,
          packet.liquidity[side].observations.map((observed) =>
            observed.endDate !== oldestDate ? { ...observed, value } : observed,
          ),
        );
      }
      const result = history(packet);
      if (result.status !== "available")
        throw new Error("Expected raw history");
      expect(result.balances).toHaveLength(3);
      expect(result.stopped).toBeNull();
      for (const balance of result.balances.slice(0, 2)) {
        expect(balance.currentAssets).toBe(a);
        expect(balance.currentLiabilities).toBe(l);
        expect(balance.currentRatio).toMatchObject({
          status: "unavailable",
          reason: ratioReason,
        });
        expect(balance.workingCapital).toMatchObject(
          workingReason
            ? { status: "unavailable", reason: workingReason }
            : { status: "available", value: a },
        );
      }
      expect(result.balances[2]?.currentRatio).toMatchObject({
        status: "available",
        value: "1.50",
      });
    },
  );

  it("preserves exact differences, half-up ratios and normalized zero", () => {
    const packet = historyInput();
    const a = ["1", "0", "100.000000000000000001"];
    const l = ["8", "1", "100"];
    const changed = withRows(
      withRows(
        packet,
        "currentAssets",
        packet.liquidity.currentAssets.observations.map((value, index) => ({
          ...value,
          value: a[index]!,
        })),
      ),
      "currentLiabilities",
      packet.liquidity.currentLiabilities.observations.map((value, index) => ({
        ...value,
        value: l[index]!,
      })),
    );
    expect(history(changed)).toMatchObject({
      status: "available",
      balances: [
        { workingCapital: { value: "-7" }, currentRatio: { value: "0.13" } },
        { workingCapital: { value: "-1" }, currentRatio: { value: "0.00" } },
        {
          workingCapital: { value: "0.000000000000000001" },
          currentRatio: { value: "1.00" },
        },
      ],
    });
  });

  it("retains maximal decimal inputs and bounded 128/129-character outputs", () => {
    const small = `0.${"0".repeat(61)}1`,
      large = "9".repeat(64);
    const packet = input(
      [
        { ...row(1), value: small },
        { ...row(3, false, 1), value: large, endDate: priorDate },
      ],
      [
        { ...row(2, true), value: large },
        { ...row(4, true, 1), value: small, endDate: priorDate },
      ],
    );
    const result = history(packet);
    if (result.status !== "available") throw new Error("Expected history");
    expect(result.balances[0]?.workingCapital).toMatchObject({
      value: `-${"9".repeat(63)}8.${"9".repeat(62)}`,
    });
    expect(result.balances[1]?.currentRatio).toMatchObject({
      value: `${large}${"0".repeat(62)}.00`,
    });
    expect(result.balances[0]?.currentAssets).toHaveLength(64);
    expect(result.balances[1]?.currentAssets).toHaveLength(64);
    if (
      result.balances[0]?.workingCapital.status !== "available" ||
      result.balances[1]?.currentRatio.status !== "available"
    )
      throw new Error("Expected calculations");
    expect(result.balances[0].workingCapital.value).toHaveLength(128);
    expect(result.balances[1].currentRatio.value).toHaveLength(129);
    expect(() =>
      history(input([{ ...row(1), value: "9".repeat(65) }])),
    ).toThrow(TypeError);
  });

  it.each(["missing", "invalid_response", "candidate_limit"])(
    "does not depend on %s income evidence",
    (incomeState) => {
      const packet = historyInput();
      const extraIncome =
        incomeState === "missing"
          ? {
              observations: [],
              resolution: { netIncome: { status: "unavailable" } },
            }
          : { scan: { status: incomeState }, observations: [] };
      expect(history({ ...packet, ...extraIncome })).toEqual(history(packet));
    },
  );

  it.each(["currentAssets", "currentLiabilities"] as const)(
    "preserves scan and complete selected-set limits on %s",
    (side) => {
      const packet = historyInput();
      for (const status of ["invalid_response", "candidate_limit"] as const) {
        const failed = withMetric(packet, side, {
          scan: { status, absence: null, coverage: null },
          observations: [],
        });
        expect(history(failed)).toEqual({
          status: "unavailable",
          reason: status,
        });
        expect(() =>
          history(
            withMetric(packet, side, {
              ...failed.liquidity[side],
              observations: packet.liquidity[side].observations,
            }),
          ),
        ).toThrow(TypeError);
      }
      const original = packet.liquidity[side];
      if (original.scan.status !== "available")
        throw new Error("Expected scan");
      expect(
        history(
          withMetric(packet, side, {
            ...original,
            scan: {
              ...original.scan,
              coverage: {
                ...original.scan.coverage,
                full: {
                  ...original.scan.coverage.full,
                  candidateRows: 4,
                  inspectedRows: 4,
                  invalidRows: 1,
                },
              },
            },
          }),
        ),
      ).toEqual({ status: "unavailable", reason: "invalid_source_rows" });
      const overflow = {
        scan: {
          status: "available" as const,
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
      expect(history(withMetric(packet, side, overflow))).toEqual({
        status: "unavailable",
        reason: "selected_report_overflow",
      });
      expect(() =>
        history(
          withMetric(packet, side, { ...overflow, observations: [row(1)] }),
        ),
      ).toThrow(TypeError);
    },
  );

  it("admits all 100 selected references and the 10000-candidate full-scan boundary", () => {
    const packet = input(
      Array.from({ length: 100 }, (_, index) =>
        row(1000 + index, false, index),
      ),
    );
    const original = packet.liquidity.currentAssets;
    if (original.scan.status !== "available") throw new Error("Expected scan");
    const scan = original.scan;
    const make = (count: number) =>
      withMetric(packet, "currentAssets", {
        ...original,
        scan: {
          ...scan,
          coverage: {
            ...scan.coverage,
            otherAccessions: count - 100,
            full: {
              ...scan.coverage.full,
              candidateRows: count,
              inspectedRows: count,
              uniqueObservations: count,
            },
          },
        },
      });
    const result = history(make(10_000));
    if (result.status !== "available") throw new Error("Expected history");
    expect(result.balances[0]?.observationIds).toHaveLength(101);
    expect(() => history(make(10_001))).toThrow(TypeError);
  });

  it.each([
    { id: row(101).id },
    { accessionNumber: "0000999999-26-000002" },
    { sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/0" },
    { sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/3" },
    { value: "-0" },
    { value: "1e5" },
  ] satisfies Partial<Row>[])(
    "rejects forged historical identity, locator or amount %#",
    (change) => {
      const packet = historyInput();
      const rows = packet.liquidity.currentAssets.observations.map((value) =>
        value.endDate === priorDate ? { ...value, ...change } : value,
      );
      expect(() =>
        history(withMetric(packet, "currentAssets", metric(rows))),
      ).toThrow(TypeError);
    },
  );

  it.each([485, 486])(
    "requires current-use eligibility at original report age %d",
    (days) => {
      const packet = historyInput();
      const cutoffAt = new Date(
        Date.parse(`${reportDate}T06:00:00.000Z`) + days * 86_400_000,
      ).toISOString();
      const changed = {
        ...packet,
        generation: {
          ...packet.generation,
          cutoffAt,
          completedAt: cutoffAt,
          sources: {
            companyFacts: {
              ...packet.generation.sources.companyFacts,
              fetchedAt: cutoffAt,
            },
            submissions: {
              ...packet.generation.sources.submissions,
              fetchedAt: cutoffAt,
            },
          },
        },
      };
      expect(resolve(changed).currentAssets).toMatchObject({
        status: "available",
        currentUseEligible: days === 485,
      });
      expect(history(changed)).toMatchObject(
        days === 485
          ? { status: "available" }
          : { status: "unavailable", reason: "current_use_unavailable" },
      );
    },
  );

  it.each([
    ["2026-09-27T06:00:01.000Z", null],
    ["2026-09-27T06:00:01.001Z", "source_stale"],
    ["not-a-clock", "invalid_clock"],
  ] as const)(
    "preserves shared source-clock refusal at %s",
    (completedAt, reason) => {
      const packet = historyInput();
      const result = history({
        ...packet,
        generation: { ...packet.generation, completedAt },
      });
      expect(result).toMatchObject(
        reason ? { status: "unavailable", reason } : { status: "available" },
      );
    },
  );
});
