import {
  PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
  PERSONAL_SEC_ANNUAL_SCAN_STATUSES,
  PERSONAL_SEC_ANNUAL_STATEMENT_ABSENCES,
  PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS as limits,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION,
  PERSONAL_SEC_ANNUAL_TARGET_REASONS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";

type Evidence = PersonalSecAnnualCanonicalEvidenceDto;
type Row = PersonalSecAnnualStatementObservationDto;
const digest = /^sha256:[a-f0-9]{64}$/u;
const accession = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const sourceStatuses = [
  "available",
  "not_covered",
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
  "response_too_large",
  "candidate_limit",
];
const filingStatuses = [
  "matched",
  "metadata_conflict",
  "not_in_current_submissions",
  "submissions_unavailable",
];
const positions = new Map(
  registry.map((entry, index) => [entry.concept as string, index]),
);

/** Shape and consistency admission only. Callers must verify source and generation hashes. */
export function assertPersonalSecAnnualCanonicalEvidence(
  value: unknown,
): asserts value is Evidence {
  const input = record(value, [
    "cik",
    "generation",
    "target",
    "targetScan",
    "facts",
  ]);
  check(
    typeof input.cik === "string" &&
      /^(?!0000000000)[0-9]{10}$/u.test(input.cik),
  );
  const generation = record(input.generation, [
    "definitionVersion",
    "cutoffAt",
    "completedAt",
    "sources",
    "sha256",
  ]);
  check(generation.definitionVersion === PERSONAL_SEC_ANNUAL_CANONICAL_VERSION);
  check(
    timestamp(generation.cutoffAt) &&
      timestamp(generation.completedAt) &&
      matches(generation.sha256, digest),
  );
  const sources = record(generation.sources, ["companyFacts", "submissions"]);
  for (const key of ["companyFacts", "submissions"] as const) {
    const source = record(sources[key], [
      "status",
      "sourceUrl",
      "fetchedAt",
      "sha256",
      "bytes",
    ]);
    check(sourceStatuses.includes(source.status as string));
    check(
      source.sourceUrl ===
        (key === "companyFacts"
          ? `https://data.sec.gov/api/xbrl/companyfacts/CIK${input.cik}.json`
          : `https://data.sec.gov/submissions/CIK${input.cik}.json`),
    );
    if (
      source.fetchedAt === null ||
      source.sha256 === null ||
      source.bytes === null
    ) {
      check(
        source.status !== "available" &&
          source.fetchedAt === null &&
          source.sha256 === null &&
          source.bytes === null,
      );
    } else {
      check(
        timestamp(source.fetchedAt) &&
          matches(source.sha256, digest) &&
          integer(
            source.bytes,
            source.status === "available" ? 1 : 0,
            PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.responseBytes,
          ),
      );
    }
  }
  const target = record(input.target);
  if (target.status === "target") {
    record(target, [
      "status",
      "accessionNumber",
      "form",
      "filedDate",
      "reportDate",
      "acceptedAt",
    ]);
    check(
      matches(target.accessionNumber, accession) &&
        (target.form === "10-K" || target.form === "20-F") &&
        date(target.filedDate) &&
        date(target.reportDate) &&
        (target.acceptedAt === null || timestamp(target.acceptedAt, false)),
    );
  } else {
    record(target, ["status", "reason"]);
    check(
      target.status === "unresolved" &&
        PERSONAL_SEC_ANNUAL_TARGET_REASONS.includes(target.reason as never),
    );
  }
  const evidence = value as Evidence;
  if (evidence.generation.sources.submissions.status === "available") {
    const scan = record(input.targetScan, [
      "currentFilings",
      "annualFilings",
      "olderHistoryAvailable",
    ]);
    check(
      integer(
        scan.currentFilings,
        0,
        PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.submissionRows,
      ) &&
        integer(scan.annualFilings, 0, scan.currentFilings) &&
        typeof scan.olderHistoryAvailable === "boolean",
    );
    if (evidence.target.status === "target") check(scan.annualFilings > 0);
  } else
    check(input.targetScan === null && evidence.target.status === "unresolved");
  const facts = record(input.facts, [
    "registryVersion",
    "scans",
    "observations",
  ]);
  check(
    facts.registryVersion === PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION,
  );
  const scans = array(facts.scans, limits.concepts);
  check(scans.length === registry.length);
  const observations = array(facts.observations, limits.observations);
  for (const [index, candidate] of scans.entries()) {
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
      continue;
    }
    check(
      scan.absence === null ||
        PERSONAL_SEC_ANNUAL_STATEMENT_ABSENCES.includes(scan.absence as never),
    );
    const coverage = record(scan.coverage, [
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
    check(
      full.candidateRows === full.inspectedRows &&
        full.inspectedRows ===
          (full.invalidRows as number) +
            (full.duplicateRows as number) +
            (full.uniqueObservations as number),
    );
    check((scan.absence !== null) === (full.candidateRows === 0));
    check(integer(coverage.returned, 0, limits.observationsPerConcept));
    if (target.status === "unresolved") {
      check(
        coverage.selected === null &&
          coverage.otherAccessions === null &&
          coverage.omittedSelected === null &&
          coverage.returned === 0,
      );
    } else {
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
      const expected =
        (coverage.selected as number) > limits.observationsPerConcept
          ? 0
          : coverage.selected;
      check(
        coverage.returned === expected &&
          coverage.omittedSelected === (coverage.selected as number) - expected,
      );
    }
  }
  const ids = new Set<string>(),
    locators = new Set<string>();
  const counts = new Map<string, number>();
  let prior: Row | undefined;
  for (const candidate of observations) {
    validateRow(candidate, evidence);
    const row = candidate as Row;
    check(!ids.has(row.id) && !locators.has(row.sourceLocator));
    ids.add(row.id);
    locators.add(row.sourceLocator);
    check(prior === undefined || compare(prior, row) <= 0);
    prior = row;
    const count = (counts.get(row.concept) ?? 0) + 1;
    check(count <= limits.observationsPerConcept);
    counts.set(row.concept, count);
    const scan = evidence.facts.scans[positions.get(row.concept)!]!.scan;
    check(
      scan.status === "available" &&
        Number(row.sourceLocator.split("/").at(-1)) <
          scan.coverage.full.candidateRows,
    );
  }
  for (const item of evidence.facts.scans)
    check(
      (counts.get(item.concept) ?? 0) ===
        (item.scan.status === "available" ? item.scan.coverage.returned : 0),
    );
}

function validateRow(candidate: unknown, evidence: Evidence): void {
  const row = record(candidate, [
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
    "filing",
  ]);
  check(
    matches(row.id, /^sec-fact:[a-f0-9]{64}$/u) &&
      typeof row.concept === "string" &&
      positions.has(row.concept) &&
      row.taxonomy === "us-gaap" &&
      row.unit === "USD",
  );
  check(
    typeof row.value === "string" &&
      row.value.length <= limits.decimalCharacters &&
      /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u.test(row.value) &&
      row.value !== "-0",
  );
  check(
    date(row.endDate) &&
      date(row.filedDate) &&
      (row.startDate === null || date(row.startDate)),
  );
  check(
    row.startDate === null
      ? row.durationDays === null
      : row.startDate <= row.endDate &&
          row.durationDays ===
            (Date.parse(row.endDate) - Date.parse(row.startDate)) / 86400000 +
              1,
  );
  check(
    row.periodBasis === "unresolved" &&
      (row.filingFocusYear === null ||
        integer(row.filingFocusYear, 1000, 9999)) &&
      (row.filingFocusPeriod === null ||
        sourceText(row.filingFocusPeriod, 32)) &&
      (row.frame === null || sourceText(row.frame, 128)) &&
      form(row.form),
  );
  check(
    matches(row.accessionNumber, accession) &&
      evidence.target.status === "target" &&
      row.accessionNumber === evidence.target.accessionNumber,
  );
  check(
    typeof row.sourceLocator === "string" &&
      new RegExp(
        `^/facts/us-gaap/${row.concept}/units/USD/(?:0|[1-9][0-9]{0,3})$`,
        "u",
      ).test(row.sourceLocator),
  );
  const filing = record(row.filing, [
    "status",
    "form",
    "filedDate",
    "reportDate",
    "acceptedAt",
    "sourceUrl",
  ]);
  check(filingStatuses.includes(filing.status as string));
  check(
    (filing.form === null || form(filing.form)) &&
      (filing.filedDate === null || date(filing.filedDate)) &&
      (filing.reportDate === null || date(filing.reportDate)) &&
      (filing.acceptedAt === null || timestamp(filing.acceptedAt, false)),
  );
  const expectedUrl = `https://www.sec.gov/Archives/edgar/data/${evidence.cik.replace(/^0+/u, "")}/${row.accessionNumber}-index.htm`;
  check(filing.sourceUrl === null || filing.sourceUrl === expectedUrl);
  if (filing.status === "matched") {
    check(evidence.target.status === "target");
    const target = evidence.target;
    check(
      row.form === target.form &&
        row.filedDate === target.filedDate &&
        filing.form === target.form &&
        filing.filedDate === target.filedDate &&
        filing.reportDate === target.reportDate &&
        filing.acceptedAt === target.acceptedAt &&
        filing.sourceUrl === expectedUrl,
    );
  } else if (
    filing.status === "not_in_current_submissions" ||
    filing.status === "submissions_unavailable"
  ) {
    check(
      filing.form === null &&
        filing.filedDate === null &&
        filing.reportDate === null &&
        filing.acceptedAt === null &&
        filing.sourceUrl === null,
    );
    check(
      filing.status !== "submissions_unavailable" ||
        evidence.generation.sources.submissions.status !== "available",
    );
  }
}

/** Deterministic content binding; excludes only generation.sha256. This does not compute or verify SHA-256. */
export function serializePersonalSecAnnualCanonicalGeneration(
  evidence: Evidence,
): string {
  assertPersonalSecAnnualCanonicalEvidence(evidence);
  const source = (s: Evidence["generation"]["sources"]["companyFacts"]) => [
    s.status,
    s.sourceUrl,
    s.fetchedAt,
    s.sha256,
    s.bytes,
  ];
  const target =
    evidence.target.status === "target"
      ? [
          "target",
          evidence.target.accessionNumber,
          evidence.target.form,
          evidence.target.filedDate,
          evidence.target.reportDate,
          evidence.target.acceptedAt,
        ]
      : ["unresolved", evidence.target.reason];
  const scans = evidence.facts.scans.map((item) => {
    const scan = item.scan;
    if (scan.status !== "available")
      return [item.concept, scan.status, null, null];
    const { full, selected, otherAccessions, returned, omittedSelected } =
      scan.coverage;
    return [
      item.concept,
      scan.status,
      scan.absence,
      [
        [
          full.candidateRows,
          full.inspectedRows,
          full.invalidRows,
          full.duplicateRows,
          full.uniqueObservations,
        ],
        selected,
        otherAccessions,
        returned,
        omittedSelected,
      ],
    ];
  });
  const observations = evidence.facts.observations.map((row) => [
    row.id,
    row.taxonomy,
    row.concept,
    row.unit,
    row.value,
    row.startDate,
    row.endDate,
    row.durationDays,
    row.periodBasis,
    row.filingFocusYear,
    row.filingFocusPeriod,
    row.frame,
    row.accessionNumber,
    row.form,
    row.filedDate,
    row.sourceLocator,
    [
      row.filing.status,
      row.filing.form,
      row.filing.filedDate,
      row.filing.reportDate,
      row.filing.acceptedAt,
      row.filing.sourceUrl,
    ],
  ]);
  return JSON.stringify([
    "personal-sec-annual-canonical-evidence",
    PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
    evidence.cik,
    [
      evidence.generation.definitionVersion,
      evidence.generation.cutoffAt,
      evidence.generation.completedAt,
      source(evidence.generation.sources.companyFacts),
      source(evidence.generation.sources.submissions),
    ],
    target,
    evidence.targetScan === null
      ? null
      : [
          evidence.targetScan.currentFilings,
          evidence.targetScan.annualFilings,
          evidence.targetScan.olderHistoryAvailable,
        ],
    [evidence.facts.registryVersion, scans, observations],
  ]);
}

function record(
  value: unknown,
  keys?: readonly string[],
): Record<string, unknown> {
  check(
    value !== null &&
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  check(
    actual.every(
      (key) =>
        typeof key === "string" &&
        descriptors[key]?.enumerable &&
        Object.hasOwn(descriptors[key], "value"),
    ),
  );
  if (keys)
    check(
      actual.length === keys.length &&
        keys.every((key) => Object.hasOwn(descriptors, key)),
    );
  return value as Record<string, unknown>;
}
function array(value: unknown, maximum: number): readonly unknown[] {
  check(
    Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype,
  );
  const length = Object.getOwnPropertyDescriptor(value, "length");
  check(
    length &&
      Object.hasOwn(length, "value") &&
      integer(length.value, 0, maximum),
  );
  const descriptors = Object.getOwnPropertyDescriptors(value),
    keys = Reflect.ownKeys(descriptors);
  check(
    keys.length === length.value + 1 &&
      keys.every(
        (key) =>
          key === "length" ||
          (typeof key === "string" &&
            /^(?:0|[1-9][0-9]*)$/u.test(key) &&
            Number(key) < length.value &&
            descriptors[key]?.enumerable &&
            Object.hasOwn(descriptors[key], "value")),
      ),
  );
  return value as readonly unknown[];
}
function check(condition: unknown): asserts condition {
  if (!condition)
    throw new TypeError("Invalid canonical annual statement evidence.");
}
function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
function integer(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
function sourceText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value.trim() === value &&
    /^[\x20-\x7E]+$/u.test(value)
  );
}
function form(value: unknown): value is string {
  return (
    sourceText(value, 40) &&
    /^[A-Za-z0-9][A-Za-z0-9 /()._-]{0,39}$/u.test(value)
  );
}
function date(value: unknown): value is string {
  return (
    matches(value, /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}
function timestamp(value: unknown, milliseconds = true): value is string {
  return (
    matches(
      value,
      milliseconds
        ? /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u
        : /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{3})?Z$/u,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().replace(".000Z", "Z") ===
      value.replace(".000Z", "Z")
  );
}
function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function compare(left: Row, right: Row): number {
  return (
    positions.get(left.concept)! - positions.get(right.concept)! ||
    lexical(right.endDate, left.endDate) ||
    lexical(right.startDate ?? "", left.startDate ?? "") ||
    lexical(right.filedDate, left.filedDate) ||
    lexical(left.accessionNumber, right.accessionNumber) ||
    lexical(left.id, right.id)
  );
}
