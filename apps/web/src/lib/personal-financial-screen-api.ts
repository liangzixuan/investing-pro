import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  PERSONAL_SEC_INSTANT_CONCEPTS,
  PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS,
  PERSONAL_FINANCIAL_SCREEN_WATCHLIST_LIMIT,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenAnnualCellDto,
  type PersonalFinancialScreenGrowthCellDto,
  type PersonalFinancialScreenInstantCellDto,
  type PersonalFinancialScreenInstantMetricDto,
  type PersonalFinancialScreenInstantSourceRefDto,
  type PersonalSecFinancialConceptDto,
  type PersonalFinancialScreenCriteriaDto,
  type PersonalFinancialScreenMetricDto,
  type PersonalFinancialScreenRequestDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialScreenSourceRefDto,
  type PersonalFinancialScreenWatchlistScopeDto,
  type PersonalFinancialScreenWatchlistResponseScopeDto,
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
const revenueConcepts = revenueBases.filter((basis) => basis !== "agreement");
const concepts = PERSONAL_SEC_ANNUAL_CONCEPTS;
const instantConcepts = PERSONAL_SEC_INSTANT_CONCEPTS;
const allConcepts = [...concepts, ...instantConcepts];
const percentMetrics: readonly PersonalFinancialScreenMetricDto[] = [
  "netMargin",
  "operatingMargin",
  "operatingCashFlowMargin",
  "grossMargin",
  "operatingCashFlowToNetIncome",
  "operatingCashFlowLessPpePurchasesMargin",
];
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
  "nonpositive_net_income",
  "source_unavailable",
  "invalid_value",
  "filing_mismatch",
  "unsupported_sign",
];
const digest = /^sha256:[a-f0-9]{64}$/u;
const bareDigest = /^[a-f0-9]{64}$/u;
const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const listingIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const forbiddenText = /[\p{Cc}\p{Cf}\p{Cs}]/u;

export interface PersonalFinancialSavedViews {
  readonly version: number;
  readonly payload: PersonalFinancialSavedViewsPayloadDto;
}

/** The provider link is reconstructed from an admitted concept/year, never arbitrary upstream text. */
export function personalFinancialSourceUrl(
  concept: PersonalSecFinancialConceptDto,
  year: number,
): string {
  const period = member(instantConcepts, concept) ? "Q4I" : "";
  return `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY${String(year)}${period}.json`;
}

/** Narrow only already-decoded references, preserving the annual payload shape. */
export function isPersonalFinancialInstantSource(
  source:
    | PersonalFinancialScreenSourceRefDto
    | PersonalFinancialScreenInstantSourceRefDto,
): source is PersonalFinancialScreenInstantSourceRefDto {
  return member(instantConcepts, source.concept);
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
    !keysWithOptionalScope(input, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "financialSnapshotSha256",
      "criteria",
      "page",
      "refresh",
    ]) ||
    input.schemaVersion !== "9.0.0" ||
    (Object.hasOwn(input, "scope") && !watchlistScope(input.scope)) ||
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
  // Bind the response to the selection sent, even if its caller later edits an array.
  const requestedScope = input.scope && {
    ...input.scope,
    listingIds: [...input.scope.listingIds],
  };
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
    !sameWatchlistScope(value.scope, requestedScope) ||
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

function watchlistScopeFields(value: Record<string, unknown>): boolean {
  return (
    value.kind === "watchlist" &&
    integer(value.watchlistVersion, 1) &&
    Array.isArray(value.listingIds) &&
    value.listingIds.length >= 1 &&
    value.listingIds.length <= PERSONAL_FINANCIAL_SCREEN_WATCHLIST_LIMIT &&
    Array.from(value.listingIds).every((id) =>
      matches(id, listingIdentifier),
    ) &&
    new Set(value.listingIds).size === value.listingIds.length
  );
}

function watchlistScope(
  value: unknown,
): value is PersonalFinancialScreenWatchlistScopeDto {
  return (
    keys(value, ["kind", "watchlistVersion", "listingIds"]) &&
    watchlistScopeFields(value)
  );
}

function watchlistResponseScope(
  value: unknown,
): value is PersonalFinancialScreenWatchlistResponseScopeDto {
  return (
    keys(value, [
      "kind",
      "watchlistVersion",
      "listingIds",
      "totalWatchlistListings",
    ]) &&
    watchlistScopeFields(value) &&
    integer(
      value.totalWatchlistListings,
      (value.listingIds as readonly string[]).length,
      10_000,
    )
  );
}

function sameWatchlistScope(
  response: PersonalFinancialScreenWatchlistResponseScopeDto | undefined,
  request: PersonalFinancialScreenWatchlistScopeDto | undefined,
): boolean {
  if (!request) return response === undefined;
  return (
    response !== undefined &&
    response.watchlistVersion === request.watchlistVersion &&
    response.listingIds.length === request.listingIds.length &&
    response.listingIds.every((id, index) => id === request.listingIds[index])
  );
}

