import { describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_RAW_FACT_EXTRACTION_ASSURANCE,
  PERSONAL_FILING_RAW_FACT_EXTRACTION_CHECKS,
  PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM,
  PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS,
  PERSONAL_FILING_RAW_FACT_EXTRACTION_NOT_PROVEN,
  PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION,
  PERSONAL_FILING_RAW_FACT_EXTRACTOR_BINDING,
  comparePersonalFilingRawFactExtraction,
  compareSuppliedPersonalFilingRawFactExtractionForTesting,
} from "./personal-filing-raw-fact-extraction";
import {
  buildPersonalFilingRawFactExtractionFixture,
  runPythonPersonalFilingRawFactExtractor,
} from "./test-personal-filing-raw-fact-extraction-builder";
import {
  canonicalPersonalFilingFactDocument,
  decodePersonalFilingFactDocument,
  type JsonRecord,
} from "./test-personal-filing-fact-builder";

describe("personal filing raw fact extraction", () => {
  it("freezes the narrow claim, assurance, controls, limits, and nonclaims", () => {
    expect(PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM).toContain(
      "python_raw_ixbrl_ten_fact_projection_agreement",
    );
    expect(PERSONAL_FILING_RAW_FACT_EXTRACTION_ASSURANCE).toBe(
      "secondary_raw_extractor_receives_no_primary_parser_result_normalized_record_or_digest",
    );
    expect(PERSONAL_FILING_RAW_FACT_EXTRACTION_CHECKS).toContain(
      "extractor_stdin_contains_only_raw_filing_documents_and_target_qnames",
    );
    expect(PERSONAL_FILING_RAW_FACT_EXTRACTION_NOT_PROVEN).toContain(
      "independently_adjudicated_ground_truth_precision_recall_or_quality_thresholds",
    );
    expect(PERSONAL_FILING_RAW_FACT_EXTRACTION_NOT_PROVEN).toContain(
      "completeness_or_correctness_of_primary_selection_among_additional_raw_coordinates",
    );
    expect(PERSONAL_FILING_RAW_FACT_EXTRACTION_NOT_PROVEN).toContain(
      "unit_transform_or_value_semantics_of_excluded_dimensional_target_facts",
    );
    expect(PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS).toEqual({
      extractorOutputBytes: 4_194_304,
      extractorOutputDepth: 7,
      extractorOutputFactsPerDocument: 4_096,
      extractorOutputNodes: 65_536,
      extractorOutputStringCodePoints: 4_194_304,
      rawFilingDocumentBytes: 33_554_432,
      rawFilingDocuments: 2,
      targetConcepts: 10,
    });
    expect(PERSONAL_FILING_RAW_FACT_EXTRACTOR_BINDING).toEqual({
      extractorId: "personal-filing-raw-fact-extractor-python-v1",
      extractorVersion: "1.0.0",
      implementationSha256:
        "sha256:8b4fe9b8d8894bec80c4124fe34f6d39b8cb5d34f6981da717f48a7890e91f10",
      runtimeFamily: "python-stdlib-html-parser",
    });
    expect(Object.isFrozen(PERSONAL_FILING_RAW_FACT_EXTRACTION_CHECKS)).toBe(
      true,
    );
    expect(
      Object.isFrozen(PERSONAL_FILING_RAW_FACT_EXTRACTION_NOT_PROVEN),
    ).toBe(true);
  });

  it.each([
    [false, 1, 10],
    [true, 2, 20],
  ] as const)(
    "requires exact raw agreement for linked mode %s",
    (withAmendment, sourceDocumentCount, comparedCoordinateCount) => {
      const fixture =
        buildPersonalFilingRawFactExtractionFixture(withAmendment);
      const one = comparePersonalFilingRawFactExtraction(fixture.input);
      const two = comparePersonalFilingRawFactExtraction(fixture.input);

      expect(one).toEqual(two);
      expect(one).toMatchObject({
        assurance: PERSONAL_FILING_RAW_FACT_EXTRACTION_ASSURANCE,
        audit: {
          comparedCoordinateCount,
          extractorCount: 1,
          outcome: "agreed",
          sourceDocumentCount,
        },
        claim: PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM,
        extractorBinding: PERSONAL_FILING_RAW_FACT_EXTRACTOR_BINDING,
        schemaVersion: PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION,
        status: "raw_extraction_agreed_for_personal_use",
        synthetic: false,
      });
      expect(one).not.toHaveProperty("facts");
      expect(one).not.toHaveProperty("rawFilingDocuments");
      expect(one).not.toHaveProperty("sourceDocuments");
      expectDeepFrozen(one);
    },
  );

  it("accepts the pinned extractor output only through a non-promoting test seam", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const extractorOutput = runPythonPersonalFilingRawFactExtractor(fixture);
    const decoded = decodePersonalFilingFactDocument(extractorOutput);
    const documents = decoded.documents as Array<{ facts: JsonRecord[] }>;
    expect(documents[0]?.facts).toHaveLength(10);
    expect(
      documents
        .flatMap((document) => document.facts)
        .every((fact) => fact.dimensionScope === "empty"),
    ).toBe(true);
    const result = compareSuppliedPersonalFilingRawFactExtractionForTesting({
      ...fixture.input,
      extractorOutput,
    });

    expect(result).toEqual({ status: "matched_for_testing_only" });
    expect(result).not.toHaveProperty("agreementSha256");
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("quarantines an exact-coordinate value conflict without returning details", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const output = decodePersonalFilingFactDocument(
      runPythonPersonalFilingRawFactExtractor(fixture),
    );
    const documents = output.documents as JsonRecord[];
    const facts = documents[0]?.facts as JsonRecord[];
    const first = facts[0];
    if (first === undefined)
      throw new TypeError("Generated output is incomplete.");
    facts[0] = { ...first, value: "1" };

    const result = compareSuppliedPersonalFilingRawFactExtractionForTesting({
      ...fixture.input,
      extractorOutput: canonicalPersonalFilingFactDocument(output),
    });

    expect(result).toMatchObject({
      audit: {
        comparedCoordinateCount: 0,
        extractorCount: 0,
        outcome: "quarantined",
        sourceDocumentCount: 0,
      },
      code: "extraction_conflict",
      extractorBindings: [],
      facts: [],
      status: "quarantined",
      synthetic: false,
    });
    expect(JSON.stringify(result)).not.toContain(first.value as string);
    expectDeepFrozen(result);
  });
});

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}
