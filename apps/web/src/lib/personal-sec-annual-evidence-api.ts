import {
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
import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";

export const PERSONAL_SEC_ANNUAL_EVIDENCE_PATH =
  "/v1/personal-filing/workspace/sec-annual-evidence";
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
const forbiddenText = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const maxBrowserResponseBytes = 2 * 1024 * 1024;
type Evidence = PersonalSecAnnualEvidenceDto;
type Observation = PersonalSecQuarterlyObservationDto;

export async function fetchPersonalSecAnnualEvidence(
  input: PersonalSecAnnualEvidenceRequestDto,
  signal: AbortSignal,
): Promise<PersonalSecAnnualEvidenceResponseDto> {
  if (
    !keys(input, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "listingId",
      "symbol",
    ]) ||
    input.schemaVersion !== "1.0.0" ||
    !matches(input.catalogSnapshotSha256, digest) ||
    !matches(input.listingId, identifier) ||
    !matches(input.symbol, symbol)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const requested = { ...input };
  signal.throwIfAborted();
  const response = await requestPersonalWorkspace(
    PERSONAL_SEC_ANNUAL_EVIDENCE_PATH,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requested),
      signal,
    },
  );
  if (!response.ok) throw await responseError(response, signal);
  const value = await readJson(response, signal);
  try {
    if (
      !isResponse(value) ||
      value.catalogSnapshotSha256 !== requested.catalogSnapshotSha256 ||
      value.security.listingId !== requested.listingId ||
      value.security.symbol !== requested.symbol ||
      !(await hashesMatch(value.evidence, signal))
    )
      throw new Error("Invalid annual evidence");
    signal.throwIfAborted();
    return freeze(value);
  } catch {
    signal.throwIfAborted();
    throw new PersonalWorkspaceApiError("invalid_response");
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
    value.schemaVersion === "1.0.0" &&
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
      "completeness",
      "coverage",
      "observations",
      "resolution",
    ]) ||
    value.cik !== cik ||
    !keys(value.generation, [
      "definitionVersion",
      "cutoffAt",
      "completedAt",
      "sources",
      "sha256",
    ]) ||
    value.generation.definitionVersion !== "1.0.0" ||
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
  if (company.status !== "available" && value.coverage !== null) return false;
  if (company.status === "available" && value.coverage === null) return false;
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
      !observation(row, cik, true) ||
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
  for (const row of evidence.observations) {
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

async function hash(value: string): Promise<`sha256:${string}`> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `sha256:${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return false;
  const a = Object.keys(left);
  const b = Object.keys(right);
  return (
    a.length === b.length &&
    a.every(
      (key) =>
        Object.hasOwn(right, key) &&
        equal(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
}

function observation(
  value: unknown,
  cik: string,
  submissionsAvailable: boolean,
): value is Observation {
  if (
    !keys(value, [
      "id",
      "metric",
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
    ]) ||
    !matches(value.id, /^sec-fact:[a-f0-9]{64}$/u) ||
    !member(["revenue", "net_income"], value.metric) ||
    value.taxonomy !== "us-gaap" ||
    !member(concepts, value.concept) ||
    (value.metric === "net_income") !== (value.concept === "NetIncomeLoss") ||
    value.unit !== "USD" ||
    !matches(value.value, /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u) ||
    value.value.length > limits.decimalCharacters ||
    value.value === "-0" ||
    !date(value.endDate) ||
    !(value.startDate === null || date(value.startDate)) ||
    (value.startDate !== null && value.startDate > value.endDate) ||
    value.durationDays !==
      (value.startDate === null
        ? null
        : (Date.parse(value.endDate) - Date.parse(value.startDate)) /
            86_400_000 +
          1) ||
    value.periodBasis !== "unresolved" ||
    !(
      value.filingFocusYear === null ||
      integer(value.filingFocusYear, 1000, 9999)
    ) ||
    !(
      value.filingFocusPeriod === null ||
      sourceText(value.filingFocusPeriod, 32)
    ) ||
    !(value.frame === null || sourceText(value.frame, 128)) ||
    !matches(value.accessionNumber, accessionPattern) ||
    !form(value.form) ||
    !date(value.filedDate) ||
    !matches(
      value.sourceLocator,
      new RegExp(
        `^/facts/us-gaap/${value.concept}/units/USD/(?:0|[1-9][0-9]{0,4})$`,
        "u",
      ),
    ) ||
    Number(value.sourceLocator.split("/").at(-1)) >= limits.candidateRows ||
    !keys(value.filing, [
      "status",
      "form",
      "filedDate",
      "reportDate",
      "acceptedAt",
      "sourceUrl",
    ]) ||
    !member(
      [
        "matched",
        "metadata_conflict",
        "not_in_current_submissions",
        "submissions_unavailable",
      ],
      value.filing.status,
    )
  )
    return false;
  const filing = value.filing;
  if (!submissionsAvailable && filing.status !== "submissions_unavailable")
    return false;
  if (submissionsAvailable && filing.status === "submissions_unavailable")
    return false;
  if (
    filing.status === "not_in_current_submissions" ||
    filing.status === "submissions_unavailable"
  ) {
    return (
      filing.form === null &&
      filing.filedDate === null &&
      filing.reportDate === null &&
      filing.acceptedAt === null &&
      filing.sourceUrl === null
    );
  }
  return (
    form(filing.form) &&
    date(filing.filedDate) &&
    (filing.reportDate === null || date(filing.reportDate)) &&
    (filing.acceptedAt === null || sourceInstant(filing.acceptedAt)) &&
    filing.sourceUrl ===
      `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${value.accessionNumber}-index.htm` &&
    (filing.status === "matched"
      ? filing.form === value.form && filing.filedDate === value.filedDate
      : filing.form !== value.form || filing.filedDate !== value.filedDate)
  );
}

function compareObservations(left: Observation, right: Observation): number {
  return (
    right.endDate.localeCompare(left.endDate) ||
    (right.startDate ?? "").localeCompare(left.startDate ?? "") ||
    right.filedDate.localeCompare(left.filedDate) ||
    left.accessionNumber.localeCompare(right.accessionNumber) ||
    left.concept.localeCompare(right.concept) ||
    left.id.localeCompare(right.id)
  );
}

function keys(
  value: unknown,
  expected: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
function text(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value === value.trim().normalize("NFC") &&
    [...value].length > 0 &&
    [...value].length <= maximum &&
    !forbiddenText.test(value)
  );
}
function sourceText(value: unknown, maximum: number): value is string {
  return text(value, maximum) && /^[\x20-\x7E]+$/u.test(value);
}
function form(value: unknown): value is string {
  return (
    sourceText(value, 40) &&
    /^[A-Za-z0-9][A-Za-z0-9 /()._-]{0,39}$/u.test(value)
  );
}
function integer(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
function member<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}
function date(value: unknown): value is string {
  return (
    matches(value, /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}
function instant(value: unknown): value is string {
  return (
    matches(
      value,
      /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function sourceInstant(value: unknown): value is string {
  return (
    matches(
      value,
      /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{3})?Z$/u,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() ===
      (value.length === 20 ? value.replace("Z", ".000Z") : value)
  );
}
function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

async function readJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new PersonalWorkspaceApiError("invalid_response");
  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    signal.throwIfAborted();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const chunks: string[] = [];
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBrowserResponseBytes)
        throw new PersonalWorkspaceApiError("invalid_response");
      chunks.push(decoder.decode(chunk.value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join("")) as unknown;
  } catch {
    void reader.cancel().catch(() => undefined);
    signal.throwIfAborted();
    throw new PersonalWorkspaceApiError("invalid_response");
  } finally {
    signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

async function responseError(
  response: Response,
  signal: AbortSignal,
): Promise<PersonalWorkspaceApiError> {
  if (response.status === 401 || response.status === 403)
    return new PersonalWorkspaceApiError("session_unavailable");
  if (response.status === 400)
    return new PersonalWorkspaceApiError("invalid_request");
  if (response.status === 409) return new PersonalWorkspaceApiError("conflict");
  if (response.status === 404)
    return new PersonalWorkspaceApiError("not_covered");
  if (response.status === 429)
    return new PersonalWorkspaceApiError("rate_limited");
  if (response.status === 502)
    return new PersonalWorkspaceApiError("provider_unavailable");
  if (response.status === 503) {
    try {
      const value = await readJson(response, signal);
      if (
        typeof value === "object" &&
        value !== null &&
        "code" in value &&
        value.code === "not_configured"
      )
        return new PersonalWorkspaceApiError("not_configured");
    } catch {
      signal.throwIfAborted();
    }
  }
  return new PersonalWorkspaceApiError("unavailable");
}
