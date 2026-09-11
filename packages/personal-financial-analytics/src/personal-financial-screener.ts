import {
  PERSONAL_FINANCIAL_REVENUE_BASES,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenCellDto,
  type PersonalFinancialScreenCriteriaDto,
  type PersonalFinancialScreenMetricDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialScreenRowDto,
  type PersonalFinancialScreenSourceRefDto,
  type PersonalSecAnnualConceptDto,
  type PersonalSecAnnualFinancialSnapshotDto,
  type PersonalSecAnnualFrameDto,
  type PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

import {
  PERSONAL_FINANCIAL_ANALYTICS_FORMULAS,
  PERSONAL_FINANCIAL_ANALYTICS_FORMULA_SET_VERSION,
  PERSONAL_FINANCIAL_ANALYTICS_ROUNDING,
} from "./personal-financial-analytics";

export const PERSONAL_FINANCIAL_SCREEN_LIMITS = Object.freeze({
  clauses: 7,
  identities: 10_000,
  identityTextCodePoints: 120,
  pageLimit: 250,
  pageOffset: 10_000,
  minimumCalendarYear: 2009,
  maximumCalendarYear: 2100,
});

export const PERSONAL_FINANCIAL_SCREEN_FORMULAS = Object.freeze({
  netMargin: PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.netMargin,
  operatingMargin: PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.operatingMargin,
  operatingCashFlowMargin:
    PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.operatingCashFlowMargin,
});

const METRICS = [
  "revenue",
  "netIncome",
  "operatingIncome",
  "operatingCashFlow",
  "netMargin",
  "operatingMargin",
  "operatingCashFlowMargin",
] as const satisfies readonly PersonalFinancialScreenMetricDto[];

const REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
] as const;
const CONCEPTS = [
  ...REVENUE_CONCEPTS,
  "NetIncomeLoss",
  "OperatingIncomeLoss",
  "NetCashProvidedByUsedInOperatingActivities",
] as const satisfies readonly PersonalSecAnnualConceptDto[];
const FAILED_SOURCE_STATUSES = new Set([
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
]);
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const CIK = /^\d{10}$/u;
const ACCESSION = /^\d{10}-\d{2}-\d{6}$/u;
const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const INVALID_TEXT = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const ScreenDecimal = Decimal.clone({
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -256,
  toExpPos: 256,
});

type UnavailableReason = Extract<
  PersonalFinancialScreenCellDto,
  { status: "unavailable" }
>["reason"];
type FrameIndex = ReadonlyMap<
  PersonalSecAnnualConceptDto,
  {
    readonly status: PersonalSecAnnualFrameDto["status"];
    readonly facts: ReadonlyMap<
      string,
      readonly PersonalFinancialScreenSourceRefDto[]
    >;
    readonly unknownCiks: ReadonlySet<string>;
  }
>;

/** The saved-definition and HTTP boundaries share this closed criteria grammar. */
export function validatePersonalFinancialScreenCriteria(
  value: unknown,
): value is PersonalFinancialScreenCriteriaDto {
  try {
    if (
      !exactRecord(value, [
        "calendarYear",
        "identityText",
        "clauses",
        "sort",
      ]) &&
      !exactRecord(value, [
        "calendarYear",
        "identityText",
        "clauses",
        "sort",
        "revenueBasis",
      ])
    )
      return false;
    if (
      !isCalendarYear(value.calendarYear) ||
      (Object.hasOwn(value, "revenueBasis") &&
        !PERSONAL_FINANCIAL_REVENUE_BASES.some(
          (basis) => basis === value.revenueBasis,
        )) ||
      typeof value.identityText !== "string" ||
      [...value.identityText].length >
        PERSONAL_FINANCIAL_SCREEN_LIMITS.identityTextCodePoints ||
      INVALID_TEXT.test(value.identityText) ||
      !Array.isArray(value.clauses) ||
      value.clauses.length > PERSONAL_FINANCIAL_SCREEN_LIMITS.clauses ||
      !exactRecord(value.sort, ["field", "direction"]) ||
      !(value.sort.field === "symbol" || isMetric(value.sort.field)) ||
      !(value.sort.direction === "asc" || value.sort.direction === "desc")
    )
      return false;
    return value.clauses.every(
      (clause: unknown) =>
        exactRecord(clause, ["field", "operator", "value"]) &&
        isMetric(clause.field) &&
        (clause.operator === "gte" || clause.operator === "lte") &&
        isDecimal(clause.value),
    );
  } catch {
    return false;
  }
}

