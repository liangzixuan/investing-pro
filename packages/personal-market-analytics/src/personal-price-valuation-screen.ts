import Decimal from "decimal.js";

export const PERSONAL_PRICE_VALUATION_SCREEN_MAXIMUM_ROWS = 20;
export const PERSONAL_PRICE_VALUATION_SCREEN_METRICS = [
  "rawClose",
  "priceToEarnings",
  "priceToBook",
] as const;
export type PersonalPriceValuationScreenMetric =
  (typeof PERSONAL_PRICE_VALUATION_SCREEN_METRICS)[number];
export interface PersonalPriceValuationScreenIdentity {
  readonly country: "US";
  readonly exchangeMic: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly securityName: string;
  readonly symbol: string;
}
export type PersonalPriceValuationScreenUnknownReason =
  | "market_not_loaded"
  | "valuation_not_loaded"
  | "latest_date_close_missing"
  | "not_supplied_by_provider";
export type PersonalPriceValuationScreenCell =
  | { readonly status: "known"; readonly value: string }
  | {
      readonly status: "unknown";
      readonly value: null;
      readonly reason: PersonalPriceValuationScreenUnknownReason;
    };
export type PersonalPriceValuationScreenRatioCell =
  | { readonly status: "known"; readonly unit: "ratio"; readonly value: string }
  | {
      readonly status: "unknown";
      readonly unit: "ratio";
      readonly value: null;
      readonly reason: "not_supplied_by_provider";
    };
export interface PersonalPriceValuationScreenMarket {
  readonly security: PersonalPriceValuationScreenIdentity;
  readonly range: "1m";
  readonly startDate: string;
  readonly endDate: string;
  readonly bars: readonly {
    readonly date: string;
    readonly raw: { readonly close: string };
  }[];
}
export interface PersonalPriceValuationScreenPoint {
  readonly date: string;
  readonly priceToEarnings: PersonalPriceValuationScreenRatioCell;
  readonly priceToBook: PersonalPriceValuationScreenRatioCell;
}
export interface PersonalPriceValuationScreenValuation {
  readonly security: PersonalPriceValuationScreenIdentity;
  readonly range: "1m";
  readonly startDate: string;
  readonly endDate: string;
  readonly latestPoint: PersonalPriceValuationScreenPoint;
  readonly points: readonly PersonalPriceValuationScreenPoint[];
}
export interface PersonalPriceValuationScreenRowInput {
  readonly identity: PersonalPriceValuationScreenIdentity;
  /** UTC calendar date frozen when this explicit batch starts. */
  readonly loadDate: string;
  readonly market: PersonalPriceValuationScreenMarket | null;
  readonly valuation: PersonalPriceValuationScreenValuation | null;
}
export interface PersonalPriceValuationScreenRow {
  readonly identity: PersonalPriceValuationScreenIdentity;
  readonly loadDate: string;
  readonly observationDate: string | null;
  readonly ageDays: number | null;
  readonly metrics: Readonly<
    Record<PersonalPriceValuationScreenMetric, PersonalPriceValuationScreenCell>
  >;
}
export interface PersonalPriceValuationScreenCriteria {
  readonly bounds: Readonly<
    Record<
      PersonalPriceValuationScreenMetric,
      { readonly min: string | null; readonly max: string | null }
    >
  >;
  readonly sort: {
    readonly field: PersonalPriceValuationScreenMetric | "symbol";
    readonly direction: "asc" | "desc";
  };
}
export type PersonalPriceValuationScreenOutcome =
  "match" | "non_match" | "unknown";
export interface PersonalPriceValuationScreenResult {
  readonly rows: readonly (PersonalPriceValuationScreenRow & {
    readonly outcome: PersonalPriceValuationScreenOutcome;
  })[];
  readonly counts: {
    readonly total: number;
    readonly matches: number;
    readonly nonMatches: number;
    readonly unknown: number;
  };
  readonly metricCoverage: Readonly<
    Record<
      PersonalPriceValuationScreenMetric,
      { readonly known: number; readonly unknown: number }
    >
  >;
}
export interface PersonalPriceValuationScreenInput {
  readonly rows: readonly PersonalPriceValuationScreenRow[];
  readonly criteria: PersonalPriceValuationScreenCriteria;
}

