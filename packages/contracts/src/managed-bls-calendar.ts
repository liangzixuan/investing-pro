export const MANAGED_BLS_CALENDAR_PATH = "/v1/managed/bls-calendar" as const;
export const MANAGED_BLS_CALENDAR_SOURCE = Object.freeze({
  id: "bls",
  name: "U.S. Bureau of Labor Statistics",
  scheduleUrl: "https://www.bls.gov/schedule/",
  timeZone: "America/New_York",
} as const);
export const MANAGED_BLS_CALENDAR_LIMITS = Object.freeze({
  operationMs: 10_000,
  responseBytes: 512 * 1_024,
  events: 512,
  seriesLength: 256,
  windowDays: 30,
});

export interface ManagedBlsCalendarEventDto {
  readonly series: string;
  readonly scheduledAt: string;
}
export interface ManagedBlsCalendarDto {
  readonly schemaVersion: "1.0.0";
  readonly source: typeof MANAGED_BLS_CALENDAR_SOURCE;
  readonly fetchedAt: string;
  readonly window: {
    readonly fromInclusive: string;
    readonly toExclusive: string;
  };
  readonly events: readonly ManagedBlsCalendarEventDto[];
}

interface CalendarHeader {
  readonly fetchedAt: string;
  readonly end: string;
  readonly events: readonly unknown[];
}

/** Admit only this agency's complete, bounded packet and detach caller-owned data. */
export function parseManagedBlsCalendar(
  value: unknown,
): ManagedBlsCalendarDto | null {
  const header = readHeader(value);
  if (!header) return null;
  const events: ManagedBlsCalendarEventDto[] = [];
  let previous: ManagedBlsCalendarEventDto | undefined;
  for (const value of header.events) {
    const event = readEvent(value, header);
    if (!event || !follows(event, previous)) return null;
    previous = Object.freeze(event);
    events.push(previous);
  }
  return Object.freeze({
    schemaVersion: "1.0.0",
    source: MANAGED_BLS_CALENDAR_SOURCE,
    fetchedAt: header.fetchedAt,
    window: Object.freeze({
      fromInclusive: header.fetchedAt,
      toExclusive: header.end,
    }),
    events: Object.freeze(events),
  });
}

function readHeader(value: unknown): CalendarHeader | null {
  if (
    !fields(value, ["schemaVersion", "source", "fetchedAt", "window", "events"])
  )
    return null;
  if (value.schemaVersion !== "1.0.0" || !source(value.source)) return null;
  if (!instant(value.fetchedAt)) return null;
  if (!window(value.window, value.fetchedAt)) return null;
  if (!Array.isArray(value.events)) return null;
  if (value.events.length > MANAGED_BLS_CALENDAR_LIMITS.events) return null;
  return {
    fetchedAt: value.fetchedAt,
    end: value.window.toExclusive,
    events: value.events,
  };
}

function source(value: unknown): boolean {
  if (!fields(value, ["id", "name", "scheduleUrl", "timeZone"])) return false;
  return Object.entries(MANAGED_BLS_CALENDAR_SOURCE).every(
    ([key, expected]) => value[key] === expected,
  );
}

function window(
  value: unknown,
  fetchedAt: string,
): value is { fromInclusive: string; toExclusive: string } {
  if (!fields(value, ["fromInclusive", "toExclusive"])) return false;
  if (!instant(value.toExclusive)) return false;
  if (value.fromInclusive !== fetchedAt) return false;
  return (
    Date.parse(value.toExclusive) - Date.parse(fetchedAt) ===
    MANAGED_BLS_CALENDAR_LIMITS.windowDays * 86_400_000
  );
}

function readEvent(
  value: unknown,
  header: CalendarHeader,
): ManagedBlsCalendarEventDto | null {
  if (!fields(value, ["series", "scheduledAt"])) return null;
  if (!series(value.series) || !instant(value.scheduledAt)) return null;
  if (value.scheduledAt < header.fetchedAt || value.scheduledAt >= header.end)
    return null;
  return { series: value.series, scheduledAt: value.scheduledAt };
}

function series(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (
    value.length === 0 ||
    value.length > MANAGED_BLS_CALENDAR_LIMITS.seriesLength
  )
    return false;
  return value.trim() === value && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value);
}

function follows(
  event: ManagedBlsCalendarEventDto,
  previous: ManagedBlsCalendarEventDto | undefined,
): boolean {
  if (!previous) return true;
  if (event.scheduledAt === previous.scheduledAt)
    return event.series > previous.series;
  return event.scheduledAt > previous.scheduledAt;
}

function fields(
  value: unknown,
  names: readonly string[],
): value is Record<string, unknown> {
  if (value === null) return false;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== names.length) return false;
  return names.every(
    (name) => descriptors[name] !== undefined && "value" in descriptors[name],
  );
}

function instant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
