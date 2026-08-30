import { describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_FACT_COMPARISON_ASSURANCE,
  PERSONAL_FILING_FACT_COMPARISON_CHECKS,
  PERSONAL_FILING_FACT_COMPARISON_CLAIM,
  PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS,
  PERSONAL_FILING_FACT_COMPARISON_LIMITS,
  PERSONAL_FILING_FACT_COMPARISON_NOT_PROVEN,
  PERSONAL_FILING_FACT_COMPARISON_QUARANTINE_CODES,
  PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION,
  comparePersonalFilingFactValidation,
  compareSuppliedPersonalFilingFactRecordForTesting,
  type PersonalFilingFactComparisonAgreementReceipt,
} from "./personal-filing-fact-comparison";
import {
  buildPersonalFilingFactComparisonFixture,
  canonicalPersonalFilingFactComparisonRecord,
  runPythonPersonalFilingFactValidator,
} from "./test-personal-filing-fact-comparison-builder";
import {
  buildPersonalFilingFactFixture,
  canonicalPersonalFilingFactDocument,
  decodePersonalFilingFactDocument,
  type JsonRecord,
} from "./test-personal-filing-fact-builder";

describe("personal filing fact cross-implementation comparison", () => {
  it("freezes the bounded claim, pinned roles, limits, and nonclaims", () => {
    expect(PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_FILING_FACT_COMPARISON_CLAIM).toBe(
      "bounded_repository_pinned_typescript_python_validator_exact_record_agreement_and_atomic_value_free_conflict_quarantine_for_personal_single_user_local_use",
    );
    expect(PERSONAL_FILING_FACT_COMPARISON_ASSURANCE).toBe(
      "distinct_repository_pinned_implementations_over_one_shared_parser_result_scope",
    );
    expect(PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS).toHaveLength(2);
    expect(PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS[0]).toMatchObject({
      role: "typescript-primary",
      runtimeFamily: "node-typescript",
      validatorVersion: "1.0.0",
    });
    expect(PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS[1]).toMatchObject({
      role: "python-secondary",
      runtimeFamily: "python-stdlib",
      validatorVersion: "1.0.1",
    });
    expect(
      PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS[0].implementationSha256,
    ).not.toBe(
      PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS[1].implementationSha256,
    );
    for (const binding of PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS) {
      expect(binding.implementationSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(Object.isFrozen(binding)).toBe(true);
    }
    expect(PERSONAL_FILING_FACT_COMPARISON_LIMITS).toEqual({
      aggregateStringCodePoints: 131_072,
      recordBytes: 1_048_576,
      recordDepth: 12,
      recordNodes: 4_096,
      sourceDocuments: 2,
      validators: 2,
    });
    expect(PERSONAL_FILING_FACT_COMPARISON_QUARANTINE_CODES).toEqual([
      "input_invalid",
      "normalization_quarantined",
      "validator_execution_failure",
      "validator_output_invalid",
      "validator_conflict",
      "comparison_failure",
    ]);
    expect(PERSONAL_FILING_FACT_COMPARISON_CHECKS).toContain(
      "byte_exact_complete_cycle2u_record_agreement_not_digest_or_subset_equality",
    );
    expect(PERSONAL_FILING_FACT_COMPARISON_CHECKS).toContain(
      "bounded_python_isolated_mode_stdin_subprocess_with_pinned_source_preflight",
    );
    expect(PERSONAL_FILING_FACT_COMPARISON_NOT_PROVEN).toContain(
      "independent_raw_filing_parsing_extraction_or_taxonomy_mapping",
    );
    expect(PERSONAL_FILING_FACT_COMPARISON_NOT_PROVEN).toContain(
      "operator_host_key_process_failure_domain_or_code_lineage_independence",
    );
    expect(PERSONAL_FILING_FACT_COMPARISON_NOT_PROVEN).toContain(
      "python_executable_identity_process_isolation_source_preflight_to_launch_atomicity_or_runtime_attestation",
    );
    for (const value of [
      PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS,
      PERSONAL_FILING_FACT_COMPARISON_CHECKS,
      PERSONAL_FILING_FACT_COMPARISON_NOT_PROVEN,
      PERSONAL_FILING_FACT_COMPARISON_LIMITS,
      PERSONAL_FILING_FACT_COMPARISON_QUARANTINE_CODES,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("agrees on the complete root-only Cycle 2u record", () => {
    const fixture = buildPersonalFilingFactComparisonFixture();
    expect(fixture.secondaryRecord).toEqual(
      canonicalPersonalFilingFactComparisonRecord(fixture.primaryRecord),
    );

    const result = agreed(comparePersonalFilingFactValidation(fixture.input));
    expect(result.audit).toEqual({
      factVersionCount: 10,
      lineageCount: 0,
      outcome: "agreed",
      sourceDocumentCount: 1,
      validatorCount: 2,
    });
    expect(result.validatorBindings.map((binding) => binding.role)).toEqual([
      "typescript-primary",
      "python-secondary",
    ]);
    expect(result.validatorBindings[0].normalizedRecordSha256).toBe(
      result.normalizedRecordSha256,
    );
    expect(result.validatorBindings[1].normalizedRecordSha256).toBe(
      result.normalizedRecordSha256,
    );
    expect(Object.keys(result)).not.toContain("factVersions");
    expect(Object.keys(result)).not.toContain("lineage");
    expectSuccessFrozen(result);
  });

  it("agrees on the complete manifest-linked amendment graph", () => {
    const result = agreed(
      comparePersonalFilingFactValidation(
        buildPersonalFilingFactComparisonFixture(true).input,
      ),
    );
    expect(result.audit).toEqual({
      factVersionCount: 20,
      lineageCount: 10,
      outcome: "agreed",
      sourceDocumentCount: 2,
      validatorCount: 2,
    });
    expectSuccessFrozen(result);
  });

  it("reconstructs changed source input in Python without a TypeScript record", () => {
    const fixture = buildPersonalFilingFactFixture();
    const original = runPythonPersonalFilingFactValidator(fixture);
    const source = decodePersonalFilingFactDocument(
      fixture.sourceDocuments[0]!,
    );
    const revenue = facts(source).find((entry) => entry.key === "revenue");
    if (revenue === undefined) throw new Error("Generated revenue is missing.");
    revenue.value = "120000001";
    const changedFixture = Object.freeze({
      ...fixture,
      sourceDocuments: Object.freeze([
        canonicalPersonalFilingFactDocument(source),
      ]),
    });
    const changed = runPythonPersonalFilingFactValidator(changedFixture);

    expect(changed).not.toEqual(original);
    expect(
      compareSuppliedPersonalFilingFactRecordForTesting({
        ...changedFixture,
        secondaryRecord: changed,
      }).status,
    ).toBe("matched_for_testing_only");
    expect(comparePersonalFilingFactValidation(changedFixture).status).toBe(
      "agreed_for_personal_use",
    );
  });

  it("agrees on year zero in both date canonicalizers", () => {
    const fixture = buildPersonalFilingFactFixture();
    const source = decodePersonalFilingFactDocument(
      fixture.sourceDocuments[0]!,
    );
    for (const fact of facts(source)) {
      fact.periodEnd = "0000-12-31";
      if (fact.periodStart !== null) fact.periodStart = "0000-01-01";
      const derivation = fact.derivation as JsonRecord | null;
      if (derivation !== null) {
        for (const operandName of ["minuend", "subtrahend"] as const) {
          const operand = derivation[operandName] as JsonRecord;
          operand.periodEnd = "0000-12-31";
          if (operand.periodStart !== null) operand.periodStart = "0000-01-01";
        }
      }
    }

    const changedFixture = Object.freeze({
      ...fixture,
      sourceDocuments: Object.freeze([
        canonicalPersonalFilingFactDocument(source),
      ]),
    });
    const output = runPythonPersonalFilingFactValidator(changedFixture);

    expect(
      compareSuppliedPersonalFilingFactRecordForTesting({
        ...changedFixture,
        secondaryRecord: output,
      }),
    ).toEqual({ status: "matched_for_testing_only" });
    expect(comparePersonalFilingFactValidation(changedFixture).status).toBe(
      "agreed_for_personal_use",
    );
  });

  it("is deterministic, fresh, and deeply immutable", () => {
    const first = comparePersonalFilingFactValidation(
      buildPersonalFilingFactComparisonFixture(true).input,
    );
    const second = comparePersonalFilingFactValidation(
      buildPersonalFilingFactComparisonFixture(true).input,
    );
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).not.toBe(second);
    expect(first.audit).not.toBe(second.audit);
    if (
      first.status !== "agreed_for_personal_use" ||
      second.status !== "agreed_for_personal_use"
    ) {
      throw new Error("Expected deterministic agreement.");
    }
    expect(first.validatorBindings).not.toBe(second.validatorBindings);
    expectSuccessFrozen(first);
    expectSuccessFrozen(second);
  });
});

function agreed(
  result: ReturnType<typeof comparePersonalFilingFactValidation>,
): PersonalFilingFactComparisonAgreementReceipt {
  expect(result.status).toBe("agreed_for_personal_use");
  if (result.status !== "agreed_for_personal_use") {
    throw new Error("Expected personal validator agreement.");
  }
  return result;
}

function expectSuccessFrozen(
  result: PersonalFilingFactComparisonAgreementReceipt,
): void {
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.audit)).toBe(true);
  expect(Object.isFrozen(result.validatorBindings)).toBe(true);
  for (const binding of result.validatorBindings) {
    expect(Object.isFrozen(binding)).toBe(true);
  }
}

function facts(source: JsonRecord): JsonRecord[] {
  return source.facts as JsonRecord[];
}
