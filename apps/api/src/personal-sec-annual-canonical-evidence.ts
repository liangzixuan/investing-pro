import { createHash } from "node:crypto";
import {
  serializePersonalSecAnnualStatementObservation,
  PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualCanonicalGenerationDto,
} from "@research-cockpit/contracts";
import {
  assertPersonalSecAnnualCanonicalEvidence,
  serializePersonalSecAnnualCanonicalGeneration,
} from "@research-cockpit/personal-financial-analytics";
import type { PersonalSecAnnualStatementCompanyFacts } from "./personal-sec-annual-statement-company-facts";
import {
  joinPersonalSecSourceFiling,
  type PersonalSecSourceSubmissions,
} from "./personal-sec-source-filing";

export interface PersonalSecAnnualCanonicalInput {
  readonly cik: string;
  readonly generation: Omit<PersonalSecAnnualCanonicalGenerationDto, "sha256">;
  readonly target: PersonalSecAnnualCanonicalEvidenceDto["target"];
  readonly targetScan: PersonalSecAnnualCanonicalEvidenceDto["targetScan"];
  readonly facts: PersonalSecAnnualStatementCompanyFacts;
  readonly submissions: PersonalSecSourceSubmissions | undefined;
}

function digest(text: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Assemble one owned graph from the existing two captured SEC source results. */
export function createPersonalSecAnnualCanonicalEvidence(
  input: PersonalSecAnnualCanonicalInput,
): PersonalSecAnnualCanonicalEvidenceDto {
  assertRecord(input, [
    "cik",
    "generation",
    "target",
    "targetScan",
    "facts",
    "submissions",
  ]);
  assertRecord(input.generation, [
    "definitionVersion",
    "cutoffAt",
    "completedAt",
    "sources",
  ]);
  assertRecord(input.facts, ["registryVersion", "scans", "observations"]);
  assertRows(input.facts.observations);
  const candidate: PersonalSecAnnualCanonicalEvidenceDto = {
    cik: input.cik,
    generation: {
      ...input.generation,
      sha256: `sha256:${"0".repeat(64)}`,
    },
    target: input.target,
    targetScan: input.targetScan,
    facts: {
      registryVersion: input.facts.registryVersion,
      scans: input.facts.scans,
      observations: input.facts.observations.map((row) => ({
        ...row,
        filing: joinPersonalSecSourceFiling(row, input.submissions),
      })),
    },
  };
  assertPersonalSecAnnualCanonicalEvidence(candidate);
  const owned = structuredClone(candidate);
  for (const row of owned.facts.observations) {
    const expected = digest(
      serializePersonalSecAnnualStatementObservation(row),
    ).replace(/^sha256:/u, "sec-fact:");
    if (row.id !== expected)
      throw new TypeError("Invalid annual statement source identity.");
  }
  const generation = {
    ...owned.generation,
    sha256: digest(serializePersonalSecAnnualCanonicalGeneration(owned)),
  };
  return freeze({ ...owned, generation });
}

/** Check raw descriptors before composition can flatten or invoke a supplied field. */
function assertRecord(value: unknown, expected: readonly string[]): void {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new TypeError("Invalid canonical annual source input.");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== expected.length ||
    !expected.every((key) => Object.hasOwn(descriptors, key)) ||
    !keys.every(
      (key) =>
        typeof key === "string" &&
        descriptors[key]?.enumerable &&
        Object.hasOwn(descriptors[key], "value"),
    )
  )
    throw new TypeError("Invalid canonical annual source input.");
}
function assertRows(value: unknown): void {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    throw new TypeError("Invalid canonical annual source rows.");
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (
    !length ||
    !Object.hasOwn(length, "value") ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0 ||
    length.value > PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS.observations
  )
    throw new TypeError("Invalid canonical annual source rows.");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== length.value + 1 ||
    !keys.every(
      (key) =>
        key === "length" ||
        (typeof key === "string" &&
          /^(?:0|[1-9][0-9]*)$/u.test(key) &&
          Number(key) < length.value &&
          descriptors[key]?.enumerable &&
          Object.hasOwn(descriptors[key], "value")),
    )
  )
    throw new TypeError("Invalid canonical annual source rows.");
  for (const row of value)
    assertRecord(row, [
      "id",
      "taxonomy",
      "concept",
      "unit",
      "value",
      "startDate",
      "endDate",
      "durationDays",
      "periodBasis",
      "filingFocusYear",
      "filingFocusPeriod",
      "frame",
      "accessionNumber",
      "form",
      "filedDate",
      "sourceLocator",
    ]);
}
