import { describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_FACT_COMPARISON_LIMITS,
  comparePersonalFilingFactValidation,
  compareSuppliedPersonalFilingFactRecordForTesting,
  type PersonalFilingFactComparisonQuarantineCode,
  type PersonalFilingFactComparisonResult,
  type PersonalFilingFactSuppliedRecordTestResult,
} from "./personal-filing-fact-comparison";
import {
  buildPersonalFilingFactComparisonFixture,
  canonicalPersonalFilingFactComparisonRecord,
  decodePersonalFilingFactComparisonRecord,
} from "./test-personal-filing-fact-comparison-builder";
import {
  canonicalPersonalFilingFactDocument,
  decodePersonalFilingFactDocument,
  type JsonRecord,
} from "./test-personal-filing-fact-builder";

describe("personal filing fact comparison security boundary", () => {
  it("accepts exactly one closed data object without executing accessors or proxy traps", () => {
    const fixture = buildPersonalFilingFactComparisonFixture();
    const input = fixture.input;
    expect(
      Reflect.apply(comparePersonalFilingFactValidation, undefined, []),
    ).toMatchObject({ code: "input_invalid", status: "quarantined" });
    expect(
      Reflect.apply(comparePersonalFilingFactValidation, undefined, [
        input,
        input,
      ]),
    ).toMatchObject({ code: "input_invalid", status: "quarantined" });
    expectQuarantined(
      comparePersonalFilingFactValidation({ ...input, extra: true } as never),
      "input_invalid",
    );

    let getterCalls = 0;
    const hostile = Object.defineProperty(
      {
        declaration: input.declaration,
        manifest: input.manifest,
        normalizationPlan: input.normalizationPlan,
        sourceDocuments: input.sourceDocuments,
      },
      "secondaryRecord",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error("COMPARISON_GETTER_CANARY");
        },
      },
    );
    expectQuarantined(
      comparePersonalFilingFactValidation(hostile),
      "input_invalid",
      ["COMPARISON_GETTER_CANARY"],
    );
    expect(getterCalls).toBe(0);

    let trapCalls = 0;
    const outerProxy = new Proxy(
      { ...input },
      {
        getPrototypeOf() {
          trapCalls += 1;
          return Object.prototype;
        },
        ownKeys() {
          trapCalls += 1;
          return [];
        },
      },
    );
    expectQuarantined(
      comparePersonalFilingFactValidation(outerProxy),
      "input_invalid",
    );
    const arrayProxy = new Proxy([...input.sourceDocuments], {
      getPrototypeOf() {
        trapCalls += 1;
        return Object.prototype;
      },
      ownKeys() {
        trapCalls += 1;
        return [];
      },
    });
    expectQuarantined(
      comparePersonalFilingFactValidation({
        ...input,
        sourceDocuments: arrayProxy,
      }),
      "input_invalid",
    );
    const byteProxy = new Proxy(fixture.secondaryRecord, {
      getPrototypeOf() {
        trapCalls += 1;
        return Uint8Array.prototype;
      },
    });
    expectQuarantined(
      compareSuppliedPersonalFilingFactRecordForTesting({
        ...input,
        secondaryRecord: byteProxy,
      }),
      "input_invalid",
    );
    expect(trapCalls).toBe(0);
  });

  it("rejects alternate, shared, detached, aliased, and oversized byte carriers", () => {
    const fixture = buildPersonalFilingFactComparisonFixture();
    const input = fixture.input;
    const variants: unknown[] = [
      Buffer.from(fixture.secondaryRecord),
      new (class extends Uint8Array {})(fixture.secondaryRecord),
      new Uint16Array(2),
      new DataView(new ArrayBuffer(8)),
      new Uint8Array(
        new SharedArrayBuffer(Math.max(3, fixture.secondaryRecord.byteLength)),
      ),
      new Uint8Array(PERSONAL_FILING_FACT_COMPARISON_LIMITS.recordBytes + 1),
    ];
    const detached = Uint8Array.from(fixture.secondaryRecord);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    variants.push(detached);
    for (const secondaryRecord of variants) {
      expectQuarantined(
        compareSuppliedPersonalFilingFactRecordForTesting({
          ...input,
          secondaryRecord: secondaryRecord as Uint8Array,
        }),
        "input_invalid",
      );
    }

    const shared = new ArrayBuffer(
      input.declaration.byteLength + input.manifest.byteLength,
    );
    const declaration = new Uint8Array(shared, 0, input.declaration.byteLength);
    const manifest = new Uint8Array(
      shared,
      input.declaration.byteLength,
      input.manifest.byteLength,
    );
    declaration.set(input.declaration);
    manifest.set(input.manifest);
    expectQuarantined(
      comparePersonalFilingFactValidation({ ...input, declaration, manifest }),
      "input_invalid",
    );
  });

  it("rejects source index accessors and repeated source backing buffers without access", () => {
    const fixture = buildPersonalFilingFactComparisonFixture();
    let getterCalls = 0;
    const accessorSources = new Array<Uint8Array>(1);
    Object.defineProperty(accessorSources, "0", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("SOURCE_INDEX_GETTER_CANARY");
      },
    });
    expectQuarantined(
      comparePersonalFilingFactValidation({
        ...fixture.input,
        sourceDocuments: accessorSources,
      }),
      "input_invalid",
      ["SOURCE_INDEX_GETTER_CANARY"],
    );
    expect(getterCalls).toBe(0);

    const pair = buildPersonalFilingFactComparisonFixture(true).input;
    expectQuarantined(
      comparePersonalFilingFactValidation({
        ...pair,
        sourceDocuments: [pair.sourceDocuments[0]!, pair.sourceDocuments[0]!],
      }),
      "input_invalid",
    );
  });

  it("requires canonical UTF-8, sorted keys, exact LF, and a complete success record", () => {
    const fixture = buildPersonalFilingFactComparisonFixture();
    const input = fixture.input;
    const text = new TextDecoder().decode(fixture.secondaryRecord);
    const variants = [
      new TextEncoder().encode(`\uFEFF${text}`),
      new TextEncoder().encode(text.replace(/\n$/u, "\r\n")),
      new TextEncoder().encode(text.trimEnd()),
      new TextEncoder().encode(`${text}{}`),
      new TextEncoder().encode(
        text.replace(/^\{"audit":/u, '{"audit":{},"audit":'),
      ),
      new TextEncoder().encode(
        text.replace(/^\{"audit":/u, '{"claim":"out-of-order","audit":'),
      ),
      Uint8Array.of(0xff, 0xfe, 0xfd),
      canonicalPersonalFilingFactComparisonRecord({
        status: "quarantined",
      }),
    ];
    for (const secondaryRecord of variants) {
      expectQuarantined(
        compareSuppliedPersonalFilingFactRecordForTesting({
          ...input,
          secondaryRecord,
        }),
        "validator_output_invalid",
      );
    }
  });

  it("compares every complete record layer and never repairs a disagreement", () => {
    const fixture = buildPersonalFilingFactComparisonFixture(true);
    const mutations: Array<(record: JsonRecord) => void> = [
      (record) => {
        record.corpusId = "comparison-conflict-canary";
      },
      (record) => {
        (record.audit as JsonRecord).factVersionCount = 19;
      },
      (record) => {
        record.normalizationPlanSha256 = `sha256:${"0".repeat(64)}`;
      },
      (record) => {
        factVersions(record)[0]!.value = "250000001";
      },
      (record) => {
        factVersions(record)[0]!.factId = `fact:sha256:${"0".repeat(64)}`;
      },
      (record) => {
        factVersions(record)[4]!.sourceConcept = "sample:Unexpected";
      },
      (record) => {
        const derivation = factVersions(record)[4]!.derivation as JsonRecord;
        (derivation.subtrahend as JsonRecord).value = "5000001";
      },
      (record) => {
        const facts = factVersions(record);
        record.factVersions = [facts[1], facts[0], ...facts.slice(2)];
      },
      (record) => {
        const lineage = record.lineage as JsonRecord[];
        lineage[0]!.effectiveAt = "2026-03-15T20:00:02.000Z";
      },
      (record) => {
        const lineage = record.lineage as JsonRecord[];
        record.lineage = [lineage[1], lineage[0], ...lineage.slice(2)];
      },
    ];
    for (const mutate of mutations) {
      const record = decodePersonalFilingFactComparisonRecord(
        fixture.secondaryRecord,
      );
      mutate(record);
      expectQuarantined(
        compareSuppliedPersonalFilingFactRecordForTesting({
          ...fixture.input,
          secondaryRecord: canonicalPersonalFilingFactComparisonRecord(record),
        }),
        "validator_conflict",
        ["comparison-conflict-canary", "sample:Unexpected", "250000001"],
      );
    }
  });

  it("does not prefer stale secondary output when the common input changes", () => {
    const fixture = buildPersonalFilingFactComparisonFixture();
    const source = decodePersonalFilingFactDocument(
      fixture.input.sourceDocuments[0]!,
    );
    const revenue = facts(source).find((entry) => entry.key === "revenue");
    if (revenue === undefined) throw new Error("Generated revenue is missing.");
    revenue.value = "120000001";
    expectQuarantined(
      compareSuppliedPersonalFilingFactRecordForTesting({
        ...fixture.input,
        sourceDocuments: [canonicalPersonalFilingFactDocument(source)],
        secondaryRecord: fixture.secondaryRecord,
      }),
      "validator_conflict",
      ["120000001"],
    );
  });

  it("returns one value-free quarantine when local normalization rejects", () => {
    const input = buildPersonalFilingFactComparisonFixture().input;
    const source = decodePersonalFilingFactDocument(input.sourceDocuments[0]!);
    const revenue = facts(source).find((entry) => entry.key === "revenue");
    if (revenue === undefined) throw new Error("Generated revenue is missing.");
    revenue.value = "PRIVATE_NORMALIZATION_CANARY";
    expectQuarantined(
      comparePersonalFilingFactValidation({
        ...input,
        sourceDocuments: [canonicalPersonalFilingFactDocument(source)],
      }),
      "normalization_quarantined",
      [
        "PRIVATE_NORMALIZATION_CANARY",
        "personal-generated-example",
        "0001234567-26-000001",
        "sample:Revenue",
      ],
    );
  });

  it("rejects excessive canonical tree depth before comparison", () => {
    const input = buildPersonalFilingFactComparisonFixture().input;
    let value: unknown = "leaf";
    for (
      let depth = 0;
      depth < PERSONAL_FILING_FACT_COMPARISON_LIMITS.recordDepth + 2;
      depth += 1
    ) {
      value = { nested: value };
    }
    expectQuarantined(
      compareSuppliedPersonalFilingFactRecordForTesting({
        ...input,
        secondaryRecord: canonicalPersonalFilingFactComparisonRecord(value),
      }),
      "validator_output_invalid",
    );
  });

  it("owns every input byte before producing a fresh immutable receipt", () => {
    const fixture = buildPersonalFilingFactComparisonFixture(true);
    const input = fixture.input;
    const result = comparePersonalFilingFactValidation(input);
    expect(result.status).toBe("agreed_for_personal_use");
    const before = JSON.stringify(result);

    input.declaration.fill(0x41);
    input.manifest.fill(0x42);
    input.normalizationPlan.fill(0x43);
    for (const source of input.sourceDocuments) source.fill(0x45);

    expect(JSON.stringify(result)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.audit)).toBe(true);
    if (result.status === "agreed_for_personal_use") {
      expect(Object.isFrozen(result.validatorBindings)).toBe(true);
      for (const binding of result.validatorBindings) {
        expect(Object.isFrozen(binding)).toBe(true);
      }
    }
  });
});

