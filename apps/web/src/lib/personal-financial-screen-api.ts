import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenCellDto,
  type PersonalFinancialScreenCriteriaDto,
  type PersonalFinancialScreenMetricDto,
  type PersonalFinancialScreenRequestDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialScreenSourceRefDto,
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
const percentMetrics: readonly PersonalFinancialScreenMetricDto[] = [
  "netMargin",
  "operatingMargin",
  "operatingCashFlowMargin",
  "grossMargin",
  "operatingCashFlowToNetIncome",
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
    input.schemaVersion !== "5.0.0" ||
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
    value.schemaVersion !== "5.0.0" ||
    value.formulaVersion !== "1.3.0" ||
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
          cell((row.metrics as Record<string, unknown>)[metric], metric),
        ) &&
        cashFlowLessPpe(
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

function cell(
  value: unknown,
  metric: PersonalFinancialScreenMetricDto,
): boolean {
  const unit = percentMetrics.includes(metric) ? "percent" : "USD";
  const exactRatio =
    metric === "grossMargin" || metric === "operatingCashFlowToNetIncome";
  if (
    !keys(value, ["status", "value", "unit", "sources"]) &&
    !keys(value, ["status", "reason", "unit", "sources"])
  )
    return false;
  if (
    value.unit !== unit ||
    !Array.isArray(value.sources) ||
    value.sources.length > (exactRatio ? 12 : 6) ||
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
      decimal(value.value, exactRatio ? 131 : 130) &&
      value.sources.length >= 1) ||
    (value.status === "unavailable" &&
      "reason" in value &&
      member(unavailableReasons, value.reason) &&
      (value.reason !== "nonpositive_net_income" ||
        metric === "operatingCashFlowToNetIncome") &&
      (metric === "operatingCashFlowLessPpePurchases" ||
        (exactRatio && value.reason === "filing_mismatch") ||
        !["filing_mismatch", "unsupported_sign"].includes(value.reason)));
  if (
    !valid ||
    !["grossProfit", "ppePurchases", "operatingCashFlow"].includes(metric)
  )
    return valid;
  const reported = value as unknown as PersonalFinancialScreenCellDto;
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
  const numerator = scaledDecimal(numeratorValue);
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
