import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenCriteriaDto,
  type PersonalFinancialScreenRequestDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialSavedViewsPayloadDto,
} from "@research-cockpit/contracts";

import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";

export const PERSONAL_FINANCIAL_SCREEN_PATH =
  "/v1/personal-filing/workspace/financial-screen";
export const PERSONAL_FINANCIAL_SAVED_VIEWS_PATH = `${PERSONAL_FINANCIAL_SCREEN_PATH}/saved-views`;
const savedId = "financial-screener-saved-views";
const metrics = PERSONAL_FINANCIAL_SCREEN_METRICS;
const revenueBases = PERSONAL_FINANCIAL_REVENUE_BASES;
const concepts = PERSONAL_SEC_ANNUAL_CONCEPTS;
const frameStatuses = [
  "available",
  "not_covered",
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
];
const unavailableReasons = [
  "missing",
  "conflicting",
  "period_mismatch",
  "nonpositive_revenue",
  "source_unavailable",
  "invalid_value",
];
const digest = /^sha256:[a-f0-9]{64}$/u;
const bareDigest = /^[a-f0-9]{64}$/u;
const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const forbiddenText = /[\p{Cc}\p{Cf}\p{Cs}]/u;

export interface PersonalFinancialSavedViews {
  readonly version: number;
  readonly payload: PersonalFinancialSavedViewsPayloadDto;
}

/** The provider link is reconstructed from an admitted concept/year, never arbitrary upstream text. */
export function personalFinancialSourceUrl(
  concept: (typeof concepts)[number],
  year: number,
): string {
  return `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY${String(year)}.json`;
}

export function isPersonalFinancialScreenCriteria(
  value: unknown,
): value is PersonalFinancialScreenCriteriaDto {
  return (
    keysWithRevenueBasis(value, [
      "calendarYear",
      "identityText",
      "clauses",
      "sort",
    ]) &&
    integer(value.calendarYear, 2009, new Date().getUTCFullYear() - 1) &&
    typeof value.identityText === "string" &&
    value.identityText === value.identityText.trim().normalize("NFC") &&
    [...value.identityText].length <= 120 &&
    !forbiddenText.test(value.identityText) &&
    Array.isArray(value.clauses) &&
    value.clauses.length <= 7 &&
    value.clauses.every(
      (clause) =>
        keys(clause, ["field", "operator", "value"]) &&
        member(metrics, clause.field) &&
        member(["gte", "lte"], clause.operator) &&
        decimal(clause.value),
    ) &&
    keys(value.sort, ["field", "direction"]) &&
    member(["symbol", ...metrics], value.sort.field) &&
    member(["asc", "desc"], value.sort.direction)
  );
}

