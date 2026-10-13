import { annualLiquidity } from "./sec-annual-liquidity-response";
import { annualCashGeneration } from "./sec-annual-cash-response";
import {
  keys,
  matches,
  text,
  integer,
  member,
  date,
  instant,
  sourceInstant,
  hash,
  equal,
  incomeObservation,
  compareObservations,
} from "./sec-annual-response-validation";
import {
  parseManagedSecAnnualEvidenceRequest,
  PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION,
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  PERSONAL_SEC_ANNUAL_SCAN_STATUSES,
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  PERSONAL_SEC_ANNUAL_TARGET_REASONS,
  PERSONAL_SEC_ANNUAL_REFUSAL_REASONS,
  type PersonalSecAnnualEvidenceRequestDto,
  type PersonalSecAnnualEvidenceResponseDto,
  type PersonalSecAnnualEvidenceDto,
  type PersonalSecAnnualMetricCountsDto,
  type PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import {
  getPersonalSecAnnualRefusalReason,
  resolvePersonalSecAnnualEvidence,
  serializePersonalSecAnnualGeneration,
} from "@research-cockpit/personal-financial-analytics";

const concepts = PERSONAL_SEC_QUARTERLY_CONCEPTS;
const limits = PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS;
const statuses = [
  "available",
  "not_covered",
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
  "response_too_large",
  "candidate_limit",
] as const;
const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const symbol = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const digest = /^sha256:[a-f0-9]{64}$/u;
const cikPattern = /^(?!0000000000)[0-9]{10}$/u;
const accessionPattern = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
type Evidence = PersonalSecAnnualEvidenceDto;
type Observation = PersonalSecQuarterlyObservationDto;

/** Owns the packet before hashing; callers retain their request cancellation lifetime. */
export async function parseSecAnnualEvidenceResponse(
  value: unknown,
  capturedRequest: PersonalSecAnnualEvidenceRequestDto,
  signal: AbortSignal,
): Promise<PersonalSecAnnualEvidenceResponseDto | null> {
  signal.throwIfAborted();
  try {
    const requested = parseManagedSecAnnualEvidenceRequest(capturedRequest);
    if (requested === null) return null;
    const owned: unknown = structuredClone(value);
    if (
      !isResponse(owned) ||
      owned.catalogSnapshotSha256 !== requested.catalogSnapshotSha256 ||
      owned.security.listingId !== requested.listingId ||
      owned.security.symbol !== requested.symbol
    )
      return null;
    const validHashes = await hashesMatch(owned.evidence, signal);
    signal.throwIfAborted();
    return validHashes ? freeze(owned) : null;
  } catch {
    signal.throwIfAborted();
    return null;
  }
}

function isResponse(
  value: unknown,
): value is PersonalSecAnnualEvidenceResponseDto {
  return (
    keys(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "security",
      "evidence",
    ]) &&
    value.schemaVersion === PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION &&
    matches(value.catalogSnapshotSha256, digest) &&
    keys(value.security, [
      "country",
      "exchangeMic",
      "issuerId",
      "issuerName",
      "listingId",
      "securityName",
      "symbol",
      "cik",
    ]) &&
    value.security.country === "US" &&
    matches(value.security.exchangeMic, /^[A-Z0-9]{4}$/u) &&
    matches(value.security.issuerId, identifier) &&
    matches(value.security.listingId, identifier) &&
    text(value.security.issuerName, 512) &&
    text(value.security.securityName, 512) &&
    matches(value.security.symbol, symbol) &&
    matches(value.security.cik, cikPattern) &&
    isEvidence(value.evidence, value.security.cik)
  );
}

