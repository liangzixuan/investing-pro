import { useLayoutEffect, useRef } from "react";
import type { ResearchDraftSetRecoveryState } from "./managed-research-draft-set-recovery";
import type { DraftSetFocusRequest } from "./useResearchDraftSetFiles";
function ownsFocus(request: DraftSetFocusRequest) {
  if (!request.ownedBeforeAction) return false;
  if (document.activeElement === request.source) return true;
  if (document.activeElement !== document.body) return false;
  return request.source.disabled || !request.source.isConnected;
}
export function useResearchDraftSetFileFocus(
  state: ResearchDraftSetRecoveryState,
  isCurrent: () => boolean,
) {
  const input = useRef<HTMLInputElement | null>(null),
    capture = useRef<HTMLButtonElement | null>(null),
    heading = useRef<HTMLHeadingElement | null>(null);
  const watchlist = useRef<HTMLButtonElement | null>(null),
    portfolio = useRef<HTMLButtonElement | null>(null),
    followups = useRef<HTMLButtonElement | null>(null),
    valuation = useRef<HTMLButtonElement | null>(null);
  const requested = useRef<DraftSetFocusRequest | null>(null),
    reading = useRef<HTMLInputElement | null>(null);
  const focus = {
    input,
    capture,
    heading,
    watchlist,
    portfolio,
    followups,
    valuation,
    requested,
    reading,
  };
  useLayoutEffect(() => {
    const request = requested.current;
    requested.current = null;
    if (request && request.state === state && isCurrent() && ownsFocus(request))
      focus[request.target].current?.focus();
    if (reading.current && state.phase === "inventory") {
      const source = reading.current;
      reading.current = null;
      if (isCurrent() && document.activeElement === source)
        heading.current?.focus();
    }
    if (state.phase === "idle" || state.phase === "retired")
      reading.current = null;
  }, [state]);
  return focus;
}
export type ResearchDraftSetFileFocus = ReturnType<
  typeof useResearchDraftSetFileFocus
>;
