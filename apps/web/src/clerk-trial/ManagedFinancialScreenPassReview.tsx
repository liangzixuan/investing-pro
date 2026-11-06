import type { ScreenPassReviewReportDeliveryAdapter } from "./screen-pass-review-report-ports";
import { ManagedScreenPassReviewReport } from "./ManagedScreenPassReviewReport";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { FinancialScreenPassReviewController } from "./financial-screen-pass-review-controller";
import { createWorkspaceScreenPassReview } from "./financial-screen-pass-review-context";
import { FinancialScreenPassReviewReading } from "./FinancialScreenPassReviewReading";
import "./managed-screen-pass-review.css";
const id = "managed-screen-pass-review";
export function ManagedFinancialScreenPassReview({
  workspace,
  routeActive,
  delivery,
}: {
  workspace: ManagedWorkspace;
  routeActive: () => boolean;
  delivery?: ScreenPassReviewReportDeliveryAdapter | undefined;
}) {
  const [owner, setOwner] = useState<{
    workspace: ManagedWorkspace;
    controller: FinancialScreenPassReviewController;
  } | null>(null);
  const currentRoute = useRef(routeActive);
  useLayoutEffect(() => {
    currentRoute.current = routeActive;
    owner?.controller.reconcile();
  });
  useLayoutEffect(() => {
    const source = createWorkspaceScreenPassReview(workspace, () =>
      currentRoute.current(),
    );
    setOwner({ workspace, controller: source.controller });
    return source.dispose;
  }, [workspace]);
  return owner?.workspace === workspace ? (
    <FinancialScreenPassReviewControls
      workspace={workspace}
      controller={owner.controller}
      routeActive={routeActive}
      delivery={delivery}
    />
  ) : null;
}
export function FinancialScreenPassReviewControls({
  workspace,
  controller,
  routeActive,
  delivery,
}: {
  workspace: ManagedWorkspace;
  controller: FinancialScreenPassReviewController;
  routeActive: () => boolean;
  delivery?: ScreenPassReviewReportDeliveryAdapter | undefined;
}) {
  const screen = workspace.financialScreen;
  const source = useSyncExternalStore(
    screen.subscribe,
    screen.getSnapshot,
    screen.getSnapshot,
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const heading = useRef<HTMLHeadingElement | null>(null),
    preview = useRef<HTMLHeadingElement | null>(null);
  const committed = useRef<object | null>(null),
    frame = {};
  const pendingFocus = useRef<{
    from: Element | null;
    target: "heading" | "preview";
    state: typeof state;
  } | null>(null);
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      if (committed.current === frame) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    controller.reconcile();
    const pending = pendingFocus.current;
    pendingFocus.current = null;
    if (
      pending &&
      controller.getSnapshot() === pending.state &&
      routeActive() &&
      (document.activeElement === pending.from ||
        (!pending.from?.isConnected &&
          document.activeElement === document.body))
    )
      (pending.target === "preview" ? preview : heading).current?.focus();
  });
  const current = () =>
    committed.current === frame && controller.getSnapshot() === state;
  const available = routeActive() && !!workspace.captureWatchlistScreenRoute();
  const canPrepare =
    screen.canReviewPass(source) && available && state.status !== "running";
  const result =
    state.status === "running" &&
    source.run?.handle === state.currentHandle &&
    source.run?.criteriaRevision === state.plan?.sourceRun.criteriaRevision &&
    source.run?.selectionRevision === state.plan?.sourceRun.selectionRevision
      ? source.run
      : state.result;
  return (
    <section
      id={id}
      className="managed-screen-pass-review"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`} ref={heading} tabIndex={-1}>
        Review a fresh Annual pass
      </h3>
      <p>
        Retain one previous reading and inspect every result after an explicit
        fresh pass. The same applied filters and ordered companies are used.
        Shortlist changes and personal Save remain separate.
      </p>
      <button
        id={`${id}-prepare`}
        type="button"
        className="trial-secondary"
        disabled={!canPrepare}
        onClick={() => {
          if (!current() || !canPrepare) return;
          const from = document.activeElement;
          const next = controller.preview(state);
          if (next?.plan && next.canRun)
            pendingFocus.current = { from, target: "preview", state: next };
        }}
      >
        Preview fresh Annual pass
      </button>
      <ManagedScreenPassReviewReport
        workspace={workspace}
        pass={controller}
        active={available}
        routeActive={routeActive}
        delivery={delivery}
      />
      <p role="status">{state.message}</p>
      {state.plan && (
        <>
          <h4 id={`${id}-preview`} ref={preview} tabIndex={-1}>
            Previous and fresh Annual pass review
          </h4>
          <FinancialScreenPassReviewReading
            plan={state.plan}
            result={result}
            currentHandle={state.currentHandle}
          />
          <button
            id={`${id}-run`}
            type="button"
            disabled={!state.canRun || !available}
            onClick={() => {
              if (current() && available) void controller.run(state);
            }}
          >
            Run reviewed fresh pass
          </button>
          <button
            id={`${id}-cancel`}
            type="button"
            className="trial-secondary"
            onClick={() => {
              if (!current()) return;
              const from = document.activeElement;
              controller.cancel(state);
              pendingFocus.current = {
                from,
                target: "heading",
                state: controller.getSnapshot(),
              };
            }}
          >
            {state.status === "running"
              ? "Cancel fresh pass"
              : state.status === "preview"
                ? "Keep current screen"
                : "Clear pass comparison"}
          </button>
        </>
      )}
    </section>
  );
}