function isEvidence(value: unknown, cik: string): value is Evidence {
  if (
    !keys(value, [
      "cik",
      "generation",
      "target",
      "targetScan",
      "incomeScanStatus",
      "cashGeneration",
      "liquidity",
      "completeness",
      "coverage",
      "observations",
      "resolution",
    ]) ||
    value.cik !== cik ||
    !member(PERSONAL_SEC_ANNUAL_SCAN_STATUSES, value.incomeScanStatus) ||
    !keys(value.generation, [
      "definitionVersion",
      "cutoffAt",
      "completedAt",
      "sources",
      "sha256",
    ]) ||
    value.generation.definitionVersion !==
      PERSONAL_SEC_ANNUAL_DEFINITION_VERSION ||
    !instant(value.generation.cutoffAt) ||
    !instant(value.generation.completedAt) ||
    value.generation.completedAt < value.generation.cutoffAt ||
    !matches(value.generation.sha256, digest) ||
    !keys(value.generation.sources, ["companyFacts", "submissions"]) ||
    !annualSource(
      value.generation.sources.companyFacts,
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      value.generation.cutoffAt,
      value.generation.completedAt,
    ) ||
    !annualSource(
      value.generation.sources.submissions,
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      value.generation.cutoffAt,
      value.generation.completedAt,
    ) ||
    !annualTarget(value.target, value.generation.cutoffAt) ||
    !keys(value.completeness, ["status", "reason"]) ||
    !(
      (value.completeness.status === "complete" &&
        value.completeness.reason === null) ||
      (value.completeness.status === "refused" &&
        member(PERSONAL_SEC_ANNUAL_REFUSAL_REASONS, value.completeness.reason))
    ) ||
    !Array.isArray(value.observations) ||
    value.observations.length > limits.observations
  )
    return false;
  const company = value.generation.sources.companyFacts;
  const submissions = value.generation.sources.submissions;
  if (submissions.status === "available") {
    if (
      !keys(value.targetScan, [
        "currentFilings",
        "annualFilings",
        "olderHistoryAvailable",
      ]) ||
      !integer(value.targetScan.currentFilings, 0, 10_000) ||
      !integer(
        value.targetScan.annualFilings,
        0,
        value.targetScan.currentFilings,
      ) ||
      typeof value.targetScan.olderHistoryAvailable !== "boolean"
    )
      return false;
  } else if (value.targetScan !== null || value.target.status !== "unresolved")
    return false;
  if (
    value.target.status === "target" &&
    (!value.targetScan || value.targetScan.annualFilings === 0)
  )
    return false;
  if (
    value.completeness.status === "complete" &&
    (company.status !== "available" ||
      submissions.status !== "available" ||
      value.target.status !== "target" ||
      value.coverage === null)
  )
    return false;
  if (
    value.completeness.status === "refused" &&
    value.observations.length !== 0
  )
    return false;
  if (
    (value.incomeScanStatus === "source_unavailable") ===
    (company.status === "available")
  )
    return false;
  if (value.incomeScanStatus !== "available" && value.coverage !== null)
    return false;
  if (value.incomeScanStatus === "available" && value.coverage === null)
    return false;
  if (
    value.coverage !== null &&
    !coverage(
      value.coverage,
      value.target.status === "target",
      value.completeness.status === "complete",
      value.observations,
    )
  )
    return false;
  if (
    value.completeness.status === "complete" &&
    value.coverage?.full.invalidRows !== 0
  )
    return false;
  const ids = new Set<string>();
  let previous: Observation | undefined;
  for (const row of value.observations) {
    if (
      !incomeObservation(row, cik) ||
      ids.has(row.id) ||
      value.target.status !== "target" ||
      row.accessionNumber !== value.target.accessionNumber ||
      (previous !== undefined && compareObservations(previous, row) > 0)
    )
      return false;
    if (
      row.filing.status === "matched" ||
      row.filing.status === "metadata_conflict"
    ) {
      if (
        row.filing.form !== value.target.form ||
        row.filing.filedDate !== value.target.filedDate ||
        row.filing.reportDate !== value.target.reportDate ||
        row.filing.acceptedAt !== value.target.acceptedAt
      )
        return false;
    } else return false;
    ids.add(row.id);
    previous = row;
  }
  // The response carries only the selected packet: greatest-target selection over
  // complete Submissions is a server boundary, not proved by its digest alone.
  const evidence = value as unknown as Evidence;
  if (
    !annualCashGeneration(value.cashGeneration, evidence, ids) ||
    !annualLiquidity(value.liquidity, evidence, ids) ||
    evidence.completeness.reason !== getPersonalSecAnnualRefusalReason(evidence)
  )
    return false;
  return equal(evidence.resolution, resolvePersonalSecAnnualEvidence(evidence));
}