const ExactDecimal = Decimal.clone({ defaults: true, precision: 80 });
const DAY = 86_400_000;
const MAXIMUM_OBSERVATIONS = 4_096;
const IDENTITY_KEYS = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;
const METRICS = PERSONAL_PRICE_VALUATION_SCREEN_METRICS;
const SOURCE_KEYS = ["security", "range", "startDate", "endDate"] as const;
const UNKNOWN_REASONS: readonly PersonalPriceValuationScreenUnknownReason[] = [
  "market_not_loaded",
  "valuation_not_loaded",
  "latest_date_close_missing",
  "not_supplied_by_provider",
];

/** Receives only narrow projections of already decoded provider responses. */
export function buildPersonalPriceValuationScreenRow(
  input: PersonalPriceValuationScreenRowInput,
): PersonalPriceValuationScreenRow {
  try {
    const record = exactRecord(input, [
      "identity",
      "loadDate",
      "market",
      "valuation",
    ]);
    const identity = parseIdentity(record.identity);
    const loadDate = parseDate(record.loadDate);
    // Validate every projected observation before selecting or withholding a row.
    const market = parseMarket(record.market, identity, loadDate);
    const valuation = parseValuation(record.valuation, identity, loadDate);
    const observationDate = valuation?.latestPoint.date ?? null;
    const common = {
      identity,
      loadDate,
      observationDate,
      ageDays:
        observationDate === null ? null : ageDays(loadDate, observationDate),
    };
    if (valuation === null)
      return freezeDeep({
        ...common,
        metrics: withheld("valuation_not_loaded"),
      });
    if (market === null)
      return freezeDeep({ ...common, metrics: withheld("market_not_loaded") });
    const bar = market.bars.find((entry) => entry.date === observationDate);
    if (bar === undefined)
      return freezeDeep({
        ...common,
        metrics: withheld("latest_date_close_missing"),
      });
    // The latest point is the anchor even when either ratio is unknown.
    return freezeDeep({
      ...common,
      metrics: {
        rawClose: { status: "known", value: bar.raw.close },
        priceToEarnings: projectRatio(valuation.latestPoint.priceToEarnings),
        priceToBook: projectRatio(valuation.latestPoint.priceToBook),
      },
    });
  } catch {
    throw new TypeError();
  }
}

export function validatePersonalPriceValuationScreenCriteria(
  value: unknown,
): PersonalPriceValuationScreenCriteria | null {
  try {
    const record = exactRecord(value, ["bounds", "sort"]);
    const bounds = exactRecord(record.bounds, METRICS);
    const sort = exactRecord(record.sort, ["field", "direction"]);
    if (
      !isSortField(sort.field) ||
      (sort.direction !== "asc" && sort.direction !== "desc")
    )
      throw new TypeError();
    const parsed = (field: PersonalPriceValuationScreenMetric) => {
      const pair = exactRecord(bounds[field], ["min", "max"]);
      const min = parseThreshold(pair.min);
      const max = parseThreshold(pair.max);
      if (min !== null && max !== null && new ExactDecimal(min).gt(max))
        throw new TypeError();
      return { min, max };
    };
    return freezeDeep({
      bounds: {
        rawClose: parsed("rawClose"),
        priceToEarnings: parsed("priceToEarnings"),
        priceToBook: parsed("priceToBook"),
      },
      sort: { field: sort.field, direction: sort.direction },
    });
  } catch {
    return null;
  }
}

