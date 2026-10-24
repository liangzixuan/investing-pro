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
  return {
    heading,
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
      remember(button, "finished", -1);
      model.finish(state);
    },
    research: (button: HTMLButtonElement) => {
      if (!current()) return;
      const entry = model.captureCurrent(state);
      if (entry && current()) props.onResearch(entry, button);
    },
  };
}