export async function screenPersonalFinancials(
  input: PersonalFinancialScreenRequestDto,
  signal: AbortSignal,
): Promise<PersonalFinancialScreenResponseDto> {
  if (
    !keys(input, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "financialSnapshotSha256",
      "criteria",
      "page",
      "refresh",
    ]) ||
    input.schemaVersion !== "1.0.0" ||
    !sha(input.catalogSnapshotSha256) ||
    (input.financialSnapshotSha256 !== null &&
      !sha(input.financialSnapshotSha256)) ||
    !isPersonalFinancialScreenCriteria(input.criteria) ||
    !keys(input.page, ["offset", "limit"]) ||
    !integer(input.page.offset, 0, 10_000) ||
    !integer(input.page.limit, 1, 250) ||
    typeof input.refresh !== "boolean" ||
    (input.refresh &&
      (input.page.offset !== 0 || input.financialSnapshotSha256 !== null)) ||
    (input.page.offset > 0 && input.financialSnapshotSha256 === null)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const response = await requestPersonalWorkspace(
    PERSONAL_FINANCIAL_SCREEN_PATH,
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
  if (!response.ok) throw await responseError(response);
  const value = await readJson(response);
  if (
    !isResponse(value) ||
    value.catalogSnapshotSha256 !== input.catalogSnapshotSha256 ||
    value.calendarYear !== input.criteria.calendarYear ||
    (value.revenueBasis ?? "agreement") !==
      (input.criteria.revenueBasis ?? "agreement") ||
    value.offset !== input.page.offset ||
    value.limitApplied !== input.page.limit ||
    (input.financialSnapshotSha256 !== null &&
      value.financialSnapshotSha256 !== input.financialSnapshotSha256)
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return value;
}

export async function fetchPersonalFinancialSavedViews(
  signal: AbortSignal,
): Promise<PersonalFinancialSavedViews | null> {
  const response = await requestPersonalWorkspace(
    PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    { method: "GET", headers: { Accept: "application/json" }, signal },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw await responseError(response);
  const value = await readJson(response);
  if (
    !keys(value, [
      "createdAt",
      "id",
      "kind",
      "payload",
      "payloadSha256",
      "profile",
      "updatedAt",
      "version",
    ]) ||
    value.id !== savedId ||
    value.kind !== "settings" ||
    value.profile !== "personal_single_user_local_vault" ||
    !instant(value.createdAt) ||
    !instant(value.updatedAt) ||
    value.updatedAt < value.createdAt ||
    !integer(value.version, 1) ||
    !matches(value.payloadSha256, bareDigest) ||
    !isSavedPayload(value.payload)
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return { version: value.version, payload: value.payload };
}

export async function savePersonalFinancialSavedViews(
  currentVersion: number,
  payload: PersonalFinancialSavedViewsPayloadDto,
  signal: AbortSignal,
): Promise<PersonalFinancialSavedViews> {
  if (
    !integer(currentVersion, 0, Number.MAX_SAFE_INTEGER - 1) ||
    !isSavedPayload(payload)
  )
    throw new PersonalWorkspaceApiError("invalid_request");
  let idempotencyKey: string;
  try {
    idempotencyKey = `financial-screen-${globalThis.crypto.randomUUID()}`;
  } catch {
    throw new PersonalWorkspaceApiError("unavailable");
  }
  const creating = currentVersion === 0;
  const response = await requestPersonalWorkspace(
    PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    {
      method: "POST",
      signal,
      body: JSON.stringify({ payload }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(creating
          ? { "If-None-Match": "*" }
          : { "If-Match": `"v${String(currentVersion)}"` }),
        "X-Research-Cockpit-Idempotency-Key": idempotencyKey,
        "X-Research-Cockpit-Intent": creating
          ? "personal-vault-create"
          : "personal-vault-update",
      },
    },
  );
  if (!response.ok) throw await responseError(response);
  const value = await readJson(response);
  if (
    !keys(value, [
      "committedAt",
      "digestSha256",
      "id",
      "kind",
      "operation",
      "profile",
      "replayed",
      "version",
    ]) ||
    value.id !== savedId ||
    value.kind !== "settings" ||
    value.operation !== "put" ||
    value.profile !== "personal_single_user_local_vault" ||
    !instant(value.committedAt) ||
    !matches(value.digestSha256, bareDigest) ||
    typeof value.replayed !== "boolean" ||
    value.version !== currentVersion + 1 ||
    response.status !== (creating ? 201 : 200)
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return { version: value.version, payload: structuredClone(payload) };
}

function isSavedPayload(
  value: unknown,
): value is PersonalFinancialSavedViewsPayloadDto {
  if (
    !keys(value, ["schemaVersion", "views"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.views) ||
    value.views.length > 20 ||
    !value.views.every(
      (view) =>
        keys(view, [
          "id",
          "name",
          "criteria",
          "createdAgainstCatalogSnapshotSha256",
          "createdAgainstFinancialSnapshotSha256",
        ]) &&
        matches(view.id, identifier) &&
        displayText(view.name, 80) &&
        sha(view.createdAgainstCatalogSnapshotSha256) &&
        sha(view.createdAgainstFinancialSnapshotSha256) &&
        isPersonalFinancialScreenCriteria(view.criteria),
    )
  )
    return false;
  const views = value.views as PersonalFinancialSavedViewsPayloadDto["views"];
  return (
    new Set(views.map((view) => view.id)).size === views.length &&
    new Set(views.map((view) => view.name.toLocaleLowerCase("en-US"))).size ===
      views.length
  );
}

function isResponse(
  value: unknown,
): value is PersonalFinancialScreenResponseDto {
  if (
    !keysWithRevenueBasis(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "financialSnapshotSha256",
      "calendarYear",
      "fetchedAt",
      "expiresAt",
      "sources",
      "rows",
      "totalUniverse",
      "identityMatches",
      "totalMatches",
      "totalNonMatches",
      "totalUnknown",
      "metricCoverage",
      "offset",
      "limitApplied",
      "hasMore",
      "formulaVersion",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    value.formulaVersion !== "1.0.0" ||
    !sha(value.catalogSnapshotSha256) ||
    !sha(value.financialSnapshotSha256) ||
    !integer(value.calendarYear, 2009, new Date().getUTCFullYear() - 1) ||
    !instant(value.fetchedAt) ||
    !instant(value.expiresAt) ||
    value.expiresAt <= value.fetchedAt ||
    !integer(value.totalUniverse, 0, 10_000) ||
    !integer(value.identityMatches, 0, value.totalUniverse) ||
    !integer(value.totalMatches, 0, value.identityMatches) ||
    !integer(value.totalNonMatches, 0, value.identityMatches) ||
    !integer(value.totalUnknown, 0, value.identityMatches) ||
    value.totalMatches + value.totalNonMatches + value.totalUnknown !==
      value.identityMatches ||
    !integer(value.offset, 0, 10_000) ||
    !integer(value.limitApplied, 1, 250) ||
    typeof value.hasMore !== "boolean" ||
    !Array.isArray(value.sources) ||
    value.sources.length !== concepts.length ||
    !keys(value.metricCoverage, metrics) ||
    !Array.isArray(value.rows)
  )
    return false;
  const year = value.calendarYear;
  const count = value.identityMatches;
  const revenueBasis = (value.revenueBasis ??
    "agreement") as PersonalFinancialRevenueBasisDto;
  if (
    !value.sources.every(
      (source) =>
        keys(source, ["concept", "status", "sourceUrl"]) &&
        member(concepts, source.concept) &&
        member(frameStatuses, source.status) &&
        source.sourceUrl === personalFinancialSourceUrl(source.concept, year),
    ) ||
    new Set(
      (value.sources as PersonalFinancialScreenResponseDto["sources"]).map(
        (source) => source.concept,
      ),
    ).size !== concepts.length ||
    !Object.values(value.metricCoverage).every(
      (coverage) =>
        keys(coverage, ["known", "unknown"]) &&
        integer(coverage.known, 0, count) &&
        integer(coverage.unknown, 0, count) &&
        coverage.known + coverage.unknown === count,
    ) ||
    value.rows.length !==
      Math.min(
        value.limitApplied,
        Math.max(0, value.totalMatches - value.offset),
      ) ||
    value.hasMore !== value.offset + value.rows.length < value.totalMatches ||
    !value.rows.every(
      (row) =>
        keys(row, ["identity", "metrics"]) &&
        identity(row.identity) &&
        keys(row.metrics, metrics) &&
        metrics.every((metric) =>
          cell(
            (row.metrics as Record<string, unknown>)[metric],
            metric.endsWith("Margin") ? "percent" : "USD",
          ),
        ) &&
        selectedRevenueSources(
          row.metrics as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
          revenueBasis,
        ),
    ) ||
    new Set(
      (value.rows as PersonalFinancialScreenResponseDto["rows"]).map(
        (row) => row.identity.listingId,
      ),
    ).size !== value.rows.length
  )
    return false;
  return true;
}

function keysWithRevenueBasis(
  value: unknown,
  required: readonly string[],
): value is Record<string, unknown> {
  return (
    (keys(value, required) || keys(value, [...required, "revenueBasis"])) &&
    (!Object.hasOwn(value, "revenueBasis") ||
      member(revenueBases, value.revenueBasis))
  );
}

function selectedRevenueSources(
  cells: PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
  basis: PersonalFinancialRevenueBasisDto,
): boolean {
  if (basis === "agreement") return true;
  if (!cells.revenue.sources.every((source) => source.concept === basis))
    return false;
  return (
    [
      ["netMargin", "NetIncomeLoss", "netIncome"],
      ["operatingMargin", "OperatingIncomeLoss", "operatingIncome"],
      [
        "operatingCashFlowMargin",
        "NetCashProvidedByUsedInOperatingActivities",
        "operatingCashFlow",
      ],
    ] as const
  ).every(([metric, numerator, numeratorMetric]) => {
    const cell = cells[metric];
    return (
      cell.sources.every(
        (source) => source.concept === basis || source.concept === numerator,
      ) &&
      (cell.status !== "available" ||
        (cells.revenue.status === "available" &&
          cells[numeratorMetric].status === "available" &&
          cell.sources.some((source) => source.concept === basis) &&
          cell.sources.some((source) => source.concept === numerator)))
    );
  });
}

function identity(value: unknown): boolean {
  return (
    keys(value, [
      "cik",
      "country",
      "exchangeMic",
      "instrumentType",
      "issuerId",
      "issuerName",
      "listingId",
      "securityId",
      "securityName",
      "shareClassId",
      "shareClassName",
      "symbol",
    ]) &&
    matches(value.cik, /^[0-9]{10}$/u) &&
    value.country === "US" &&
    matches(value.exchangeMic, /^[A-Z0-9]{4}$/u) &&
    member(["adr", "common_stock"], value.instrumentType) &&
    matches(value.symbol, /^[A-Z0-9][A-Z0-9.-]{0,31}$/u) &&
    [
      value.issuerId,
      value.listingId,
      value.securityId,
      value.shareClassId,
    ].every((id) => matches(id, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)) &&
    [value.issuerName, value.securityName, value.shareClassName].every(
      (name) =>
        typeof name === "string" &&
        name.length > 0 &&
        [...name].length <= 500 &&
        !forbiddenText.test(name),
    )
  );
}

function cell(value: unknown, unit: "USD" | "percent"): boolean {
  if (
    !keys(value, ["status", "value", "unit", "sources"]) &&
    !keys(value, ["status", "reason", "unit", "sources"])
  )
    return false;
  if (
    value.unit !== unit ||
    !Array.isArray(value.sources) ||
    value.sources.length > 6 ||
    !value.sources.every(
      (source) =>
        keys(source, [
          "concept",
          "accessionNumber",
          "startDate",
          "endDate",
          "value",
        ]) &&
        member(concepts, source.concept) &&
        matches(source.accessionNumber, /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u) &&
        date(source.startDate) &&
        date(source.endDate) &&
        source.endDate > source.startDate &&
        decimal(source.value),
    )
  )
    return false;
  return (
    (value.status === "available" &&
      "value" in value &&
      decimal(value.value, 130) &&
      value.sources.length >= 1) ||
    (value.status === "unavailable" &&
      "reason" in value &&
      member(unavailableReasons, value.reason))
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
}

async function responseError(
  response: Response,
): Promise<PersonalWorkspaceApiError> {
  if (response.status === 401 || response.status === 403)
    return new PersonalWorkspaceApiError("session_unavailable");
  if (response.status === 409) return new PersonalWorkspaceApiError("conflict");
  if (response.status === 400)
    return new PersonalWorkspaceApiError("invalid_request");
  if (response.status === 429)
    return new PersonalWorkspaceApiError("rate_limited");
  if (response.status === 502)
    return new PersonalWorkspaceApiError("provider_unavailable");
  if (response.status === 503) {
    try {
      const problem: unknown = await response.json();
      if (
        typeof problem === "object" &&
        problem !== null &&
        "code" in problem &&
        problem.code === "not_configured"
      )
        return new PersonalWorkspaceApiError("not_configured");
    } catch {
      /* A malformed problem must not be displayed. */
    }
  }
  return new PersonalWorkspaceApiError("unavailable");
}

function keys<const T extends readonly string[]>(
  value: unknown,
  expected: T,
): value is Record<T[number], unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function member<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}
function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
function sha(value: unknown): value is `sha256:${string}` {
  return matches(value, digest);
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
function decimal(value: unknown, maximumLength = 64): value is string {
  return (
    typeof value === "string" &&
    value.length <= maximumLength &&
    /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value) &&
    Number.isFinite(Number(value))
  );
}
function displayText(value: unknown, limit: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim().normalize("NFC") &&
    [...value].length <= limit &&
    !forbiddenText.test(value)
  );
}
function date(value: unknown): value is string {
  return (
    matches(value, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}
function instant(value: unknown): value is string {
  return (
    matches(
      value,
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
