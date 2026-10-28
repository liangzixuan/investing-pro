import {
  readCpiDataRecord as record,
  readCpiDataArray,
} from "./managed-cpi-headline-data";
import {
  isCpiCalendarDate,
  parseCpiSourceInstant,
  compareCpiSourceInstants,
} from "./managed-cpi-headline-clock";
export {
  parseCpiSourceInstant,
  compareCpiSourceInstants,
} from "./managed-cpi-headline-clock";
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

export function isCpiHeadlineUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^https:\/\/www\.bls\.gov\/news\.release\/archives\/cpi_(\d{2})(\d{2})(\d{4})\.htm$/u.exec(
      value,
    );
  return (
    match !== null &&
    isCpiCalendarDate({
      year: Number(match[3]),
      month: Number(match[1]),
      day: Number(match[2]),
    })
  );
}
function text(value: unknown, maximum: number): value is string {
  if (typeof value !== "string") return false;
  if (!value.length || value.length > maximum) return false;
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
function readHeadlineIdentity(value: Record<string, unknown>) {
  if (!text(value.sourceId, MANAGED_CPI_HEADLINES_LIMITS.sourceIdCodeUnits))
    return null;
  if (!text(value.title, MANAGED_CPI_HEADLINES_LIMITS.titleCodeUnits))
    return null;
  if (!isCpiHeadlineUrl(value.url)) return null;
  return { sourceId: value.sourceId, title: value.title, url: value.url };
}
function readHeadlineClocks(value: Record<string, unknown>) {
  if (!optionalClock(value.publishedAt) || !optionalClock(value.updatedAt))
    return null;
  return { publishedAt: value.publishedAt, updatedAt: value.updatedAt };
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
  const identity = readHeadlineIdentity(value);
  if (!identity) return null;
  const clocks = readHeadlineClocks(value);
  if (!clocks) return null;
  return Object.freeze({ ...identity, ...clocks });
}
class CpiHeadlineSequence {
  private readonly items: ManagedCpiHeadlineDto[] = [];
  private readonly ids = new Set<string>();
  private readonly urls = new Set<string>();
  append(item: ManagedCpiHeadlineDto): boolean {
    if (this.ids.has(item.sourceId) || this.urls.has(item.url)) return false;
    const previous = this.items.at(-1);
    if (previous && !ordered(previous, item)) return false;
    this.ids.add(item.sourceId);
    this.urls.add(item.url);
    this.items.push(item);
    return true;
  }
  snapshot(): readonly ManagedCpiHeadlineDto[] {
    return Object.freeze(this.items);
  }
}
function readItems(
  value: unknown,
  count: number,
): readonly ManagedCpiHeadlineDto[] | null {
  const values = readCpiDataArray(
    value,
    Math.min(count, MANAGED_CPI_HEADLINES_LIMITS.shownEntries),
  );
  if (!values) return null;
  const sequence = new CpiHeadlineSequence();
  for (const value of values) {
    const item = parseManagedCpiHeadline(value);
    if (!item) return null;
    if (!sequence.append(item)) return null;
  }
  return sequence.snapshot();
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
function readHeader(value: Record<string, unknown>) {
  if (value.schemaVersion !== "1.0.0") return null;
  if (!sourceMatches(value.source)) return null;
  if (!retrievalInstant(value.fetchedAt)) return null;
  if (!optionalClock(value.feedUpdatedAt)) return null;
  if (!itemCount(value.availableItemCount)) return null;
  return {
    fetchedAt: value.fetchedAt,
    feedUpdatedAt: value.feedUpdatedAt,
    availableItemCount: value.availableItemCount,
  };
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
  const header = readHeader(value);
  if (!header) return null;
  const items = readItems(value.items, header.availableItemCount);
  if (!items) return null;
  return Object.freeze({
    schemaVersion: "1.0.0",
    source: MANAGED_CPI_HEADLINE_SOURCE,
    ...header,
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
