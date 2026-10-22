import { useLayoutEffect, useRef, type RefObject } from "react";
import type {
  ValuationDraftFileState,
  ValuationFileFocusRequest,
} from "./useValuationDraftFiles";
interface FileFocus {
  input: RefObject<HTMLInputElement | null>;
  heading: RefObject<HTMLHeadingElement | null>;
  requested: RefObject<ValuationFileFocusRequest>;
}
function ownsFocus(source: HTMLElement) {
  if (document.activeElement === source) return true;
  if (source.isConnected) return false;
  return document.activeElement === document.body;
}
function canReturnToInput(
  source: HTMLElement,
  state: ValuationDraftFileState,
  isCurrent: () => boolean,
) {
  if (!ownsFocus(source)) return false;
  if (!state.canImport) return false;
  return isCurrent();
}
function focusCancelledInput(
  focus: FileFocus,
  state: ValuationDraftFileState,
  isCurrent: () => boolean,
) {
  if (state.phase === "retired") focus.requested.current = null;
  if (state.phase !== "idle") return;
  const request = focus.requested.current;
  if (!request) return;
  focus.requested.current = null;
  if (!canReturnToInput(request.source, state, isCurrent)) return;
  focus.input.current?.focus();
}
function focusCompletedReview(
  previous: ValuationDraftFileState["phase"],
  state: ValuationDraftFileState,
  focus: FileFocus,
  isCurrent: () => boolean,
) {
  if (previous !== "reading") return;
  if (state.phase !== "review") return;
  if (document.activeElement !== focus.input.current) return;
  if (!isCurrent()) return;
  focus.heading.current?.focus();
}
export function useValuationDraftFileFocus(
  state: ValuationDraftFileState,
  isCurrent: () => boolean,
) {
  const input = useRef<HTMLInputElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previous = useRef(state.phase);
  const requested = useRef<ValuationFileFocusRequest>(null);
  const focus = { input, heading, requested };
  useLayoutEffect(() => {
    focusCancelledInput(focus, state, isCurrent);
    focusCompletedReview(previous.current, state, focus, isCurrent);
    previous.current = state.phase;
  }, [state.phase, state.canImport, isCurrent]);
  return focus;
}
