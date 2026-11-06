import type { FinancialScreenPassReviewController } from "./financial-screen-pass-review-controller";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import { createScreenPassReviewReportSource } from "./screen-pass-review-report-source";
import { ScreenPassReviewReportController } from "./screen-pass-review-report-controller";
import type { ScreenPassReviewReportDeliveryAdapter } from "./screen-pass-review-report-ports";
import type { PreparedScreenPassReviewReport } from "./screen-pass-review-report";
import { formatScreenPassReviewReportHtml } from "./screen-pass-review-report-html";
import { ScreenPassReviewReportSnapshot } from "./ScreenPassReviewReportSnapshot";
import "./managed-screen-pass-review-report.css";

const empty = Object.freeze({ report: null, saving: false, message: "" });
const emptySnapshot = () => empty;
const noop = () => () => {};
const unavailable = () => false;

export function ManagedScreenPassReviewReport(props: {
  readonly workspace: ManagedWorkspace;
  readonly active: boolean;
  readonly pass: FinancialScreenPassReviewController;
  readonly routeActive: () => boolean;
  readonly delivery: ScreenPassReviewReportDeliveryAdapter | undefined;
}) {
  const latest = useRef(props);
  latest.current = props;
  const { workspace, delivery, pass } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  const focusRequest = useRef<{
    report: PreparedScreenPassReviewReport;
    from: Element | null;
  } | null>(null);
  const committed = useRef<object | null>(null),
    frame = {};
  const [owned, setOwned] = useState<{
    workspace: ManagedWorkspace;
    pass: FinancialScreenPassReviewController;
    delivery: ScreenPassReviewReportDeliveryAdapter | undefined;
    source: ReturnType<typeof createScreenPassReviewReportSource>;
    controller: ScreenPassReviewReportController;
  } | null>(null);
  useLayoutEffect(() => {
    const source = createScreenPassReviewReportSource(
      workspace,
      pass,
      () => latest.current.active && latest.current.routeActive(),
    );
    const controller = new ScreenPassReviewReportController(
      source,
      delivery,
      formatScreenPassReviewReportHtml,
    );
    setOwned({ source, controller, workspace, pass, delivery });
    return () => {
      controller.dispose();
      source.dispose();
    };
  }, [workspace, delivery, pass]);
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      if (committed.current === frame) committed.current = null;
    };
  });
  const ownerCurrent = () =>
    owned?.workspace === workspace &&
    owned.pass === pass &&
    owned.delivery === delivery;
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
    pass.subscribe,
    pass.getSnapshot,
    pass.getSnapshot,
  );
  useLayoutEffect(() => {
    owned?.source.reconcile();
    const requested = focusRequest.current;
    focusRequest.current = null;
    if (
      requested &&
      latest.current.active &&
      latest.current.routeActive() &&
      ownerCurrent() &&
      requested.report === state.report &&
      (document.activeElement === requested.from ||
        (!requested.from?.isConnected &&
          document.activeElement === document.body)) &&
      owned?.controller.getSnapshot().report === requested.report
    )
      heading.current?.focus();
  });
  const current = () =>
    committed.current === frame &&
    ownerCurrent() &&
    owned?.controller.getSnapshot() === state;
  if (review.status !== "settled") return null;
  return (
    <section
      className="managed-screen-pass-report"
      aria-labelledby="managed-screen-pass-report-heading"
    >
      <h4 id="managed-screen-pass-report-heading" ref={heading} tabIndex={-1}>
        Keep this Annual-pass comparison
      </h4>
      <p>
        Prepare a private report with every previous and current result,
        original source packet and attempt clock. Save the Watchlist separately.
      </p>
      <button
        type="button"
        id="managed-screen-pass-report-prepare"
        disabled={!props.active || !ready || state.saving}
        onClick={() => {
          if (
            !current() ||
            !latest.current.active ||
            !latest.current.routeActive() ||
            !owned
          )
            return;
          const from = document.activeElement;
          owned.controller.prepare();
          const report = owned.controller.getSnapshot().report;
          focusRequest.current = report ? { report, from } : null;
        }}
      >
        Prepare Annual-pass report
      </button>
      {state.report && (
        <>
          <details id="managed-screen-pass-report-preview">
            <summary>Preview complete Annual-pass report</summary>
            <ScreenPassReviewReportSnapshot report={state.report} />
          </details>
          {delivery && (
            <button
              type="button"
              id="managed-screen-pass-report-save"
              disabled={!props.active || state.saving}
              onClick={() => {
                if (
                  current() &&
                  latest.current.active &&
                  latest.current.routeActive()
                )
                  void owned?.controller.save();
              }}
            >
              {delivery.actionLabel ?? "Save Annual-pass report (HTML)"}
            </button>
          )}
          {state.saving && (
            <button
              type="button"
              id="managed-screen-pass-report-cancel"
              onClick={() => {
                if (current()) owned?.controller.cancel();
              }}
            >
              Cancel report save
            </button>
          )}
          <button
            type="button"
            id="managed-screen-pass-report-close"
            onClick={() => {
              if (current()) owned?.controller.close();
            }}
          >
            Clear Annual-pass report preview
          </button>
        </>
      )}
      <p role="status" aria-live="polite">
        {state.message}
      </p>
    </section>
  );
}
