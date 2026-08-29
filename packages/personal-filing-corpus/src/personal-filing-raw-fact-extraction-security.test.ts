import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM,
  comparePersonalFilingRawFactExtraction,
  compareSuppliedPersonalFilingRawFactExtractionForTesting,
  type PersonalFilingRawFactExtractionInput,
  type PersonalFilingRawFactExtractionQuarantinedResult,
} from "./personal-filing-raw-fact-extraction";
import {
  buildPersonalFilingRawFactExtractionFixture,
  replaceRawFilingDocument,
  runPythonPersonalFilingRawFactExtractor,
} from "./test-personal-filing-raw-fact-extraction-builder";
import {
  canonicalPersonalFilingFactDocument,
  decodePersonalFilingFactDocument,
} from "./test-personal-filing-fact-builder";

describe("personal filing raw fact extraction security", () => {
  it("rejects extra input properties, accessors, proxies, and aliased buffers", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const extra = comparePersonalFilingRawFactExtraction({
      ...fixture.input,
      extra: true,
    } as PersonalFilingRawFactExtractionInput);
    const accessor = Object.create(Object.prototype) as Record<string, unknown>;
    Object.defineProperties(accessor, {
      declaration: { enumerable: true, get: () => fixture.input.declaration },
      manifest: { enumerable: true, get: () => fixture.input.manifest },
      normalizationPlan: {
        enumerable: true,
        get: () => fixture.input.normalizationPlan,
      },
      rawFilingDocuments: {
        enumerable: true,
        get: () => fixture.input.rawFilingDocuments,
      },
      sourceDocuments: {
        enumerable: true,
        get: () => fixture.input.sourceDocuments,
      },
    });
    const proxied = new Proxy(fixture.input, {});
    const alias = {
      ...fixture.input,
      rawFilingDocuments: [fixture.input.manifest],
    } as PersonalFilingRawFactExtractionInput;

    for (const result of [
      extra,
      comparePersonalFilingRawFactExtraction(
        accessor as unknown as PersonalFilingRawFactExtractionInput,
      ),
      comparePersonalFilingRawFactExtraction(proxied),
      comparePersonalFilingRawFactExtraction(alias),
    ]) {
      expectFailure(result, "input_invalid");
    }
  });

  it("binds raw length and digest to the manifest before extraction", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const changed = new Uint8Array(
      fixture.input.rawFilingDocuments[0] as Uint8Array,
    );
    changed[changed.length - 1] = (changed.at(-1) ?? 0) ^ 1;

    expectFailure(
      comparePersonalFilingRawFactExtraction(
        replaceRawFilingDocument(fixture, 0, changed),
      ),
      "raw_payload_scope_mismatch",
    );
  });

  it("requires the Cycle 2v primary agreement before examining raw values", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const changed = new Uint8Array(
      fixture.input.sourceDocuments[0] as Uint8Array,
    );
    changed[changed.length - 2] = (changed.at(-2) ?? 0) ^ 1;
    const result = comparePersonalFilingRawFactExtraction({
      ...fixture.input,
      sourceDocuments: [changed],
    });

    expectFailure(result, "primary_agreement_missing");
  });

  it("rejects quarantined, malformed, noncanonical, overcomplete, and duplicate-conflicting extractor output", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const valid = decodePersonalFilingFactDocument(
      runPythonPersonalFilingRawFactExtractor(fixture),
    );
    const documents = valid.documents as Array<{ facts: unknown[] }>;
    const first = documents[0]?.facts[0];
    if (first === undefined)
      throw new TypeError("Generated output is incomplete.");
    const conflicting = structuredClone(valid);
    const conflictDocuments = conflicting.documents as Array<{
      facts: unknown[];
    }>;
    conflictDocuments[0]?.facts.push({
      ...(first as Record<string, unknown>),
      value: "2",
    });
    const overcomplete = structuredClone(valid) as Record<string, unknown>;
    overcomplete.extra = true;

    const cases = [
      canonicalPersonalFilingFactDocument({
        documents: [],
        schemaVersion: "1.0.0",
        status: "quarantined",
      }),
      new TextEncoder().encode("not json\n"),
      new TextEncoder().encode(`${JSON.stringify(valid, null, 2)}\n`),
      canonicalPersonalFilingFactDocument(overcomplete),
      canonicalPersonalFilingFactDocument(conflicting),
    ];
    for (const extractorOutput of cases) {
      expectFailure(
        compareSuppliedPersonalFilingRawFactExtractionForTesting({
          ...fixture.input,
          extractorOutput,
        }),
        "extractor_output_invalid",
      );
    }
  });

  it("the worker rejects unsupported target continuations and conflicting raw duplicates value-free", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const source = new TextDecoder().decode(
      fixture.input.rawFilingDocuments[0],
    );
    const continued = source.replace(
      'contextRef="instant"',
      'continuedAt="continuation-1" contextRef="instant"',
    );
    const conflict = source.replace(
      "</ix:hidden>",
      '<ix:nonFraction contextRef="instant" decimals="0" format="ixt:numdotdecimal" name="sample:Assets" scale="0" unitRef="usd">1</ix:nonFraction></ix:hidden>',
    );
    for (const raw of [continued, conflict]) {
      const rebound = rebindRawDocument(
        fixture.input,
        new TextEncoder().encode(raw),
      );
      const result = comparePersonalFilingRawFactExtraction(rebound);
      expectFailure(result, "extractor_output_invalid");
      expect(JSON.stringify(result)).not.toContain("sample:Assets");
    }
  });

  it("fails closed on malformed HTML, unsupported transforms, missing contexts, unsupported units, and invalid UTF-8", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const source = new TextDecoder().decode(
      fixture.input.rawFilingDocuments[0],
    );
    const invalidUtf8 = new Uint8Array(
      fixture.input.rawFilingDocuments[0] as Uint8Array,
    );
    invalidUtf8[32] = 0xff;
    const cases = [
      new TextEncoder().encode(source.slice(0, -20)),
      new TextEncoder().encode(
        source.replace(
          'format="ixt:numdotdecimal"',
          'format="ixt:unsupported"',
        ),
      ),
      new TextEncoder().encode(
        source.replace('contextRef="instant"', 'contextRef="missing"'),
      ),
      new TextEncoder().encode(
        source.replace("iso4217:USD", "sample:UnsupportedUnit"),
      ),
      new TextEncoder().encode(
        source.replace(
          "<xbrli:period><xbrli:instant>2025-12-31</xbrli:instant></xbrli:period>",
          "<xbrli:instant>2025-12-31</xbrli:instant>",
        ),
      ),
      new TextEncoder().encode(
        source.replace(
          "<xbrli:measure>iso4217:USD</xbrli:measure>",
          "<span><xbrli:measure>iso4217:USD</xbrli:measure></span>",
        ),
      ),
      new TextEncoder().encode(
        source.replace(' xmlns:xbrldi="http://xbrl.org/2006/xbrldi"', ""),
      ),
      invalidUtf8,
    ];
    for (const raw of cases) {
      const result = comparePersonalFilingRawFactExtraction(
        rebindRawDocument(fixture.input, raw),
      );
      expectFailure(result, "extractor_output_invalid");
    }
  });

  it("collapses equivalent raw duplicate coordinates deterministically", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const source = new TextDecoder().decode(
      fixture.input.rawFilingDocuments[0],
    );
    const duplicate = source.replace(
      "</ix:hidden>",
      '<ix:nonFraction contextRef="instant" decimals="-6" format="ixt:numdotdecimal" name="sample:Assets" scale="6" unitRef="usd">250</ix:nonFraction></ix:hidden>',
    );
    const result = comparePersonalFilingRawFactExtraction(
      rebindRawDocument(fixture.input, new TextEncoder().encode(duplicate)),
    );

    expect(result.status).toBe("raw_extraction_agreed_for_personal_use");
  });

  it("keeps excluded dimensional transform semantics outside the selected projection", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const source = new TextDecoder().decode(
      fixture.input.rawFilingDocuments[0],
    );
    const unsupported = source.replace(
      'contextRef="duration-dimensional" decimals="-6" format="ixt:numdotdecimal"',
      'contextRef="duration-dimensional" decimals="-6" format="ixt:unsupported"',
    );

    expect(
      comparePersonalFilingRawFactExtraction(
        rebindRawDocument(fixture.input, new TextEncoder().encode(unsupported)),
      ),
    ).toMatchObject({ status: "raw_extraction_agreed_for_personal_use" });
  });

  it("rejects a complex unit for selected facts but ignores it for excluded dimensional facts", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const source = new TextDecoder().decode(
      fixture.input.rawFilingDocuments[0],
    );
    const dividedUnit =
      '<xbrli:unit id="usd"><xbrli:divide><xbrli:unitNumerator><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unitNumerator><xbrli:unitDenominator><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unitDenominator></xbrli:divide></xbrli:unit>';
    const selectedComplexUnit = source.replace(
      '<xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>',
      dividedUnit,
    );
    expectFailure(
      comparePersonalFilingRawFactExtraction(
        rebindRawDocument(
          fixture.input,
          new TextEncoder().encode(selectedComplexUnit),
        ),
      ),
      "extractor_output_invalid",
    );

    const excludedComplexUnit = source
      .replace(
        'contextRef="duration-dimensional" decimals="-6" format="ixt:numdotdecimal" name="sample:Revenue" scale="6" unitRef="usd"',
        'contextRef="duration-dimensional" decimals="-6" format="ixt:numdotdecimal" name="sample:Revenue" scale="6" unitRef="ratio"',
      )
      .replace(
        "</ix:resources>",
        `${dividedUnit.replace('id="usd"', 'id="ratio"')}</ix:resources>`,
      );
    expect(
      comparePersonalFilingRawFactExtraction(
        rebindRawDocument(
          fixture.input,
          new TextEncoder().encode(excludedComplexUnit),
        ),
      ),
    ).toMatchObject({ status: "raw_extraction_agreed_for_personal_use" });
  });

  it("compares the selected ten-coordinate projection without claiming raw filing exhaustiveness", () => {
    const fixture = buildPersonalFilingRawFactExtractionFixture();
    const source = new TextDecoder().decode(
      fixture.input.rawFilingDocuments[0],
    );
    const withPriorCoordinate = source
      .replace(
        "</ix:hidden>",
        '<ix:nonFraction contextRef="prior-instant" decimals="-6" format="ixt:numdotdecimal" name="sample:Assets" scale="6" unitRef="usd">240</ix:nonFraction></ix:hidden>',
      )
      .replace(
        "</ix:resources>",
        '<xbrli:context id="prior-instant"><xbrli:entity><xbrli:identifier scheme="https://example.invalid/cik">0001234567</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2024-12-31</xbrli:instant></xbrli:period></xbrli:context></ix:resources>',
      );

    const result = comparePersonalFilingRawFactExtraction(
      rebindRawDocument(
        fixture.input,
        new TextEncoder().encode(withPriorCoordinate),
      ),
    );
    expect(result).toMatchObject({
      audit: { comparedCoordinateCount: 10 },
      status: "raw_extraction_agreed_for_personal_use",
    });
  });
});

