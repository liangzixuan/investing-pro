import { describe, expect, it } from "vitest";

import {
  normalizePersonalFilingFacts,
  type PersonalFilingFactNormalizationQuarantineCode,
  type PersonalFilingFactNormalizationResult,
} from "./personal-filing-fact-normalization";
import {
  buildPersonalFilingFactFixture,
  canonicalPersonalFilingFactDocument,
  decodePersonalFilingFactDocument,
  sha256,
  type JsonRecord,
} from "./test-personal-filing-fact-builder";

describe("personal filing fact normalization security boundary", () => {
  it("accepts one exact owned input object and a closed one-or-two document array", () => {
    const fixture = buildPersonalFilingFactFixture();
    expect(
      Reflect.apply(normalizePersonalFilingFacts, undefined, []),
    ).toMatchObject({ code: "input_invalid", status: "quarantined" });
    expect(
      Reflect.apply(normalizePersonalFilingFacts, undefined, [
        fixture,
        fixture,
      ]),
    ).toMatchObject({ code: "input_invalid", status: "quarantined" });
    expectQuarantined(
      normalizePersonalFilingFacts({ ...fixture, extra: true } as never),
      "input_invalid",
    );
    expectQuarantined(
      normalizePersonalFilingFacts({
        ...fixture,
        sourceDocuments: [],
      }),
      "input_invalid",
    );
    expectQuarantined(
      normalizePersonalFilingFacts({
        ...fixture,
        sourceDocuments: [
          fixture.sourceDocuments[0]!,
          fixture.sourceDocuments[0]!,
          fixture.sourceDocuments[0]!,
        ],
      }),
      "input_invalid",
    );
    const sourceDocuments = [fixture.sourceDocuments[0]!];
    Object.defineProperty(sourceDocuments, "extra", { value: true });
    expectQuarantined(
      normalizePersonalFilingFacts({ ...fixture, sourceDocuments }),
      "input_invalid",
    );

    let getterAccessed = false;
    const hostile = Object.defineProperty({}, "declaration", {
      enumerable: true,
      get() {
        getterAccessed = true;
        throw new Error("INPUT_GETTER_CANARY");
      },
    });
    Object.assign(hostile, {
      manifest: fixture.manifest,
      normalizationPlan: fixture.normalizationPlan,
      sourceDocuments: fixture.sourceDocuments,
    });
    expectQuarantined(
      normalizePersonalFilingFacts(hostile as never),
      "input_invalid",
      ["INPUT_GETTER_CANARY"],
    );
    expect(getterAccessed).toBe(false);

    let proxyTrapCalls = 0;
    const hostileInputProxy = new Proxy(
      { ...fixture },
      {
        getPrototypeOf() {
          proxyTrapCalls += 1;
          return Object.prototype;
        },
        ownKeys() {
          proxyTrapCalls += 1;
          return [];
        },
      },
    );
    expectQuarantined(
      normalizePersonalFilingFacts(hostileInputProxy),
      "input_invalid",
    );
    const hostileArrayProxy = new Proxy([...fixture.sourceDocuments], {
      getPrototypeOf() {
        proxyTrapCalls += 1;
        return Object.prototype;
      },
      ownKeys() {
        proxyTrapCalls += 1;
        return [];
      },
    });
    expectQuarantined(
      normalizePersonalFilingFacts({
        ...fixture,
        sourceDocuments: hostileArrayProxy,
      }),
      "input_invalid",
    );
    const hostileByteProxy = new Proxy(fixture.declaration, {
      getPrototypeOf() {
        proxyTrapCalls += 1;
        return Uint8Array.prototype;
      },
    });
    expectQuarantined(
      normalizePersonalFilingFacts({
        ...fixture,
        declaration: hostileByteProxy,
      }),
      "input_invalid",
    );
    expect(proxyTrapCalls).toBe(0);
  });

  it("rejects noncanonical, duplicate-key, trailing, and invalid UTF-8 documents", () => {
    const fixture = buildPersonalFilingFactFixture();
    const planText = new TextDecoder().decode(fixture.normalizationPlan);
    const sourceText = new TextDecoder().decode(fixture.sourceDocuments[0]);
    const planVariants = [
      new TextEncoder().encode(` ${planText}`),
      new TextEncoder().encode(planText.trimEnd()),
      new TextEncoder().encode(planText.replace(/\n$/u, "\r\n")),
      new TextEncoder().encode(
        planText.replace(
          '"corpusId":"personal-generated-example"',
          '"corpusId":"DUPLICATE_PLAN_CANARY","corpusId":"personal-generated-example"',
        ),
      ),
      Uint8Array.of(0xff, 0xfe, 0xfd),
    ];
    for (const normalizationPlan of planVariants) {
      expectQuarantined(
        normalizePersonalFilingFacts({ ...fixture, normalizationPlan }),
        "plan_invalid",
        ["DUPLICATE_PLAN_CANARY"],
      );
    }
    const sourceVariants = [
      new TextEncoder().encode(` ${sourceText}`),
      new TextEncoder().encode(sourceText.trimEnd()),
      new TextEncoder().encode(`${sourceText}{}`),
      new TextEncoder().encode(`\uFEFF${sourceText}`),
      Uint8Array.of(0xff, 0xfe, 0xfd),
    ];
    for (const sourceDocument of sourceVariants) {
      expectQuarantined(
        normalizePersonalFilingFacts({
          ...fixture,
          sourceDocuments: [sourceDocument],
        }),
        "source_document_invalid",
      );
    }
  });

  it("binds the plan exactly to the verified personal corpus", () => {
    const mutations: Array<(plan: JsonRecord) => void> = [
      (plan) => {
        plan.profile = "shared_service";
      },
      (plan) => {
        plan.corpusId = "PLAN_SCOPE_CANARY";
      },
      (plan) => {
        plan.declarationSha256 = `sha256:${"0".repeat(64)}`;
      },
      (plan) => {
        plan.manifestSha256 = `sha256:${"0".repeat(64)}`;
      },
      (plan) => {
        plan.taxonomy = "other-taxonomy";
      },
      (plan) => {
        plan.parserVersion = "PARSER_VERSION_CANARY";
      },
      (plan) => {
        plan.extra = "PLAN_EXTRA_CANARY";
      },
    ];
    for (const mutate of mutations) {
      const fixture = buildPersonalFilingFactFixture();
      const plan = decodePersonalFilingFactDocument(fixture.normalizationPlan);
      mutate(plan);
      expectQuarantined(
        normalizePersonalFilingFacts({
          ...fixture,
          normalizationPlan: canonicalPersonalFilingFactDocument(plan),
        }),
        "plan_invalid",
        ["PLAN_SCOPE_CANARY", "PARSER_VERSION_CANARY", "PLAN_EXTRA_CANARY"],
      );
    }
  });

  it("rejects duplicate source coordinates except the declared FCF minuend reuse", () => {
    for (const mutate of [
      (plan: JsonRecord, source: JsonRecord) => {
        const mappings = plan.mappings as JsonRecord[];
        const facts = source.facts as JsonRecord[];
        mappings[1]!.sourceConcept = mappings[0]!.sourceConcept;
        facts[1]!.concept = mappings[0]!.sourceConcept;
      },
      (plan: JsonRecord, source: JsonRecord) => {
        const mappings = plan.mappings as JsonRecord[];
        const revenueConcept = mappings[9]!.sourceConcept;
        mappings[4]!.subtrahendConcept = revenueConcept;
        const fcfDerivation = facts(source)[4]!.derivation as JsonRecord;
        (fcfDerivation.subtrahend as JsonRecord).concept = revenueConcept;
      },
    ]) {
      const fixture = buildPersonalFilingFactFixture();
      const plan = decodePersonalFilingFactDocument(fixture.normalizationPlan);
      const source = decodePersonalFilingFactDocument(
        fixture.sourceDocuments[0]!,
      );
      mutate(plan, source);
      const normalizationPlan = canonicalPersonalFilingFactDocument(plan);
      source.normalizationPlanSha256 = sha256(normalizationPlan);
      expectQuarantined(
        normalizePersonalFilingFacts({
          ...fixture,
          normalizationPlan,
          sourceDocuments: [canonicalPersonalFilingFactDocument(source)],
        }),
        "plan_invalid",
      );
    }
  });

  it("binds every parser result field to the manifest and plan", () => {
    const cases: Array<(source: JsonRecord) => void> = [
      (source) => {
        source.accession = "SOURCE_ACCESSION_CANARY";
      },
      (source) => {
        source.cik = "0000000000";
      },
      (source) => {
        source.form = "10-Q";
      },
      (source) => {
        source.acceptedAt = "2026-02-20T20:00:02.000Z";
      },
      (source) => {
        source.contentSha256 = `sha256:${"0".repeat(64)}`;
      },
      (source) => {
        source.normalizationPlanSha256 = `sha256:${"0".repeat(64)}`;
      },
      (source) => {
        source.parserVersion = "other-parser";
      },
      (source) => {
        source.taxonomy = "other-taxonomy";
      },
      (source) => {
        source.synthetic = true;
      },
    ];
    for (const mutate of cases) {
      const mutable = mutableFixture();
      mutate(mutable.sources[0]!);
      expectQuarantined(normalizeMutable(mutable), "source_metadata_invalid", [
        "SOURCE_ACCESSION_CANARY",
      ]);
    }
  });

  it("enforces exact direct mappings, units, contexts, dimensions, and decimals", () => {
    const mutations: Array<(source: JsonRecord) => void> = [
      (source) => {
        fact(source, "assets").concept = "sample:OtherAssets";
      },
      (source) => {
        fact(source, "diluted_shares").unit = "USD";
      },
      (source) => {
        fact(source, "revenue").dimensions = { segment: "FACT_CANARY" };
      },
      (source) => {
        fact(source, "assets").periodStart = "2025-01-01";
      },
      (source) => {
        fact(source, "revenue").periodStart = null;
      },
      (source) => {
        fact(source, "revenue").value = "01";
      },
      (source) => {
        fact(source, "revenue").value = "1e3";
      },
      (source) => {
        const facts = source.facts as JsonRecord[];
        source.facts = facts.slice(0, 9);
      },
      (source) => {
        const facts = source.facts as JsonRecord[];
        source.facts = [facts[1], facts[0], ...facts.slice(2)];
      },
    ];
    for (const mutate of mutations) {
      const mutable = mutableFixture();
      mutate(mutable.sources[0]!);
      expectQuarantined(normalizeMutable(mutable), "fact_set_invalid", [
        "FACT_CANARY",
      ]);
    }
  });

  it("allows only exact same-context FCF subtraction and recomputes its value", () => {
    const mutations: Array<(source: JsonRecord) => void> = [
      (source) => {
        derivation(source).formula = "DERIVATION_FORMULA_CANARY";
      },
      (source) => {
        fact(source, "free_cash_flow").concept = "sample:FreeCashFlow";
      },
      (source) => {
        derivation(source).minuend = {
          ...(derivation(source).minuend as JsonRecord),
          concept: "sample:OtherCashFlow",
        };
      },
      (source) => {
        const operand = derivation(source).subtrahend as JsonRecord;
        operand.unit = "shares";
      },
      (source) => {
        const operand = derivation(source).subtrahend as JsonRecord;
        operand.dimensions = { segment: "DERIVATION_DIMENSION_CANARY" };
      },
      (source) => {
        const operand = derivation(source).subtrahend as JsonRecord;
        operand.periodStart = "2025-02-01";
      },
      (source) => {
        fact(source, "free_cash_flow").value = "14999999";
      },
      (source) => {
        fact(source, "operating_cash_flow").value = "20000001";
      },
    ];
    for (const mutate of mutations) {
      const mutable = mutableFixture();
      mutate(mutable.sources[0]!);
      expectQuarantined(normalizeMutable(mutable), "derivation_invalid", [
        "DERIVATION_FORMULA_CANARY",
        "DERIVATION_DIMENSION_CANARY",
      ]);
    }

    const fractional = mutableFixture();
    fact(fractional.sources[0]!, "operating_cash_flow").value = "20.5";
    const fcf = fact(fractional.sources[0]!, "free_cash_flow");
    const fcfDerivation = derivation(fractional.sources[0]!);
    (fcfDerivation.minuend as JsonRecord).value = "20.5";
    (fcfDerivation.subtrahend as JsonRecord).value = "5.25";
    fcf.value = "15.25";
    expect(normalizeMutable(fractional).status).toBe(
      "normalized_for_personal_use",
    );
  });

  it("enforces exact decimal sign, borrow, precision, scale, and result bounds", () => {
    for (const [minuend, subtrahend, result] of [
      ["-1.25", "-2.5", "1.25"],
      ["100.000000000001", "0.000000000002", "99.999999999999"],
      [
        "99999999999999999999999999.999999999999",
        "0",
        "99999999999999999999999999.999999999999",
      ],
    ] as const) {
      const mutable = mutableFixture();
      setFcfArithmetic(mutable.sources[0]!, minuend, subtrahend, result);
      expect(normalizeMutable(mutable).status).toBe(
        "normalized_for_personal_use",
      );
    }

    for (const [minuend, subtrahend, result, code] of [
      ["100000000000000000000000000", "0", "0", "derivation_invalid"],
      ["1.0000000000001", "0", "0", "derivation_invalid"],
      [
        "99999999999999999999999999.999999999999",
        "-0.000000000001",
        "0",
        "derivation_invalid",
      ],
    ] as const) {
      const mutable = mutableFixture();
      setFcfArithmetic(mutable.sources[0]!, minuend, subtrahend, result);
      expectQuarantined(normalizeMutable(mutable), code);
    }
  });

  it("requires a complete manifest-linked pair before creating lineage", () => {
    const pair = buildPersonalFilingFactFixture(true);
    expectQuarantined(
      normalizePersonalFilingFacts({
        ...pair,
        sourceDocuments: [pair.sourceDocuments[0]!],
      }),
      "source_metadata_invalid",
    );

    const differentContext = mutableFixture(true);
    for (const entry of facts(differentContext.sources[1]!)) {
      entry.periodEnd = "2026-01-01";
      if (entry.key === "free_cash_flow") {
        const item = entry.derivation as JsonRecord;
        (item.minuend as JsonRecord).periodEnd = "2026-01-01";
        (item.subtrahend as JsonRecord).periodEnd = "2026-01-01";
      }
    }
    expectQuarantined(normalizeMutable(differentContext), "lineage_invalid");
  });

  it("owns byte inputs, is deterministic, and emits only value-free quarantine", () => {
    const firstFixture = buildPersonalFilingFactFixture(true);
    const secondFixture = buildPersonalFilingFactFixture(true);
    const first = normalizePersonalFilingFacts(firstFixture);
    const second = normalizePersonalFilingFacts(secondFixture);
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).not.toBe(second);
    expect(first.status).toBe("normalized_for_personal_use");
    if (first.status !== "normalized_for_personal_use") return;
    firstFixture.declaration.fill(0x41);
    firstFixture.manifest.fill(0x42);
    firstFixture.normalizationPlan.fill(0x43);
    firstFixture.sourceDocuments[0]!.fill(0x44);
    expect(first).toEqual(second);
    expect(
      Reflect.set(first.factVersions[0] as object, "value", "MUTATION_CANARY"),
    ).toBe(false);
    expect(JSON.stringify(first)).not.toContain("MUTATION_CANARY");

    const privateCanaries = [
      "0001234567-26-000001",
      "personal-generated-example",
      "sample:Revenue",
      "120000000",
    ];
    const mutable = mutableFixture();
    fact(mutable.sources[0]!, "revenue").value = "PRIVATE_VALUE_CANARY";
    expectQuarantined(normalizeMutable(mutable), "fact_set_invalid", [
      ...privateCanaries,
      "PRIVATE_VALUE_CANARY",
    ]);
  });
});

