import { useLayoutEffect, useRef } from "react";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type {
  FollowupsReviewHandle,
  FollowupsReviewState,
} from "./managed-followups-review-session";

interface Props {
  workspace: ManagedWorkspace;
  state: FollowupsReviewState;
  active: boolean;
  routeActive: () => boolean;
  onResearch: (entry: ResearchFollowup, opener: HTMLButtonElement) => void;
}

export function useManagedFollowupsReviewControls(props: Props) {
  const { workspace, state } = props;
  const model = workspace.followupsReview;
  const committed = useRef<Props | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const transition = useRef<{
    button: HTMLButtonElement;
    phase: FollowupsReviewState["phase"];
    position: number;
    state?: FollowupsReviewState;
  } | null>(null);
  const routeCurrent = () => {
    const current = workspace.getSnapshot();
    return (
      props.active &&
      props.routeActive() &&
      workspace.sessionOwner.getSnapshot().phase === "active" &&
      current.view === "followups" &&
      !current.research &&
      !current.companyRoute &&
      !current.followupOpening
    );
  };
  const current = () =>
    committed.current === props &&
    routeCurrent() &&
    model.getSnapshot() === state;
  useLayoutEffect(() => {
    committed.current = props;
    return () => {
      if (committed.current === props) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    const request = transition.current;
    transition.current = null;
    const target = heading.current;
    if (
      !request ||
      !current() ||
      state.phase !== request.phase ||
      state.position !== request.position ||
      (request.state && state !== request.state) ||
      !target?.isConnected
    )
      return;
    if (target.closest("[hidden], [inert]") || !target.getClientRects().length)
      return;
    if (
      document.activeElement !== request.button &&
      document.activeElement !== document.body
    )
      return;
    target.focus({ preventScroll: true });
  }, [state, props.active]);
  const remember = (
    button: HTMLButtonElement,
    phase: FollowupsReviewState["phase"],
    position: number,
  ) => {
    if (document.activeElement === button)
      transition.current = { button, phase, position };
  };
  const assessmentClock = new Date(
    workspace.followups.getSnapshot().assessmentTime ?? NaN,
  );
  const selected = routeCurrent() ? model.captureCurrent(state) : null;
  const changeStatus = (
    button: HTMLButtonElement,
    status: ResearchFollowup["status"],
  ) => {
    if (!current()) return;
    const entry = model.captureCurrent(state);
    if (!entry || entry.status === status || !current()) return;
    const ownsFocus = document.activeElement === button;
    let publications = 0;
    const unsubscribe = model.subscribe(() => {
      publications++;
    });
    try {
      if (status === "completed")
        workspace.followups.complete(entry, assessmentClock);
      else workspace.followups.reopen(entry);
    } finally {
      unsubscribe();
    }
    const next = model.getSnapshot();
    // Reentrant notifications may already have moved or replaced this check.
    if (
      ownsFocus &&
      publications === 1 &&
      next.phase === "reviewing" &&
      next.position === state.position &&
      next.selected?.handle === state.selected?.handle &&
      next.selected?.entry.status === status
    )
      transition.current = {
        button,
        phase: next.phase,
        position: next.position,
        state: next,
      };
  };
  return {
    heading,
    canComplete: selected?.status === "open",
    canReopen: selected?.status === "completed",
    complete: (button: HTMLButtonElement) => changeStatus(button, "completed"),
    reopen: (button: HTMLButtonElement) => changeStatus(button, "open"),
    canEnter: routeCurrent() && workspace.followups.getReviewContext() !== null,
    canStart: routeCurrent() && model.canStart(state),
    canContinue: routeCurrent() && model.canContinue(state),
    enabled: routeCurrent() && state.available,
    enter: (button: HTMLButtonElement) => {
      if (!current()) return;
      remember(button, "choosing", -1);
      model.enter();
    },
    choose: (handle: FollowupsReviewHandle) => {
      if (current()) model.choose(state, handle);
    },
    canChoose: (handle: FollowupsReviewHandle) =>
      routeCurrent() && model.canChoose(state, handle),
    start: (button: HTMLButtonElement) => {
      if (!current()) return;
      remember(button, "reviewing", 0);
      model.start(state);
    },
    next: (button: HTMLButtonElement) => {
      if (!current()) return;
      remember(button, "reviewing", state.position + 1);
      model.continue(state);
    },
    finish: (button: HTMLButtonElement) => {
      if (!current()) return;
      const ownsFocus = document.activeElement === button;
      let publications = 0;
      const unsubscribe = model.subscribe(() => {
        publications++;
      });
      try {
        model.finish(state);
      } finally {
        unsubscribe();
      }
      const next = model.getSnapshot();
      if (
        ownsFocus &&
        publications === 1 &&
        next.phase === "finished" &&
        next.chosen === state.chosen &&
        next.selected === null &&
        next.position === -1
      )
        transition.current = {
          button,
          phase: next.phase,
          position: next.position,
          state: next,
        };
    },
    research: (button: HTMLButtonElement) => {
      if (!current()) return;
      const entry = model.captureCurrent(state);
      if (entry && current()) props.onResearch(entry, button);
    },
  };
}
