import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type {
  ManagedValuationReassessment,
  ManagedValuationReassessmentState,
} from "./managed-valuation-reassessment";

const noSubscribe = () => () => {};
const noSnapshot = () => null;

export function valuationFocusOrigin(): Element | null {
  return typeof document === "undefined" ? null : document.activeElement;
}

/** Focus belongs to the exact committed action, never a background publication. */
export function useValuationReassessmentView(
  model: ManagedValuationReassessment | undefined,
  navigationPending: boolean,
) {
  const state = useSyncExternalStore(
    model?.subscribe ?? noSubscribe,
    model?.getSnapshot ?? noSnapshot,
    model?.getSnapshot ?? noSnapshot,
  );
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const pending = useRef<{
    state: ManagedValuationReassessmentState;
    origin: Element | null;
  } | null>(null);
  const rendered = { model, state, navigationPending };
  const committed = useRef<typeof rendered | null>(null);
  useLayoutEffect(() => {
    committed.current = rendered;
    const requested = pending.current;
    pending.current = null;
    const heading = headingRef.current;
    if (
      requested &&
      !navigationPending &&
      state?.active &&
      state === requested.state &&
      model?.getSnapshot() === state &&
      heading?.isConnected &&
      (typeof document === "undefined" ||
        document.activeElement === requested.origin ||
        document.activeElement === document.body)
    )
      heading.focus();
    return () => {
      if (committed.current === rendered) committed.current = null;
    };
  });
  const ready = () =>
    committed.current === rendered &&
    !navigationPending &&
    model !== undefined &&
    model.getSnapshot() === state;
  const requestFocus = (
    next: ManagedValuationReassessmentState | null,
    origin: Element | null,
  ) => {
    if (next && !navigationPending && model?.getSnapshot() === next)
      pending.current = { state: next, origin };
  };
  return { state, headingRef, ready, requestFocus };
}
