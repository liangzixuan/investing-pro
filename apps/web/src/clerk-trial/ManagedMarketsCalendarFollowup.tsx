import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { CalendarSourceCapture } from "./managed-calendar-followup";
import { ManagedMarketsDayView } from "./ManagedMarketsDayView";
import type { ManagedMarketsNavigationProps } from "./ManagedMarketsNavigation";
import { ManagedCalendarFollowupForm } from "./ManagedCalendarFollowupForm";
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
interface Choice {
  capture: CalendarSourceCapture | null;
  revision: number;
  reason: string | null;
}
export function ManagedMarketsCalendarFollowup(
  props: ManagedMarketsCalendarFollowupProps,
) {
  useCalendarSources(props.workspace);
  const [choice, setChoice] = useState<Choice>({
    capture: null,
    revision: 0,
    reason: null,
  });
  const render = { props, choice };
  const committed = useRef<typeof render | null>(null);
  const focusFrom = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) committed.current = null;
    };
  });
  const current = () =>
    committed.current === render &&
    props.isCurrent() &&
    !props.navigationPending;
  return (
    <>
      <ManagedMarketsDayView
        blsCalendar={props.workspace.blsCalendar}
        agenda={props.workspace.agenda}
        announcements={props.workspace.announcements}
        navigation={props.navigation}
        {...(props.headingRef ? { headingRef: props.headingRef } : {})}
        onKeepCheck={(entry, selectionIsCurrent) => {
          if (!current() || !selectionIsCurrent()) return;
          const result = props.workspace.captureMarketsCalendarSource(
            entry.key,
            selectionIsCurrent,
          );
          if (!current() || !selectionIsCurrent()) return;
          committed.current = null;
          if (result.capture) {
            focusFrom.current =
              typeof document !== "undefined" &&
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            setChoice({
              capture: result.capture,
              revision: choice.revision + 1,
              reason: null,
            });
          } else setChoice({ ...choice, reason: result.reason });
        }}
      />
      {choice.reason && <p role="status">{choice.reason}</p>}
      <ManagedCalendarFollowupForm
        key={choice.revision}
        {...props}
        capture={choice.capture}
        onClose={() => {
          if (current() && focusFrom.current?.isConnected)
            focusFrom.current.focus({ preventScroll: true });
        }}
      />
    </>
  );
}