function expectQuarantined(
  result:
    | PersonalFilingFactComparisonResult
    | PersonalFilingFactSuppliedRecordTestResult,
  code?: PersonalFilingFactComparisonQuarantineCode,
  canaries: readonly string[] = [],
): void {
  expect(result.status).toBe("quarantined");
  if (result.status !== "quarantined") return;
  if (code !== undefined) expect(result.code).toBe(code);
  expect(Object.keys(result).sort()).toEqual([
    "audit",
    "claim",
    "code",
    "factVersions",
    "lineage",
    "schemaVersion",
    "status",
    "synthetic",
    "validatorBindings",
  ]);
  expect(result.audit).toEqual({
    factVersionCount: 0,
    lineageCount: 0,
    outcome: "quarantined",
    sourceDocumentCount: 0,
    validatorCount: 0,
  });
  expect(result.factVersions).toEqual([]);
  expect(result.lineage).toEqual([]);
  expect(result.validatorBindings).toEqual([]);
  const serialized = JSON.stringify(result);
  for (const canary of canaries) expect(serialized).not.toContain(canary);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.audit)).toBe(true);
  expect(Object.isFrozen(result.factVersions)).toBe(true);
  expect(Object.isFrozen(result.lineage)).toBe(true);
  expect(Object.isFrozen(result.validatorBindings)).toBe(true);
}

function factVersions(record: JsonRecord): JsonRecord[] {
  return record.factVersions as JsonRecord[];
}

function facts(source: JsonRecord): JsonRecord[] {
  return source.facts as JsonRecord[];
}
