import type { BeaAgendaComparison } from "../features/markets/bea-agenda-comparison";
import type {
  BeaReleaseRefreshView,
  BeaReleaseView,
} from "../features/markets/bea-release-view";

/** Intersect current series/date matches with exact current-only event objects. */
export function projectManagedBeaUpdatesView(
  releases: BeaReleaseView,
  comparison: BeaAgendaComparison | null,
  requested: BeaReleaseRefreshView,
) {
  const current = comparison?.current === releases.response ? comparison : null;
  const refreshView: BeaReleaseRefreshView =
    current && requested === "new" ? "new" : "all";
  if (refreshView === "all")
    return { view: releases, refreshView, available: current !== null };
  const entries = new Set(current!.addedEvents);
  const visibleGroups = releases.visibleGroups.flatMap((group) => {
    const events = group.events.filter((event) => entries.has(event));
    return events.length ? [{ ...group, events }] : [];
  });
  const view: BeaReleaseView = {
    ...releases,
    visibleGroups,
    visibleCount: visibleGroups.reduce(
      (count, group) => count + group.events.length,
      0,
    ),
  };
  return { view, refreshView, available: true };
}
