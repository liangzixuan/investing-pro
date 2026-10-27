import {
  PERSONAL_SEC_ANNUAL_SCAN_STATUSES,
  PERSONAL_SEC_ANNUAL_STATEMENT_ABSENCES,
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry,
  PERSONAL_SEC_INTERIM_STATEMENT_FACT_LIMITS as limits,
  type PersonalSecInterimCanonicalEvidenceDto as Evidence,
  type PersonalSecInterimStatementObservationDto as Row,
} from "@research-cockpit/contracts";
import {
  array,
  record,
  check,
  integer,
} from "./personal-sec-interim-validation";
import {
  compareInterimRows,
  validateInterimRow,
} from "./personal-sec-interim-observations";

function validateCoverage(
  value: unknown,
  targetResolved: boolean,
  absence: unknown,
) {
  const coverage = record(value, [
    "full",
    "selected",
    "otherAccessions",
    "returned",
    "omittedSelected",
  ]);
  const full = record(coverage.full, [
    "candidateRows",
    "inspectedRows",
    "invalidRows",
    "duplicateRows",
    "uniqueObservations",
  ]);
  check(
    Object.values(full).every((count) =>
      integer(count, 0, limits.candidateRowsPerConcept),
    ),
  );
  check(full.candidateRows === full.inspectedRows);
  check(
    full.inspectedRows ===
      (full.invalidRows as number) +
        (full.duplicateRows as number) +
        (full.uniqueObservations as number),
  );
  check((absence !== null) === (full.candidateRows === 0));
  check(integer(coverage.returned, 0, limits.observationsPerConcept));
  if (!targetResolved) {
    check(
      coverage.selected === null &&
        coverage.otherAccessions === null &&
        coverage.omittedSelected === null &&
        coverage.returned === 0,
    );
    return;
  }
  check(
    [
      coverage.selected,
      coverage.otherAccessions,
      coverage.omittedSelected,
    ].every((count) => integer(count, 0, limits.candidateRowsPerConcept)),
  );
  check(
    (coverage.selected as number) + (coverage.otherAccessions as number) ===
      full.uniqueObservations,
  );
  const selected = coverage.selected as number;
  const expected = selected > limits.observationsPerConcept ? 0 : selected;
  check(
    coverage.returned === expected &&
      coverage.omittedSelected === selected - expected,
  );
}

function validateScan(candidate: unknown, index: number, evidence: Evidence) {
  const item = record(candidate, ["concept", "scan"]);
  check(item.concept === registry[index]?.concept);
  const scan = record(item.scan, ["status", "absence", "coverage"]);
  check(PERSONAL_SEC_ANNUAL_SCAN_STATUSES.includes(scan.status as never));
  check(
    (scan.status === "source_unavailable") !==
      (evidence.generation.sources.companyFacts.status === "available"),
  );
  if (scan.status !== "available") {
    check(scan.absence === null && scan.coverage === null);
    return;
  }
  check(
    scan.absence === null ||
      PERSONAL_SEC_ANNUAL_STATEMENT_ABSENCES.includes(scan.absence as never),
  );
  validateCoverage(
    scan.coverage,
    evidence.target.status === "target",
    scan.absence,
  );
}

function validateObservations(
  observations: readonly unknown[],
  evidence: Evidence,
) {
  const ids = new Set<string>(),
    locators = new Set<string>();
  const counts = new Map<string, number>();
  const scans = new Map(
    evidence.facts.scans.map((item) => [item.concept, item.scan]),
  );
  let prior: Row | undefined;
  for (const candidate of observations) {
    validateInterimRow(candidate, evidence);
    const row = candidate as Row;
    check(!ids.has(row.id) && !locators.has(row.sourceLocator));
    ids.add(row.id);
    locators.add(row.sourceLocator);
    check(prior === undefined || compareInterimRows(prior, row) <= 0);
    prior = row;
    const count = (counts.get(row.concept) ?? 0) + 1;
    check(count <= limits.observationsPerConcept);
    counts.set(row.concept, count);
    const scan = scans.get(row.concept)!;
    check(
      scan.status === "available" &&
        Number(row.sourceLocator.split("/").at(-1)) <
          scan.coverage.full.candidateRows,
    );
  }
  for (const item of evidence.facts.scans) {
    const expected =
      item.scan.status === "available" ? item.scan.coverage.returned : 0;
    check((counts.get(item.concept) ?? 0) === expected);
  }
}

export function validateInterimFacts(value: unknown, evidence: Evidence): void {
  const facts = record(value, ["registryVersion", "scans", "observations"]);
  check(facts.registryVersion === "1.0.0");
  const scans = array(facts.scans, limits.concepts);
  check(scans.length === registry.length);
  scans.forEach((scan, index) => validateScan(scan, index, evidence));
  validateObservations(
    array(facts.observations, limits.observations),
    evidence,
  );
}