/** Evaluates one current SEC calendar frame; the frame year is not a fiscal-year label. */
export function evaluatePersonalFinancialScreen(
  identities: readonly PersonalSecurityMasterScreenRowDto[],
  snapshot: PersonalSecAnnualFinancialSnapshotDto,
  criteria: PersonalFinancialScreenCriteriaDto,
  page: Readonly<{ offset: number; limit: number }>,
  catalogSnapshotSha256: `sha256:${string}`,
): PersonalFinancialScreenResponseDto {
  try {
    if (
      !validatePersonalFinancialScreenCriteria(criteria) ||
      !exactRecord(page, ["offset", "limit"]) ||
      !boundedInteger(
        page.offset,
        0,
        PERSONAL_FINANCIAL_SCREEN_LIMITS.pageOffset,
      ) ||
      !boundedInteger(
        page.limit,
        1,
        PERSONAL_FINANCIAL_SCREEN_LIMITS.pageLimit,
      ) ||
      typeof catalogSnapshotSha256 !== "string" ||
      !DIGEST.test(catalogSnapshotSha256) ||
      !Array.isArray(identities) ||
      identities.length > PERSONAL_FINANCIAL_SCREEN_LIMITS.identities ||
      !identities.every(isIdentity) ||
      new Set(identities.map((identity) => identity.listingId)).size !==
        identities.length ||
      !isSnapshot(snapshot) ||
      criteria.calendarYear !== snapshot.calendarYear
    )
      fail();

    const index = indexFrames(snapshot.frames);
    const tokens = normalizeText(criteria.identityText)
      .split(" ")
      .filter(Boolean);
    const coverage = Object.fromEntries(
      METRICS.map((metric) => [metric, { known: 0, unknown: 0 }]),
    ) as Record<
      PersonalFinancialScreenMetricDto,
      { known: number; unknown: number }
    >;
    const matches: PersonalFinancialScreenRowDto[] = [];
    const metricsByCik = new Map<
      string,
      PersonalFinancialScreenRowDto["metrics"]
    >();
    let identityMatches = 0;
    let totalNonMatches = 0;
    let totalUnknown = 0;
    for (const identity of identities) {
      if (!matchesIdentity(identity, tokens)) continue;
      identityMatches += 1;
      let metrics = metricsByCik.get(identity.cik);
      if (metrics === undefined) {
        metrics = buildMetrics(
          identity.cik,
          index,
          criteria.revenueBasis ?? "agreement",
        );
        metricsByCik.set(identity.cik, metrics);
      }
      for (const metric of METRICS) {
        coverage[metric][
          metrics[metric].status === "available" ? "known" : "unknown"
        ] += 1;
      }
      const outcome = evaluateClauses(metrics, criteria);
      if (outcome === "false") totalNonMatches += 1;
      else if (outcome === "unknown") totalUnknown += 1;
      else matches.push({ identity: { ...identity }, metrics });
    }
    matches.sort((left, right) => compareRows(left, right, criteria.sort));
    return {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256,
      financialSnapshotSha256: snapshot.snapshotSha256,
      calendarYear: snapshot.calendarYear,
      ...(criteria.revenueBasis === undefined
        ? {}
        : { revenueBasis: criteria.revenueBasis }),
      fetchedAt: snapshot.fetchedAt,
      expiresAt: snapshot.expiresAt,
      sources: CONCEPTS.map((concept) => {
        const frame = snapshot.frames.find(
          (candidate) => candidate.concept === concept,
        )!;
        return { concept, status: frame.status, sourceUrl: frame.sourceUrl };
      }),
      rows: matches.slice(page.offset, page.offset + page.limit),
      totalUniverse: identities.length,
      identityMatches,
      totalMatches: matches.length,
      totalNonMatches,
      totalUnknown,
      metricCoverage: coverage,
      offset: page.offset,
      limitApplied: page.limit,
      hasMore: page.offset + page.limit < matches.length,
      formulaVersion: PERSONAL_FINANCIAL_ANALYTICS_FORMULA_SET_VERSION,
    };
  } catch {
    return fail();
  }
}

