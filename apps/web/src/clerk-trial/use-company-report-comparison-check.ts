import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CompanyReportRevisit } from "./company-report-revisit";
import type { CompanyReportComparisonCheckActions } from "./company-report-comparison-check-actions";
import {
  prepareCompanyReportComparisonCheck,
  staleComparisonCheck,
  type CompanyReportComparisonCheckPreview,
} from "./company-report-comparison-check";

interface State {
  preview: CompanyReportComparisonCheckPreview | null;
  message: string | null;
}
function ownsFocus(element: Element | null) {
  return (
    element !== null &&
    (document.activeElement === element ||
      (!element.isConnected && document.activeElement === document.body))
  );
}
export function useCompanyReportComparisonCheck(
  controller: CompanyReportRevisit,
  actions: CompanyReportComparisonCheckActions,
) {
  useSyncExternalStore(
    actions.subscribe,
    actions.getSnapshot,
    actions.getSnapshot,
  );
  const [state, setState] = useState<State>({ preview: null, message: null });
  const lease = useRef<{
    preview: CompanyReportComparisonCheckPreview | null;
    busy: boolean;
  }>({ preview: null, busy: false });
  const committed = useRef<object | null>(null);
  const host = useRef<CompanyReportRevisit | null>(null);
  const prepareButton = useRef<HTMLButtonElement | null>(null);
  const previewHeading = useRef<HTMLHeadingElement | null>(null);
  const targetHeading = useRef<HTMLHeadingElement | null>(null);
  const focus = useRef<(() => void) | null>(null);
  const frame = {};
  const comparisonState = controller.getSnapshot();
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      if (committed.current === frame) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    host.current = controller;
    return () => {
      host.current = null;
      lease.current.preview?.cancel();
      lease.current.preview = null;
      focus.current = null;
    };
  }, [controller]);
  const target = actions.target();
  const preview = state.preview?.isCurrent() ? state.preview : null;
  const stale = state.preview !== null && preview === null;
  useLayoutEffect(() => {
    const pending = focus.current;
    focus.current = null;
    pending?.();
  });
  const current = () =>
    committed.current === frame &&
    host.current === controller &&
    controller.getSnapshot() === comparisonState &&
    !lease.current.busy;
  const cancel = () => {
    if (!current()) return;
    const initiating = document.activeElement;
    const comparison = controller.captureComparison();
    lease.current.preview?.cancel();
    lease.current.preview = null;
    focus.current = () => {
      if (
        host.current === controller &&
        ownsFocus(initiating) &&
        comparison?.isCurrent() &&
        target?.isCurrent() &&
        actions.target()?.entry === target.entry
      )
        prepareButton.current?.focus();
    };
    setState({ preview: null, message: null });
  };
  const prepare = () => {
    if (!current() || !target?.editable || !target.isCurrent()) return;
    const initiating = document.activeElement;
    lease.current.busy = true;
    lease.current.preview?.cancel();
    lease.current.preview = null;
    try {
      const capture = controller.captureComparison();
      const result = capture
        ? prepareCompanyReportComparisonCheck(
            capture,
            target,
            () => host.current === controller,
          )
        : { preview: null, reason: staleComparisonCheck };
      if (committed.current !== frame || host.current !== controller) {
        result.preview?.cancel();
        return;
      }
      lease.current.preview = result.preview;
      const prepared = result.preview;
      if (prepared)
        focus.current = () => {
          if (
            ownsFocus(initiating) &&
            lease.current.preview === prepared &&
            prepared.isCurrent()
          )
            previewHeading.current?.focus();
        };
      setState({ preview: result.preview, message: result.reason });
    } finally {
      lease.current.busy = false;
    }
  };
  const apply = () => {
    if (!current() || !preview || lease.current.preview !== preview) return;
    const initiating = document.activeElement;
    const comparison = controller.captureComparison();
    if (!comparison?.isCurrent()) return;
    lease.current.busy = true;
    try {
      const applied = preview.apply();
      lease.current.preview = null;
      if (host.current !== controller || !comparison.isCurrent()) return;
      const after = actions.target();
      if (!after?.isCurrent()) return;
      if (
        applied &&
        (after.entry.id !== preview.target.entry.id ||
          after.entry.result !== preview.result)
      )
        return;
      if (applied) {
        focus.current = () => {
          if (
            ownsFocus(initiating) &&
            after.isCurrent() &&
            actions.target()?.entry === after.entry
          )
            targetHeading.current?.focus();
        };
      }
      setState({
        preview: null,
        message: applied
          ? "Comparison applied to this check's assessment draft. Review, complete and Save follow-ups separately."
          : staleComparisonCheck,
      });
    } finally {
      lease.current.busy = false;
    }
  };
  return {
    target,
    preview,
    message: stale ? staleComparisonCheck : state.message,
    prepare,
    apply,
    cancel,
    prepareButton,
    previewHeading,
    targetHeading,
  };
}