function isResponse(
  value: unknown,
): value is PersonalFinancialScreenResponseDto {
  if (
    !keysWithRevenueBasis(
      value,
      [
        "schemaVersion",
        "catalogSnapshotSha256",
        "financialSnapshotSha256",
        "calendarYear",
        "priorCalendarYear",
        "instantQuarter",
        "fetchedAt",
        "expiresAt",
        "sources",
        "priorRevenueSources",
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
      ],
      true,
    ) ||
    value.schemaVersion !== "9.0.0" ||
    (Object.hasOwn(value, "scope") &&
      (!watchlistResponseScope(value.scope) ||
        value.totalUniverse !== value.scope.listingIds.length)) ||
    value.formulaVersion !== "1.7.0" ||
    value.instantQuarter !== 4 ||
    !sha(value.catalogSnapshotSha256) ||
    !sha(value.financialSnapshotSha256) ||
    !integer(value.calendarYear, 2009, new Date().getUTCFullYear() - 1) ||
    value.priorCalendarYear !== value.calendarYear - 1 ||
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
    value.sources.length !== allConcepts.length ||
    !Array.isArray(value.priorRevenueSources) ||
    value.priorRevenueSources.length !== revenueConcepts.length ||
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
        member(allConcepts, source.concept) &&
        member(frameStatuses, source.status) &&
        source.sourceUrl === personalFinancialSourceUrl(source.concept, year),
    ) ||
    new Set(
      (value.sources as PersonalFinancialScreenResponseDto["sources"]).map(
        (source) => source.concept,
      ),
    ).size !== allConcepts.length ||
    !value.priorRevenueSources.every(
      (source) =>
        keys(source, ["concept", "status", "sourceUrl"]) &&
        member(revenueConcepts, source.concept) &&
        member(frameStatuses, source.status) &&
        source.sourceUrl ===
          personalFinancialSourceUrl(source.concept, year - 1),
    ) ||
    new Set(
      (
        value.priorRevenueSources as PersonalFinancialScreenResponseDto["priorRevenueSources"]
      ).map((source) => source.concept),
    ).size !== revenueConcepts.length ||
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
        (!value.scope ||
          (
            value.scope as PersonalFinancialScreenWatchlistResponseScopeDto
          ).listingIds.includes(
            (row.identity as { listingId: string }).listingId,
          )) &&
        keys(row.metrics, metrics) &&
        metrics.every(
          (metric) =>
            metric === "revenueGrowth" ||
            cell(
              (row.metrics as Record<string, unknown>)[metric],
              metric,
              year,
              value.sources as PersonalFinancialScreenResponseDto["sources"],
            ),
        ) &&
        revenueGrowth(
          row.metrics as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
          year,
          revenueBasis,
          value.sources as PersonalFinancialScreenResponseDto["sources"],
          value.priorRevenueSources as PersonalFinancialScreenResponseDto["priorRevenueSources"],
        ) &&
        currentAssetsToLiabilities(
          row.metrics as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
        ) &&
        currentAssetsLessLiabilities(
          row.metrics as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
        ) &&
        cashFlowLessPpe(
          row.metrics as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
        ) &&
        cashFlowLessPpeMargin(
          row.metrics as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
        ) &&
        grossProfitRatio(
          row.metrics as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
        ) &&
        operatingCashFlowToNetIncome(
          row.metrics as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
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
  allowScope = false,
): value is Record<string, unknown> {
  const admittedKeys = allowScope ? keysWithOptionalScope : keys;
  return (
    (admittedKeys(value, required) ||
      admittedKeys(value, [...required, "revenueBasis"])) &&
    (!Object.hasOwn(value, "revenueBasis") ||
      member(revenueBases, value.revenueBasis))
  );
}

function keysWithOptionalScope(
  value: unknown,
  required: readonly string[],
): value is Record<string, unknown> {
  return keys(value, required) || keys(value, [...required, "scope"]);
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

function revenueReference(
  value: unknown,
): value is PersonalFinancialScreenSourceRefDto {
  return (
    keys(value, [
      "concept",
      "accessionNumber",
      "startDate",
      "endDate",
      "value",
    ]) &&
    member(revenueConcepts, value.concept) &&
    matches(value.accessionNumber, /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u) &&
    date(value.startDate) &&
    date(value.endDate) &&
    value.endDate >= value.startDate &&
    decimal(value.value)
  );
}

/** Reconstruct a reported revenue operand from its references and the selected source statuses. */
function revenueOperand(
  value: unknown,
  basis: PersonalFinancialRevenueBasisDto,
  statuses: PersonalFinancialScreenResponseDto["sources"],
): value is PersonalFinancialScreenAnnualCellDto {
  if (
    (!keys(value, ["status", "value", "unit", "sources"]) &&
      !keys(value, ["status", "reason", "unit", "sources"])) ||
    value.unit !== "USD" ||
    !Array.isArray(value.sources) ||
    value.sources.length > 6 ||
    !value.sources.every(revenueReference)
  )
    return false;
  const selected = basis === "agreement" ? revenueConcepts : [basis];
  const refs = value.sources;
  if (
    !refs.every(
      (ref) =>
        member(selected, ref.concept) &&
        statuses.some(
          (source) =>
            source.concept === ref.concept && source.status === "available",
        ),
    )
  )
    return false;
  const failed = selected.some((concept) => {
    const status = statuses.find(
      (source) => source.concept === concept,
    )?.status;
    return status !== "available" && status !== "not_covered";
  });
  if (failed)
    return (
      value.status === "unavailable" &&
      "reason" in value &&
      value.reason === "source_unavailable"
    );
  if (value.status === "available") {
    if (!("value" in value) || !decimal(value.value) || refs.length === 0)
      return false;
    const reportedValue = value.value;
    return refs.every(
      (ref) =>
        normalizedDecimal(ref.value) === normalizedDecimal(reportedValue) &&
        ref.startDate === refs[0]!.startDate &&
        ref.endDate === refs[0]!.endDate,
    );
  }
  if (value.status !== "unavailable" || !("reason" in value)) return false;
  if (value.reason === "missing") return refs.length === 0;
  // Quarantined CIKs may have no retained references, or agreeing retained references.
  // An invalid decimal cannot be justified by references admitted through this strict boundary.
  return (
    value.reason === "conflicting" &&
    selected.some((concept) =>
      statuses.some(
        (source) => source.concept === concept && source.status === "available",
      ),
    )
  );
}

function annualSourceKey(source: PersonalFinancialScreenSourceRefDto): string {
  return JSON.stringify([
    source.concept,
    source.accessionNumber,
    source.startDate,
    source.endDate,
    source.value,
  ]);
}

function sameSourceMultiset<T>(
  left: readonly T[],
  right: readonly T[],
  key: (value: T) => string,
): boolean {
  const expected = left.map(key).sort(),
    actual = right.map(key).sort();
  return (
    expected.length === actual.length &&
    expected.every((entry, index) => entry === actual[index])
  );
}

/** Bind both years and source roles before independently computing the selected-revenue change. */
function revenueGrowth(
  cells: PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
  year: number,
  basis: PersonalFinancialRevenueBasisDto,
  currentStatuses: PersonalFinancialScreenResponseDto["sources"],
  priorStatuses: PersonalFinancialScreenResponseDto["priorRevenueSources"],
): boolean {
  const value: unknown = cells.revenueGrowth;
  const common = ["unit", "currentRevenue", "priorRevenue", "sources"];
  if (
    (!keys(value, [...common, "status", "value"]) &&
      !keys(value, [...common, "status", "reason"])) ||
    value.unit !== "percent" ||
    !revenueOperand(value.currentRevenue, basis, currentStatuses) ||
    !revenueOperand(value.priorRevenue, basis, priorStatuses) ||
    !Array.isArray(value.sources) ||
    value.sources.length > 12 ||
    !value.sources.every((source) => {
      if (
        !keys(source, [
          "concept",
          "accessionNumber",
          "startDate",
          "endDate",
          "value",
          "role",
          "calendarYear",
        ]) ||
        !member(["current_revenue", "prior_revenue"], source.role) ||
        source.calendarYear !==
          (source.role === "current_revenue" ? year : year - 1)
      )
        return false;
      return revenueReference({
        concept: source.concept,
        accessionNumber: source.accessionNumber,
        startDate: source.startDate,
        endDate: source.endDate,
        value: source.value,
      });
    }) ||
    !(
      (value.status === "available" &&
        "value" in value &&
        decimal(value.value, 131)) ||
      (value.status === "unavailable" &&
        "reason" in value &&
        member(
          [
            "prior_unavailable",
            "current_unavailable",
            "period_mismatch",
            "concept_set_changed",
            "nonadjacent_periods",
            "nonpositive_prior_revenue",
            "filing_mismatch",
          ],
          value.reason,
        ))
    )
  )
    return false;
  const growth = value as unknown as PersonalFinancialScreenGrowthCellDto;
  const current = growth.currentRevenue,
    prior = growth.priorRevenue,
    reported = cells.revenue;
  if (
    current.status !== reported.status ||
    current.unit !== reported.unit ||
    (current.status === "available" &&
      (reported.status !== "available" || current.value !== reported.value)) ||
    (current.status === "unavailable" &&
      (reported.status !== "unavailable" ||
        current.reason !== reported.reason)) ||
    !sameSourceMultiset(current.sources, reported.sources, annualSourceKey)
  )
    return false;
  const tagged = (
    operand: PersonalFinancialScreenAnnualCellDto,
    role: "current_revenue" | "prior_revenue",
    calendarYear: number,
  ) => operand.sources.map((source) => ({ ...source, role, calendarYear }));
  const expected = [
    ...tagged(current, "current_revenue", year),
    ...tagged(prior, "prior_revenue", year - 1),
  ];
  const roleKey = (
    source: PersonalFinancialScreenSourceRefDto & {
      role: string;
      calendarYear: number;
    },
  ) =>
    JSON.stringify([source.role, source.calendarYear, annualSourceKey(source)]);
  if (!sameSourceMultiset(expected, growth.sources, roleKey)) return false;
  const unknown = (
    reason: Extract<
      PersonalFinancialScreenGrowthCellDto,
      { status: "unavailable" }
    >["reason"],
  ) => growth.status === "unavailable" && growth.reason === reason;
  if (prior.status === "unavailable") return unknown("prior_unavailable");
  if (current.status === "unavailable") return unknown("current_unavailable");
  if (
    expected.some((source) => {
      const days =
        (Date.parse(source.endDate) - Date.parse(source.startDate)) /
          86_400_000 +
        1;
      return (
        days < 335 ||
        days > 395 ||
        Math.abs(Number(source.endDate.slice(0, 4)) - source.calendarYear) > 1
      );
    })
  )
    return unknown("period_mismatch");
  const conceptSet = (operand: PersonalFinancialScreenAnnualCellDto) =>
    [...new Set(operand.sources.map((source) => source.concept))]
      .sort()
      .join("|");
  if (conceptSet(current) !== conceptSet(prior))
    return unknown("concept_set_changed");
  if (
    current.sources.some((c) =>
      prior.sources.some(
        (p) => Date.parse(c.startDate) - Date.parse(p.endDate) !== 86_400_000,
      ),
    )
  )
    return unknown("nonadjacent_periods");
  const c = scaledDecimal(current.value),
    p = scaledDecimal(prior.value);
  if (p.coefficient <= 0n) return unknown("nonpositive_prior_revenue");
  if (
    [current, prior].some((operand) =>
      operand.sources.some(
        (source) =>
          source.accessionNumber !== operand.sources[0]!.accessionNumber,
      ),
    )
  )
    return unknown("filing_mismatch");
  const scale = Math.max(c.scale, p.scale);
  const denominator = p.coefficient * 10n ** BigInt(scale - p.scale);
  const numerator =
    (c.coefficient * 10n ** BigInt(scale - c.scale) - denominator) * 10_000n;
  const magnitude = numerator < 0n ? -numerator : numerator;
  const rounded =
    magnitude / denominator +
    (2n * (magnitude % denominator) >= denominator ? 1n : 0n);
  const expectedValue = `${numerator < 0n && rounded !== 0n ? "-" : ""}${String(rounded / 100n)}.${String(rounded % 100n).padStart(2, "0")}`;
  return growth.status === "available" && growth.value === expectedValue;
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

function cell(
  value: unknown,
  metric: PersonalFinancialScreenMetricDto,
  year: number,
  sourceStatuses: PersonalFinancialScreenResponseDto["sources"],
): boolean {
  if (member(PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS, metric))
    return instantCell(value, metric, year, sourceStatuses);
  const unit = percentMetrics.includes(metric) ? "percent" : "USD";
  const cashMargin = metric === "operatingCashFlowLessPpePurchasesMargin";
  const exactRatio =
    metric === "grossMargin" ||
    metric === "operatingCashFlowToNetIncome" ||
    cashMargin;
  if (
    !keys(value, ["status", "value", "unit", "sources"]) &&
    !keys(value, ["status", "reason", "unit", "sources"])
  )
    return false;
  if (
    value.unit !== unit ||
    !Array.isArray(value.sources) ||
    value.sources.length > (cashMargin ? 18 : exactRatio ? 12 : 6) ||
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
        admittedSource(metric, source.concept) &&
        matches(source.accessionNumber, /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u) &&
        date(source.startDate) &&
        date(source.endDate) &&
        source.endDate > source.startDate &&
        decimal(source.value),
    )
  )
    return false;
  const valid =
    (value.status === "available" &&
      "value" in value &&
      decimal(value.value, cashMargin ? 133 : exactRatio ? 131 : 130) &&
      value.sources.length >= 1) ||
    (value.status === "unavailable" &&
      "reason" in value &&
      member(unavailableReasons, value.reason) &&
      (value.reason !== "nonpositive_net_income" ||
        metric === "operatingCashFlowToNetIncome") &&
      (metric === "operatingCashFlowLessPpePurchases" ||
        cashMargin ||
        (exactRatio && value.reason === "filing_mismatch") ||
        !["filing_mismatch", "unsupported_sign"].includes(value.reason)));
  if (
    !valid ||
    !["grossProfit", "ppePurchases", "operatingCashFlow"].includes(metric)
  )
    return valid;
  const reported = value as unknown as PersonalFinancialScreenAnnualCellDto;
  if (reported.status === "unavailable")
    return [
      "missing",
      "conflicting",
      "source_unavailable",
      "invalid_value",
    ].includes(reported.reason);
  const first = reported.sources[0]!;
  return reported.sources.every(
    (source) =>
      normalizedDecimal(source.value) === normalizedDecimal(reported.value) &&
      source.startDate === first.startDate &&
      source.endDate === first.endDate,
  );
}

function instantCell(
  value: unknown,
  metric: PersonalFinancialScreenInstantMetricDto,
  year: number,
  sourceStatuses: PersonalFinancialScreenResponseDto["sources"],
): boolean {
  const ratio = metric === "currentRatio";
  const difference = metric === "currentAssetsLessCurrentLiabilities";
  const derived = ratio || difference;
  if (
    (!keys(value, ["status", "value", "unit", "sources"]) &&
      !keys(value, ["status", "reason", "unit", "sources"])) ||
    value.unit !== (ratio ? "multiple" : "USD") ||
    !Array.isArray(value.sources) ||
    value.sources.length > (derived ? 12 : 6) ||
    !value.sources.every(
      (source) =>
        keys(source, ["concept", "accessionNumber", "asOfDate", "value"]) &&
        member(instantConcepts, source.concept) &&
        (derived ||
          source.concept ===
            (metric === "currentAssets"
              ? "AssetsCurrent"
              : "LiabilitiesCurrent")) &&
        matches(source.accessionNumber, /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u) &&
        date(source.asOfDate) &&
        Math.abs(Number(source.asOfDate.slice(0, 4)) - year) <= 1 &&
        decimal(source.value),
    )
  )
    return false;
  if (!derived) {
    const concept =
      metric === "currentAssets" ? "AssetsCurrent" : "LiabilitiesCurrent";
    const frameStatus = sourceStatuses.find(
      (source) => source.concept === concept,
    )?.status;
    if (frameStatus !== "available")
      return (
        value.status === "unavailable" &&
        "reason" in value &&
        value.reason ===
          (frameStatus === "not_covered" ? "missing" : "source_unavailable") &&
        value.sources.length === 0
      );
    if (
      value.status === "unavailable" &&
      "reason" in value &&
      value.reason === "source_unavailable"
    )
      return false;
  }
  if (value.status === "available") {
    if (
      !("value" in value) ||
      !decimal(value.value, ratio ? 129 : difference ? 128 : 64) ||
      value.sources.length === 0
    )
      return false;
    const reportedValue = value.value;
    if (derived) return true; // Independently bound to both reported operands below.
    const sources =
      value.sources as unknown as readonly PersonalFinancialScreenInstantSourceRefDto[];
    return sources.every(
      (source) =>
        normalizedDecimal(source.value) === normalizedDecimal(reportedValue) &&
        source.asOfDate === sources[0]!.asOfDate &&
        supportedBalanceDate(source.asOfDate, year),
    );
  }
  if (
    value.status !== "unavailable" ||
    !("reason" in value) ||
    !member(
      [
        "missing",
        "conflicting",
        "source_unavailable",
        "invalid_value",
        "unsupported_balance_date",
        ...(derived
          ? [
              "balance_date_mismatch",
              "filing_mismatch",
              "unsupported_sign",
              ...(ratio ? ["nonpositive_current_liabilities"] : []),
            ]
          : []),
      ],
      value.reason,
    )
  )
    return false;
  if (derived) return true;
  // Invalid reported decimal references cannot cross this decoder's strict source boundary.
  if (value.reason === "invalid_value") return false;
  const sources =
    value.sources as unknown as readonly PersonalFinancialScreenInstantSourceRefDto[];
  if (value.reason === "missing" || value.reason === "source_unavailable")
    return sources.length === 0;
  if (value.reason === "unsupported_balance_date") {
    const first = sources[0];
    return (
      first !== undefined &&
      !supportedBalanceDate(first.asOfDate, year) &&
      sources.every(
        (source) =>
          source.asOfDate === first.asOfDate &&
          normalizedDecimal(source.value) === normalizedDecimal(first.value),
      )
    );
  }
  // A quarantined CIK can conflict even when its retained references agree or are empty.
  return true;
}

function supportedBalanceDate(asOfDate: string, year: number): boolean {
  return (
    asOfDate >= `${String(year)}-10-01` && asOfDate <= `${String(year)}-12-31`
  );
}

/** Verify source multiplicity and the ratio independently of the server's decimal library. */
function currentAssetsToLiabilities(
  cells: PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
): boolean {
  const assets = cells.currentAssets;
  const liabilities = cells.currentLiabilities;
  const ratio = cells.currentRatio;
  const sources = [...assets.sources, ...liabilities.sources];
  const sourceKey = (source: PersonalFinancialScreenInstantSourceRefDto) =>
    JSON.stringify([
      source.concept,
      source.asOfDate,
      source.accessionNumber,
      source.value,
    ]);
  const expected = sources.map(sourceKey).sort();
  const actual = ratio.sources.map(sourceKey).sort();
  if (
    expected.length !== actual.length ||
    expected.some((key, index) => key !== actual[index])
  )
    return false;
  const unknown = (
    reason: Extract<
      PersonalFinancialScreenInstantCellDto,
      { status: "unavailable" }
    >["reason"],
  ) => ratio.status === "unavailable" && ratio.reason === reason;
  if (liabilities.status === "unavailable") return unknown(liabilities.reason);
  if (assets.status === "unavailable") return unknown(assets.reason);
  const first = sources[0]!;
  if (sources.some((source) => source.asOfDate !== first.asOfDate))
    return unknown("balance_date_mismatch");
  if (
    sources.some((source) => source.accessionNumber !== first.accessionNumber)
  )
    return unknown("filing_mismatch");
  const denominator = scaledDecimal(liabilities.value);
  const numerator = scaledDecimal(assets.value);
  if (denominator.coefficient <= 0n)
    return unknown("nonpositive_current_liabilities");
  if (numerator.coefficient < 0n) return unknown("unsupported_sign");
  // Multiple hundredths = assets / liabilities * 100; no percentage conversion.
  const dividend =
    numerator.coefficient * 10n ** BigInt(denominator.scale) * 100n;
  const divisor = denominator.coefficient * 10n ** BigInt(numerator.scale);
  const rounded =
    dividend / divisor + (2n * (dividend % divisor) >= divisor ? 1n : 0n);
  const expectedValue = `${String(rounded / 100n)}.${String(rounded % 100n).padStart(2, "0")}`;
  return ratio.status === "available" && ratio.value === expectedValue;
}

/** Recompute the signed balance difference from complete operands using integer scales. */
function currentAssetsLessLiabilities(
  cells: PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
): boolean {
  const assets = cells.currentAssets;
  const liabilities = cells.currentLiabilities;
  const difference = cells.currentAssetsLessCurrentLiabilities;
  const sources = [...assets.sources, ...liabilities.sources];
  const sourceKey = (source: PersonalFinancialScreenInstantSourceRefDto) =>
    JSON.stringify([
      source.concept,
      source.asOfDate,
      source.accessionNumber,
      source.value,
    ]);
  if (!sameSourceMultiset(sources, difference.sources, sourceKey)) return false;
  const unknown = (reason: string) =>
    difference.status === "unavailable" && difference.reason === reason;
  if (assets.status === "unavailable") return unknown(assets.reason);
  if (liabilities.status === "unavailable") return unknown(liabilities.reason);
  const first = sources[0]!;
  if (sources.some((source) => source.asOfDate !== first.asOfDate))
    return unknown("balance_date_mismatch");
  if (
    sources.some((source) => source.accessionNumber !== first.accessionNumber)
  )
    return unknown("filing_mismatch");
  const left = scaledDecimal(assets.value);
  const right = scaledDecimal(liabilities.value);
  if (left.coefficient < 0n || right.coefficient < 0n)
    return unknown("unsupported_sign");
  if (
    difference.status !== "available" ||
    normalizedDecimal(difference.value) !== difference.value
  )
    return false;
  const result = scaledDecimal(difference.value);
  const scale = Math.max(left.scale, right.scale, result.scale);
  return (
    left.coefficient * 10n ** BigInt(scale - left.scale) -
      right.coefficient * 10n ** BigInt(scale - right.scale) ===
    result.coefficient * 10n ** BigInt(scale - result.scale)
  );
}

function admittedSource(
  metric: PersonalFinancialScreenMetricDto,
  concept: (typeof concepts)[number],
): boolean {
  if (metric === "grossProfit") return concept === "GrossProfit";
  if (metric === "grossMargin")
    return concept === "GrossProfit" || member(revenueConcepts, concept);
  if (metric === "operatingCashFlowToNetIncome")
    return (
      concept === "NetCashProvidedByUsedInOperatingActivities" ||
      concept === "NetIncomeLoss"
    );
  if (metric === "ppePurchases")
    return concept === "PaymentsToAcquirePropertyPlantAndEquipment";
  if (metric === "operatingCashFlow")
    return concept === "NetCashProvidedByUsedInOperatingActivities";
  if (metric === "operatingCashFlowLessPpePurchases")
    return (
      concept === "NetCashProvidedByUsedInOperatingActivities" ||
      concept === "PaymentsToAcquirePropertyPlantAndEquipment"
    );
  if (metric === "operatingCashFlowLessPpePurchasesMargin")
    return (
      concept === "NetCashProvidedByUsedInOperatingActivities" ||
      concept === "PaymentsToAcquirePropertyPlantAndEquipment" ||
      member(revenueConcepts, concept)
    );
  return (
    concept !== "GrossProfit" &&
    concept !== "PaymentsToAcquirePropertyPlantAndEquipment"
  );
}

/** Verify the new derived cell against its reported operands, including unknown precedence. */
function cashFlowLessPpe(
  cells: PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
): boolean {
  const operating = cells.operatingCashFlow;
  const purchases = cells.ppePurchases;
  const derived = cells.operatingCashFlowLessPpePurchases;
  const expectedSources = [...operating.sources, ...purchases.sources];
  const sourceKey = (source: PersonalFinancialScreenSourceRefDto) =>
    JSON.stringify([
      source.concept,
      source.accessionNumber,
      source.startDate,
      source.endDate,
      source.value,
    ]);
  const actualKeys = derived.sources.map(sourceKey).sort();
  const expectedKeys = expectedSources.map(sourceKey).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  )
    return false;
  const unknown = (reason: string) =>
    derived.status === "unavailable" && derived.reason === reason;
  if (operating.status === "unavailable") return unknown(operating.reason);
  if (purchases.status === "unavailable") return unknown(purchases.reason);
  const first = expectedSources[0]!;
  if (
    expectedSources.some((source) => {
      const days =
        (Date.parse(source.endDate) - Date.parse(source.startDate)) /
          86_400_000 +
        1;
      return (
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        days < 335 ||
        days > 395
      );
    })
  )
    return unknown("period_mismatch");
  if (
    expectedSources.some(
      (source) => source.accessionNumber !== first.accessionNumber,
    )
  )
    return unknown("filing_mismatch");
  if (scaledDecimal(purchases.value).coefficient < 0n)
    return unknown("unsupported_sign");
  if (derived.status !== "available") return false;
  const operands = [operating.value, purchases.value, derived.value].map(
    scaledDecimal,
  );
  const scale = Math.max(...operands.map((operand) => operand.scale));
  const [left, right, result] = operands.map(
    (operand) => operand.coefficient * 10n ** BigInt(scale - operand.scale),
  );
  return left! - right! === result;
}

/** Recompute all three original operands; never divide a rounded intermediate. */
function cashFlowLessPpeMargin(
  cells: PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
): boolean {
  const revenue = cells.revenue;
  const operating = cells.operatingCashFlow;
  const purchases = cells.ppePurchases;
  const ratio = cells.operatingCashFlowLessPpePurchasesMargin;
  const sources = [
    ...operating.sources,
    ...purchases.sources,
    ...revenue.sources,
  ];
  if (!sameSourceMultiset(sources, ratio.sources, annualSourceKey))
    return false;
  const unknown = (reason: string) =>
    ratio.status === "unavailable" && ratio.reason === reason;
  if (revenue.status === "unavailable") return unknown(revenue.reason);
  if (operating.status === "unavailable") return unknown(operating.reason);
  if (purchases.status === "unavailable") return unknown(purchases.reason);
  const first = sources[0]!;
  if (
    sources.some((source) => {
      const days =
        (Date.parse(source.endDate) - Date.parse(source.startDate)) /
          86_400_000 +
        1;
      return (
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        days < 335 ||
        days > 395
      );
    })
  )
    return unknown("period_mismatch");
  if (
    sources.some((source) => source.accessionNumber !== first.accessionNumber)
  )
    return unknown("filing_mismatch");
  const left = scaledDecimal(operating.value);
  const right = scaledDecimal(purchases.value);
  if (right.coefficient < 0n) return unknown("unsupported_sign");
  const denominator = scaledDecimal(revenue.value);
  if (denominator.coefficient <= 0n) return unknown("nonpositive_revenue");
  const scale = Math.max(left.scale, right.scale);
  const difference = {
    coefficient:
      left.coefficient * 10n ** BigInt(scale - left.scale) -
      right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  };
  return (
    ratio.status === "available" &&
    ratio.value === scaledPercentageValue(difference, denominator)
  );
}

/** Check the qualified ratio against both complete operands without floating-point arithmetic. */
function grossProfitRatio(
  cells: PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
): boolean {
  const revenue = cells.revenue;
  const profit = cells.grossProfit;
  const ratio = cells.grossMargin;
  const sources = [...profit.sources, ...revenue.sources];
  const sourceKey = (source: PersonalFinancialScreenSourceRefDto) =>
    JSON.stringify([
      source.concept,
      source.accessionNumber,
      source.startDate,
      source.endDate,
      source.value,
    ]);
  const expected = sources.map(sourceKey).sort();
  const actual = ratio.sources.map(sourceKey).sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index]) ||
    !revenue.sources.every((source) => member(revenueConcepts, source.concept))
  )
    return false;
  const unknown = (reason: string) =>
    ratio.status === "unavailable" && ratio.reason === reason;
  if (revenue.status === "unavailable")
    return (
      [
        "missing",
        "conflicting",
        "source_unavailable",
        "invalid_value",
      ].includes(revenue.reason) && unknown(revenue.reason)
    );
  const firstRevenue = revenue.sources[0]!;
  if (
    !revenue.sources.every(
      (source) =>
        normalizedDecimal(source.value) === normalizedDecimal(revenue.value) &&
        source.startDate === firstRevenue.startDate &&
        source.endDate === firstRevenue.endDate,
    )
  )
    return false;
  if (profit.status === "unavailable") return unknown(profit.reason);
  const first = sources[0]!;
  if (
    sources.some((source) => {
      const days =
        (Date.parse(source.endDate) - Date.parse(source.startDate)) /
          86_400_000 +
        1;
      return (
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        days < 335 ||
        days > 395
      );
    })
  )
    return unknown("period_mismatch");
  if (
    sources.some((source) => source.accessionNumber !== first.accessionNumber)
  )
    return unknown("filing_mismatch");
  const denominator = scaledDecimal(revenue.value);
  if (denominator.coefficient <= 0n) return unknown("nonpositive_revenue");
  if (ratio.status !== "available") return false;
  return ratio.value === percentageValue(profit.value, denominator);
}