function buildMetrics(
  cik: string,
  frames: FrameIndex,
  revenueBasis: PersonalFinancialRevenueBasisDto,
): PersonalFinancialScreenRowDto["metrics"] {
  const revenue = resolveReported(
    cik,
    revenueBasis === "agreement" ? REVENUE_CONCEPTS : [revenueBasis],
    frames,
  );
  const netIncome = resolveReported(cik, ["NetIncomeLoss"], frames);
  const operatingIncome = resolveReported(cik, ["OperatingIncomeLoss"], frames);
  const operatingCashFlow = resolveReported(
    cik,
    ["NetCashProvidedByUsedInOperatingActivities"],
    frames,
  );
  return {
    revenue,
    netIncome,
    operatingIncome,
    operatingCashFlow,
    netMargin: margin(netIncome, revenue),
    operatingMargin: margin(operatingIncome, revenue),
    operatingCashFlowMargin: margin(operatingCashFlow, revenue),
  };
}

function resolveReported(
  cik: string,
  concepts: readonly PersonalSecAnnualConceptDto[],
  frames: FrameIndex,
): PersonalFinancialScreenCellDto {
  const sources: PersonalFinancialScreenSourceRefDto[] = [];
  let sourceUnavailable = false;
  let conflicting = false;
  for (const concept of concepts) {
    const frame = frames.get(concept);
    if (frame === undefined || FAILED_SOURCE_STATUSES.has(frame.status)) {
      sourceUnavailable = true;
      continue;
    }
    if (frame.status === "not_covered") continue;
    if (frame.unknownCiks.has(cik)) conflicting = true;
    sources.push(...(frame.facts.get(cik) ?? []));
  }
  if (sourceUnavailable)
    return unavailable("USD", "source_unavailable", sources);
  if (conflicting) return unavailable("USD", "conflicting", sources);
  if (sources.length === 0) return unavailable("USD", "missing", sources);
  if (sources.some((source) => !isDecimal(source.value)))
    return unavailable("USD", "invalid_value", sources);
  const first = sources[0]!;
  const value = new ScreenDecimal(first.value);
  if (
    sources.some(
      (source) =>
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        !new ScreenDecimal(source.value).eq(value),
    )
  )
    return unavailable("USD", "conflicting", sources);
  return {
    status: "available",
    unit: "USD",
    value: canonicalDecimal(value),
    sources,
  };
}

function margin(
  numerator: PersonalFinancialScreenCellDto,
  revenue: PersonalFinancialScreenCellDto,
): PersonalFinancialScreenCellDto {
  const sources = [...numerator.sources, ...revenue.sources];
  if (revenue.status === "unavailable")
    return unavailable("percent", revenue.reason, sources);
  if (numerator.status === "unavailable")
    return unavailable("percent", numerator.reason, sources);
  if (
    numerator.sources[0]!.startDate !== revenue.sources[0]!.startDate ||
    numerator.sources[0]!.endDate !== revenue.sources[0]!.endDate
  )
    return unavailable("percent", "period_mismatch", sources);
  const denominator = new ScreenDecimal(revenue.value);
  if (!denominator.gt(0))
    return unavailable("percent", "nonpositive_revenue", sources);
  const rounded = new ScreenDecimal(numerator.value)
    .div(denominator)
    .times(100)
    .toDecimalPlaces(
      PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces,
      Decimal.ROUND_HALF_UP,
    );
  return {
    status: "available",
    unit: "percent",
    value: rounded.isZero()
      ? "0.00"
      : rounded.toFixed(PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces),
    sources,
  };
}

