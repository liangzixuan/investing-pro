import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  ScreenComparisonFollowupReview,
  emptyScreenComparisonFollowup,
  type ScreenComparisonFollowupProps,
} from "./use-screen-comparison-followup-state";
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
  const current = () => Boolean(controller?.current(token, state));
  return {
    state,
    destinations: controller?.destinations() ?? [],
    saved: props.workspace.followups.coordinator.getSnapshot(),
    disabled: !controller?.active() || props.navigationPending,
    canCapture: Boolean(controller?.canCapture()) && !props.navigationPending,
    canLoad: Boolean(controller?.canLoad()) && !props.navigationPending,
    canPrepare: Boolean(controller?.canPrepare()) && !props.navigationPending,
    readinessReason: controller?.readinessReason() ?? null,
    canReview: Boolean(controller?.canReview()) && !props.navigationPending,
    setOpen: (open: boolean) => {
      if (controller?.currentDisclosure(token, state)) controller.setOpen(open);
    },
    capture: () => {
      if (current()) controller?.capture();
    },
    edit: (field: "side" | "question" | "dueOn", value: string) => {
      if (current()) controller?.edit(field, value);
    },
    load: () => {
      if (current()) void controller?.load();
    },
    prepare: () => {
      if (current()) controller?.prepare();
    },
    create: () => {
      if (current() && state.preview) controller?.create(state.preview);
    },
    review: (opener: HTMLButtonElement) => {
      if (current()) controller?.review(opener);
    },
    cancel: () => current() && Boolean(controller?.cancel()),
  };
}
export type ScreenComparisonFollowupControls = ReturnType<
  typeof useScreenComparisonFollowupReview
>;