/** Net income supplies this denominator independently of the revenue-basis policy. */
function operatingCashFlowToNetIncome(
  cells: PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
): boolean {
  const income = cells.netIncome;
  const operating = cells.operatingCashFlow;
  const ratio = cells.operatingCashFlowToNetIncome;
  const sources = [...operating.sources, ...income.sources];
  const sourceKey = (source: PersonalFinancialScreenSourceRefDto) =>
    JSON.stringify([
      source.concept,
      source.accessionNumber,
      source.startDate,
      source.endDate,
      source.value,
    ]);
  const expected = sources.map(sourceKey).sort();
  const actual = ratio.sources.map(sourceKey).sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index]) ||
    !income.sources.every((source) => source.concept === "NetIncomeLoss")
  )
    return false;
  const unknown = (reason: string) =>
    ratio.status === "unavailable" && ratio.reason === reason;
  if (income.status === "unavailable")
    return (
      [
        "missing",
        "conflicting",
        "source_unavailable",
        "invalid_value",
      ].includes(income.reason) && unknown(income.reason)
    );
  const firstIncome = income.sources[0]!;
  if (
    !income.sources.every(
      (source) =>
        normalizedDecimal(source.value) === normalizedDecimal(income.value) &&
        source.startDate === firstIncome.startDate &&
        source.endDate === firstIncome.endDate,
    )
  )
    return false;
  if (operating.status === "unavailable") return unknown(operating.reason);
  const first = sources[0]!;
  if (
    sources.some((source) => {
      const days =
        (Date.parse(source.endDate) - Date.parse(source.startDate)) /
          86_400_000 +
        1;
      return (
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        days < 335 ||
        days > 395
      );
    })
  )
    return unknown("period_mismatch");
  if (
    sources.some((source) => source.accessionNumber !== first.accessionNumber)
  )
    return unknown("filing_mismatch");
  const denominator = scaledDecimal(income.value);
  if (denominator.coefficient <= 0n) return unknown("nonpositive_net_income");
  return (
    ratio.status === "available" &&
    ratio.value === percentageValue(operating.value, denominator)
  );
}

