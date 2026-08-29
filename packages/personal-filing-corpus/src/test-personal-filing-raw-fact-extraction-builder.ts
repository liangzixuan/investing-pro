import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { PersonalFilingRawFactExtractionInput } from "./personal-filing-raw-fact-extraction";
import {
  buildPersonalFilingFactFixture,
  canonicalPersonalFilingFactDocument,
  decodePersonalFilingFactDocument,
  sha256,
  type JsonRecord,
} from "./test-personal-filing-fact-builder";

export interface PersonalFilingRawFactExtractionFixture {
  readonly input: PersonalFilingRawFactExtractionInput;
  readonly targetConcepts: readonly string[];
}

const PYTHON_EXTRACTOR_PATH = fileURLToPath(
  new URL(
    "../validator/personal_filing_raw_fact_extractor.py",
    import.meta.url,
  ),
);

export function buildPersonalFilingRawFactExtractionFixture(
  withAmendment = false,
): PersonalFilingRawFactExtractionFixture {
  const initial = buildPersonalFilingFactFixture(withAmendment);
  const initialSources = initial.sourceDocuments.map(
    decodePersonalFilingFactDocument,
  );
  const rawFilingDocuments = initialSources.map(buildInlineXbrlDocument);

  const manifestValue = decodePersonalFilingFactDocument(initial.manifest);
  const entries = requiredArray(manifestValue.entries).map(
    (entryValue, index) => {
      const entry = requiredRecord(entryValue);
      const raw = required(rawFilingDocuments[index]);
      return {
        ...entry,
        contentBytes: raw.byteLength,
        contentSha256: sha256(raw),
      };
    },
  );
  const manifest = canonicalPersonalFilingFactDocument({
    ...manifestValue,
    entries,
  });

  const declarationValue = decodePersonalFilingFactDocument(
    initial.declaration,
  );
  const declaration = canonicalPersonalFilingFactDocument({
    ...declarationValue,
    manifestSha256: sha256(manifest),
  });

  const planValue = decodePersonalFilingFactDocument(initial.normalizationPlan);
  const normalizationPlan = canonicalPersonalFilingFactDocument({
    ...planValue,
    declarationSha256: sha256(declaration),
    manifestSha256: sha256(manifest),
  });
  const normalizationPlanSha256 = sha256(normalizationPlan);

  const sourceDocuments = initialSources.map((source, index) =>
    canonicalPersonalFilingFactDocument({
      ...source,
      contentSha256: requiredRecord(required(entries[index])).contentSha256,
      normalizationPlanSha256,
    }),
  );
  const targetConcepts = targetConceptsFromSource(initialSources[0]);

  return Object.freeze({
    input: Object.freeze({
      declaration,
      manifest,
      normalizationPlan,
      rawFilingDocuments: Object.freeze(rawFilingDocuments),
      sourceDocuments: Object.freeze(sourceDocuments),
    }),
    targetConcepts,
  });
}

export function runPythonPersonalFilingRawFactExtractor(
  fixture: PersonalFilingRawFactExtractionFixture,
): Uint8Array {
  const request = canonicalPersonalFilingFactDocument({
    rawFilingDocuments: fixture.input.rawFilingDocuments.map(base64),
    targetConcepts: fixture.targetConcepts,
  });
  const result = spawnSync("python", ["-I", "-B", PYTHON_EXTRACTOR_PATH], {
    input: request,
    maxBuffer: 4_194_305,
    timeout: 20_000,
    windowsHide: true,
  });
  if (
    result.error !== undefined ||
    result.status !== 0 ||
    result.signal !== null ||
    result.stderr.byteLength !== 0 ||
    result.stdout.byteLength === 0
  ) {
    throw new Error("Generated Python raw filing extractor execution failed.");
  }
  return Uint8Array.from(result.stdout);
}

export function replaceRawFilingDocument(
  fixture: PersonalFilingRawFactExtractionFixture,
  index: number,
  raw: Uint8Array,
): PersonalFilingRawFactExtractionInput {
  return Object.freeze({
    ...fixture.input,
    rawFilingDocuments: Object.freeze(
      fixture.input.rawFilingDocuments.map((value, at) =>
        at === index ? raw : value,
      ),
    ),
  });
}

