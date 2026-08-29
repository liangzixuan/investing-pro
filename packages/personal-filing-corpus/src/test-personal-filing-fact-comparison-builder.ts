import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { PersonalFilingFactComparisonInput } from "./personal-filing-fact-comparison";
import {
  normalizePersonalFilingFacts,
  type PersonalFilingFactNormalizationRecord,
} from "./personal-filing-fact-normalization";
import {
  buildPersonalFilingFactFixture,
  canonicalPersonalFilingFactDocument,
  decodePersonalFilingFactDocument,
  type JsonRecord,
  type PersonalFilingFactFixture,
} from "./test-personal-filing-fact-builder";

export interface PersonalFilingFactComparisonFixture {
  readonly input: PersonalFilingFactComparisonInput;
  readonly primaryRecord: PersonalFilingFactNormalizationRecord;
  readonly secondaryRecord: Uint8Array;
}

const PYTHON_VALIDATOR_PATH = fileURLToPath(
  new URL("../validator/personal_filing_fact_validator.py", import.meta.url),
);

export function buildPersonalFilingFactComparisonFixture(
  withAmendment = false,
): PersonalFilingFactComparisonFixture {
  const fixture = buildPersonalFilingFactFixture(withAmendment);
  const primaryRecord = normalized(normalizePersonalFilingFacts(fixture));
  return Object.freeze({
    input: Object.freeze({
      ...fixture,
    }),
    primaryRecord,
    secondaryRecord: runPythonPersonalFilingFactValidator(fixture),
  });
}

export function runPythonPersonalFilingFactValidator(
  fixture: PersonalFilingFactFixture,
): Uint8Array {
  const request = canonicalPersonalFilingFactDocument({
    declaration: base64(fixture.declaration),
    manifest: base64(fixture.manifest),
    normalizationPlan: base64(fixture.normalizationPlan),
    sourceDocuments: fixture.sourceDocuments.map(base64),
  });
  const result = spawnSync("python", ["-B", PYTHON_VALIDATOR_PATH], {
    input: request,
    maxBuffer: 2 * 1024 * 1024,
    timeout: 10_000,
    windowsHide: true,
  });
  if (
    result.error !== undefined ||
    result.status !== 0 ||
    result.signal !== null ||
    result.stderr.byteLength !== 0 ||
    result.stdout.byteLength === 0
  ) {
    throw new Error("Generated Python validator execution failed.");
  }
  return Uint8Array.from(result.stdout);
}

export function canonicalPersonalFilingFactComparisonRecord(
  value: unknown,
): Uint8Array {
  return canonicalPersonalFilingFactDocument(value);
}

export function decodePersonalFilingFactComparisonRecord(
  bytes: Uint8Array,
): JsonRecord {
  return decodePersonalFilingFactDocument(bytes);
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function normalized(
  result: ReturnType<typeof normalizePersonalFilingFacts>,
): PersonalFilingFactNormalizationRecord {
  if (result.status !== "normalized_for_personal_use") {
    throw new Error("Generated TypeScript normalization failed.");
  }
  return result;
}
