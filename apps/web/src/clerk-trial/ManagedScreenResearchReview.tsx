import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedScreenResearchReviewState } from "./managed-screen-research-review";
import { ScreenComparisonReportSnapshot } from "./ScreenComparisonReportSnapshot";
import { ManagedScreenResearchReading } from "./ManagedScreenResearchReading";
import "./managed-screen-research-review.css";

type Side = "left" | "right";
export interface ScreenResearchOpenProps {
  readonly onOpenSide: (
    state: ManagedScreenResearchReviewState,
    side: Side,
    opener: HTMLButtonElement,
  ) => void;
}
type Context = {
  readonly workspace: Pick<
    ManagedWorkspace,
    "screenResearchReview" | "captureScreenResearchReading"
  >;
  readonly navigationPending: boolean;
};

/** Capture is an explicit action in the current owned company visit. */
export function ManagedScreenResearchCapture({
  workspace,
  navigationPending,
}: Context) {
  const model = workspace.screenResearchReview;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<ManagedScreenResearchReviewState | null>(null);
  const [committed, setCommitted] =
    useState<ManagedScreenResearchReviewState | null>(null);
  useLayoutEffect(() => {
    const requested = pendingFocus.current;
    pendingFocus.current = null;
    if (
      requested &&
      requested === committed &&
      committed === state &&
      committed === model.getSnapshot() &&
      !navigationPending &&
      heading.current?.isConnected
    )
      heading.current.focus();
  }, [committed, state, model, navigationPending]);
  if (!state.reading || !state.activeSide) return null;
  const captured = state.reading[state.activeSide];
  return (
    <section
      className="managed-screen-research-review"
      aria-labelledby="managed-screen-research-capture-heading"
    >
      <h2
        id="managed-screen-research-capture-heading"
        ref={heading}
        tabIndex={-1}
      >
        Retain this company reading
      </h2>
      <p>
        Keep the current sources, authored thesis and valuation result beside
        the other screened company in Discover. Saved resources remain separate.
      </p>
      {captured && (
        <p>
          Current retained reading captured at {captured.capturedAt}. Capturing
          again replaces only this company’s reading.
        </p>
      )}
      <button
        id="managed-screen-research-capture"
        disabled={navigationPending || !state.canCapture}
        onClick={() => {
          if (navigationPending || model.getSnapshot() !== state) return;
          const result = workspace.captureScreenResearchReading(state);
          if (result && result === model.getSnapshot()) {
            pendingFocus.current = result;
            setCommitted(result);
          }
        }}
      >
        {captured
          ? "Replace retained company reading"
          : "Retain current company reading"}
      </button>
      {state.reason && <p role="status">{state.reason}</p>}
    </section>
  );
}

export function ManagedScreenResearchReview({
  workspace,
  navigationPending,
  onOpenSide,
}: Context & ScreenResearchOpenProps) {
  const model = workspace.screenResearchReview;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  if (!state.reading) return null;
  const reading = state.reading;
  return (
    <section
      className="managed-screen-research-review"
      aria-labelledby="managed-screen-research-review-heading"
    >
      <h2 id="managed-screen-research-review-heading">
        Two-company research reading
      </h2>
      <p>
        These retained readings keep each company’s own periods, source states
        and evaluation time. They do not rank the companies or align their
        reporting periods.
      </p>
      <p>
        Open a company’s current Research to edit its thesis or create a dated
        check. Retained readings cannot load sources, change drafts or save
        resources.
      </p>
      <ScreenComparisonReportSnapshot report={reading.comparison} />
      <div className="managed-screen-research-pair">
        {(["left", "right"] as const).map((side) => (
          <section key={side} aria-label={`${side} company decision reading`}>
            <h3>
              {side === "left" ? "First" : "Second"} company ·{" "}
              {reading.comparison[side].listing.symbol} ·{" "}
              {reading.comparison[side].listing.shareClassName}
            </h3>
            <div className="managed-screen-research-actions">
              <button
                id={`managed-screen-research-open-${side}`}
                disabled={navigationPending}
                onClick={(event) => {
                  if (!navigationPending && model.getSnapshot() === state)
                    onOpenSide(state, side, event.currentTarget);
                }}
              >
                Research {reading.comparison[side].listing.symbol}
              </button>
              <button
                className="trial-secondary"
                disabled={navigationPending || !reading[side]}
                onClick={() => {
                  if (!navigationPending && model.getSnapshot() === state)
                    model.clearSide(state, side);
                }}
              >
                Clear {side === "left" ? "first" : "second"} retained reading
              </button>
            </div>
            {reading[side] ? (
              <ManagedScreenResearchReading capture={reading[side]} />
            ) : (
              <p>
                No company research reading retained. Open this company and
                capture explicitly after reviewing its sources and authored
                valuation.
              </p>
            )}
          </section>
        ))}
      </div>
      <button
        className="trial-secondary"
        disabled={navigationPending}
        onClick={() => {
          if (!navigationPending && model.getSnapshot() === state)
            model.clear(state);
        }}
      >
        Clear both retained readings
      </button>
    </section>
  );
}
