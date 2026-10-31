import type { RefObject } from "react";
import type { CalendarSourceCapture } from "./managed-calendar-followup";
import type { FollowupReview, ManagedWorkspace } from "./managed-workspace";

interface Host {
  readonly workspace: ManagedWorkspace;
  readonly setView: (view: "watchlist" | "followups") => boolean;
  readonly setReview: (review: FollowupReview | null) => void;
  readonly watchlistNavigation: RefObject<HTMLButtonElement | null>;
  readonly followupsNavigation: RefObject<HTMLButtonElement | null>;
}
function focusNavigation(target: RefObject<HTMLButtonElement | null>) {
  target.current?.focus();
}
/** Reuse the existing exact-entry route and focus only after accepted navigation. */
export function marketsFollowupNavigation(host: Host) {
  return {
    review: (entry: FollowupReview["entry"]) => {
      const review = host.workspace.reviewFollowup(entry, () =>
        host.setView("followups"),
      );
      if (review) host.setReview(review);
    },
    reviewBriefing: (
      entry: FollowupReview["entry"],
      capture: CalendarSourceCapture,
      selection?: { date?: string; source?: string; title?: string },
    ) => {
      const review = host.workspace.reviewMarketsBriefingFollowup(
        entry,
        capture,
        () => host.setView("followups"),
        selection,
      );
      if (review) host.setReview(review);
    },
    manageWatchlist: () => {
      if (host.setView("watchlist")) focusNavigation(host.watchlistNavigation);
    },
    manageFollowups: () => {
      if (!host.setView("followups")) return;
      host.setReview(null);
      focusNavigation(host.followupsNavigation);
    },
  };
}
