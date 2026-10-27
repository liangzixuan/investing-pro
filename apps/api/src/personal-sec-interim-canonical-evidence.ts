import {
  assertSecCanonicalRecord,
  assertSecCanonicalRows as assertRows,
  digestSecCanonicalText as digest,
  freezeSecCanonicalGraph as freeze,
} from "./personal-sec-canonical-input";
import {
  serializePersonalSecInterimStatementObservation,
  PERSONAL_SEC_INTERIM_STATEMENT_FACT_LIMITS,
  type PersonalSecInterimCanonicalEvidenceDto,
  type PersonalSecInterimCanonicalGenerationDto,
} from "@research-cockpit/contracts";
import {
  assertPersonalSecInterimCanonicalEvidence,
  serializePersonalSecInterimCanonicalGeneration,
} from "@research-cockpit/personal-financial-analytics";
import type { PersonalSecInterimStatementCompanyFacts } from "./personal-sec-interim-statement-company-facts";
import {
  joinPersonalSecSourceFiling,
  type PersonalSecSourceSubmissions,
} from "./personal-sec-source-filing";

export interface PersonalSecInterimCanonicalInput {
  readonly cik: string;
  readonly generation: Omit<PersonalSecInterimCanonicalGenerationDto, "sha256">;
  readonly target: PersonalSecInterimCanonicalEvidenceDto["target"];
  readonly targetScan: PersonalSecInterimCanonicalEvidenceDto["targetScan"];
  readonly facts: PersonalSecInterimStatementCompanyFacts;
  readonly submissions: PersonalSecSourceSubmissions | undefined;
}

const assertRecord = (value: unknown, fields: readonly string[]) =>
  assertSecCanonicalRecord(value, fields, "interim");

/** Assemble one owned graph from the existing two captured SEC source results. */
export function createPersonalSecInterimCanonicalEvidence(
  input: PersonalSecInterimCanonicalInput,
): PersonalSecInterimCanonicalEvidenceDto {
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
    PERSONAL_SEC_INTERIM_STATEMENT_FACT_LIMITS.observations,
    "interim",
  );
  const candidate: PersonalSecInterimCanonicalEvidenceDto = {
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
  assertPersonalSecInterimCanonicalEvidence(candidate);
  const owned = structuredClone(candidate);
  for (const row of owned.facts.observations) {
    const expected = digest(
      serializePersonalSecInterimStatementObservation(row),
    ).replace(/^sha256:/u, "sec-interim-fact:");
    if (row.id !== expected)
      throw new TypeError("Invalid interim statement source identity.");
  }
  const generation = {
    ...owned.generation,
    sha256: digest(serializePersonalSecInterimCanonicalGeneration(owned)),
  };
  return freeze({ ...owned, generation });
}
