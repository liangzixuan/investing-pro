import { beforeAll, describe, expect, it } from "vitest";
import type {
  PersonalSecInterimCanonicalResponseDto as Response,
  PersonalSecInterimStatementConcept as Concept,
} from "@research-cockpit/contracts";
import {
  buildInterimFixture,
  sealFixture,
} from "./personal-sec-interim-test-fixture";
import { resolvePersonalSecInterimStatements as resolve } from "./personal-sec-interim-statements";
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
let fixture: Response;
beforeAll(async () => {
  fixture = await buildInterimFixture();
});
const copy = () => structuredClone(fixture) as Mutable<Response>;
const find = (value: Response, concept: Concept) =>
  resolve(value.evidence)
    .statements.flatMap((statement) => statement.rows)
    .find((row) => row.concept === concept)!;
const revenue = "RevenueFromContractWithCustomerExcludingAssessedTax";
describe("exact reported interim periods", () => {
  it("keeps quarter-shaped and YTD-shaped windows separate, without claiming their fiscal role", () => {
    const result = resolve(fixture.evidence),
      cells = find(fixture, revenue).cells;
    expect(result.contextReason).toBeNull();
    expect(result.statements.map((view) => view.rows.length)).toEqual([
      13, 13, 6,
    ]);
    expect(
      cells.map((cell) => [
        cell.period.startDate,
        cell.period.endDate,
        cell.period.durationDays,
        cell.period.classification,
        cell.status === "available" ? cell.value : null,
      ]),
    ).toEqual([
      ["2026-04-01", "2026-06-30", 91, "not_established", "40"],
      ["2026-01-01", "2026-06-30", 181, "not_established", "75"],
    ]);
    expect(new Set(cells.map((cell) => cell.period.key)).size).toBe(2);
    expect(
      find(fixture, "NetCashProvidedByUsedInOperatingActivities").cells[0],
    ).toMatchObject({
      status: "available",
      value: "9",
      period: {
        startDate: "2026-01-01",
        durationDays: 181,
        classification: "not_established",
      },
    });
    expect(find(fixture, "Assets").cells[0]).toMatchObject({
      status: "available",
      value: "120",
      period: {
        startDate: null,
        durationDays: null,
        classification: "instant",
      },
    });
    expect(find(fixture, "Revenues")).toMatchObject({
      reason: "concept_missing",
      cells: [],
    });
    expect(JSON.stringify(result)).not.toContain('"35"');
  });
  it("retains complete references and freezes every derived layer without mutating input", () => {
    const original = JSON.stringify(fixture),
      result = resolve(fixture.evidence);
    const cells = result.statements.flatMap((s) =>
      s.rows.flatMap((r) => r.cells),
    );
    expect(cells.flatMap((cell) => cell.observationIds)).toEqual(
      fixture.evidence.facts.observations.map((row) => row.id),
    );
    expect(
      [
        result,
        result.statements,
        result.statements[0],
        cells[0],
        cells[0]!.period,
        cells[0]!.observationIds,
      ].every(Object.isFrozen),
    ).toBe(true);
    expect(JSON.stringify(fixture)).toBe(original);
  });
  it("rejects a same-period conflicting value without losing the other duration", async () => {
    const value = copy(),
      row = value.evidence.facts.observations[0]!;
    value.evidence.facts.observations.push({
      ...row,
      value: "41",
      sourceLocator: row.sourceLocator.replace(/0$/u, "2"),
    });
    const scan = value.evidence.facts.scans[0]!.scan;
    if (scan.status !== "available") throw new Error("fixture");
    scan.coverage.full.candidateRows =
      scan.coverage.full.inspectedRows =
      scan.coverage.full.uniqueObservations =
        3;
    scan.coverage.selected = scan.coverage.returned = 3;
    const evidence = await sealFixture(value.evidence);
    const cells = find({ ...value, evidence }, revenue).cells;
    expect(cells[0]).toMatchObject({
      status: "unavailable",
      reason: "ambiguous_value",
    });
    expect(cells[0]!.observationIds).toHaveLength(2);
    expect(cells[1]).toMatchObject({ status: "available", value: "75" });
  });
  it("withholds an overflowing whole concept and does not substitute a priced subset", () => {
    const value = copy(),
      scan = value.evidence.facts.scans[0]!.scan;
    if (scan.status !== "available") throw new Error("fixture");
    value.evidence.facts.observations =
      value.evidence.facts.observations.filter(
        (row) => row.concept !== revenue,
      );
    scan.coverage.full = {
      candidateRows: 101,
      inspectedRows: 101,
      invalidRows: 0,
      duplicateRows: 0,
      uniqueObservations: 101,
    };
    scan.coverage.selected = 101;
    scan.coverage.returned = 0;
    scan.coverage.omittedSelected = 101;
    expect(find(value, revenue)).toMatchObject({
      reason: "selected_report_overflow",
      cells: [],
    });
    expect(find(value, "Assets").cells[0]).toMatchObject({
      status: "available",
      value: "120",
    });
  });
  it("retains a comparative period and ignores source fp/frame as a fiscal classifier", async () => {
    const value = copy(),
      row = value.evidence.facts.observations[0]!;
    row.startDate = "2025-04-01";
    row.endDate = "2025-06-30";
    row.durationDays = 91;
    row.frame = "CY2026Q2";
    const evidence = await sealFixture(value.evidence);
    const cells = find({ ...value, evidence }, revenue).cells;
    expect(cells.at(-1)).toMatchObject({
      status: "available",
      value: "40",
      period: {
        kind: "comparative",
        startDate: "2025-04-01",
        classification: "not_established",
      },
    });
  });
  it("retains valid short/52-week-calendar windows without annual or quarter inference", async () => {
    const value = copy(),
      row = value.evidence.facts.observations[0]!;
    row.startDate = "2026-06-29";
    row.durationDays = 2;
    row.filingFocusPeriod = "FY";
    const evidence = await sealFixture(value.evidence);
    expect(find({ ...value, evidence }, revenue).cells[0]).toMatchObject({
      status: "available",
      period: { durationDays: 2, classification: "not_established" },
    });
  });
  it("refuses a durationless flow and an instant with a start while preserving source references", async () => {
    const value = copy(),
      row = value.evidence.facts.observations[0]!;
    row.startDate = null;
    row.durationDays = null;
    expect(
      find(
        { ...value, evidence: await sealFixture(value.evidence) },
        revenue,
      ).cells.at(-1),
    ).toMatchObject({
      status: "unavailable",
      reason: "invalid_duration_period",
    });
    const asset = value.evidence.facts.observations.find(
      (item) => item.concept === "Assets",
    )!;
    asset.startDate = "2026-06-30";
    asset.durationDays = 1;
    expect(
      find({ ...value, evidence: await sealFixture(value.evidence) }, "Assets")
        .cells[0],
    ).toMatchObject({
      status: "unavailable",
      reason: "invalid_instant_period",
    });
  });
  it("refuses values when captured clocks are inconsistent", () => {
    const value = copy();
    value.evidence.generation.completedAt = "2026-07-31T12:00:00.000Z";
    expect(resolve(value.evidence).contextReason).toBe("invalid_clock");
    expect(
      find(value, revenue).cells.every((cell) => cell.status === "unavailable"),
    ).toBe(true);
  });
  it("does not call a refused future date comparative", async () => {
    const value = copy(),
      row = value.evidence.facts.observations[0]!;
    row.endDate = "2026-07-01";
    row.durationDays = 92;
    const evidence = await sealFixture(value.evidence);
    expect(find({ ...value, evidence }, revenue).cells[0]).toMatchObject({
      status: "unavailable",
      reason: "future_or_inconsistent_dates",
      period: { kind: "unresolved" },
    });
  });
});
