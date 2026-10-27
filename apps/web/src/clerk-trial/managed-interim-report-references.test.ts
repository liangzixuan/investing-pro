import { expect, it } from "vitest";
import {
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry,
  type PersonalSecInterimStatementsDto,
} from "@research-cockpit/contracts";
import { interimReportReferences } from "./managed-interim-report-references";
import { COMPANY_REPORT_INTERIM_REFERENCES_MAX_BYTES } from "./managed-company-report-document";
it("bounds all3200 singleton references with longest duration keys and refusal strings", () => {
  const projection: PersonalSecInterimStatementsDto = {
    contextReason: "filing_unmatched_or_conflicted",
    statements: (
      ["income_statement", "balance_sheet", "cash_flow"] as const
    ).map((id) => ({
      id,
      rows: registry
        .filter((entry) => entry.statement === id)
        .map((entry) => ({
          concept: entry.concept,
          lineId: entry.lineId,
          reason: "filing_unmatched_or_conflicted",
          cells: Array.from({ length: 100 }, (_, index) => ({
            period: {
              key: JSON.stringify(["duration", "1000-01-01", "9999-12-31"]),
              periodType: "duration",
              startDate: "1000-01-01",
              endDate: "9999-12-31",
              durationDays: 3287182,
              kind: "unresolved",
              classification: "not_established",
            },
            observationIds: [
              `sec-interim-fact:${index.toString(16).padStart(64, "0")}` as const,
            ],
            status: "unavailable",
            reason: "filing_unmatched_or_conflicted",
          })),
        })),
    })),
  };
  const refs = interimReportReferences(projection),
    text = JSON.stringify(refs);
  expect(
    refs.statements.flatMap((s) => s.rows).flatMap((r) => r.cells),
  ).toHaveLength(3200);
  expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(
    COMPANY_REPORT_INTERIM_REFERENCES_MAX_BYTES,
  );
  console.log(
    JSON.stringify({
      maximumReferencePlaneBytes: new TextEncoder().encode(text).byteLength,
      referenceBudget: COMPANY_REPORT_INTERIM_REFERENCES_MAX_BYTES,
    }),
  );
  expect(text).not.toContain('"value"');
  expect(text).not.toContain('"period":');
});