function evaluateClauses(
  metrics: PersonalFinancialScreenRowDto["metrics"],
  criteria: PersonalFinancialScreenCriteriaDto,
): "true" | "false" | "unknown" {
  let unknown = false;
  for (const clause of criteria.clauses) {
    const metric = metrics[clause.field];
    if (metric.status === "unavailable") {
      unknown = true;
      continue;
    }
    const value = new ScreenDecimal(metric.value);
    if (
      clause.operator === "gte"
        ? value.lt(clause.value)
        : value.gt(clause.value)
    )
      return "false";
  }
  return unknown ? "unknown" : "true";
}

function compareRows(
  left: PersonalFinancialScreenRowDto,
  right: PersonalFinancialScreenRowDto,
  sort: PersonalFinancialScreenCriteriaDto["sort"],
): number {
  const direction = sort.direction === "asc" ? 1 : -1;
  let comparison = 0;
  if (sort.field === "symbol")
    comparison =
      compareText(left.identity.symbol, right.identity.symbol) * direction;
  else {
    const leftCell = left.metrics[sort.field];
    const rightCell = right.metrics[sort.field];
    if (leftCell.status !== rightCell.status)
      return leftCell.status === "available" ? -1 : 1;
    if (leftCell.status === "available" && rightCell.status === "available") {
      comparison =
        new ScreenDecimal(leftCell.value).cmp(rightCell.value) * direction;
    }
  }
  return (
    comparison ||
    compareText(left.identity.symbol, right.identity.symbol) ||
    compareText(left.identity.listingId, right.identity.listingId)
  );
}

function indexFrames(frames: readonly PersonalSecAnnualFrameDto[]): FrameIndex {
  return new Map(
    frames.map((frame) => {
      const facts = new Map<string, PersonalFinancialScreenSourceRefDto[]>();
      for (const fact of frame.facts) {
        const existing = facts.get(fact.cik) ?? [];
        existing.push({
          concept: frame.concept,
          accessionNumber: fact.accessionNumber,
          startDate: fact.startDate,
          endDate: fact.endDate,
          value: fact.value,
        });
        facts.set(fact.cik, existing);
      }
      for (const entries of facts.values())
        entries.sort(
          (left, right) =>
            compareText(left.startDate, right.startDate) ||
            compareText(left.endDate, right.endDate) ||
            compareText(left.accessionNumber, right.accessionNumber) ||
            compareText(left.value, right.value),
        );
      return [
        frame.concept,
        {
          status: frame.status,
          facts,
          unknownCiks: new Set(frame.unknownCiks),
        },
      ] as const;
    }),
  );
}

function unavailable(
  unit: "USD" | "percent",
  reason: UnavailableReason,
  sources: readonly PersonalFinancialScreenSourceRefDto[],
): PersonalFinancialScreenCellDto {
  return { status: "unavailable", unit, reason, sources };
}

