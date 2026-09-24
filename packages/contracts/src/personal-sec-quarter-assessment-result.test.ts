import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  isPersonalSecQuarterAnalysis,
  isPersonalSecQuarterAssessmentResponse,
  isPersonalSecQuarterPrimaryEvidence,
  type PersonalSecQuarterAssessmentRequestDto,
  type PersonalSecQuarterAssessmentResponseDto,
} from "./personal-sec-quarter-assessment";

// Invented EXMPL response produced by the real source/worker pipeline, never owner data.
const fixture: unknown = JSON.parse(
  readFileSync(
    new URL(
      "../../../fixtures/synthetic/sec-quarter-assessment/supported-response.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const request: PersonalSecQuarterAssessmentRequestDto = {
  schemaVersion: "1.0.0",
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  listingId: "fixture:example",
  symbol: "EXMPL",
  selection: {
    accessionNumber: "0000999999-25-000001",
    form: "10-Q",
    filedDate: "2025-05-05",
    reportDate: "2025-03-31",
  },
};
function complete() {
  const value: unknown = structuredClone(fixture);
  expect(isPersonalSecQuarterAssessmentResponse(value, request)).toBe(true);
  const response = value as PersonalSecQuarterAssessmentResponseDto;
  if (response.assessment.stage !== "assessment")
    throw new Error("Expected complete fixture");
  return response.assessment;
}
type Mutable<T> = T extends object
  ? { -readonly [K in keyof T]: Mutable<T[K]> }
  : T;
function mutable() {
  return structuredClone(complete()) as Mutable<ReturnType<typeof complete>>;
}

describe("supported quarter result proof joins", () => {
  it("preserves the source-derived signed pair and full proof graph", () => {
    const value = complete();
    expect(value.analysis.pair.status).toBe("supported_as_filed");
    expect(value.analysis.metrics[1]!.value?.startsWith("-")).toBe(true);
  });
  it.each([
    "report_identity_v1",
    "calendar_direct_boundary_v1",
    "principal_statement_v1",
    "standalone_column_v1",
    "whole_revenue_v1",
    "parent_income_explicit_v1",
    "signed_usd_display_v1",
    "static_source_path_v1",
  ])("requires witness dependency %s", (profile) => {
    const value = mutable();
    const ids = new Set(
      value.analysis.predicates
        .filter((p) => p.profile === profile)
        .map((p) => p.id),
    );
    expect(ids.size).toBeGreaterThan(0);
    for (const witness of value.analysis.witnesses)
      witness.predicateIds = witness.predicateIds.filter((id) => !ids.has(id));
    expect(isPersonalSecQuarterAnalysis(value.analysis, value.evidence)).toBe(
      false,
    );
  });
  it.each(["column", "display", "static", "calendar"] as const)(
    "binds %s observations to their witness",
    (kind) => {
      const value = mutable();
      const observed = value.analysis.predicates.find(
        (p) => p.observed?.kind === kind,
      )!.observed!;
      if (observed.kind === "column")
        observed.numericCellRef = value.analysis.witnesses[1]!.numericCellRef;
      if (observed.kind === "display") observed.value = "999";
      if (observed.kind === "static") observed.pathRefs = [];
      if (observed.kind === "calendar") observed.quarterStart = "2025-01-02";
      expect(isPersonalSecQuarterAnalysis(value.analysis, value.evidence)).toBe(
        false,
      );
    },
  );
  it("requires the display predicate's original evidence references", () => {
    const value = mutable();
    const predicate = value.analysis.predicates.find(
      (p) => p.profile === "signed_usd_display_v1",
    )!;
    predicate.evidenceIds = [value.analysis.witnesses[0]!.primaryRef];
    expect(isPersonalSecQuarterAnalysis(value.analysis, value.evidence)).toBe(
      false,
    );
  });
});

describe("complete table source geometry", () => {
  it.each(["span", "cell", "row", "column"] as const)(
    "refuses altered %s geometry while retaining original markup",
    (change) => {
      const value = mutable();
      const witness = value.analysis.witnesses[0]!;
      const table = value.evidence.primary.structure!.tables.find(
        (t) => t.tableRecordId === witness.tableRef,
      )!;
      const header = table.rows
        .flatMap((r) => r.cells)
        .find((c) => c.cellRecordId === witness.durationHeaderRefs[0])!;
      if (change === "span") header.columnSpan -= 1;
      if (change === "cell") table.rows[0]!.cells.pop();
      if (change === "row") {
        table.rows.pop();
        table.rowRecordIds.pop();
      }
      if (change === "column") header.columnStart += 1;
      expect(isPersonalSecQuarterPrimaryEvidence(value.evidence.primary)).toBe(
        false,
      );
    },
  );
});