export function evaluatePersonalPriceValuationScreen(
  input: PersonalPriceValuationScreenInput,
): PersonalPriceValuationScreenResult {
  try {
    const record = exactRecord(input, ["rows", "criteria"]);
    const rows = denseArray(
      record.rows,
      PERSONAL_PRICE_VALUATION_SCREEN_MAXIMUM_ROWS,
    ).map(parseRow);
    const criteria = validatePersonalPriceValuationScreenCriteria(
      record.criteria,
    );
    if (
      criteria === null ||
      new Set(rows.map((row) => row.identity.listingId)).size !== rows.length ||
      new Set(rows.map((row) => row.loadDate)).size > 1
    )
      throw new TypeError();
    const metricCoverage = {
      rawClose: { known: 0, unknown: 0 },
      priceToEarnings: { known: 0, unknown: 0 },
      priceToBook: { known: 0, unknown: 0 },
    };
    const counts = {
      total: rows.length,
      matches: 0,
      nonMatches: 0,
      unknown: 0,
    };
    const evaluated = rows.map((row) => {
      for (const metric of METRICS)
        metricCoverage[metric][row.metrics[metric].status] += 1;
      const outcome = evaluateRow(row, criteria);
      if (outcome === "match") counts.matches += 1;
      else if (outcome === "non_match") counts.nonMatches += 1;
      else counts.unknown += 1;
      return { ...row, outcome };
    });
    evaluated.sort((left, right) => compareRows(left, right, criteria));
    return freezeDeep({ rows: evaluated, counts, metricCoverage });
  } catch {
    throw new TypeError();
  }
}

function evaluateRow(
  row: PersonalPriceValuationScreenRow,
  criteria: PersonalPriceValuationScreenCriteria,
): PersonalPriceValuationScreenOutcome {
  let unknown = false;
  for (const field of METRICS) {
    const { min, max } = criteria.bounds[field];
    if (min === null && max === null) continue;
    const cell = row.metrics[field];
    if (cell.status === "unknown") {
      unknown = true;
      continue;
    }
    const value = new ExactDecimal(cell.value);
    if ((min !== null && value.lt(min)) || (max !== null && value.gt(max)))
      return "non_match";
  }
  return unknown ? "unknown" : "match";
}
function compareRows(
  left: PersonalPriceValuationScreenRow,
  right: PersonalPriceValuationScreenRow,
  criteria: PersonalPriceValuationScreenCriteria,
): number {
  const { field, direction } = criteria.sort;
  const multiplier = direction === "asc" ? 1 : -1;
  if (field === "symbol") {
    const compared =
      compareText(left.identity.symbol, right.identity.symbol) * multiplier;
    if (compared !== 0) return compared;
  } else {
    const a = left.metrics[field];
    const b = right.metrics[field];
    if (a.status !== b.status) return a.status === "unknown" ? 1 : -1;
    if (a.status === "known" && b.status === "known") {
      const compared = new ExactDecimal(a.value).cmp(b.value) * multiplier;
      if (compared !== 0) return compared;
    }
  }
  return (
    compareText(left.identity.symbol, right.identity.symbol) ||
    compareText(left.identity.listingId, right.identity.listingId)
  );
}

