import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedMarketsState } from "./managed-markets";
import type { ManagedMarketsSourceReviewState } from "./managed-markets-source-review-types";
import type { ManagedBlsCalendarState } from "./managed-bls-calendar";
import type { ManagedBeaReleaseAgendaState } from "./managed-bea-release-agenda";
import type { ManagedFedAnnouncementsState } from "./managed-fed-announcements";
import type { ManagedCpiHeadlinesState } from "./managed-cpi-headlines";
import type { CalendarFollowupSource } from "./managed-calendar-followup";

export interface ManagedMarketsBriefingSelection {
  readonly date?: string;
  readonly source?: string;
  readonly title?: string;
}

/** Complete reading evidence. No live source or draft mutation capability is retained. */
export interface ManagedMarketsBriefingReading {
  readonly board: Readonly<ManagedMarketsState>;
  readonly pass: Readonly<ManagedMarketsSourceReviewState>;
  readonly bls: Readonly<ManagedBlsCalendarState>;
  readonly bea: Readonly<ManagedBeaReleaseAgendaState>;
  readonly fed: Readonly<ManagedFedAnnouncementsState>;
  readonly cpi: Readonly<ManagedCpiHeadlinesState>;
  readonly selected: CalendarFollowupSource;
  readonly entry: ResearchFollowup;
  readonly selection?: ManagedMarketsBriefingSelection;
}

/** Assessment and completion may change; the original question and listing may not. */
export function sameMarketsBriefingEntry(
  original: ResearchFollowup,
  current: ResearchFollowup | null,
) {
  return (
    current !== null &&
    original.id === current.id &&
    original.catalogSnapshotSha256 === current.catalogSnapshotSha256 &&
    original.check === current.check &&
    original.dueOn === current.dueOn &&
    JSON.stringify(original.listing) === JSON.stringify(current.listing)
  );
}
