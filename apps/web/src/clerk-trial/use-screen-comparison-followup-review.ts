import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  ScreenComparisonFollowupReview,
  emptyScreenComparisonFollowup,
  type ScreenComparisonFollowupProps,
} from "./use-screen-comparison-followup-state";
import {
  screenComparisonFollowupActionStatus,
  screenComparisonFollowupEvents,
  screenComparisonFollowupReadout,
} from "./use-screen-comparison-followup-events";
export type { ScreenComparisonFollowupProps } from "./use-screen-comparison-followup-state";
const empty = emptyScreenComparisonFollowup();
const idle = { getSnapshot: () => empty, subscribe: () => () => {} };
export function useScreenComparisonFollowupReview(
  props: ScreenComparisonFollowupProps,
) {
  const [stored, setStored] = useState<ScreenComparisonFollowupReview | null>(
    null,
  );
  useLayoutEffect(() => {
    const next = new ScreenComparisonFollowupReview(props);
    next.mount();
    setStored(next);
    return () => next.dispose();
  }, [props.workspace]);
  const controller = stored?.workspace === props.workspace ? stored : null;
  const store = controller ?? idle;
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const token = {};
  useLayoutEffect(() => {
    controller?.commit(token, props);
  });
  return {
    state,
    ...screenComparisonFollowupReadout(controller),
    saved: props.workspace.followups.coordinator.getSnapshot(),
    ...screenComparisonFollowupActionStatus(
      controller,
      props.navigationPending,
    ),
    ...screenComparisonFollowupEvents(controller, token, state),
  };
}
export type ScreenComparisonFollowupControls = ReturnType<
  typeof useScreenComparisonFollowupReview
>;
