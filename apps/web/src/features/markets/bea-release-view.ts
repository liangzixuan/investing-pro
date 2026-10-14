import type { PersonalEconomicCalendarDto } from "@research-cockpit/contracts";
import { groupBeaReleaseDates } from "./bea-release-dates";

type BeaReleaseDateGroup = ReturnType<typeof groupBeaReleaseDates>[number];

export interface BeaReleaseView {
  readonly response: PersonalEconomicCalendarDto | null;
  readonly selectedDate: string;
  readonly query: string;
  readonly groups: readonly BeaReleaseDateGroup[];
  readonly visibleGroups: readonly BeaReleaseDateGroup[];
  readonly visibleCount: number;
}

const normalize = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/gu, " ");

export function projectBeaReleaseView(
  response: PersonalEconomicCalendarDto | null,
  selectedDate: string,
  query: string,
): BeaReleaseView {
  const groups = groupBeaReleaseDates(response);
  const date = groups.some((group) => group.key === selectedDate)
    ? selectedDate
    : "";
  const phrase = normalize(query);
  const visibleGroups = groups.flatMap((group) => {
    if (date && group.key !== date) return [];
    if (!phrase) return [group];
    const events = group.events.filter((event) =>
      normalize(event.series).includes(phrase),
    );
    return events.length ? [{ ...group, events }] : [];
  });
  return {
    response,
    selectedDate: date,
    query,
    groups,
    visibleGroups,
    visibleCount: visibleGroups.reduce(
      (count, group) => count + group.events.length,
      0,
    ),
  };
}
