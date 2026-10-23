import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CompanyReportRevisit,
  type CompanyReportRevisitState,
} from "./company-report-revisit";
import {
  captureCompanyReportRevisit,
  type CompanyReportRevisitProps,
} from "./company-report-revisit-capture";

const empty: CompanyReportRevisitState = {
  phase: "idle",
  archive: null,
  current: null,
  assessment: "",
  preview: null,
  message: "",
};
const emptySnapshot = () => empty;
const noop = () => () => {};
function useRevisitController(props: CompanyReportRevisitProps) {
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const [controller, setController] = useState<CompanyReportRevisit | null>(
    null,
  );
  const { selection, price, annual, filings, valuation } = props;
  useLayoutEffect(() => {
    const next = new CompanyReportRevisit({
      selection,
      active: () =>
        latest.current.selection === selection &&
        latest.current.target()?.isCurrent() === true,
      capture: () => captureCompanyReportRevisit(latest.current),
    });
    setController(next);
    return () => next.dispose();
  }, [selection, price, annual, filings, valuation]);
  return controller;
}
function useRevisitSnapshot(controller: CompanyReportRevisit | null) {
  useLayoutEffect(() => controller?.reconcile());
  const state = useSyncExternalStore(
    controller?.subscribe ?? noop,
    controller?.getSnapshot ?? emptySnapshot,
    controller?.getSnapshot ?? emptySnapshot,
  );
  return state;
}
function useCommittedRevisitAction(controller: CompanyReportRevisit | null) {
  // Old handlers cannot act after another render, local edit, append or unmount.
  const frame = {};
  const committed = useRef<object | null>(null);
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      committed.current = null;
    };
  });
  const act = (action: () => void) => {
    if (committed.current !== frame) return;
    if (!controller) return;
    committed.current = null;
    action();
  };
  return act;
}
/** Controller lifetime, observation and committed actions keep their hook order. */
export function useCompanyReportRevisit(props: CompanyReportRevisitProps) {
  const controller = useRevisitController(props);
  const state = useRevisitSnapshot(controller);
  const act = useCommittedRevisitAction(controller);
  return { controller, state, act };
}
export type CompanyReportRevisitControls = ReturnType<
  typeof useCompanyReportRevisit
>;
function readingFinished(
  previous: CompanyReportRevisitState["phase"],
  phase: CompanyReportRevisitState["phase"],
) {
  if (previous !== "reading") return false;
  return phase === "review";
}
function reportInputOwnsFocus(input: HTMLInputElement | null) {
  return document.activeElement === input;
}
export function useCompanyReportRevisitFocus(
  phase: CompanyReportRevisitState["phase"],
) {
  const input = useRef<HTMLInputElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previous = useRef(phase);
  useLayoutEffect(() => {
    if (readingFinished(previous.current, phase)) {
      if (reportInputOwnsFocus(input.current)) heading.current?.focus();
    }
    previous.current = phase;
  }, [phase]);
  return { input, heading };
}
export type CompanyReportRevisitFocus = ReturnType<
  typeof useCompanyReportRevisitFocus
>;