function percentageValue(
  numeratorValue: string,
  denominator: ReturnType<typeof scaledDecimal>,
): string {
  return scaledPercentageValue(scaledDecimal(numeratorValue), denominator);
}

function scaledPercentageValue(
  numerator: ReturnType<typeof scaledDecimal>,
  denominator: ReturnType<typeof scaledDecimal>,
): string {
  const negative = numerator.coefficient < 0n;
  const magnitude = negative ? -numerator.coefficient : numerator.coefficient;
  // Percentage hundredths = numerator / denominator * 10,000. Round ties away from zero.
  const dividend = magnitude * 10n ** BigInt(denominator.scale) * 10_000n;
  const divisor = denominator.coefficient * 10n ** BigInt(numerator.scale);
  const rounded =
    dividend / divisor + (2n * (dividend % divisor) >= divisor ? 1n : 0n);
  return `${negative && rounded !== 0n ? "-" : ""}${String(
    rounded / 100n,
  )}.${String(rounded % 100n).padStart(2, "0")}`;
}

function scaledDecimal(value: string): { coefficient: bigint; scale: number } {
  const [whole, fraction = ""] = value.split(".");
  return {
    coefficient: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  };
}

function normalizedDecimal(value: string): string {
  const [integerPart, fraction = ""] = value.split(".");
  const significantFraction = fraction.replace(/0+$/u, "");
  return significantFraction.length > 0
    ? `${integerPart}.${significantFraction}`
    : integerPart === "-0"
      ? "0"
      : integerPart!;
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