function matchesIdentity(
  identity: PersonalSecurityMasterScreenRowDto,
  tokens: readonly string[],
): boolean {
  const text = normalizeText(
    [
      identity.symbol,
      identity.issuerName,
      identity.securityName,
      identity.shareClassName,
      identity.cik,
      identity.exchangeMic,
      identity.instrumentType,
    ].join(" "),
  );
  return tokens.every((token) => text.includes(token));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isSnapshot(
  value: unknown,
): value is PersonalSecAnnualFinancialSnapshotDto {
  if (
    !exactRecord(value, [
      "calendarYear",
      "fetchedAt",
      "expiresAt",
      "snapshotSha256",
      "frames",
    ])
  )
    return false;
  if (
    !isCalendarYear(value.calendarYear) ||
    !isInstant(value.fetchedAt) ||
    !isInstant(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.fetchedAt) ||
    typeof value.snapshotSha256 !== "string" ||
    !DIGEST.test(value.snapshotSha256) ||
    !Array.isArray(value.frames) ||
    value.frames.length !== CONCEPTS.length
  )
    return false;
  const seenConcepts = new Set<string>();
  for (const frame of value.frames as unknown[]) {
    if (
      !exactRecord(frame, [
        "concept",
        "status",
        "sourceUrl",
        "facts",
        "unknownCiks",
      ]) ||
      !CONCEPTS.some((concept) => concept === frame.concept) ||
      typeof frame.concept !== "string" ||
      seenConcepts.has(frame.concept) ||
      typeof frame.status !== "string" ||
      !["available", "not_covered", ...FAILED_SOURCE_STATUSES].includes(
        frame.status,
      ) ||
      frame.sourceUrl !==
        `https://data.sec.gov/api/xbrl/frames/us-gaap/${frame.concept}/USD/CY${String(value.calendarYear)}.json` ||
      !Array.isArray(frame.facts) ||
      frame.facts.length > 50_000 ||
      !Array.isArray(frame.unknownCiks) ||
      frame.unknownCiks.length > 50_000 ||
      !frame.unknownCiks.every(
        (cik: unknown) => typeof cik === "string" && CIK.test(cik),
      ) ||
      (frame.status !== "available" &&
        (frame.facts.length !== 0 || frame.unknownCiks.length !== 0))
    )
      return false;
    seenConcepts.add(frame.concept);
    for (const fact of frame.facts as unknown[]) {
      if (
        !exactRecord(fact, [
          "cik",
          "accessionNumber",
          "startDate",
          "endDate",
          "value",
        ]) ||
        typeof fact.cik !== "string" ||
        !CIK.test(fact.cik) ||
        typeof fact.accessionNumber !== "string" ||
        !ACCESSION.test(fact.accessionNumber) ||
        !isDate(fact.startDate) ||
        !isDate(fact.endDate) ||
        fact.startDate > fact.endDate ||
        typeof fact.value !== "string" ||
        fact.value.length > 64
      )
        return false;
    }
  }
  return true;
}

function isIdentity(
  value: unknown,
): value is PersonalSecurityMasterScreenRowDto {
  if (
    !exactRecord(value, [
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
    ])
  )
    return false;
  return (
    typeof value.cik === "string" &&
    CIK.test(value.cik) &&
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    /^[A-Z0-9]{4}$/u.test(value.exchangeMic) &&
    (value.instrumentType === "common_stock" ||
      value.instrumentType === "adr") &&
    [
      value.issuerId,
      value.listingId,
      value.securityId,
      value.shareClassId,
    ].every(
      (id) =>
        typeof id === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(id),
    ) &&
    [value.issuerName, value.securityName, value.shareClassName].every(
      (name) =>
        typeof name === "string" &&
        name.length > 0 &&
        [...name].length <= 500 &&
        !INVALID_TEXT.test(name),
    ) &&
    typeof value.symbol === "string" &&
    /^[A-Z0-9][A-Z0-9.-]{0,31}$/u.test(value.symbol)
  );
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) return false;
  const names = Reflect.ownKeys(value);
  if (
    names.length !== keys.length ||
    !names.every((key) => typeof key === "string" && keys.includes(key))
  )
    return false;
  return names.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      descriptor !== undefined && "value" in descriptor && descriptor.enumerable
    );
  });
}

function isMetric(value: unknown): value is PersonalFinancialScreenMetricDto {
  return METRICS.some((metric) => metric === value);
}
function isCalendarYear(value: unknown): value is number {
  return boundedInteger(
    value,
    PERSONAL_FINANCIAL_SCREEN_LIMITS.minimumCalendarYear,
    PERSONAL_FINANCIAL_SCREEN_LIMITS.maximumCalendarYear,
  );
}
function boundedInteger(
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
function isDecimal(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    DECIMAL.test(value) &&
    new ScreenDecimal(value).isFinite()
  );
}
function canonicalDecimal(value: Decimal): string {
  return value.isZero() ? "0" : value.toFixed();
}
function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
function isInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().replace(".000Z", "Z") ===
      value.replace(".000Z", "Z")
  );
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function fail(): never {
  throw new TypeError("Personal financial screen request is invalid.");
}
