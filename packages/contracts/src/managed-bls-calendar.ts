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

/** Admit only this agency's complete, bounded packet and detach caller-owned data. */
export function parseManagedBlsCalendar(
  value: unknown,
): ManagedBlsCalendarDto | null {
  if (
    !fields(value, [
      "schemaVersion",
      "source",
      "fetchedAt",
      "window",
      "events",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    !fields(value.source, ["id", "name", "scheduleUrl", "timeZone"]) ||
    value.source.id !== MANAGED_BLS_CALENDAR_SOURCE.id ||
    value.source.name !== MANAGED_BLS_CALENDAR_SOURCE.name ||
    value.source.scheduleUrl !== MANAGED_BLS_CALENDAR_SOURCE.scheduleUrl ||
    value.source.timeZone !== MANAGED_BLS_CALENDAR_SOURCE.timeZone ||
    !instant(value.fetchedAt) ||
    !fields(value.window, ["fromInclusive", "toExclusive"]) ||
    value.window.fromInclusive !== value.fetchedAt ||
    !instant(value.window.toExclusive) ||
    Date.parse(value.window.toExclusive) - Date.parse(value.fetchedAt) !==
      MANAGED_BLS_CALENDAR_LIMITS.windowDays * 86_400_000 ||
    !Array.isArray(value.events) ||
    value.events.length > MANAGED_BLS_CALENDAR_LIMITS.events
  )
    return null;
  const events: ManagedBlsCalendarEventDto[] = [];
  let previous: ManagedBlsCalendarEventDto | undefined;
  for (const event of value.events) {
    if (
      !fields(event, ["series", "scheduledAt"]) ||
      typeof event.series !== "string" ||
      event.series.length === 0 ||
      event.series.length > MANAGED_BLS_CALENDAR_LIMITS.seriesLength ||
      event.series.trim() !== event.series ||
      /[\p{Cc}\p{Cf}\p{Cs}]/u.test(event.series) ||
      !instant(event.scheduledAt) ||
      event.scheduledAt < value.fetchedAt ||
      event.scheduledAt >= value.window.toExclusive ||
      (previous !== undefined &&
        (event.scheduledAt < previous.scheduledAt ||
          (event.scheduledAt === previous.scheduledAt &&
            event.series <= previous.series)))
    )
      return null;
    previous = Object.freeze({
      series: event.series,
      scheduledAt: event.scheduledAt,
    });
    events.push(previous);
  }
  return Object.freeze({
    schemaVersion: "1.0.0",
    source: MANAGED_BLS_CALENDAR_SOURCE,
    fetchedAt: value.fetchedAt,
    window: Object.freeze({
      fromInclusive: value.fetchedAt,
      toExclusive: value.window.toExclusive,
    }),
    events: Object.freeze(events),
  });
}

function fields(
  value: unknown,
  names: readonly string[],
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return (
    Reflect.ownKeys(descriptors).length === names.length &&
    names.every(
      (name) => descriptors[name] !== undefined && "value" in descriptors[name],
    )
  );
}
function instant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  )
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
