import {
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry,
  PERSONAL_SEC_INTERIM_STATEMENT_FACT_LIMITS as limits,
  type PersonalSecInterimCanonicalEvidenceDto as Evidence,
  type PersonalSecInterimStatementObservationDto as Row,
} from "@research-cockpit/contracts";
import {
  record,
  check,
  matches,
  date,
  integer,
  timestamp,
  sourceText,
  form,
  lexical,
} from "./personal-sec-interim-validation";
const accession = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const filingStatuses = [
  "matched",
  "metadata_conflict",
  "not_in_current_submissions",
  "submissions_unavailable",
];
const positions = new Map(
  registry.map((entry, index) => [entry.concept as string, index]),
);
export function validateInterimRow(
  candidate: unknown,
  evidence: Evidence,
): void {
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
  validateObservationIdentity(row);
  validateReportedPeriod(row);
  validateObservationMetadata(row);
  validateObservationSource(row, evidence);
  validateFilingJoin(candidate as Row, evidence);
}

type IdentifiedRow = Record<string, unknown> & { concept: string };
function validateObservationIdentity(
  row: Record<string, unknown>,
): asserts row is IdentifiedRow {
  check(matches(row.id, /^sec-interim-fact:[a-f0-9]{64}$/u));
  check(typeof row.concept === "string");
  check(positions.has(row.concept));
  check(row.taxonomy === "us-gaap");
  check(row.unit === "USD");
  check(
    typeof row.value === "string" &&
      row.value.length <= limits.decimalCharacters &&
      /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u.test(row.value) &&
      row.value !== "-0",
  );
}
function validateObservationMetadata(row: Record<string, unknown>): void {
  check(row.periodBasis === "unresolved");
  check(
    row.filingFocusYear === null || integer(row.filingFocusYear, 1000, 9999),
  );
  check(
    row.filingFocusPeriod === null || sourceText(row.filingFocusPeriod, 32),
  );
  check(row.frame === null || sourceText(row.frame, 128));
  check(form(row.form));
}
function validateObservationSource(
  row: IdentifiedRow,
  evidence: Evidence,
): void {
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
}

function validateReportedPeriod(row: Record<string, unknown>): void {
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
}
function validateFilingJoin(row: Row, evidence: Evidence): void {
  const filing = record(row.filing, [
    "status",
    "form",
    "filedDate",
    "reportDate",
    "acceptedAt",
    "sourceUrl",
  ]);
  check(filingStatuses.includes(filing.status as string));
  validateFilingMetadata(filing);
  const expectedUrl = `https://www.sec.gov/Archives/edgar/data/${evidence.cik.replace(/^0+/u, "")}/${row.accessionNumber}-index.htm`;
  check(filing.sourceUrl === null || filing.sourceUrl === expectedUrl);
  if (filing.status === "matched") {
    validateMatchedFiling(row, filing, evidence, expectedUrl);
  } else if (
    filing.status === "not_in_current_submissions" ||
    filing.status === "submissions_unavailable"
  ) {
    validateAbsentFiling(filing, evidence);
  }
}
function validateFilingMetadata(filing: Record<string, unknown>): void {
  check(filing.form === null || form(filing.form));
  check(filing.filedDate === null || date(filing.filedDate));
  check(filing.reportDate === null || date(filing.reportDate));
  check(filing.acceptedAt === null || timestamp(filing.acceptedAt, false));
}
function validateMatchedFiling(
  row: Row,
  filing: Record<string, unknown>,
  evidence: Evidence,
  expectedUrl: string,
): void {
  check(evidence.target.status === "target");
  const target = evidence.target;
  check(row.form === target.form && row.filedDate === target.filedDate);
  check(filing.form === target.form && filing.filedDate === target.filedDate);
  check(
    filing.reportDate === target.reportDate &&
      filing.acceptedAt === target.acceptedAt,
  );
  check(filing.sourceUrl === expectedUrl);
}
function validateAbsentFiling(
  filing: Record<string, unknown>,
  evidence: Evidence,
): void {
  check(
    [
      filing.form,
      filing.filedDate,
      filing.reportDate,
      filing.acceptedAt,
      filing.sourceUrl,
    ].every((value) => value === null),
  );
  if (filing.status === "submissions_unavailable")
    check(evidence.generation.sources.submissions.status !== "available");
}

export function compareInterimRows(left: Row, right: Row): number {
  return (
    positions.get(left.concept)! - positions.get(right.concept)! ||
    lexical(right.endDate, left.endDate) ||
    lexical(right.startDate ?? "", left.startDate ?? "") ||
    lexical(right.filedDate, left.filedDate) ||
    lexical(left.accessionNumber, right.accessionNumber) ||
    lexical(left.id, right.id)
  );
}
