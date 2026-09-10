import {
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecQuarterlyEvidenceRequestDto,
  type PersonalSecQuarterlyEvidenceResponseDto,
} from "@research-cockpit/contracts";

import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";

export const PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH =
  "/v1/personal-filing/workspace/sec-quarterly-evidence";

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

type Evidence = PersonalSecQuarterlyEvidenceResponseDto["evidence"];
type Observation = Evidence["observations"][number];

export async function fetchPersonalSecQuarterlyEvidence(
  input: PersonalSecQuarterlyEvidenceRequestDto,
  signal: AbortSignal,
): Promise<PersonalSecQuarterlyEvidenceResponseDto> {
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
  )
    throw new PersonalWorkspaceApiError("invalid_request");
  signal.throwIfAborted();
  const response = await requestPersonalWorkspace(
    PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );
  if (!response.ok) throw await responseError(response, signal);
  const value = await readJson(response, signal);
  if (
    !isResponse(value) ||
    value.catalogSnapshotSha256 !== input.catalogSnapshotSha256 ||
    value.security.listingId !== input.listingId ||
    value.security.symbol !== input.symbol
  )
    throw new PersonalWorkspaceApiError("invalid_response");
  return freeze(value);
}

function isResponse(
  value: unknown,
): value is PersonalSecQuarterlyEvidenceResponseDto {
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
      "fetchedAt",
      "sources",
      "olderHistoryAvailable",
      "coverage",
      "observations",
      "ttm",
    ]) ||
    value.cik !== cik ||
    !instant(value.fetchedAt) ||
    !keys(value.sources, ["companyFacts", "submissions"]) ||
    !source(
      value.sources.companyFacts,
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    ) ||
    !source(
      value.sources.submissions,
      `https://data.sec.gov/submissions/CIK${cik}.json`,
    ) ||
    typeof value.olderHistoryAvailable !== "boolean" ||
    !keys(value.coverage, [
      "inspectedRows",
      "invalidRows",
      "duplicateRows",
      "availableObservations",
      "returnedObservations",
      "truncated",
      "conceptsWithoutUsd",
    ]) ||
    !integer(value.coverage.inspectedRows, 0, limits.candidateRows) ||
    !integer(value.coverage.invalidRows, 0, value.coverage.inspectedRows) ||
    !integer(value.coverage.duplicateRows, 0, value.coverage.inspectedRows) ||
    !integer(
      value.coverage.availableObservations,
      0,
      value.coverage.inspectedRows,
    ) ||
    value.coverage.invalidRows +
      value.coverage.duplicateRows +
      value.coverage.availableObservations !==
      value.coverage.inspectedRows ||
    !integer(value.coverage.returnedObservations, 0, limits.observations) ||
    value.coverage.returnedObservations >
      value.coverage.availableObservations ||
    value.coverage.truncated !==
      value.coverage.availableObservations >
        value.coverage.returnedObservations ||
    !Array.isArray(value.coverage.conceptsWithoutUsd) ||
    value.coverage.conceptsWithoutUsd.length > concepts.length ||
    !value.coverage.conceptsWithoutUsd.every((concept) =>
      member(concepts, concept),
    ) ||
    new Set(value.coverage.conceptsWithoutUsd).size !==
      value.coverage.conceptsWithoutUsd.length ||
    !Array.isArray(value.observations) ||
    value.observations.length !== value.coverage.returnedObservations ||
    !keys(value.ttm, ["status", "reason"]) ||
    value.ttm.status !== "unavailable" ||
    value.ttm.reason !== "period_and_revision_not_admitted"
  )
    return false;

  if (
    value.sources.companyFacts.status !== "available" &&
    (value.observations.length !== 0 ||
      value.coverage.inspectedRows !== 0 ||
      value.coverage.conceptsWithoutUsd.length !== 0)
  )
    return false;
  if (
    value.sources.submissions.status !== "available" &&
    value.olderHistoryAvailable
  )
    return false;
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  const metricCounts = { revenue: 0, net_income: 0 };
  let previous: Observation | undefined;
  for (const candidate of value.observations) {
    if (
      !observation(
        candidate,
        cik,
        value.sources.submissions.status === "available",
      ) ||
      ids.has(candidate.id)
    )
      return false;
    if (previous !== undefined && compareObservations(previous, candidate) > 0)
      return false;
    const fingerprint = JSON.stringify([
      candidate.metric,
      candidate.concept,
      candidate.value,
      candidate.startDate,
      candidate.endDate,
      candidate.filingFocusYear,
      candidate.filingFocusPeriod,
      candidate.frame,
      candidate.accessionNumber,
      candidate.form,
      candidate.filedDate,
    ]);
    if (fingerprints.has(fingerprint)) return false;
    fingerprints.add(fingerprint);
    ids.add(candidate.id);
    metricCounts[candidate.metric] += 1;
    if (
      metricCounts[candidate.metric] > limits.observationsPerMetric ||
      value.coverage.conceptsWithoutUsd.includes(candidate.concept)
    )
      return false;
    previous = candidate;
  }
  return true;
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

function source(
  value: unknown,
  sourceUrl: string,
): value is { status: (typeof statuses)[number]; sourceUrl: string } {
  return (
    keys(value, ["status", "sourceUrl"]) &&
    member(statuses, value.status) &&
    value.sourceUrl === sourceUrl
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
