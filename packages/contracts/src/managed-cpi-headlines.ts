export const MANAGED_CPI_HEADLINES_PATH = "/v1/managed/cpi-headlines" as const;
export const MANAGED_CPI_HEADLINE_SOURCE = Object.freeze({
  id: "bls-cpi",
  name: "U.S. Bureau of Labor Statistics",
  topic: "Consumer Price Index",
  feedUrl: "https://www.bls.gov/feed/cpi.rss",
  directoryUrl: "https://www.bls.gov/feed/",
  timeZone: "America/New_York",
} as const);
export const MANAGED_CPI_HEADLINES_LIMITS = Object.freeze({
  responseBytes: 65_536,
  operationMs: 10_000,
  sourceBytes: 262_144,
  inputEntries: 128,
  shownEntries: 10,
  titleCodeUnits: 256,
  sourceIdCodeUnits: 128,
});
export interface ManagedCpiHeadlineDto {
  readonly sourceId: string;
  readonly title: string;
  readonly url: string;
  readonly publishedAt: string | null;
  readonly updatedAt: string | null;
}
export interface ManagedCpiHeadlinesDto {
  readonly schemaVersion: "1.0.0";
  readonly source: typeof MANAGED_CPI_HEADLINE_SOURCE;
  readonly fetchedAt: string;
  readonly feedUpdatedAt: string | null;
  readonly availableItemCount: number;
  readonly items: readonly ManagedCpiHeadlineDto[];
}