function coverage(
  value: unknown,
  hasTarget: boolean,
  complete: boolean,
  rows: readonly unknown[],
): value is Evidence["coverage"] & {} {
  if (
    !keys(value, [
      "full",
      "selected",
      "otherAccessions",
      "returned",
      "omittedSelected",
      "history",
    ]) ||
    !keys(value.full, [
      "observations",
      "revenue",
      "netIncome",
      "inspectedRows",
      "invalidRows",
      "duplicateRows",
      "uniqueObservations",
      "conceptsWithoutUsd",
    ]) ||
    !counts(value.full, false) ||
    !integer(value.full.inspectedRows, 0, limits.candidateRows) ||
    !integer(value.full.invalidRows, 0, value.full.inspectedRows) ||
    !integer(value.full.duplicateRows, 0, value.full.inspectedRows) ||
    value.full.uniqueObservations !== value.full.observations ||
    value.full.invalidRows +
      value.full.duplicateRows +
      value.full.observations !==
      value.full.inspectedRows ||
    !Array.isArray(value.full.conceptsWithoutUsd) ||
    value.full.conceptsWithoutUsd.length > concepts.length ||
    !value.full.conceptsWithoutUsd.every((item) => member(concepts, item)) ||
    new Set(value.full.conceptsWithoutUsd).size !==
      value.full.conceptsWithoutUsd.length ||
    !counts(value.returned) ||
    value.returned.observations !== rows.length ||
    !keys(value.history, ["returned", "truncated"]) ||
    !counts(value.history.returned) ||
    value.history.returned.revenue !==
      Math.min(value.full.revenue, limits.observationsPerMetric) ||
    value.history.returned.netIncome !==
      Math.min(value.full.netIncome, limits.observationsPerMetric) ||
    value.history.truncated !==
      value.full.observations > value.history.returned.observations
  )
    return false;
  if (!hasTarget)
    return (
      value.selected === null &&
      value.otherAccessions === null &&
      value.omittedSelected === null &&
      rows.length === 0
    );
  if (
    !counts(value.selected) ||
    !counts(value.otherAccessions) ||
    !counts(value.omittedSelected)
  )
    return false;
  for (const metric of ["observations", "revenue", "netIncome"] as const) {
    if (
      value.selected[metric] + value.otherAccessions[metric] !==
        value.full[metric] ||
      value.returned[metric] + value.omittedSelected[metric] !==
        value.selected[metric]
    )
      return false;
  }
  if (
    complete &&
    (value.omittedSelected.observations !== 0 ||
      value.selected.revenue > limits.observationsPerMetric ||
      value.selected.netIncome > limits.observationsPerMetric)
  )
    return false;
  const revenue = rows.filter(
    (row) =>
      typeof row === "object" &&
      row !== null &&
      "metric" in row &&
      row.metric === "revenue",
  ).length;
  if (
    value.returned.revenue !== revenue ||
    value.returned.netIncome !== rows.length - revenue
  )
    return false;
  const missingConcepts = value.full.conceptsWithoutUsd;
  return rows.every(
    (row) =>
      typeof row === "object" &&
      row !== null &&
      "concept" in row &&
      member(concepts, row.concept) &&
      !missingConcepts.includes(row.concept),
  );
}

