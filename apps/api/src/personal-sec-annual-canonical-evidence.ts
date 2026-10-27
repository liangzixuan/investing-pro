import {
  assertSecCanonicalRecord,
  assertSecCanonicalRows as assertRows,
  digestSecCanonicalText as digest,
  freezeSecCanonicalGraph as freeze,
} from "./personal-sec-canonical-input";
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

const assertRecord = (value: unknown, fields: readonly string[]) =>
  assertSecCanonicalRecord(value, fields, "annual");

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
  assertRows(
    input.facts.observations,
    PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS.observations,
    "annual",
  );
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
