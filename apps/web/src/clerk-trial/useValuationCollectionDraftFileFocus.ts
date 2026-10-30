import { useLayoutEffect, useRef, type RefObject } from "react";
import type { ValuationCollectionRecoveryState } from "./managed-valuation-collection-recovery";
interface FocusRequest {
  state: ValuationCollectionRecoveryState;
  source: HTMLButtonElement;
  ownedBeforeAction: boolean;
  to: "input" | "heading" | "capture";
}
export interface ValuationCollectionFileFocus {
  capture: RefObject<HTMLButtonElement | null>;
  input: RefObject<HTMLInputElement | null>;
  heading: RefObject<HTMLHeadingElement | null>;
  requested: RefObject<FocusRequest | null>;
  reading: RefObject<HTMLElement | null>;
}
function ownsFocus(request: FocusRequest) {
  if (!request.ownedBeforeAction) return false;
  if (document.activeElement === request.source) return true;
  if (document.activeElement !== document.body) return false;
  return request.source.disabled || !request.source.isConnected;
}
function focusCommittedRequest(
  focus: ValuationCollectionFileFocus,
  state: ValuationCollectionRecoveryState,
  isCurrent: () => boolean,
) {
  const request = focus.requested.current;
  if (!request) return;
  focus.requested.current = null;
  if (request.state !== state) return;
  if (!isCurrent() || !ownsFocus(request)) return;
  focus[request.to].current?.focus();
}
function focusReadReview(
  focus: ValuationCollectionFileFocus,
  state: ValuationCollectionRecoveryState,
  isCurrent: () => boolean,
) {
  if (focus.reading.current && state.phase === "review") {
    const source = focus.reading.current;
    focus.reading.current = null;
    if (isCurrent() && document.activeElement === source)
      focus.heading.current?.focus();
  }
  if (state.phase === "idle" || state.phase === "retired")
    focus.reading.current = null;
}
export function useValuationCollectionDraftFileFocus(
  state: ValuationCollectionRecoveryState,
  isCurrent: () => boolean,
): ValuationCollectionFileFocus {
  const capture = useRef<HTMLButtonElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const requested = useRef<FocusRequest | null>(null);
  const reading = useRef<HTMLElement | null>(null);
  const focus = { capture, input, heading, requested, reading };
  useLayoutEffect(() => {
    focusCommittedRequest(focus, state, isCurrent);
    focusReadReview(focus, state, isCurrent);
  }, [state]);
  return focus;
}
