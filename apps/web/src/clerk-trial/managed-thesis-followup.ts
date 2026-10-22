import type { WatchlistMembership } from "@research-cockpit/contracts";
import type { ManagedResearchFollowups } from "./managed-research-followups";

export interface ThesisFollowupContext {
  readonly model: ManagedResearchFollowups;
  readonly member: WatchlistMembership;
  readonly isCurrent: () => boolean;
}