interface MutableFixture {
  readonly fixture: ReturnType<typeof buildPersonalFilingFactFixture>;
  readonly sources: JsonRecord[];
}

function mutableFixture(withAmendment = false): MutableFixture {
  const fixture = buildPersonalFilingFactFixture(withAmendment);
  return {
    fixture,
    sources: fixture.sourceDocuments.map(decodePersonalFilingFactDocument),
  };
}

function normalizeMutable(
  mutable: MutableFixture,
): PersonalFilingFactNormalizationResult {
  return normalizePersonalFilingFacts({
    ...mutable.fixture,
    sourceDocuments: mutable.sources.map(canonicalPersonalFilingFactDocument),
  });
}

function facts(source: JsonRecord): JsonRecord[] {
  return source.facts as JsonRecord[];
}

function fact(source: JsonRecord, key: string): JsonRecord {
  const value = facts(source).find((candidate) => candidate.key === key);
  if (value === undefined) throw new Error("Generated fact is missing.");
  return value;
}

function derivation(source: JsonRecord): JsonRecord {
  return fact(source, "free_cash_flow").derivation as JsonRecord;
}

function setFcfArithmetic(
  source: JsonRecord,
  minuend: string,
  subtrahend: string,
  result: string,
): void {
  fact(source, "operating_cash_flow").value = minuend;
  const fcf = fact(source, "free_cash_flow");
  const value = derivation(source);
  (value.minuend as JsonRecord).value = minuend;
  (value.subtrahend as JsonRecord).value = subtrahend;
  fcf.value = result;
}

function expectQuarantined(
  result: PersonalFilingFactNormalizationResult,
  code?: PersonalFilingFactNormalizationQuarantineCode,
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
  ]);
  expect(result.audit).toEqual({
    factVersionCount: 0,
    lineageCount: 0,
    outcome: "quarantined",
    sourceDocumentCount: 0,
  });
  expect(result.factVersions).toEqual([]);
  expect(result.lineage).toEqual([]);
  const serialized = JSON.stringify(result);
  for (const canary of canaries) expect(serialized).not.toContain(canary);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.audit)).toBe(true);
  expect(Object.isFrozen(result.factVersions)).toBe(true);
  expect(Object.isFrozen(result.lineage)).toBe(true);
}