function parseMarket(
  value: unknown,
  identity: PersonalPriceValuationScreenIdentity,
  loadDate: string,
): PersonalPriceValuationScreenMarket | null {
  if (value === null) return null;
  const record = exactRecord(value, [...SOURCE_KEYS, "bars"]);
  const common = parseSource(record, identity, loadDate);
  let previous = "";
  const bars = denseArray(record.bars, MAXIMUM_OBSERVATIONS).map((entry) => {
    const bar = exactRecord(entry, ["date", "raw"]);
    const date = parseDate(bar.date);
    if (date <= previous || date < common.startDate || date > common.endDate)
      throw new TypeError();
    previous = date;
    const raw = exactRecord(bar.raw, ["close"]);
    const close = parseRawClose(raw.close);
    if (!new ExactDecimal(close).gt(0)) throw new TypeError();
    return { date, raw: { close } };
  });
  return { ...common, bars };
}
function parseValuation(
  value: unknown,
  identity: PersonalPriceValuationScreenIdentity,
  loadDate: string,
): PersonalPriceValuationScreenValuation | null {
  if (value === null) return null;
  const record = exactRecord(value, [...SOURCE_KEYS, "latestPoint", "points"]);
  const common = parseSource(record, identity, loadDate);
  let previous = "";
  const points = denseArray(record.points, MAXIMUM_OBSERVATIONS).map(
    (entry) => {
      const point = parsePoint(entry);
      if (
        point.date <= previous ||
        point.date < common.startDate ||
        point.date > common.endDate
      )
        throw new TypeError();
      previous = point.date;
      return point;
    },
  );
  const latestPoint = parsePoint(record.latestPoint);
  const last = points.at(-1);
  if (
    last === undefined ||
    latestPoint.date !== last.date ||
    !sameRatio(latestPoint.priceToEarnings, last.priceToEarnings) ||
    !sameRatio(latestPoint.priceToBook, last.priceToBook)
  )
    throw new TypeError();
  return { ...common, latestPoint, points };
}
function parseSource(
  record: Record<string, unknown>,
  identity: PersonalPriceValuationScreenIdentity,
  loadDate: string,
) {
  const security = parseIdentity(record.security);
  const startDate = parseDate(record.startDate);
  const endDate = parseDate(record.endDate);
  if (
    record.range !== "1m" ||
    endDate > loadDate ||
    startDate !== monthBefore(endDate) ||
    IDENTITY_KEYS.some((key) => security[key] !== identity[key])
  )
    throw new TypeError();
  return { security, range: "1m" as const, startDate, endDate };
}
function parsePoint(value: unknown): PersonalPriceValuationScreenPoint {
  const record = exactRecord(value, ["date", "priceToEarnings", "priceToBook"]);
  return {
    date: parseDate(record.date),
    priceToEarnings: parseRatio(record.priceToEarnings),
    priceToBook: parseRatio(record.priceToBook),
  };
}
function parseRatio(value: unknown): PersonalPriceValuationScreenRatioCell {
  const record = plainRecord(value);
  if (record.status === "known") {
    exactRecord(record, ["status", "unit", "value"]);
    if (record.unit !== "ratio") throw new TypeError();
    return {
      status: "known",
      unit: "ratio",
      value: parseDecimal(record.value),
    };
  }
  exactRecord(record, ["status", "unit", "value", "reason"]);
  if (
    record.status !== "unknown" ||
    record.unit !== "ratio" ||
    record.value !== null ||
    record.reason !== "not_supplied_by_provider"
  )
    throw new TypeError();
  return {
    status: "unknown",
    unit: "ratio",
    value: null,
    reason: "not_supplied_by_provider",
  };
}
function sameRatio(
  left: PersonalPriceValuationScreenRatioCell,
  right: PersonalPriceValuationScreenRatioCell,
) {
  return left.status === right.status && left.value === right.value;
}
function projectRatio(
  cell: PersonalPriceValuationScreenRatioCell,
): PersonalPriceValuationScreenCell {
  return cell.status === "known"
    ? { status: "known", value: cell.value }
    : unknownCell(cell.reason);
}
function unknownCell(
  reason: PersonalPriceValuationScreenUnknownReason,
): PersonalPriceValuationScreenCell {
  return { status: "unknown", value: null, reason };
}
function withheld(reason: PersonalPriceValuationScreenUnknownReason) {
  return {
    rawClose: unknownCell(reason),
    priceToEarnings: unknownCell(reason),
    priceToBook: unknownCell(reason),
  };
}

