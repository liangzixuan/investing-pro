import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { FinancialScreenContinuationController } from "./financial-screen-continuation-controller";
import { createWorkspaceScreenContinuation } from "./financial-screen-continuation-context";
import { FinancialScreenContinuationReading } from "./FinancialScreenContinuationReading";
import "./managed-screen-continuation.css";
const id = "managed-screen-continuation";
export function ManagedFinancialScreenContinuation({
  workspace,
  routeActive,
}: {
  workspace: ManagedWorkspace;
  routeActive: () => boolean;
}) {
  const [owner, setOwner] = useState<{
    workspace: ManagedWorkspace;
    controller: FinancialScreenContinuationController;
  } | null>(null);
  const currentRoute = useRef(routeActive);
  useLayoutEffect(() => {
    currentRoute.current = routeActive;
    owner?.controller.reconcile();
  });
  useLayoutEffect(() => {
    const source = createWorkspaceScreenContinuation(workspace, () =>
      currentRoute.current(),
    );
    setOwner({ workspace, controller: source.controller });
    return source.dispose;
  }, [workspace]);
  return owner?.workspace === workspace ? (
    <FinancialScreenContinuationControls
      workspace={workspace}
      controller={owner.controller}
      routeActive={routeActive}
    />
  ) : null;
}
export function FinancialScreenContinuationControls({
  workspace,
  controller,
  routeActive,
}: {
  workspace: ManagedWorkspace;
  controller: FinancialScreenContinuationController;
  routeActive: () => boolean;
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
    screen.canContinue(source) && available && state.status !== "running";
  const result =
    state.status === "running" &&
    source.run?.handle === state.plan?.sourceRun.handle &&
    source.run?.criteriaRevision === state.plan?.sourceRun.criteriaRevision &&
    source.run?.selectionRevision === state.plan?.sourceRun.selectionRevision
      ? source.run
      : state.result;
  return (
    <section
      id={id}
      className="managed-screen-continuation"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`} ref={heading} tabIndex={-1}>
        Complete missing Annual reads
      </h3>
      <p>
        Keep already retained Annual packets, including partial or historical
        evidence. Review the finite missing request list before another explicit
        pass. Full Run screen remains a separate refresh.
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
        Review missing Annual reads
      </button>
      <p role="status">{state.message}</p>
      {state.plan && (
        <>
          <h4 id={`${id}-preview`} ref={preview} tabIndex={-1}>
            Missing Annual read plan
          </h4>
          <FinancialScreenContinuationReading
            plan={state.plan}
            result={result}
          />
          <button
            id={`${id}-run`}
            type="button"
            disabled={!state.canRun || !available}
            onClick={() => {
              if (current() && available) void controller.run(state);
            }}
          >
            Run reviewed reads
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
              ? "Cancel continuation"
              : state.status === "preview"
                ? "Keep current screen"
                : "Clear continuation reading"}
          </button>
        </>
      )}
    </section>
  );
}
