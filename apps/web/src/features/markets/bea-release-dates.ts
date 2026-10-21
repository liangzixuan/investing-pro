import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  type PersonalEconomicCalendarDto,
  type PersonalEconomicCalendarEventDto,
} from "@research-cockpit/contracts";

const date = new Intl.DateTimeFormat("en-US", {
  timeZone: PERSONAL_BEA_CALENDAR_SOURCE.timeZone,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const key = new Intl.DateTimeFormat("en-US", {
  timeZone: PERSONAL_BEA_CALENDAR_SOURCE.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const formatBeaReleaseDate = (instant: string) =>
  date.format(new Date(instant));

export function groupBeaReleaseDates(
  agenda: Pick<PersonalEconomicCalendarDto, "events"> | null,
) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      events: PersonalEconomicCalendarEventDto[];
    }
  >();
  for (const event of agenda?.events ?? []) {
    const parts = key.formatToParts(new Date(event.scheduledAt));
    const day = ["year", "month", "day"]
      .map((type) => parts.find((part) => part.type === type)!.value)
      .join("-");
    const group = groups.get(day) ?? {
      key: day,
      label: formatBeaReleaseDate(event.scheduledAt),
      events: [],
    };
    group.events.push(event);
    groups.set(day, group);
  }
  return [...groups.values()];
}
