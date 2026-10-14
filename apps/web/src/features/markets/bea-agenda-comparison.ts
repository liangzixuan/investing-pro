import type { PersonalEconomicCalendarDto } from "@research-cockpit/contracts";

export interface BeaAgendaComparison {
  readonly previous: PersonalEconomicCalendarDto;
  readonly current: PersonalEconomicCalendarDto;
  readonly addedEvents: PersonalEconomicCalendarDto["events"];
}

/** Exact scheduled entries in two admitted windows, without a rescheduling claim. */
export function compareBeaAgendas(
  previous: PersonalEconomicCalendarDto | null,
  current: PersonalEconomicCalendarDto,
): BeaAgendaComparison | null {
  if (previous === null) return null;
  const key = (event: PersonalEconomicCalendarDto["events"][number]) =>
    JSON.stringify([event.series, event.scheduledAt]);
  const previousEntries = new Set(previous.events.map(key));
  return Object.freeze({
    previous,
    current,
    addedEvents: Object.freeze(
      current.events.filter((event) => !previousEntries.has(key(event))),
    ),
  });
}
