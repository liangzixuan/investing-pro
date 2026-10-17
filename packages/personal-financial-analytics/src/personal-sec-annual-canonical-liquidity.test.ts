import { describe, expect, it } from "vitest";
import type {
  PersonalSecAnnualLiquidityConcept,
  PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualCanonicalLiquidity as resolve,
  resolvePersonalSecAnnualCanonicalLiquidityHistory as history,
} from "./personal-sec-annual-canonical-liquidity";
import { derivePersonalSecAnnualFinancialInputs } from "./personal-sec-annual-financial-inputs";
import { resolvePersonalSecAnnualStatements } from "./personal-sec-annual-statements";
import {
  fixture,
  observation,
  setScan,
  type Fixture,
} from "./personal-sec-annual-statements.fixture";

const report = "2025-09-30";
function balances(
  date = report,
  assets = "120",
  liabilities = "80",
  index = 0,
) {
  return [
    observation("AssetsCurrent", index, { endDate: date, value: assets }),
    observation("LiabilitiesCurrent", index, {
      endDate: date,
      value: liabilities,
    }),
  ];
}
function packet(
  rows: readonly PersonalSecAnnualStatementObservationDto[] = balances(),
) {
  return fixture(rows);
}
function scan(input: Fixture, concept: PersonalSecAnnualLiquidityConcept) {
  const result = input.facts.scans.find(
    (entry) => entry.concept === concept,
  )!.scan;
  if (result.status !== "available")
    throw new Error("Expected available fixture scan.");
  return result;
}
function clock(input: Fixture, cutoffAt: string) {
  input.generation.cutoffAt = cutoffAt;
  input.generation.completedAt = cutoffAt;
  for (const source of Object.values(input.generation.sources))
    source.fetchedAt = cutoffAt;
}

