import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { FollowupsReviewFilingsState } from "./managed-followups-review-filings";

export interface ReviewFilingsProps {
  workspace: ManagedWorkspace;
  active: boolean;
  routeActive: () => boolean;
  onInspect?:
    | ((state: FollowupsReviewFilingsState, opener: HTMLButtonElement) => void)
    | undefined;
}

export function useManagedFollowupsReviewFilings(props: ReviewFilingsProps) {
  const model = props.workspace.reviewFilings;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  useSyncExternalStore(
    props.workspace.subscribe,
    props.workspace.getSnapshot,
    props.workspace.getSnapshot,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const committed = useRef<object | null>(null);
  const pendingFocus = useRef<{
    state: FollowupsReviewFilingsState;
    button: HTMLButtonElement;
  } | null>(null);
  const frame = { used: false };
  const routeCurrent = () => {
    const view = props.workspace.getSnapshot();
    return (
      props.active &&
      props.routeActive() &&
      props.workspace.sessionOwner.getSnapshot().phase === "active" &&
      view.view === "followups" &&
      !view.research &&
      !view.companyRoute &&
      !view.followupOpening
    );
  };
  const current = () =>
    committed.current === frame &&
    !frame.used &&
    routeCurrent() &&
    model.getSnapshot() === state;
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      if (committed.current === frame) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    const request = pendingFocus.current;
    pendingFocus.current = null;
    const target = heading.current;
    if (
      !request ||
      request.state !== state ||
      !current() ||
      !target?.isConnected ||
      target.closest("[hidden], [inert]") ||
      !target.getClientRects().length
    )
      return;
    if (
      document.activeElement !== request.button &&
      document.activeElement !== document.body
    )
      return;
    target.focus({ preventScroll: true });
  });
  const change = (button: HTMLButtonElement, cancel: boolean) => {
    if (
      !current() ||
      !state.selected ||
      (cancel ? !state.selected.filings.running : !model.canLoad(state))
    )
      return;
    frame.used = true;
    const ownsFocus = document.activeElement === button;
    let publications = 0;
    const unsubscribe = model.subscribe(() => {
      publications++;
    });
    try {
      if (cancel) model.cancel(state);
      else void model.load(state);
    } finally {
      unsubscribe();
    }
    const next = model.getSnapshot();
    if (
      ownsFocus &&
      publications === 1 &&
      routeCurrent() &&
      next !== state &&
      next.selected?.handle === state.selected.handle &&
      next.selected.entry === state.selected.entry
    )
      pendingFocus.current = { state: next, button };
  };
  return {
    state,
    heading,
    canLoad: routeCurrent() && model.canLoad(state),
    canCancel: routeCurrent() && Boolean(state.selected?.filings.running),
    canInspect:
      routeCurrent() && Boolean(props.onInspect) && model.canInspect(state),
    load: (button: HTMLButtonElement) => change(button, false),
    cancel: (button: HTMLButtonElement) => change(button, true),
    inspect: (button: HTMLButtonElement) => {
      if (!current() || !props.onInspect || !model.canInspect(state)) return;
      frame.used = true;
      props.onInspect(state, button);
    },
  };
}