function buildInlineXbrlDocument(source: JsonRecord): Uint8Array {
  const facts = requiredArray(source.facts).map(requiredRecord);
  const direct = facts.filter((fact) => fact.key !== "free_cash_flow");
  const derived = requiredRecord(
    requiredRecord(
      required(facts.find((fact) => fact.key === "free_cash_flow")),
    ).derivation,
  );
  const subtrahend = requiredRecord(derived.subtrahend);
  const numericFacts = [
    ...direct.map((fact) => ({
      concept: requiredString(fact.concept),
      periodStart: fact.periodStart,
      unit: requiredString(fact.unit),
      value: requiredString(fact.value),
    })),
    {
      concept: requiredString(subtrahend.concept),
      periodStart: subtrahend.periodStart,
      unit: requiredString(subtrahend.unit),
      value: requiredString(subtrahend.value),
    },
  ];
  const factMarkup = numericFacts
    .map(
      (fact) =>
        `<ix:nonFraction contextRef="${fact.periodStart === null ? "instant" : "duration"}" decimals="-6" format="ixt:numdotdecimal" name="${fact.concept}" scale="6" unitRef="${fact.unit === "USD" ? "usd" : "shares"}">${scaledDisplay(fact.value, 6)}</ix:nonFraction>`,
    )
    .join("");
  const revenue = required(
    numericFacts.find((fact) => fact.concept.endsWith(":Revenue")),
  );
  const dimensionalAlternative = `<ix:nonFraction contextRef="duration-dimensional" decimals="-6" format="ixt:numdotdecimal" name="${revenue.concept}" scale="6" unitRef="usd">999</ix:nonFraction>`;
  const html = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2015-02-26" xmlns:sample="https://example.invalid/sample-gaap-2026" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:xbrli="http://www.xbrl.org/2003/instance"><head><title>Generated fixture &amp; parser probe</title></head><body><ix:header><ix:hidden>${factMarkup}${dimensionalAlternative}</ix:hidden><ix:resources><xbrli:context id="instant"><xbrli:entity><xbrli:identifier scheme="https://example.invalid/cik">0001234567</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2025-12-31</xbrli:instant></xbrli:period></xbrli:context><xbrli:context id="duration"><xbrli:entity><xbrli:identifier scheme="https://example.invalid/cik">0001234567</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context><xbrli:context id="duration-dimensional"><xbrli:entity><xbrli:identifier scheme="https://example.invalid/cik">0001234567</xbrli:identifier><xbrli:segment><xbrldi:explicitMember dimension="sample:Axis">sample:Member</xbrldi:explicitMember></xbrli:segment></xbrli:entity><xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context><xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit><xbrli:unit id="shares"><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unit></ix:resources></ix:header></body></html>`;
  return new TextEncoder().encode(html);
}

function targetConceptsFromSource(
  source: JsonRecord | undefined,
): readonly string[] {
  const facts = requiredArray(requiredRecord(source).facts).map(requiredRecord);
  const concepts = new Set<string>();
  for (const fact of facts) {
    if (fact.key === "free_cash_flow") {
      const derivation = requiredRecord(fact.derivation);
      concepts.add(requiredString(requiredRecord(derivation.minuend).concept));
      concepts.add(
        requiredString(requiredRecord(derivation.subtrahend).concept),
      );
    } else {
      concepts.add(requiredString(fact.concept));
    }
  }
  if (concepts.size !== 10)
    throw new TypeError("Generated targets are invalid.");
  return Object.freeze([...concepts].sort());
}

function scaledDisplay(value: string, scale: number): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction = ""] = unsigned.split(".");
  const coefficient = `${integer}${fraction}`.replace(/^0+(?=\d)/u, "");
  const places = scale + fraction.length;
  if (places < 0 || coefficient.length <= places) {
    throw new TypeError("Generated scaled value is invalid.");
  }
  const split = coefficient.length - places;
  const display = `${coefficient.slice(0, split)}${
    split === coefficient.length ? "" : `.${coefficient.slice(split)}`
  }`;
  return `${negative ? "-" : ""}${display}`;
}

function required<T>(value: T | undefined): T {
  if (value === undefined)
    throw new TypeError("Generated fixture is incomplete.");
  return value;
}

function requiredArray(value: unknown): unknown[] {
  if (!Array.isArray(value))
    throw new TypeError("Generated fixture is invalid.");
  return value;
}

function requiredRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Generated fixture is invalid.");
  }
  return value as JsonRecord;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string")
    throw new TypeError("Generated fixture is invalid.");
  return value;
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
