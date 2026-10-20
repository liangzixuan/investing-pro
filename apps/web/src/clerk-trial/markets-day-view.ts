import type {
  ManagedBlsCalendarDto,
  PersonalEconomicCalendarDto,
  PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import { formatBeaReleaseDate } from "../features/markets/bea-release-dates";

export type MarketsDaySource = "all" | "bea" | "bls" | "fed";
export interface MarketsDayEntry {
  readonly key: string;
  readonly source: "bea" | "bls" | "fed";
  readonly title: string;
  readonly instant: string | null;
  readonly url: string;
}
const easternDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function dateKey(instant: string) {
  const parts = easternDate.formatToParts(new Date(instant));
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
}

/** A local view of already admitted packets, not a raw response validator. */
export function projectMarketsDayView(
  bls: ManagedBlsCalendarDto | null,
  agenda: PersonalEconomicCalendarDto | null,
  announcements: PersonalMonetaryAnnouncementsDto | null,
  selectedDate: string,
  source: MarketsDaySource,
) {
  const entries: Readonly<MarketsDayEntry>[] = [
    ...(bls?.events ?? []).map((event) =>
      Object.freeze({
        key: `bls:${JSON.stringify([event.series, event.scheduledAt])}`,
        source: "bls" as const,
        title: event.series,
        instant: event.scheduledAt,
        url: bls!.source.scheduleUrl,
      }),
    ),
    ...(agenda?.events ?? []).map((event) =>
      Object.freeze({
        key: `bea:${JSON.stringify([event.series, event.scheduledAt])}`,
        source: "bea" as const,
        title: event.series,
        instant: event.scheduledAt,
        url: agenda!.source.scheduleUrl,
      }),
    ),
    ...(announcements?.items ?? []).map((item) =>
      Object.freeze({
        key: `fed:${item.url}`,
        source: "fed" as const,
        title: item.title,
        instant: item.publishedAt,
        url: item.url,
      }),
    ),
  ];
  // Exact instants determine order, including the repeated hour at DST fall-back.
  const dated = entries
    .filter((entry) => entry.instant !== null)
    .sort((a, b) =>
      a.instant! < b.instant! ? -1 : a.instant! > b.instant! ? 1 : 0,
    );
  const dates = new Map<
    string,
    { date: string; label: string; entries: Readonly<MarketsDayEntry>[] }
  >();
  for (const entry of dated) {
    const date = dateKey(entry.instant!);
    const group = dates.get(date) ?? {
      date,
      label: formatBeaReleaseDate(entry.instant!),
      entries: [],
    };
    group.entries.push(entry);
    dates.set(date, group);
  }
  const groups = [...dates.values()].map((group) =>
    Object.freeze({ ...group, entries: Object.freeze(group.entries) }),
  );
  const date = dates.has(selectedDate) ? selectedDate : "";
  const matchesSource = (entry: MarketsDayEntry) =>
    source === "all" || entry.source === source;
  const visibleGroups = groups.flatMap((group) => {
    if (date && date !== group.date) return [];
    const rows = group.entries.filter(matchesSource);
    return rows.length
      ? [Object.freeze({ ...group, entries: Object.freeze(rows) })]
      : [];
  });
  // An unknown timestamp cannot be assigned to a selected date. Keep it separately visible.
  const unknown = entries.filter(
    (entry) => entry.instant === null && matchesSource(entry),
  );
  return Object.freeze({
    selectedDate: date,
    source,
    groups: Object.freeze(groups),
    visibleGroups: Object.freeze(visibleGroups),
    unknown: Object.freeze(unknown),
    loadedCount: entries.length,
    visibleDatedCount: visibleGroups.reduce(
      (count, group) => count + group.entries.length,
      0,
    ),
  });
}
