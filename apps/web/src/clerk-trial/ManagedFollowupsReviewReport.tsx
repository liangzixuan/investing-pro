import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { FollowupsReviewReportDeliveryAdapter } from "./followups-review-report-ports";
import {
  FollowupsReviewReportController,
  emptyFollowupsReviewReport,
} from "./followups-review-report-controller";
import { createManagedFollowupsReviewReportSource } from "./managed-followups-review-report-source";
import { formatFollowupsReviewReportHtml } from "./followups-review-report-html";
import { FollowupsReviewReportSnapshot } from "./FollowupsReviewReportSnapshot";
import "./managed-followups-review-report.css";

interface Props {
  workspace: ManagedWorkspace;
  routeActive: () => boolean;
  delivery: FollowupsReviewReportDeliveryAdapter | undefined;
}
const empty = emptyFollowupsReviewReport();
const emptySnapshot = () => empty;
const noop = () => () => {};
const unavailable = () => false;
function useReport(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [owned, setOwned] = useState<{
    controller: FollowupsReviewReportController;
    source: ReturnType<typeof createManagedFollowupsReviewReportSource>;
  } | null>(null);
  const { workspace, delivery } = props;
  useLayoutEffect(() => {
    const source = createManagedFollowupsReviewReportSource(workspace, () =>
      latest.current.routeActive(),
    );
    const controller = new FollowupsReviewReportController(
      source,
      delivery,
      formatFollowupsReviewReportHtml,
    );
    setOwned({ source, controller });
    return () => {
      controller.dispose();
      source.dispose();
    };
  }, [workspace, delivery]);
  useLayoutEffect(() => owned?.source.reconcile());
  const state = useSyncExternalStore(
    owned?.controller.subscribe ?? noop,
    owned?.controller.getSnapshot ?? emptySnapshot,
    owned?.controller.getSnapshot ?? emptySnapshot,
  );
  const ready = useSyncExternalStore(
    owned?.source.subscribe ?? noop,
    owned?.source.canCapture ?? unavailable,
    unavailable,
  );
  return { controller: owned?.controller, state, ready };
}
export function ManagedFollowupsReviewReport(props: Props) {
  const { controller, state, ready } = useReport(props);
  return (
    <details
      id="managed-followups-review-report"
      className="managed-followups-review-report"
      onToggle={(event) => {
        if (!event.currentTarget.open) controller?.close();
      }}
    >
      <summary>Keep a readable follow-ups report</summary>
      <p>
        Capture every check in the current valid draft, including entries
        outside this filter or chosen review. Inspect the complete report before
        saving a private HTML copy. Save follow-ups remains separate.
      </p>
      <p>
        The copy contains your questions, assessments and listing identities in
        plain text. Store it privately. It records an authored snapshot, not
        cloud backup or immutable history.
      </p>
      <div className="trial-actions">
        <button
          id="managed-followups-report-capture"
          type="button"
          className="trial-secondary"
          disabled={!ready || state.saving}
          onClick={() => controller?.prepare()}
        >
          Capture follow-ups report
        </button>
      </div>
      {!ready && (
        <p>
          Load a current valid Follow-ups draft and finish any save or identity
          review before capture.
        </p>
      )}
      {state.report && (
        <>
          <section
            id="managed-followups-report-preview"
            aria-label="Captured follow-ups report"
          >
            <FollowupsReviewReportSnapshot report={state.report} />
          </section>
          <label htmlFor="managed-followups-report-json">
            Complete captured report JSON
            <textarea
              id="managed-followups-report-json"
              readOnly
              rows={12}
              value={JSON.stringify(state.report, null, 2)}
            />
          </label>
          <div className="trial-actions">
            <button
              id="managed-followups-report-save"
              type="button"
              className="trial-secondary"
              disabled={!props.delivery || state.saving}
              onClick={() => {
                void controller?.save();
              }}
            >
              Save report (HTML)
            </button>
            {state.saving && (
              <button
                id="managed-followups-report-cancel"
                type="button"
                className="trial-secondary"
                onClick={() => controller?.cancel()}
              >
                Cancel report save
              </button>
            )}
            <button
              id="managed-followups-report-close"
              type="button"
              className="trial-secondary"
              onClick={() => controller?.close()}
            >
              Close captured report
            </button>
          </div>
        </>
      )}
      {state.message && <p role="status">{state.message}</p>}
    </details>
  );
}
