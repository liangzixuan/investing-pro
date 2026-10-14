import type {
  FedAnnouncementRefreshView,
  FedAnnouncementView,
} from "../features/markets/fed-announcement-view";
import type { ManagedFedRefreshComparison } from "./managed-fed-refresh-comparison";

/** Intersect title matches with the exact current loaded comparison. */
export function projectManagedFedUpdatesView(
  titles: FedAnnouncementView,
  comparison: ManagedFedRefreshComparison | null,
  requested: FedAnnouncementRefreshView,
) {
  const current = comparison?.current === titles.response ? comparison : null;
  const refreshView: FedAnnouncementRefreshView =
    current && requested === "new" ? "new" : "all";
  const urls = new Set(current?.newUrls ?? []);
  const view: FedAnnouncementView =
    refreshView === "new"
      ? {
          ...titles,
          visibleItems: titles.visibleItems.filter((item) =>
            urls.has(item.url),
          ),
        }
      : titles;
  return { view, refreshView, available: current !== null };
}
