import {
  PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
  PERSONAL_SEC_INTERIM_TARGET_REASONS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecInterimCanonicalEvidenceDto as Evidence,
} from "@research-cockpit/contracts";
import {
  check,
  record,
  integer,
  matches,
  date,
  timestamp,
} from "./personal-sec-interim-validation";
import { validateInterimFacts } from "./personal-sec-interim-facts";
const digest = /^sha256:[a-f0-9]{64}$/u;
const statuses = [
  "available",
  "not_covered",
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
  "response_too_large",
  "candidate_limit",
];

function validateSource(
  value: unknown,
  key: "companyFacts" | "submissions",
  cik: string,
) {
  const source = record(value, [
    "status",
    "sourceUrl",
    "fetchedAt",
    "sha256",
    "bytes",
  ]);
  check(statuses.includes(source.status as string));
  const url =
    key === "companyFacts"
      ? `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
      : `https://data.sec.gov/submissions/CIK${cik}.json`;
  check(source.sourceUrl === url);
  const absent = [source.fetchedAt, source.sha256, source.bytes].some(
    (field) => field === null,
  );
  if (absent) {
    check(
      source.status !== "available" &&
        source.fetchedAt === null &&
        source.sha256 === null &&
        source.bytes === null,
    );
    return;
  }
  check(timestamp(source.fetchedAt) && matches(source.sha256, digest));
  check(
    integer(
      source.bytes,
      source.status === "available" ? 1 : 0,
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.responseBytes,
    ),
  );
}

function validateGeneration(value: unknown, cik: string) {
  const generation = record(value, [
    "definitionVersion",
    "cutoffAt",
    "completedAt",
    "sources",
    "sha256",
  ]);
  check(
    generation.definitionVersion === PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
  );
  check(
    timestamp(generation.cutoffAt) &&
      timestamp(generation.completedAt) &&
      matches(generation.sha256, digest),
  );
  const sources = record(generation.sources, ["companyFacts", "submissions"]);
  validateSource(sources.companyFacts, "companyFacts", cik);
  validateSource(sources.submissions, "submissions", cik);
}

function validateTarget(value: unknown) {
  const target = record(value);
  if (target.status !== "target") {
    record(target, ["status", "reason"]);
    check(
      target.status === "unresolved" &&
        PERSONAL_SEC_INTERIM_TARGET_REASONS.includes(target.reason as never),
    );
    return;
  }
  record(target, [
    "status",
    "accessionNumber",
    "form",
    "filedDate",
    "reportDate",
    "acceptedAt",
  ]);
  check(
    matches(target.accessionNumber, /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u) &&
      target.form === "10-Q",
  );
  check(date(target.filedDate) && date(target.reportDate));
  check(target.acceptedAt === null || timestamp(target.acceptedAt, false));
}

function validateTargetScan(value: unknown, evidence: Evidence) {
  if (evidence.generation.sources.submissions.status !== "available") {
    check(value === null && evidence.target.status === "unresolved");
    return;
  }
  const scan = record(value, [
    "currentFilings",
    "interimFilings",
    "olderHistoryAvailable",
  ]);
  check(
    integer(
      scan.currentFilings,
      0,
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.submissionRows,
    ),
  );
  check(
    integer(scan.interimFilings, 0, scan.currentFilings) &&
      typeof scan.olderHistoryAvailable === "boolean",
  );
  if (evidence.target.status === "target") check(scan.interimFilings > 0);
}

/** Closed shape/count/reference admission. Hash verification is a separate boundary. */
export function assertPersonalSecInterimCanonicalEvidence(
  value: unknown,
): asserts value is Evidence {
  const input = record(value, [
    "cik",
    "generation",
    "target",
    "targetScan",
    "facts",
  ]);
  check(matches(input.cik, /^(?!0000000000)[0-9]{10}$/u));
  validateGeneration(input.generation, input.cik);
  validateTarget(input.target);
  const evidence = value as Evidence;
  validateTargetScan(input.targetScan, evidence);
  validateInterimFacts(input.facts, evidence);
}

export function interimTemporalContext(evidence: Evidence): boolean {
  const { generation, target } = evidence;
  if (generation.completedAt < generation.cutoffAt) return false;
  const captured = Object.values(generation.sources).every(
    (source) =>
      source.fetchedAt === null ||
      (source.fetchedAt >= generation.cutoffAt &&
        source.fetchedAt <= generation.completedAt),
  );
  if (!captured) return false;
  if (target.status === "unresolved") return true;
  const cutoffDay = generation.cutoffAt.slice(0, 10);
  if (target.reportDate > target.filedDate || target.filedDate > cutoffDay)
    return false;
  return target.acceptedAt === null
    ? target.filedDate < cutoffDay
    : Date.parse(target.acceptedAt) <= Date.parse(generation.cutoffAt) &&
        target.acceptedAt.slice(0, 10) >= target.reportDate;
}
