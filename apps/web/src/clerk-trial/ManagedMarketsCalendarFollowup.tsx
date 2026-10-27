import { useSyncExternalStore, type Ref } from "react";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import { ManagedMarketsDayView } from "./ManagedMarketsDayView";
import type { ManagedMarketsNavigationProps } from "./ManagedMarketsNavigation";
import { ManagedCalendarFollowupForm } from "./ManagedCalendarFollowupForm";
import { useCalendarSourceChoice } from "./ManagedMarketsCalendarFollowupChoice";
import "./managed-calendar-followup.css";

export interface ManagedMarketsCalendarFollowupProps {
  workspace: ManagedWorkspace;
  navigation: ManagedMarketsNavigationProps;
  headingRef?: Ref<HTMLHeadingElement>;
  isCurrent: () => boolean;
  navigationPending: boolean;
  onReview: (entry: ResearchFollowup) => void;
  onManageWatchlist: () => void;
}
function useCalendarSources(workspace: ManagedWorkspace) {
  useSyncExternalStore(
    workspace.marketsSourceReview.subscribe,
    workspace.marketsSourceReview.getSnapshot,
    workspace.marketsSourceReview.getSnapshot,
  );
  // Each source publishes independently of the workspace snapshot.
  useSyncExternalStore(
    workspace.blsCalendar.subscribe,
    workspace.blsCalendar.getSnapshot,
    workspace.blsCalendar.getSnapshot,
  );
  useSyncExternalStore(
    workspace.agenda.subscribe,
    workspace.agenda.getSnapshot,
    workspace.agenda.getSnapshot,
  );
  useSyncExternalStore(
    workspace.announcements.subscribe,
    workspace.announcements.getSnapshot,
    workspace.announcements.getSnapshot,
  );
  useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
    workspace.coordinator.getSnapshot,
  );
  useSyncExternalStore(
    workspace.followups.subscribe,
    workspace.followups.getSnapshot,
    workspace.followups.getSnapshot,
  );
  useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
    workspace.followups.coordinator.getSnapshot,
  );
  useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
}
export function ManagedMarketsCalendarFollowup(
  props: ManagedMarketsCalendarFollowupProps,
) {
  useCalendarSources(props.workspace);
  const controls = useCalendarSourceChoice(props);
  return (
    <>
      <ManagedMarketsDayView
        blsCalendar={props.workspace.blsCalendar}
        agenda={props.workspace.agenda}
        announcements={props.workspace.announcements}
        navigation={props.navigation}
        {...(props.headingRef ? { headingRef: props.headingRef } : {})}
        onKeepCheck={controls.onKeepCheck}
      />
      {controls.choice.reason && <p role="status">{controls.choice.reason}</p>}
      <ManagedCalendarFollowupForm
        key={controls.choice.revision}
        {...props}
        capture={controls.choice.capture}
        onClose={controls.onClose}
      />
    </>
  );
}
