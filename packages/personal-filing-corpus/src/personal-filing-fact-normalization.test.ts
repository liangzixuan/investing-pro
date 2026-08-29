import { describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_FACT_CONTRACTS,
  PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
  PERSONAL_FILING_FACT_KEYS,
  PERSONAL_FILING_FACT_NORMALIZATION_CHECKS,
  PERSONAL_FILING_FACT_NORMALIZATION_CLAIM,
  PERSONAL_FILING_FACT_NORMALIZATION_LIMITS,
  PERSONAL_FILING_FACT_NORMALIZATION_NOT_PROVEN,
  PERSONAL_FILING_FACT_NORMALIZATION_QUARANTINE_CODES,
  PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
  normalizePersonalFilingFacts,
  type PersonalFilingFactNormalizationRecord,
} from "./personal-filing-fact-normalization";
import {
  buildPersonalFilingFactFixture,
  sha256,
} from "./test-personal-filing-fact-builder";

describe("personal filing fact normalization", () => {
  it("freezes the bounded personal claim, fixed facts, limits, and nonclaims", () => {
    expect(PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_FILING_FACT_NORMALIZATION_CLAIM).toBe(
      "bounded_private_ten_fact_normalization_and_manifest_linked_lineage_for_personal_single_user_local_use",
    );
    expect(PERSONAL_FILING_FACT_KEYS).toEqual([
      "assets",
      "cash",
      "debt",
      "diluted_shares",
      "free_cash_flow",
      "gross_profit",
      "net_income",
      "operating_cash_flow",
      "operating_income",
      "revenue",
    ]);
    expect(PERSONAL_FILING_FACT_CONTRACTS).toHaveLength(10);
    expect(PERSONAL_FILING_FACT_CONTRACTS[4]).toEqual({
      key: "free_cash_flow",
      periodKind: "duration",
      unit: "USD",
    });
    expect(PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA).toBe(
      "operating_cash_flow_minus_capital_expenditures",
    );
    expect(PERSONAL_FILING_FACT_NORMALIZATION_LIMITS).toEqual({
      aggregateStringCodePoints: 65_536,
      decimalIntegerDigits: 26,
      decimalPrecision: 38,
      decimalScale: 12,
      documentDepth: 9,
      documentNodes: 768,
      factsPerDocument: 10,
      lineageEdges: 10,
      normalizationPlanBytes: 32_768,
      parserResultBytes: 131_072,
      sourceDocuments: 2,
    });
    expect(PERSONAL_FILING_FACT_NORMALIZATION_QUARANTINE_CODES).toEqual([
      "input_invalid",
      "corpus_invalid",
      "plan_invalid",
      "source_document_invalid",
      "source_metadata_invalid",
      "fact_set_invalid",
      "derivation_invalid",
      "lineage_invalid",
      "normalization_failure",
    ]);
    expect(PERSONAL_FILING_FACT_NORMALIZATION_CHECKS).toContain(
      "free_cash_flow_operand_context_unit_value_link_and_strict_decimal_recomputation",
    );
    expect(PERSONAL_FILING_FACT_NORMALIZATION_NOT_PROVEN).toContain(
      "ixbrl_xbrl_parser_extraction_or_taxonomy_mapping_correctness",
    );
    expect(PERSONAL_FILING_FACT_NORMALIZATION_NOT_PROVEN).toContain(
      "absence_of_amendments_or_corrections_outside_the_exact_frozen_manifest",
    );
    for (const value of [
      PERSONAL_FILING_FACT_KEYS,
      PERSONAL_FILING_FACT_CONTRACTS,
      PERSONAL_FILING_FACT_NORMALIZATION_CHECKS,
      PERSONAL_FILING_FACT_NORMALIZATION_NOT_PROVEN,
      PERSONAL_FILING_FACT_NORMALIZATION_LIMITS,
      PERSONAL_FILING_FACT_NORMALIZATION_QUARANTINE_CODES,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("normalizes one exact manifest-bound 10-K as root-only lineage", () => {
    const fixture = buildPersonalFilingFactFixture();
    const result = normalized(normalizePersonalFilingFacts(fixture));

    expect(result.audit).toEqual({
      factVersionCount: 10,
      lineageCount: 0,
      outcome: "normalized",
      sourceDocumentCount: 1,
    });
    expect(result.lineageStatus).toBe("root_only_no_in_corpus_amendment");
    expect(result.nullKnownToScope).toBe(
      "no_later_version_within_exact_frozen_manifest_only",
    );
    expect(result.lineageScope).toBe(
      "issuer_filing_versions_within_exact_frozen_manifest_only",
    );
    expect(result.ownerCorrectionStatus).toBe("not_modeled");
    expect(result.lineage).toEqual([]);
    expect(result.factVersions.map((fact) => fact.key)).toEqual(
      PERSONAL_FILING_FACT_KEYS,
    );
    expect(
      result.factVersions.every(
        (fact) =>
          fact.predecessorFactId === null &&
          fact.successorFactId === null &&
          fact.knownToExclusive === null &&
          fact.synthetic === false,
      ),
    ).toBe(true);
    expect(result.normalizationPlanSha256).toBe(
      sha256(fixture.normalizationPlan),
    );
    expect(result.sourceDocumentSha256s).toEqual([
      sha256(fixture.sourceDocuments[0]!),
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.factVersions)).toBe(true);
    expect(Object.isFrozen(result.lineage)).toBe(true);
    expectSuccessGraphFrozen(result);
  });

  it("records the only permitted derivation with exact private operands", () => {
    const result = normalized(
      normalizePersonalFilingFacts(buildPersonalFilingFactFixture()),
    );
    const operatingCashFlow = result.factVersions.find(
      (fact) => fact.key === "operating_cash_flow",
    );
    const freeCashFlow = result.factVersions.find(
      (fact) => fact.key === "free_cash_flow",
    );

    expect(freeCashFlow?.sourceConcept).toBeNull();
    expect(freeCashFlow?.value).toBe("15000000");
    expect(freeCashFlow?.derivation).toEqual({
      formula: "operating_cash_flow_minus_capital_expenditures",
      minuend: {
        concept: "sample:OperatingCashFlow",
        dimensions: {},
        periodEnd: "2025-12-31",
        periodStart: "2025-01-01",
        unit: "USD",
        value: "20000000",
      },
      subtrahend: {
        concept: "sample:CapitalExpenditures",
        dimensions: {},
        periodEnd: "2025-12-31",
        periodStart: "2025-01-01",
        unit: "USD",
        value: "5000000",
      },
    });
    expect(freeCashFlow?.derivation?.minuend.value).toBe(
      operatingCashFlow?.value,
    );
    expect(Object.isFrozen(freeCashFlow?.derivation)).toBe(true);
    expect(Object.isFrozen(freeCashFlow?.derivation?.minuend)).toBe(true);
    expect(
      result.factVersions
        .filter((fact) => fact.key !== "free_cash_flow")
        .every(
          (fact) => fact.derivation === null && fact.sourceConcept !== null,
        ),
    ).toBe(true);
  });

  it("normalizes one exact manifest-linked 10-K/A pair with ten edges", () => {
    const fixture = buildPersonalFilingFactFixture(true);
    const result = normalized(normalizePersonalFilingFacts(fixture));

    expect(result.audit).toEqual({
      factVersionCount: 20,
      lineageCount: 10,
      outcome: "normalized",
      sourceDocumentCount: 2,
    });
    expect(result.lineageStatus).toBe("amendment_supersession_observed");
    expect(result.lineage).toHaveLength(10);
    for (let index = 0; index < PERSONAL_FILING_FACT_KEYS.length; index += 1) {
      const predecessor = result.factVersions[index];
      const successor = result.factVersions[index + 10];
      expect(predecessor?.knownToExclusive).toBe("2026-03-15T20:00:01.000Z");
      expect(predecessor?.successorFactId).toBe(successor?.factId);
      expect(successor?.predecessorFactId).toBe(predecessor?.factId);
      expect(successor?.successorFactId).toBeNull();
      expect(result.lineage[index]).toEqual({
        effectiveAt: "2026-03-15T20:00:01.000Z",
        key: PERSONAL_FILING_FACT_KEYS[index],
        predecessorFactId: predecessor?.factId,
        successorFactId: successor?.factId,
      });
    }
    expect(
      result.factVersions
        .filter((fact) => fact.key === "cash")
        .map((fact) => fact.value),
    ).toEqual(["24000000", "24000000"]);
    expect(
      result.factVersions
        .filter((fact) => fact.key === "revenue")
        .map((fact) => fact.value),
    ).toEqual(["120000000", "116400000"]);
    expectSuccessGraphFrozen(result);
  });
});

function normalized(
  result: ReturnType<typeof normalizePersonalFilingFacts>,
): PersonalFilingFactNormalizationRecord {
  expect(result.status).toBe("normalized_for_personal_use");
  if (result.status !== "normalized_for_personal_use") {
    throw new Error("Expected normalized personal filing facts.");
  }
  return result;
}

function expectSuccessGraphFrozen(
  result: PersonalFilingFactNormalizationRecord,
): void {
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.audit)).toBe(true);
  expect(Object.isFrozen(result.factVersions)).toBe(true);
  expect(Object.isFrozen(result.lineage)).toBe(true);
  expect(Object.isFrozen(result.sourceDocumentSha256s)).toBe(true);
  for (const fact of result.factVersions) {
    expect(Object.isFrozen(fact)).toBe(true);
    expect(Object.isFrozen(fact.dimensions)).toBe(true);
    if (fact.derivation !== null) {
      expect(Object.isFrozen(fact.derivation)).toBe(true);
      expect(Object.isFrozen(fact.derivation.minuend)).toBe(true);
      expect(Object.isFrozen(fact.derivation.minuend.dimensions)).toBe(true);
      expect(Object.isFrozen(fact.derivation.subtrahend)).toBe(true);
      expect(Object.isFrozen(fact.derivation.subtrahend.dimensions)).toBe(true);
    }
  }
  for (const edge of result.lineage) expect(Object.isFrozen(edge)).toBe(true);
}
