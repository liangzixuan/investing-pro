import {
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type RefObject,
} from "react";
import type {
  ManagedFilingsReview,
  ManagedFilingsReviewCapture,
  ManagedFilingsReviewState,
} from "./managed-filings-review";
import type { ManagedWatchlistFilingsMember } from "./managed-watchlist-filings";

type ButtonEvent = MouseEvent<HTMLButtonElement>;
type OnView = (
  capture: ManagedFilingsReviewCapture,
  opener: HTMLButtonElement,
) => void;
interface Action {
  model: ManagedFilingsReview;
  state: ManagedFilingsReviewState;
  active: boolean;
}
interface FocusRequest {
  member: symbol;
  control: HTMLButtonElement;
}
interface TransitionRequest {
  control: HTMLButtonElement;
  target: "group" | "company";
  member: symbol | null;
}
interface FocusBindings {
  load: RefObject<HTMLButtonElement | null>;
  group: RefObject<HTMLHeadingElement | null>;
  company: RefObject<HTMLHeadingElement | null>;
  cancel: RefObject<FocusRequest | null>;
  transition: RefObject<TransitionRequest | null>;
}
export function selectedReviewRow(state: ManagedFilingsReviewState) {
  return state.rows.find((row) => row.member === state.selected);
}
function packetCapture(
  state: ManagedFilingsReviewState,
): ManagedFilingsReviewCapture | null {
  const selected = selectedReviewRow(state);
  if (!selected?.filings.response) return null;
  return { member: selected.member, response: selected.filings.response };
}
function ownsFocus(control: HTMLButtonElement) {
  return (
    document.activeElement === control ||
    document.activeElement === document.body
  );
}
function focusVisible(target: HTMLElement | null) {
  if (!target?.isConnected) return;
  if (!target.getClientRects().length) return;
  target.focus();
}
function canRestoreFocus(
  request: { control: HTMLButtonElement },
  action: Action,
) {
  return action.active && action.state.active && ownsFocus(request.control);
}
function restoreCancelledCheck(
  request: FocusRequest | null,
  action: Action,
  focus: FocusBindings,
) {
  if (!request) return;
  if (!canRestoreFocus(request, action)) return;
  if (action.state.selected?.handle !== request.member) return;
  const button = focus.load.current;
  if (!button || button.disabled) return;
  focusVisible(button);
}
function transitionTarget(
  request: TransitionRequest,
  state: ManagedFilingsReviewState,
  focus: FocusBindings,
) {
  if (request.target === "group")
    return state.rows.length === 0 ? focus.group.current : null;
  return state.selected?.handle === request.member
    ? focus.company.current
    : null;
}
function restoreTransition(
  request: TransitionRequest | null,
  action: Action,
  focus: FocusBindings,
) {
  if (!request) return;
  if (!canRestoreFocus(request, action)) return;
  focusVisible(transitionTarget(request, action.state, focus));
}
function rememberTransition(
  event: ButtonEvent,
  target: TransitionRequest["target"],
  member: symbol | null,
  focus: FocusBindings,
) {
  if (document.activeElement !== event.currentTarget) return;
  focus.transition.current = { control: event.currentTarget, target, member };
}
function selectionCommands(
  action: Action,
  current: () => boolean,
  focus: FocusBindings,
) {
  const { model, state } = action;
  return {
    choose: (member: ManagedWatchlistFilingsMember) => {
      if (current()) model.choose(state, member);
    },
    select: (member: ManagedWatchlistFilingsMember) => {
      if (current()) model.select(state, member);
    },
    start: (event: ButtonEvent) => {
      if (!current()) return;
      rememberTransition(
        event,
        "company",
        state.chosen[0]?.handle ?? null,
        focus,
      );
      model.start(state);
    },
    finish: (event: ButtonEvent) => {
      if (!current()) return;
      rememberTransition(event, "group", null, focus);
      model.finish(state);
    },
  };
}
function rememberCancel(
  event: ButtonEvent,
  state: ManagedFilingsReviewState,
  focus: FocusBindings,
) {
  if (!state.selected) return;
  focus.cancel.current =
    document.activeElement === event.currentTarget
      ? { member: state.selected.handle, control: event.currentTarget }
      : null;
}
function sourceCommands(
  action: Action,
  current: () => boolean,
  focus: FocusBindings,
  onView: OnView,
) {
  const { model, state } = action;
  return {
    load: () => {
      if (current()) void model.load(state);
    },
    cancel: (event: ButtonEvent) => {
      if (!current()) return;
      rememberCancel(event, state, focus);
      model.cancel();
    },
    inspect: (event: ButtonEvent) => {
      if (!current()) return;
      const capture = packetCapture(state);
      if (!capture) return;
      if (model.canAdmit(capture)) onView(capture, event.currentTarget);
    },
  };
}
function isCurrent(committed: Action | null, action: Action) {
  return (
    committed === action &&
    action.active &&
    action.state.active &&
    action.model.getSnapshot() === action.state
  );
}
function canInspect(action: Action) {
  const capture = packetCapture(action.state);
  return capture !== null && action.model.canAdmit(capture);
}

export function useManagedFilingsReviewControls(
  model: ManagedFilingsReview,
  state: ManagedFilingsReviewState,
  active: boolean,
  onView: OnView,
) {
  const action: Action = { model, state, active };
  const committed = useRef<Action | null>(null);
  const load = useRef<HTMLButtonElement | null>(null);
  const cancel = useRef<FocusRequest | null>(null);
  const group = useRef<HTMLHeadingElement | null>(null);
  const company = useRef<HTMLHeadingElement | null>(null);
  const transition = useRef<TransitionRequest | null>(null);
  const focus: FocusBindings = { load, cancel, group, company, transition };
  const current = () => isCurrent(committed.current, action);
  const running = selectedReviewRow(state)?.filings.running;
  useLayoutEffect(() => {
    committed.current = action;
    return () => {
      committed.current = null;
    };
  });
  useLayoutEffect(() => {
    if (running) return;
    const request = cancel.current;
    cancel.current = null;
    restoreCancelledCheck(request, action, focus);
  }, [active, state.active, running, state.selected]);
  useLayoutEffect(() => {
    const request = transition.current;
    transition.current = null;
    restoreTransition(request, action, focus);
  }, [active, state.active, state.rows, state.selected]);
  return {
    enabled: active && state.active,
    canLoad: model.canLoad(state),
    canInspect: canInspect(action),
    focus,
    ...selectionCommands(action, current, focus),
    ...sourceCommands(action, current, focus, onView),
  };
}
export type ManagedFilingsReviewControls = ReturnType<
  typeof useManagedFilingsReviewControls
>;