function rebindRawDocument(
  input: PersonalFilingRawFactExtractionInput,
  raw: Uint8Array,
): PersonalFilingRawFactExtractionInput {
  const manifest = decodePersonalFilingFactDocument(input.manifest);
  const entries = manifest.entries as Array<Record<string, unknown>>;
  entries[0] = {
    ...entries[0],
    contentBytes: raw.byteLength,
    contentSha256: `sha256:${createHash("sha256").update(raw).digest("hex")}`,
  };
  const manifestBytes = canonicalPersonalFilingFactDocument(manifest);
  const declaration = decodePersonalFilingFactDocument(input.declaration);
  declaration.manifestSha256 = digest(manifestBytes);
  const declarationBytes = canonicalPersonalFilingFactDocument(declaration);
  const plan = decodePersonalFilingFactDocument(input.normalizationPlan);
  plan.declarationSha256 = digest(declarationBytes);
  plan.manifestSha256 = digest(manifestBytes);
  const planBytes = canonicalPersonalFilingFactDocument(plan);
  const source = decodePersonalFilingFactDocument(
    input.sourceDocuments[0] as Uint8Array,
  );
  source.contentSha256 = entries[0]?.contentSha256;
  source.normalizationPlanSha256 = digest(planBytes);
  return {
    declaration: declarationBytes,
    manifest: manifestBytes,
    normalizationPlan: planBytes,
    rawFilingDocuments: [raw],
    sourceDocuments: [canonicalPersonalFilingFactDocument(source)],
  };
}

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function expectFailure(result: unknown, code: string): void {
  expect(result).toEqual({
    audit: {
      comparedCoordinateCount: 0,
      extractorCount: 0,
      outcome: "quarantined",
      sourceDocumentCount: 0,
    },
    claim: PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM,
    code,
    extractorBindings: [],
    facts: [],
    schemaVersion: "1.0.0",
    status: "quarantined",
    synthetic: false,
  });
  const record = result as PersonalFilingRawFactExtractionQuarantinedResult;
  expect(Object.isFrozen(record)).toBe(true);
  expect(Object.isFrozen(record.audit)).toBe(true);
  expect(Object.isFrozen(record.extractorBindings)).toBe(true);
  expect(Object.isFrozen(record.facts)).toBe(true);
}
