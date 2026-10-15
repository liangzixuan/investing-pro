import { describe, expect, it } from "vitest";
import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  PERSONAL_SEC_ANNUAL_BALANCE_SHEET_ABSENCES,
  PERSONAL_SEC_ANNUAL_BALANCE_SHEET_CONCEPTS,
  PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS,
  PERSONAL_SEC_ANNUAL_BALANCE_SHEET_REASONS,
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION,
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  parseManagedSecAnnualEvidenceRequest,
} from "./index";

describe("reported balance-sheet contract", () => {
  it("admits only the three fixed totals, including parent equity without a substitute", () => {
    expect(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_CONCEPTS).toEqual([
      "Assets",
      "Liabilities",
      "StockholdersEquity",
    ]);
    expect(Object.isFrozen(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_CONCEPTS)).toBe(
      true,
    );
    expect(PERSONAL_SEC_QUARTERLY_CONCEPTS).toHaveLength(4);
    expect(PERSONAL_SEC_QUARTERLY_CONCEPTS).not.toContain("Assets");
  });

  it("keeps bounded independent scans and the unchanged Annual transport cap", () => {
    expect(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS).toEqual({
      candidateRowsPerMetric: 10_000,
      observationsPerMetric: 100,
      decimalCharacters: 64,
    });
    expect(Object.isFrozen(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS)).toBe(
      true,
    );
    expect(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS).toEqual({
      requestBytes: 4096,
      responseBytes: 2097152,
    });
  });

  it("defines source refusals without adding sign or equation refusals for raw totals", () => {
    expect(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_ABSENCES).toEqual([
      "concept_missing",
      "usd_missing",
      "empty_usd",
    ]);
    expect(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_REASONS).toContain(
      "ambiguous_value",
    );
    expect(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_REASONS).toContain(
      "invalid_instant_period",
    );
    expect(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_REASONS).not.toContain(
      "unsupported_sign",
    );
    expect(new Set(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_REASONS).size).toBe(
      PERSONAL_SEC_ANNUAL_BALANCE_SHEET_REASONS.length,
    );
    expect(Object.isFrozen(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_ABSENCES)).toBe(
      true,
    );
    expect(Object.isFrozen(PERSONAL_SEC_ANNUAL_BALANCE_SHEET_REASONS)).toBe(
      true,
    );
  });

  it("requires coordinated version 5 and refuses an old client without an optional graph", () => {
    const request = {
      schemaVersion: "5.0.0",
      catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
      listingId: "invented-listing-a",
      symbol: "ZERO.A",
    };
    expect(PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION).toBe("5.0.0");
    expect(PERSONAL_SEC_ANNUAL_DEFINITION_VERSION).toBe("5.0.0");
    expect(parseManagedSecAnnualEvidenceRequest(request)).toEqual(request);
    expect(
      parseManagedSecAnnualEvidenceRequest({
        ...request,
        schemaVersion: "4.0.0",
      }),
    ).toBeNull();
  });
});
