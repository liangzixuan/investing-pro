import { useLayoutEffect, useRef, type RefObject } from "react";
import type {
  ManagedFilingsReview,
  ManagedFilingsReviewState,
} from "./managed-filings-review";

interface Action {
  model: ManagedFilingsReview;
  state: ManagedFilingsReviewState;
  active: boolean;
}
interface FocusRequest {
  state: ManagedFilingsReviewState;
  opener: HTMLButtonElement;
  target: RefObject<HTMLHeadingElement | null>;
}

/** A focus request belongs to one synchronous, committed user action. */
export function useManagedWatchlistDailyReviewControls(action: Action) {
  const committed = useRef<Action | null>(null);
  const pending = useRef<FocusRequest | null>(null);
  const current = () =>
    committed.current === action &&
    action.active &&
    action.state.active &&
    action.model.getSnapshot() === action.state;
  useLayoutEffect(() => {
    committed.current = action;
    const request = pending.current;
    pending.current = null;
    const target = request?.target.current;
    if (
      request &&
      request.state === action.state &&
      current() &&
      target?.isConnected &&
      target.getClientRects().length &&
      (document.activeElement === request.opener ||
        document.activeElement === document.body)
    )
      target.focus();
    return () => {
      committed.current = null;
    };
  });
  return {
    current,
    enabled:
      action.active && action.state.active && !action.state.catalogChanged,
    transition(
      opener: HTMLButtonElement,
      target: RefObject<HTMLHeadingElement | null>,
      change: () => ManagedFilingsReviewState | null | undefined,
    ) {
      if (!current()) return;
      const ownsFocus = document.activeElement === opener;
      pending.current = null;
      const installed = change();
      if (
        ownsFocus &&
        installed &&
        installed.active &&
        action.model.getSnapshot() === installed
      )
        pending.current = { state: installed, opener, target };
    },
  };
}