function counts(
  value: unknown,
  exactKeys = true,
): value is PersonalSecAnnualMetricCountsDto {
  if (
    typeof value !== "object" ||
    value === null ||
    (exactKeys && !keys(value, ["observations", "revenue", "netIncome"]))
  )
    return false;
  return (
    "observations" in value &&
    "revenue" in value &&
    "netIncome" in value &&
    integer(value.observations, 0, limits.candidateRows) &&
    integer(value.revenue, 0, limits.candidateRows) &&
    integer(value.netIncome, 0, limits.candidateRows) &&
    value.revenue + value.netIncome === value.observations
  );
}

function annualTarget(
  value: unknown,
  cutoff: string,
): value is Evidence["target"] {
  if (keys(value, ["status", "reason"]))
    return (
      value.status === "unresolved" &&
      member(PERSONAL_SEC_ANNUAL_TARGET_REASONS, value.reason)
    );
  if (
    !keys(value, [
      "status",
      "accessionNumber",
      "form",
      "filedDate",
      "reportDate",
      "acceptedAt",
    ]) ||
    value.status !== "target" ||
    !matches(value.accessionNumber, accessionPattern) ||
    !member(["10-K", "20-F"], value.form) ||
    !date(value.filedDate) ||
    !date(value.reportDate) ||
    value.reportDate > value.filedDate ||
    value.filedDate > cutoff.slice(0, 10) ||
    !(value.acceptedAt === null || sourceInstant(value.acceptedAt))
  )
    return false;
  if (value.acceptedAt === null) return value.filedDate < cutoff.slice(0, 10);
  return (
    Date.parse(value.acceptedAt) <= Date.parse(cutoff) &&
    value.acceptedAt.slice(0, 10) >= value.reportDate
  );
}

function annualSource(
  value: unknown,
  url: string,
  cutoff: string,
  completed: string,
): value is Evidence["generation"]["sources"]["companyFacts"] {
  if (
    !keys(value, ["status", "sourceUrl", "fetchedAt", "sha256", "bytes"]) ||
    !member(statuses, value.status) ||
    value.sourceUrl !== url
  )
    return false;
  if (value.fetchedAt === null || value.sha256 === null || value.bytes === null)
    return (
      value.status !== "available" &&
      value.fetchedAt === null &&
      value.sha256 === null &&
      value.bytes === null
    );
  return (
    instant(value.fetchedAt) &&
    value.fetchedAt >= cutoff &&
    value.fetchedAt <= completed &&
    matches(value.sha256, digest) &&
    integer(value.bytes, value.status === "available" ? 1 : 0, 8 * 1024 * 1024)
  );
}

async function hashesMatch(evidence: Evidence, signal: AbortSignal) {
  const { sha256: expected, ...generation } = evidence.generation;
  if (
    (await hash(
      serializePersonalSecAnnualGeneration({
        cik: evidence.cik,
        generation,
        target: evidence.target,
        targetScan: evidence.targetScan,
      }),
    )) !== expected
  )
    return false;
  for (const row of [
    ...evidence.observations,
    ...evidence.cashGeneration.operatingCashFlow.observations,
    ...evidence.cashGeneration.ppePurchases.observations,
    ...evidence.liquidity.currentAssets.observations,
    ...evidence.liquidity.currentLiabilities.observations,
  ]) {
    signal.throwIfAborted();
    const fields = {
      metric: row.metric,
      taxonomy: row.taxonomy,
      concept: row.concept,
      unit: row.unit,
      value: row.value,
      startDate: row.startDate,
      endDate: row.endDate,
      durationDays: row.durationDays,
      periodBasis: row.periodBasis,
      filingFocusYear: row.filingFocusYear,
      filingFocusPeriod: row.filingFocusPeriod,
      frame: row.frame,
      accessionNumber: row.accessionNumber,
      form: row.form,
      filedDate: row.filedDate,
    };
    if (`sec-fact:${(await hash(JSON.stringify(fields))).slice(7)}` !== row.id)
      return false;
  }
  return true;
}

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