describe("canonical annual liquidity", () => {
  it("uses the actual v6 graph and original untagged source objects, leaving caller evidence unchanged", () => {
    const input = packet(
      balances(report, "9007199254740993.125", "9007199254740993.124"),
    );
    const before = structuredClone(input);
    const derived = derivePersonalSecAnnualFinancialInputs(input);
    const assets = input.facts.observations.find(
      (row) => row.concept === "AssetsCurrent",
    )!;
    expect(derived.liquidity.currentAssets.observations[0]).toBe(assets);
    expect(derived.liquidity.currentAssets.scan).toBe(
      scan(input, "AssetsCurrent"),
    );
    const result = resolve(input);
    expect(result.currentAssets).toMatchObject({
      status: "available",
      value: "9007199254740993.125",
      asOfDate: report,
      currentUseEligible: true,
      observationIds: [assets.id],
    });
    expect(result.workingCapital).toMatchObject({
      status: "available",
      value: "0.001",
    });
    expect(result.currentRatio).toMatchObject({
      status: "available",
      value: "1.00",
    });
    expect(history(input)).toMatchObject({
      status: "available",
      balances: [
        {
          currentAssets: "9007199254740993.125",
          currentLiabilities: "9007199254740993.124",
          workingCapital: { value: "0.001" },
        },
      ],
    });
    expect(input).toEqual(before);
    expect(input.generation.definitionVersion).toBe("6.0.0");
    expect(input.facts.observations.every((row) => !("metric" in row))).toBe(
      true,
    );
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(assets)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.currentAssets.observationIds)).toBe(true);
  });

  it.each([
    "missing",
    "invalid_response",
    "candidate_limit",
    "invalid_rows",
    "overflow",
  ] as const)("keeps valid liquidity independent of %s income", (state) => {
    const input = packet();
    if (state === "invalid_response" || state === "candidate_limit")
      setScan(input, "NetIncomeLoss", {
        status: state,
        absence: null,
        coverage: null,
      });
    if (state === "invalid_rows" || state === "overflow")
      setScan(input, "NetIncomeLoss", {
        status: "available",
        absence: null,
        coverage: {
          full: {
            candidateRows: state === "overflow" ? 101 : 1,
            inspectedRows: state === "overflow" ? 101 : 1,
            invalidRows: state === "overflow" ? 0 : 1,
            duplicateRows: 0,
            uniqueObservations: state === "overflow" ? 101 : 0,
          },
          selected: state === "overflow" ? 101 : 0,
          otherAccessions: 0,
          returned: 0,
          omittedSelected: state === "overflow" ? 101 : 0,
        },
      });
    const baseline = packet();
    expect(resolve(input)).toEqual(resolve(baseline));
    expect(history(input)).toEqual(history(baseline));
  });

  it.each([
    ["0", "0", "0", "nonpositive_current_liabilities"],
    ["0", "8", "-8", "0.00"],
    ["-9007199254740993.125", "8", "unsupported_sign", "unsupported_sign"],
    ["8", "-0.125", "unsupported_sign", "nonpositive_current_liabilities"],
  ])(
    "preserves exact signed balances %s/%s and separate division policy",
    (assets, liabilities, difference, ratio) => {
      const input = packet(balances(report, assets, liabilities));
      const result = resolve(input);
      expect(result.currentAssets).toMatchObject({
        status: "available",
        value: assets,
      });
      expect(result.currentLiabilities).toMatchObject({
        status: "available",
        value: liabilities,
      });
      expect(result.workingCapital).toMatchObject(
        difference === "unsupported_sign"
          ? { status: "unavailable", reason: difference }
          : { status: "available", value: difference },
      );
      expect(result.currentRatio).toMatchObject(
        ratio === "unsupported_sign" ||
          ratio === "nonpositive_current_liabilities"
          ? { status: "unavailable", reason: ratio }
          : { status: "available", value: ratio },
      );
      expect(history(input)).toMatchObject({
        status: "available",
        balances: [{ currentAssets: assets, currentLiabilities: liabilities }],
      });
    },
  );

  it.each([
    "concept_missing",
    "usd_missing",
    "empty_usd",
    "invalid_response",
    "candidate_limit",
    "invalid_rows",
    "overflow",
  ] as const)("contains a %s refusal to the affected concept", (reason) => {
    const input = packet([
      observation("LiabilitiesCurrent", 0, { value: "80" }),
    ]);
    if (
      reason === "concept_missing" ||
      reason === "usd_missing" ||
      reason === "empty_usd"
    )
      scan(input, "AssetsCurrent").absence = reason;
    if (reason === "invalid_response" || reason === "candidate_limit")
      setScan(input, "AssetsCurrent", {
        status: reason,
        absence: null,
        coverage: null,
      });
    if (reason === "invalid_rows" || reason === "overflow")
      setScan(input, "AssetsCurrent", {
        status: "available",
        absence: null,
        coverage: {
          full: {
            candidateRows: reason === "overflow" ? 101 : 1,
            inspectedRows: reason === "overflow" ? 101 : 1,
            invalidRows: reason === "overflow" ? 0 : 1,
            duplicateRows: 0,
            uniqueObservations: reason === "overflow" ? 101 : 0,
          },
          selected: reason === "overflow" ? 101 : 0,
          otherAccessions: 0,
          returned: 0,
          omittedSelected: reason === "overflow" ? 101 : 0,
        },
      });
    const expected =
      reason === "invalid_rows"
        ? "invalid_source_rows"
        : reason === "overflow"
          ? "selected_report_overflow"
          : reason;
    const result = resolve(input);
    expect(result.currentAssets).toMatchObject({
      status: "unavailable",
      reason: expected,
    });
    expect(result.currentLiabilities).toMatchObject({
      status: "available",
      value: "80",
    });
    expect(result.workingCapital).toMatchObject({
      status: "unavailable",
      reason: expected,
    });
    expect(history(input)).toEqual({ status: "unavailable", reason: expected });
  });

  it("keeps all 100 references and exact full-scan accounting without truncation", () => {
    const input = packet([
      ...Array.from({ length: 100 }, (_, index) =>
        observation("AssetsCurrent", index, { value: "120" }),
      ),
      observation("LiabilitiesCurrent", 0, { value: "80" }),
    ]);
    const coverage = scan(input, "AssetsCurrent").coverage;
    Object.assign(coverage.full, {
      candidateRows: 10_000,
      inspectedRows: 10_000,
      duplicateRows: 9_900,
    });
    const result = resolve(input);
    expect(result.currentAssets).toMatchObject({
      status: "available",
      value: "120",
    });
    expect(result.currentAssets.observationIds).toHaveLength(100);
    expect(result.workingCapital.observationIds).toHaveLength(101);
    expect(history(input)).toMatchObject({
      status: "available",
      balances: [{ observationIds: result.workingCapital.observationIds }],
    });
  });

  it.each([
    ["end before capture", "2026-02-02T05:59:59.999Z", "invalid_clock"],
    ["seven-day edge", "2026-02-09T06:00:01.000Z", null],
    ["seven-day excess", "2026-02-09T06:00:01.001Z", "source_stale"],
  ] as const)(
    "keeps source clock policy at %s",
    (_label, completedAt, reason) => {
      const input = packet();
      input.generation.completedAt = completedAt;
      expect(resolve(input).currentAssets).toMatchObject(
        reason ? { status: "unavailable", reason } : { status: "available" },
      );
      expect(history(input)).toMatchObject(
        reason ? { status: "unavailable", reason } : { status: "available" },
      );
    },
  );

  it("retains whole-source unavailability and target unresolved counts without fabricated balances", () => {
    const input = fixture();
    input.generation.sources.companyFacts = {
      ...input.generation.sources.companyFacts,
      status: "upstream_unavailable",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    };
    for (const entry of input.facts.scans)
      entry.scan = {
        status: "source_unavailable",
        absence: null,
        coverage: null,
      };
    expect(resolve(input).currentAssets).toMatchObject({
      status: "unavailable",
      reason: "source_unavailable",
      observationIds: [],
    });
    expect(resolve(input).utilityAge).toBeNull();
    expect(history(input)).toEqual({
      status: "unavailable",
      reason: "source_unavailable",
    });
    const unresolved = fixture();
    unresolved.target = {
      status: "unresolved",
      reason: "no_observed_annual_target",
    };
    for (const entry of unresolved.facts.scans)
      if (entry.scan.status === "available")
        Object.assign(entry.scan.coverage, {
          selected: null,
          otherAccessions: null,
          omittedSelected: null,
        });
    expect(resolve(unresolved).currentAssets).toMatchObject({
      status: "unavailable",
      reason: "target_unresolved",
    });
    expect(history(unresolved)).toEqual({
      status: "unavailable",
      reason: "target_unresolved",
    });
  });

  it.each([485, 486])(
    "keeps current-use eligibility at report age %d days",
    (days) => {
      const input = packet();
      clock(
        input,
        new Date(
          Date.parse(`${report}T00:00:00.000Z`) + days * 86_400_000,
        ).toISOString(),
      );
      expect(resolve(input).currentAssets).toMatchObject({
        status: "available",
        currentUseEligible: days === 485,
      });
      expect(history(input)).toMatchObject(
        days === 485
          ? { status: "available" }
          : { status: "unavailable", reason: "current_use_unavailable" },
      );
    },
  );

  it.each([
    [{ form: "10-K/A" }, "unsupported_form"],
    [{ filingFocusPeriod: "Q4" }, "missing_or_non_FY_focus"],
    [{ startDate: "2025-01-01" }, "invalid_instant_period"],
    [{ endDate: "2025-09-29" }, "no_report_date"],
  ] as const)("keeps row admission for %j", (changes, reason) => {
    const input = packet([
      observation("AssetsCurrent", 0, changes),
      observation("LiabilitiesCurrent"),
    ]);
    if ("form" in changes)
      input.facts.observations.find(
        (row) => row.concept === "AssetsCurrent",
      )!.filing.status = "metadata_conflict";
    expect(resolve(input).currentAssets).toMatchObject({
      status: "unavailable",
      reason,
    });
    expect(history(input)).toEqual({ status: "unavailable", reason });
  });

  it("refuses ambiguous reported values without choosing one", () => {
    const input = packet([
      ...balances(),
      observation("AssetsCurrent", 1, { value: "121" }),
    ]);
    const result = resolve(input);
    expect(result.currentAssets).toMatchObject({
      status: "unavailable",
      reason: "ambiguous_value",
    });
    expect(result.currentAssets.observationIds).toHaveLength(2);
    expect(history(input)).toEqual({
      status: "unavailable",
      reason: "ambiguous_value",
    });
  });

  it.each([
    "version",
    "metric tag",
    "scan count",
    "ID",
    "decimal",
    "accession",
    "source CIK",
  ] as const)("rejects malformed canonical %s before calculation", (kind) => {
    const input = packet();
    const row = input.facts.observations[0]!;
    if (kind === "version")
      Object.assign(input.generation, { definitionVersion: "5.0.0" });
    if (kind === "metric tag") Object.assign(row, { metric: "current_assets" });
    if (kind === "scan count")
      scan(input, "AssetsCurrent").coverage.returned = 0;
    if (kind === "ID") Object.assign(row, { id: "sec-fact:bad" });
    if (kind === "decimal") row.value = "9".repeat(65);
    if (kind === "accession") row.accessionNumber = "0000999999-25-000001";
    if (kind === "source CIK")
      input.generation.sources.companyFacts.sourceUrl =
        "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000043.json";
    expect(() => resolve(input)).toThrow(TypeError);
    expect(() => history(input)).toThrow(TypeError);
  });
});

