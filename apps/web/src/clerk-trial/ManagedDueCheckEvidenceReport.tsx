import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import { createManagedDueCheckEvidenceReportSource } from "./managed-due-check-evidence-report-source";
import { DueCheckEvidenceReportController } from "./due-check-evidence-report-controller";
import type { DueCheckEvidenceReportDeliveryAdapter } from "./due-check-evidence-report-ports";
import type { PreparedDueCheckEvidenceReport } from "./due-check-evidence-report";
import { formatDueCheckEvidenceReportHtml } from "./due-check-evidence-report-html";
import { DueCheckEvidenceReportSnapshot } from "./DueCheckEvidenceReportSnapshot";

const empty = Object.freeze({ report: null, saving: false, message: "" });
const emptySnapshot = () => empty;
const noop = () => () => {};
const unavailable = () => false;

export function ManagedDueCheckEvidenceReport(props: {
  readonly workspace: ManagedWorkspace;
  readonly active: boolean;
  readonly routeActive: () => boolean;
  readonly delivery: DueCheckEvidenceReportDeliveryAdapter | undefined;
}) {
  const latest = useRef(props);
  latest.current = props;
  const { workspace, delivery } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  const focusRequest = useRef<PreparedDueCheckEvidenceReport | null>(null);
  const [owned, setOwned] = useState<{
    source: ReturnType<typeof createManagedDueCheckEvidenceReportSource>;
    controller: DueCheckEvidenceReportController;
  } | null>(null);
  useLayoutEffect(() => {
    const source = createManagedDueCheckEvidenceReportSource(
      workspace,
      () => latest.current.active && latest.current.routeActive(),
    );
    const controller = new DueCheckEvidenceReportController(
      source,
      delivery,
      formatDueCheckEvidenceReportHtml,
    );
    setOwned({ source, controller });
    return () => {
      controller.dispose();
      source.dispose();
    };
  }, [workspace, delivery]);
  const state = useSyncExternalStore(
    owned?.controller.subscribe ?? noop,
    owned?.controller.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  );
  const ready = useSyncExternalStore(
    owned?.source.subscribe ?? noop,
    owned?.source.canCapture ?? unavailable,
    unavailable,
  );
  const review = useSyncExternalStore(
    workspace.followupsReview.subscribe,
    workspace.followupsReview.getSnapshot,
    workspace.followupsReview.getSnapshot,
  );
  useLayoutEffect(() => {
    owned?.source.reconcile();
    const requested = focusRequest.current;
    focusRequest.current = null;
    if (
      requested &&
      latest.current.active &&
      latest.current.routeActive() &&
      requested === state.report &&
      owned?.controller.getSnapshot().report === requested
    )
      heading.current?.focus();
  });
  if (review.phase !== "finished") return null;
  return (
    <section aria-labelledby="managed-due-check-report-heading">
      <h4 id="managed-due-check-report-heading" ref={heading} tabIndex={-1}>
        Keep this finished review
      </h4>
      <p>
        Prepare a private report with the chosen checks, authored assessments
        and complete retained evidence. Save Follow-ups separately.
      </p>
      <button
        type="button"
        id="managed-due-check-report-prepare"
        disabled={!props.active || !ready || state.saving}
        onClick={() => {
          if (!latest.current.active || !latest.current.routeActive() || !owned)
            return;
          owned.controller.prepare();
          focusRequest.current = owned.controller.getSnapshot().report;
        }}
      >
        Prepare finished review report
      </button>
      {state.report && (
        <>
          <details id="managed-due-check-report-preview">
            <summary>Preview complete finished review report</summary>
            <DueCheckEvidenceReportSnapshot report={state.report} />
          </details>
          {delivery && (
            <button
              type="button"
              id="managed-due-check-report-save"
              disabled={!props.active || state.saving}
              onClick={() => {
                if (latest.current.active && latest.current.routeActive())
                  void owned?.controller.save();
              }}
            >
              {delivery.actionLabel ?? "Save finished review (HTML)"}
            </button>
          )}
          {state.saving && (
            <button
              type="button"
              id="managed-due-check-report-cancel"
              onClick={() => owned?.controller.cancel()}
            >
              Cancel report save
            </button>
          )}
          <button
            type="button"
            id="managed-due-check-report-close"
            onClick={() => owned?.controller.close()}
          >
            Clear finished report preview
          </button>
        </>
      )}
      <p role="status" aria-live="polite">
        {state.message}
      </p>
    </section>
  );
}
