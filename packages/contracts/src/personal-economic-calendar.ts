export const PERSONAL_ECONOMIC_CALENDAR_PATH =
  "/v1/personal-filing/economic-calendar" as const;
export const PERSONAL_ECONOMIC_CALENDAR_WINDOW_DAYS = 30;
export const PERSONAL_ECONOMIC_CALENDAR_MAXIMUM_EVENTS = 512;
export const PERSONAL_ECONOMIC_CALENDAR_MAXIMUM_SERIES_LENGTH = 256;
export const PERSONAL_BEA_CALENDAR_SOURCE = Object.freeze({
  id: "bea",
  name: "U.S. Bureau of Economic Analysis",
  scheduleUrl: "https://www.bea.gov/news/schedule",
  timeZone: "America/New_York",
} as const);

export interface PersonalEconomicCalendarEventDto {
  readonly series: string;
  readonly scheduledAt: string;
}

/** BEA series release times; no consensus, results or company-event claims. */
export interface PersonalEconomicCalendarDto {
  readonly schemaVersion: "1.0.0";
  readonly source: typeof PERSONAL_BEA_CALENDAR_SOURCE;
  readonly fetchedAt: string;
  readonly window: {
    readonly fromInclusive: string;
    readonly toExclusive: string;
  };
  readonly events: readonly PersonalEconomicCalendarEventDto[];
}

export function isPersonalEconomicCalendarDto(
  value: unknown,
): value is PersonalEconomicCalendarDto {
  if (
    !hasKeys(value, [
      "schemaVersion",
      "source",
      "fetchedAt",
      "window",
      "events",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    !hasKeys(value.source, ["id", "name", "scheduleUrl", "timeZone"]) ||
    value.source.id !== PERSONAL_BEA_CALENDAR_SOURCE.id ||
    value.source.name !== PERSONAL_BEA_CALENDAR_SOURCE.name ||
    value.source.scheduleUrl !== PERSONAL_BEA_CALENDAR_SOURCE.scheduleUrl ||
    value.source.timeZone !== PERSONAL_BEA_CALENDAR_SOURCE.timeZone ||
    !isUtcInstant(value.fetchedAt) ||
    !hasKeys(value.window, ["fromInclusive", "toExclusive"]) ||
    value.window.fromInclusive !== value.fetchedAt ||
    !isUtcInstant(value.window.toExclusive) ||
    Date.parse(value.window.toExclusive) - Date.parse(value.fetchedAt) !==
      PERSONAL_ECONOMIC_CALENDAR_WINDOW_DAYS * 86_400_000 ||
    !Array.isArray(value.events) ||
    value.events.length > PERSONAL_ECONOMIC_CALENDAR_MAXIMUM_EVENTS
  ) {
    return false;
  }
  let previous: PersonalEconomicCalendarEventDto | undefined;
  for (const event of value.events) {
    if (
      !hasKeys(event, ["series", "scheduledAt"]) ||
      typeof event.series !== "string" ||
      event.series.length === 0 ||
      event.series.length > PERSONAL_ECONOMIC_CALENDAR_MAXIMUM_SERIES_LENGTH ||
      event.series.trim() !== event.series ||
      /[\p{Cc}\p{Cf}\p{Cs}]/u.test(event.series) ||
      !isUtcInstant(event.scheduledAt) ||
      event.scheduledAt < value.fetchedAt ||
      event.scheduledAt >= value.window.toExclusive ||
      (previous !== undefined &&
        (event.scheduledAt < previous.scheduledAt ||
          (event.scheduledAt === previous.scheduledAt &&
            event.series <= previous.series)))
    ) {
      return false;
    }
    previous = { series: event.series, scheduledAt: event.scheduledAt };
  }
  return true;
}

function hasKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isUtcInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return false;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
