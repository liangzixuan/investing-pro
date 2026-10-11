import {
  isPersonalEconomicCalendarDto,
  PERSONAL_BEA_CALENDAR_SOURCE,
  type PersonalEconomicCalendarDto,
} from "./personal-economic-calendar";

export const MANAGED_ECONOMIC_CALENDAR_PATH =
  "/v1/managed/economic-calendar" as const;
export const MANAGED_ECONOMIC_CALENDAR_LIMITS = Object.freeze({
  // Normalization repeats the series name per event, unlike the source JSON.
  responseBytes: 512 * 1_024,
  operationMs: 10_000,
});

/** Preserve the existing BEA window/source contract and detach caller-owned data. */
export function parseManagedEconomicCalendar(
  value: unknown,
): PersonalEconomicCalendarDto | null {
  if (!isPersonalEconomicCalendarDto(value)) return null;
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    source: PERSONAL_BEA_CALENDAR_SOURCE,
    fetchedAt: value.fetchedAt,
    window: Object.freeze({ ...value.window }),
    events: Object.freeze(
      value.events.map((event) =>
        Object.freeze({ series: event.series, scheduledAt: event.scheduledAt }),
      ),
    ),
  });
}