/** Feed clock syntax only; it does not establish release, embargo or revision time. */
export function parseCpiSourceInstant(value: unknown): string | null {
  const match = sourceClockParts(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  if (!validDate(year!, month!, day!)) return null;
  if (!validTime(hour!, minute!, second!)) return null;
  const offset = offsetMinutes(match[8]!);
  if (offset === null) return null;
  const local = new Date(0);
  local.setUTCFullYear(year!, month! - 1, day);
  local.setUTCHours(
    hour!,
    minute,
    second,
    Number((match[7] ?? "").padEnd(3, "0").slice(0, 3)),
  );
  const result = new Date(local.getTime() - offset * 60_000).toISOString();
  return /^\d{4}-/u.test(result) ? result : null;
}
function sourceClockParts(value: unknown): RegExpExecArray | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/u.exec(
      value,
    );
  return match?.[8] === "-00:00" ? null : match;
}
function validTime(hour: number, minute: number, second: number): boolean {
  return hour <= 23 && minute <= 59 && second <= 59;
}
function validDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}
function offsetMinutes(offset: string): number | null {
  if (offset === "Z") return 0;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4));
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60 + minutes) * (offset[0] === "+" ? 1 : -1);
}
/** Ascending comparison of admitted clocks, retaining submillisecond precision. */
export function compareCpiSourceInstants(left: string, right: string): number {
  const a = parseCpiSourceInstant(left),
    b = parseCpiSourceInstant(right);
  if (a === null || b === null) throw new Error("Invalid CPI source clock");
  if (a !== b) return a < b ? -1 : 1;
  const fraction = (raw: string) =>
    (raw.split(".")[1]?.split(/[Z+-]/u)[0] ?? "").padEnd(64, "0");
  const af = fraction(left),
    bf = fraction(right);
  return af === bf ? 0 : af < bf ? -1 : 1;
}
export function isCpiHeadlineUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^https:\/\/www\.bls\.gov\/news\.release\/archives\/cpi_(\d{2})(\d{2})(\d{4})\.htm$/u.exec(
      value,
    );
  return (
    match !== null &&
    validDate(Number(match[3]), Number(match[1]), Number(match[2]))
  );
}
function record(
  value: unknown,
  names: readonly string[],
): Record<string, unknown> | null {
  if (value === null || typeof value !== "object") return null;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== names.length) return null;
  const detached: Record<string, unknown> = {};
  for (const name of names) {
    const field = fields[name];
    if (!field?.enumerable || !Object.hasOwn(field, "value")) return null;
    detached[name] = field.value;
  }
  return detached;
}
function text(value: unknown, maximum: number): value is string {
  if (typeof value !== "string" || !value.length || value.length > maximum)
    return false;
  return value.trim() === value && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value);
}
function optionalClock(value: unknown): value is string | null {
  return value === null || parseCpiSourceInstant(value) !== null;
}
export function parseManagedCpiHeadline(
  value: unknown,
): ManagedCpiHeadlineDto | null {
  try {
    return readItem(value);
  } catch {
    return null;
  }
}
function readItem(input: unknown): ManagedCpiHeadlineDto | null {
  const value = record(input, [
    "sourceId",
    "title",
    "url",
    "publishedAt",
    "updatedAt",
  ]);
  if (!value) return null;
  if (!text(value.sourceId, MANAGED_CPI_HEADLINES_LIMITS.sourceIdCodeUnits))
    return null;
  if (!text(value.title, MANAGED_CPI_HEADLINES_LIMITS.titleCodeUnits))
    return null;
  if (!isCpiHeadlineUrl(value.url)) return null;
  if (!optionalClock(value.publishedAt) || !optionalClock(value.updatedAt))
    return null;
  return Object.freeze({
    sourceId: value.sourceId,
    title: value.title,
    url: value.url,
    publishedAt: value.publishedAt,
    updatedAt: value.updatedAt,
  });
}
function arrayValues(value: unknown, count: number): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")
    ?.value as unknown;
  if (length !== Math.min(count, MANAGED_CPI_HEADLINES_LIMITS.shownEntries))
    return null;
  if (Reflect.ownKeys(value).length !== Number(length) + 1) return null;
  const values: unknown[] = [];
  for (let index = 0; index < Number(length); index++) {
    const field = Object.getOwnPropertyDescriptor(value, index);
    if (!field || !Object.hasOwn(field, "value")) return null;
    values.push(field.value);
  }
  return values;
}
function readItems(
  value: unknown,
  count: number,
): readonly ManagedCpiHeadlineDto[] | null {
  const values = arrayValues(value, count);
  if (!values) return null;
  const items: ManagedCpiHeadlineDto[] = [],
    ids = new Set<string>(),
    urls = new Set<string>();
  for (const value of values) {
    const item = parseManagedCpiHeadline(value);
    if (!item || ids.has(item.sourceId) || urls.has(item.url)) return null;
    const previous = items.at(-1);
    if (previous && !ordered(previous, item)) return null;
    ids.add(item.sourceId);
    urls.add(item.url);
    items.push(item);
  }
  return Object.freeze(items);
}
function ordered(
  previous: ManagedCpiHeadlineDto,
  item: ManagedCpiHeadlineDto,
): boolean {
  if (previous.publishedAt === null) return item.publishedAt === null;
  if (item.publishedAt === null) return true;
  return compareCpiSourceInstants(previous.publishedAt, item.publishedAt) >= 0;
}
function sourceMatches(value: unknown): boolean {
  const source = record(value, Object.keys(MANAGED_CPI_HEADLINE_SOURCE));
  return (
    source !== null &&
    Object.entries(MANAGED_CPI_HEADLINE_SOURCE).every(
      ([key, expected]) => source[key] === expected,
    )
  );
}
function retrievalInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
    return false;
  return parseCpiSourceInstant(value) === value;
}
function itemCount(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return false;
  return value >= 0 && value <= MANAGED_CPI_HEADLINES_LIMITS.inputEntries;
}
function readPacket(input: unknown): ManagedCpiHeadlinesDto | null {
  const value = record(input, [
    "schemaVersion",
    "source",
    "fetchedAt",
    "feedUpdatedAt",
    "availableItemCount",
    "items",
  ]);
  if (!value) return null;
  if (value.schemaVersion !== "1.0.0" || !sourceMatches(value.source))
    return null;
  if (!retrievalInstant(value.fetchedAt) || !optionalClock(value.feedUpdatedAt))
    return null;
  const count = value.availableItemCount;
  if (!itemCount(count)) return null;
  const items = readItems(value.items, count);
  if (!items) return null;
  return Object.freeze({
    schemaVersion: "1.0.0",
    source: MANAGED_CPI_HEADLINE_SOURCE,
    fetchedAt: value.fetchedAt,
    feedUpdatedAt: value.feedUpdatedAt,
    availableItemCount: count,
    items,
  });
}
/** Admit a complete detached packet; no source-clock relationships are inferred. */
export function parseManagedCpiHeadlines(
  value: unknown,
): ManagedCpiHeadlinesDto | null {
  try {
    return readPacket(value);
  } catch {
    return null;
  }
}