describe("canonical same-filing liquidity history", () => {
  it("retains observed nonconsecutive balance dates and stops after three complete balances", () => {
    const input = packet([
      ...balances(),
      ...balances("2023-06-30", "100", "60", 1),
      ...balances("2020-01-31", "70", "50", 2),
      ...balances("2018-12-31", "50", "40", 3),
    ]);
    expect(history(input)).toMatchObject({
      status: "available",
      stopped: null,
      balances: [
        {
          asOfDate: report,
          workingCapital: { value: "40" },
          currentRatio: { value: "1.50" },
        },
        { asOfDate: "2023-06-30", workingCapital: { value: "40" } },
        { asOfDate: "2020-01-31", workingCapital: { value: "20" } },
      ],
    });
    const result = history(input);
    if (result.status !== "available") throw new Error("Expected history.");
    expect(result.balances).toHaveLength(3);
    expect(
      Object.isFrozen(result.balances[1]!.currentRatio.observationIds),
    ).toBe(true);
  });

  it("stops at an incomplete observed balance date instead of skipping to an older complete balance", () => {
    const input = packet([
      ...balances(),
      observation("AssetsCurrent", 1, { endDate: "2024-09-30" }),
      ...balances("2023-09-30", "100", "60", 2),
    ]);
    const result = history(input);
    expect(result).toMatchObject({
      status: "available",
      balances: [{ asOfDate: report }],
      stopped: { asOfDate: "2024-09-30", reason: "no_report_date" },
    });
    if (result.status === "available") expect(result.balances).toHaveLength(1);
    const statement = resolvePersonalSecAnnualStatements(input).statements.find(
      (value) => value.id === "balance_sheet",
    )!;
    expect(statement.columns.map((column) => column.endDate)).toEqual([
      report,
      "2024-09-30",
      "2023-09-30",
    ]);
    expect(
      statement.rows.find((row) => row.concept === "AssetsCurrent")!.cells[2],
    ).toMatchObject({ status: "available" });
  });

  it("does not let another statement row's comparative dates replace liquidity history dates", () => {
    const input = packet([
      ...balances(),
      ...balances("2020-09-30", "100", "60", 1),
      observation("Assets", 0, { endDate: "2024-09-30" }),
      observation("Assets", 1, { endDate: "2023-09-30" }),
    ]);
    const statement = resolvePersonalSecAnnualStatements(input).statements.find(
      (value) => value.id === "balance_sheet",
    )!;
    expect(statement.columns.map((column) => column.endDate)).toEqual([
      report,
      "2024-09-30",
      "2023-09-30",
    ]);
    const result = history(input);
    if (result.status !== "available") throw new Error("Expected history.");
    expect(result.balances.map((balance) => balance.asOfDate)).toEqual([
      report,
      "2020-09-30",
    ]);
  });

  it("retains statement cells after current-use age expires while history refuses their current-use basis", () => {
    const input = packet([
      ...balances(),
      ...balances("2024-09-30", "100", "60", 1),
    ]);
    clock(input, "2027-02-01T00:00:00.000Z");
    expect(resolve(input).currentAssets).toMatchObject({
      status: "available",
      currentUseEligible: false,
    });
    expect(history(input)).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
    });
    const statement = resolvePersonalSecAnnualStatements(input).statements.find(
      (value) => value.id === "balance_sheet",
    )!;
    expect(
      statement.rows.find((row) => row.concept === "AssetsCurrent")!.cells,
    ).toMatchObject([
      { status: "available", currentUseEligible: false },
      { status: "available", currentUseEligible: false },
    ]);
  });

  it("refuses a selected observation after the report date instead of silently removing it from history", () => {
    const input = packet([
      ...balances(),
      observation("AssetsCurrent", 1, { endDate: "2025-10-01" }),
    ]);
    expect(resolve(input).currentAssets).toMatchObject({
      status: "available",
      asOfDate: report,
    });
    expect(history(input)).toEqual({
      status: "unavailable",
      reason: "report_end_mismatch",
    });
  });
});
