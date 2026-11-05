import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedFinancialScreenState } from "./managed-financial-screen";
import { createWorkspaceScreenRefinement } from "./financial-screen-refinement-context";
import {
  FinancialScreenCriteriaControls,
  copyFinancialScreenCriteria,
} from "./FinancialScreenCriteriaControls";
import { FinancialScreenRefinementReading } from "./FinancialScreenRefinementReading";
import type { FinancialScreenRefinementController } from "./financial-screen-refinement-controller";
import "./managed-screen-refinement.css";
const id = "managed-screen-refinement";
export function ManagedFinancialScreenRefinement({
  workspace,
  routeActive,
  onApplied,
}: {
  workspace: ManagedWorkspace;
  routeActive: () => boolean;
  onApplied: (state: ManagedFinancialScreenState) => void;
}) {
  const [owner, setOwner] = useState<{
    workspace: ManagedWorkspace;
    controller: FinancialScreenRefinementController;
  } | null>(null);
  const currentRoute = useRef(routeActive);
  useLayoutEffect(() => {
    currentRoute.current = routeActive;
    owner?.controller.reconcile();
  });
  useLayoutEffect(() => {
    const source = createWorkspaceScreenRefinement(workspace, () =>
      currentRoute.current(),
    );
    setOwner({ workspace, controller: source.controller });
    return source.dispose;
  }, [workspace]);
  return owner?.workspace === workspace ? (
    <FinancialScreenRefinementControls
      workspace={workspace}
      controller={owner.controller}
      routeActive={routeActive}
      onApplied={onApplied}
    />
  ) : null;
}
export function FinancialScreenRefinementControls({
  workspace,
  controller,
  routeActive,
  onApplied,
}: {
  workspace: ManagedWorkspace;
  controller: FinancialScreenRefinementController;
  routeActive: () => boolean;
  onApplied: (state: ManagedFinancialScreenState) => void;
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
  const [draft, setDraft] = useState(() =>
    copyFinancialScreenCriteria(source.criteria),
  );
  const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const preview = useRef<HTMLHeadingElement | null>(null);
  const pendingFocus = useRef<{
    from: Element | null;
    target: "heading" | "preview";
    state: typeof state;
  } | null>(null);
  const committed = useRef<object | null>(null);
  const frame = {};
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      if (committed.current === frame) committed.current = null;
    };
  });
  const isCurrent = () =>
    committed.current === frame && controller.getSnapshot() === state;
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
  const canPreview =
    screen.canRefine(source) &&
    routeActive() &&
    !!workspace.captureWatchlistScreenRoute();
  return (
    <section className="managed-screen-refinement" id={id}>
      <button
        type="button"
        className="trial-secondary"
        id={`${id}-open`}
        disabled={!canPreview}
        aria-expanded={open}
        onClick={() => {
          if (!isCurrent() || !canPreview) return;
          const initiating = document.activeElement;
          controller.cancel(state);
          setDraft(copyFinancialScreenCriteria(source.criteria));
          setOpen(true);
          pendingFocus.current = {
            from: initiating,
            target: "heading",
            state: controller.getSnapshot(),
          };
        }}
      >
        Try different filters on this run
      </button>
      {open && (
        <>
          <h3 id={`${id}-heading`} ref={heading} tabIndex={-1}>
            Refine this loaded Annual screen
          </h3>
          <p>
            Preview different filters against the retained Annual reports.
            Source dates and unavailable evidence stay unchanged. Run screen
            separately to load new evidence.
          </p>
          <form
            className="managed-screen-refinement-draft"
            onSubmit={(event) => {
              event.preventDefault();
              if (!isCurrent() || !canPreview) return;
              const initiating = document.activeElement;
              const installed = controller.preview(state, draft);
              if (installed?.reading && installed.canApply)
                pendingFocus.current = {
                  from: initiating,
                  target: "preview",
                  state: installed,
                };
            }}
          >
            <fieldset disabled={!canPreview}>
              <legend>Filters for local evaluation</legend>
              <FinancialScreenCriteriaControls
                draft={draft}
                edit={(next) => {
                  if (!isCurrent()) return;
                  controller.cancel(state);
                  setDraft(next);
                }}
              />
              <button
                type="submit"
                className="trial-secondary"
                id={`${id}-prepare`}
              >
                Preview revised filters
              </button>
            </fieldset>
          </form>
          <p role="status">{state.message}</p>
          {state.reading && (
            <>
              <h4 id={`${id}-preview`} ref={preview} tabIndex={-1}>
                Original and revised filter results
              </h4>
              <FinancialScreenRefinementReading reading={state.reading} />
              <button
                type="button"
                id={`${id}-apply`}
                disabled={!state.canApply || !canPreview}
                onClick={() => {
                  if (!isCurrent() || !canPreview) return;
                  const initiating = document.activeElement;
                  const installed = controller.apply(state);
                  if (installed) {
                    onApplied(installed);
                    if (
                      screen.getSnapshot() === installed &&
                      controller.getSnapshot().status === "applied"
                    )
                      pendingFocus.current = {
                        from: initiating,
                        target: "heading",
                        state: controller.getSnapshot(),
                      };
                  }
                }}
              >
                Apply reviewed filters and results
              </button>
            </>
          )}
          <button
            type="button"
            className="trial-secondary"
            id={`${id}-cancel`}
            onClick={() => {
              if (!isCurrent()) return;
              const initiating = document.activeElement;
              controller.cancel(state);
              setDraft(
                copyFinancialScreenCriteria(screen.getSnapshot().criteria),
              );
              pendingFocus.current = {
                from: initiating,
                target: "heading",
                state: controller.getSnapshot(),
              };
            }}
          >
            {state.status === "applied"
              ? "Clear comparison"
              : "Keep original screen"}
          </button>
        </>
      )}
    </section>
  );
}
