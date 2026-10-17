import { describe, expect, it, vi } from "vitest";
import {
  resolvePersonalSecAnnualCanonicalBalanceSheet as resolve,
  resolvePersonalSecAnnualCanonicalBalanceSheetHistory as history,
} from "./personal-sec-annual-canonical-balance-sheet";
import {
  fixture,
  observation,
  setScan,
} from "./personal-sec-annual-statements.fixture";

const exact = "900719925474099312345.000000000000000001";
function balances() {
  return fixture([
    observation("Assets", 0, { value: exact }),
    observation("Liabilities", 0, { value: "0" }),
    observation("StockholdersEquity", 0, { value: "-7.5" }),
  ]);
}

describe("canonical annual balance calculations", () => {
  it("retains exact unsafe amounts, zero and negative parent equity without changing the graph", () => {
    const graph = balances();
    const before = JSON.stringify(graph);
    const result = resolve(graph);
    expect(result.totalAssets).toMatchObject({
      status: "available",
      value: exact,
      unit: "USD",
      asOfDate: "2025-09-30",
      currentUseEligible: true,
    });
    expect(result.totalLiabilities).toMatchObject({
      status: "available",
      value: "0",
    });
    expect(result.shareholdersEquity).toMatchObject({
      status: "available",
      value: "-7.5",
    });
    expect(result.totalAssets.observationIds).toEqual(
      graph.facts.observations
        .filter((row) => row.concept === "Assets")
        .map((row) => row.id),
    );
    expect(JSON.stringify(graph)).toBe(before);
    expect(Object.isFrozen(graph.generation)).toBe(false);
    expect(Object.isFrozen(graph.facts.observations[0]!)).toBe(false);
    expect(Object.isFrozen(result.totalAssets)).toBe(true);
    expect(graph.generation.definitionVersion).toBe("6.0.0");
    expect(
      graph.facts.observations.every((row) => !Object.hasOwn(row, "metric")),
    ).toBe(true);
  });

  it("keeps all balance amounts independent of a failed income scan", () => {
    const graph = balances();
    setScan(graph, "NetIncomeLoss", {
      status: "invalid_response",
      absence: null,
      coverage: null,
    });
    expect(resolve(graph)).toEqual(resolve(balances()));
    expect(history(graph).status).toBe("available");
  });

  it("shows missing exact assets without hiding liabilities or parent equity", () => {
    const graph = fixture([
      observation("Liabilities"),
      observation("StockholdersEquity", 0, { value: "-1" }),
    ]);
    expect(resolve(graph).totalAssets).toMatchObject({
      status: "unavailable",
      reason: "concept_missing",
    });
    expect(resolve(graph).shareholdersEquity).toMatchObject({
      status: "available",
      value: "-1",
    });
  });

  it.each(["candidate_limit", "invalid_response"] as const)(
    "keeps a %s assets scan independent",
    (status) => {
      const graph = fixture([
        observation("Liabilities"),
        observation("StockholdersEquity"),
      ]);
      setScan(graph, "Assets", { status, absence: null, coverage: null });
      const result = resolve(graph);
      expect(result.totalAssets).toMatchObject({
        status: "unavailable",
        reason: status,
      });
      expect(result.totalLiabilities.status).toBe("available");
    },
  );

  it("refuses counted invalid assets rows with the original valid row reference intact", () => {
    const graph = balances();
    const scan = graph.facts.scans.find(
      (item) => item.concept === "Assets",
    )!.scan;
    if (scan.status !== "available")
      throw new Error("Invented scan unavailable");
    scan.coverage.full.candidateRows++;
    scan.coverage.full.inspectedRows++;
    scan.coverage.full.invalidRows++;
    const result = resolve(graph);
    expect(result.totalAssets).toMatchObject({
      status: "unavailable",
      reason: "invalid_source_rows",
      observationIds: [
        graph.facts.observations.find((row) => row.concept === "Assets")!.id,
      ],
    });
    expect(result.shareholdersEquity.status).toBe("available");
  });

  it("withholds a complete overflowing concept without clipping or refusing siblings", () => {
    const graph = fixture([
      observation("Liabilities"),
      observation("StockholdersEquity"),
    ]);
    setScan(graph, "Assets", {
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
    });
    expect(resolve(graph).totalAssets).toMatchObject({
      status: "unavailable",
      reason: "selected_report_overflow",
      observationIds: [],
    });
    expect(resolve(graph).shareholdersEquity.status).toBe("available");
    expect(
      graph.facts.scans.find((item) => item.concept === "Assets")!.scan,
    ).toMatchObject({
      coverage: { selected: 101, returned: 0, omittedSelected: 101 },
    });
  });

  it("retains every same-value source ID and refuses conflicting values", () => {
    const same = fixture([
      observation("Assets", 0, { value: exact }),
      observation("Assets", 1, { value: exact }),
    ]);
    expect(resolve(same).totalAssets).toMatchObject({
      status: "available",
      value: exact,
      observationIds: same.facts.observations.map((row) => row.id),
    });
    const conflict = fixture([
      observation("Assets", 0, { value: "10" }),
      observation("Assets", 1, { value: "11" }),
    ]);
    expect(resolve(conflict).totalAssets).toMatchObject({
      status: "unavailable",
      reason: "ambiguous_value",
    });
  });

  it("uses the balance-history date union and leaves missing cells unavailable", () => {
    const graph = fixture([
      observation("Assets", 0, { value: "30" }),
      observation("Assets", 1, { endDate: "2024-09-30", value: "20" }),
      observation("Liabilities", 0, { value: "0" }),
      observation("Liabilities", 1, { endDate: "2023-09-30", value: "10" }),
      observation("StockholdersEquity", 0, { value: "-7.5" }),
    ]);
    const result = history(graph);
    expect(result.status).toBe("available");
    if (result.status !== "available")
      throw new Error("Invented history unavailable");
    expect(result.balances.map((row) => row.asOfDate)).toEqual([
      "2025-09-30",
      "2024-09-30",
      "2023-09-30",
    ]);
    expect(result.balances[1]!.totalAssets).toMatchObject({
      status: "available",
      value: "20",
      currentUseEligible: false,
    });
    expect(result.balances[1]!.totalLiabilities).toMatchObject({
      status: "unavailable",
      reason: "no_report_date",
    });
    expect(result.balances[2]!.totalLiabilities).toMatchObject({
      status: "available",
      value: "10",
    });
  });

  it("does not let a later assets date supply balance-history columns or hide siblings", () => {
    const graph = fixture([
      observation("Assets"),
      observation("Assets", 1, { endDate: "2026-01-01" }),
      observation("StockholdersEquity", 0, { value: "-7.5" }),
    ]);
    expect(resolve(graph).totalAssets.status).toBe("available");
    const result = history(graph);
    expect(result.status).toBe("available");
    if (result.status !== "available")
      throw new Error("Invented history unavailable");
    expect(result.balances).toHaveLength(1);
    expect(result.balances[0]!.totalAssets).toMatchObject({
      status: "unavailable",
      reason: "report_end_mismatch",
    });
    expect(result.balances[0]!.shareholdersEquity).toMatchObject({
      status: "available",
      value: "-7.5",
    });
  });

  it("retains historical exact balances while withholding current-use history", () => {
    const graph = balances();
    graph.generation.cutoffAt = "2028-02-02T06:00:00.000Z";
    graph.generation.completedAt = "2028-02-02T06:00:03.000Z";
    graph.generation.sources.companyFacts.fetchedAt =
      "2028-02-02T06:00:01.000Z";
    graph.generation.sources.submissions.fetchedAt = "2028-02-02T06:00:02.000Z";
    expect(resolve(graph).totalAssets).toMatchObject({
      status: "available",
      value: exact,
      currentUseEligible: false,
    });
    expect(history(graph)).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
    });
  });

  it("refuses invalid load clocks without assigning a new generation", () => {
    const graph = balances();
    graph.generation.completedAt = "2026-02-02T05:59:59.000Z";
    expect(resolve(graph).totalAssets).toMatchObject({
      status: "unavailable",
      reason: "invalid_clock",
    });
    expect(resolve(graph).utilityAge).toBeNull();
  });

  it("keeps a supported v6-length unsupported source form as a diagnostic", () => {
    const graph = fixture([
      observation("Assets", 0, {
        form: "Z".repeat(40),
        filing: {
          ...observation("Assets").filing,
          status: "metadata_conflict",
        },
      }),
    ]);
    expect(resolve(graph).totalAssets).toMatchObject({
      status: "unavailable",
      reason: "unsupported_form",
    });
  });

  it.each(["old version", "metric extra", "accessor"] as const)(
    "keeps canonical admission closed for %s",
    (kind) => {
      const graph = balances();
      const getter = vi.fn(() => exact);
      if (kind === "old version")
        Object.assign(graph.generation, { definitionVersion: "5.0.0" });
      if (kind === "metric extra")
        Object.assign(graph.facts.observations[0]!, { metric: "total_assets" });
      if (kind === "accessor")
        Object.defineProperty(graph.facts.observations[0]!, "value", {
          enumerable: true,
          get: getter,
        });
      expect(() => resolve(graph)).toThrow(TypeError);
      expect(getter).not.toHaveBeenCalled();
    },
  );
});