function parseRow(value: unknown): PersonalPriceValuationScreenRow {
  const record = exactRecord(value, [
    "identity",
    "loadDate",
    "observationDate",
    "ageDays",
    "metrics",
  ]);
  const identity = parseIdentity(record.identity);
  const loadDate = parseDate(record.loadDate);
  const observationDate =
    record.observationDate === null ? null : parseDate(record.observationDate);
  const expectedAge =
    observationDate === null ? null : ageDays(loadDate, observationDate);
  if (
    record.ageDays !== expectedAge ||
    (expectedAge !== null && expectedAge < 0)
  )
    throw new TypeError();
  const sourceMetrics = exactRecord(record.metrics, METRICS);
  const metrics = {
    rawClose: parseCell(sourceMetrics.rawClose),
    priceToEarnings: parseCell(sourceMetrics.priceToEarnings),
    priceToBook: parseCell(sourceMetrics.priceToBook),
  };
  if (metrics.rawClose.status === "known") {
    if (
      observationDate === null ||
      !new ExactDecimal(metrics.rawClose.value).gt(0) ||
      METRICS.some(
        (field) =>
          metrics[field].status === "unknown" &&
          metrics[field].reason !== "not_supplied_by_provider",
      )
    )
      throw new TypeError();
  } else {
    const reason = metrics.rawClose.reason;
    if (
      reason === "not_supplied_by_provider" ||
      (observationDate === null) !== (reason === "valuation_not_loaded") ||
      METRICS.some(
        (field) =>
          metrics[field].status !== "unknown" ||
          metrics[field].reason !== reason,
      )
    )
      throw new TypeError();
  }
  return { identity, loadDate, observationDate, ageDays: expectedAge, metrics };
}
function parseCell(value: unknown): PersonalPriceValuationScreenCell {
  const record = plainRecord(value);
  if (record.status === "known") {
    exactRecord(record, ["status", "value"]);
    return { status: "known", value: parseDecimal(record.value) };
  }
  exactRecord(record, ["status", "value", "reason"]);
  if (
    record.status !== "unknown" ||
    record.value !== null ||
    !UNKNOWN_REASONS.some((reason) => reason === record.reason)
  )
    throw new TypeError();
  return unknownCell(
    record.reason as PersonalPriceValuationScreenUnknownReason,
  );
}
function parseIdentity(value: unknown): PersonalPriceValuationScreenIdentity {
  const record = exactRecord(value, IDENTITY_KEYS);
  if (
    record.country !== "US" ||
    typeof record.exchangeMic !== "string" ||
    !/^[A-Z0-9]{4}$/u.test(record.exchangeMic) ||
    typeof record.listingId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(record.listingId) ||
    typeof record.symbol !== "string" ||
    !/^[A-Z0-9][A-Z0-9.-]{0,31}$/u.test(record.symbol) ||
    !isText(record.issuerName) ||
    !isText(record.securityName)
  )
    throw new TypeError();
  return {
    country: "US",
    exchangeMic: record.exchangeMic,
    issuerName: record.issuerName,
    listingId: record.listingId,
    securityName: record.securityName,
    symbol: record.symbol,
  };
}
function isText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    [...value].length <= 512 &&
    value === value.trim() &&
    /^[^\p{Cc}\p{Cf}\p{Cs}]+$/u.test(value)
  );
}
function parseDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    value < "1900-01-01"
  )
    throw new TypeError();
  const milliseconds = Date.parse(value + "T00:00:00.000Z");
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  )
    throw new TypeError();
  return value;
}
function monthBefore(date: string): string {
  const end = new Date(date + "T00:00:00.000Z");
  const previous = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0),
  );
  previous.setUTCDate(Math.min(end.getUTCDate(), previous.getUTCDate()));
  return previous.toISOString().slice(0, 10);
}
function ageDays(loadDate: string, observationDate: string) {
  return (
    (Date.parse(loadDate + "T00:00:00.000Z") -
      Date.parse(observationDate + "T00:00:00.000Z")) /
    DAY
  );
}
function parseDecimal(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value) ||
    new ExactDecimal(value).toFixed() !== value
  )
    throw new TypeError();
  return value;
}
function parseRawClose(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)
  )
    throw new TypeError();
  // The market decoder permits trailing zeroes; normalize without rounding.
  return parseDecimal(new ExactDecimal(value).toFixed());
}
function parseThreshold(value: unknown): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value)
  )
    throw new TypeError();
  return parseDecimal(new ExactDecimal(value).toFixed());
}
function isSortField(
  value: unknown,
): value is PersonalPriceValuationScreenMetric | "symbol" {
  return value === "symbol" || METRICS.some((field) => field === value);
}
function plainRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError();
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError();
  return value as Record<string, unknown>;
}
function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  const record = plainRecord(value);
  if (
    Reflect.ownKeys(record).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(record, key))
  )
    throw new TypeError();
  return record;
}
function denseArray(value: unknown, maximum: number): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    Object.keys(value).length !== value.length
  )
    throw new TypeError();
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(value, index)) throw new TypeError();
  return value as readonly unknown[];
}
function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function freezeDeep<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const entry of Object.values(value)) freezeDeep(entry);
  return Object.freeze(value);
}
