import { useId, useLayoutEffect, useRef } from "react";
import { ManagedScreenComparisonFollowupFields } from "./ManagedScreenComparisonFollowupFields";
import { ManagedScreenComparisonFollowupPreview } from "./ManagedScreenComparisonFollowupPreview";
import {
  ManagedScreenComparisonFollowupReadiness,
  ManagedScreenComparisonFollowupResult,
} from "./ManagedScreenComparisonFollowupStatus";
import {
  useScreenComparisonFollowupReview,
  type ScreenComparisonFollowupProps,
  type ScreenComparisonFollowupControls,
} from "./use-screen-comparison-followup-review";
import "./managed-screen-comparison-followup.css";
export type { ScreenComparisonFollowupProps } from "./use-screen-comparison-followup-review";

function Load({ controls: c }: { controls: ScreenComparisonFollowupControls }) {
  if (c.saved.draft !== null) return null;
  return (
    <>
      <button
        id="screen-comparison-followup-load"
        type="button"
        className="trial-secondary"
        disabled={!c.canLoad}
        onClick={c.load}
      >
        {c.state.loading
          ? "Loading follow-ups…"
          : "Load follow-ups for this question"}
      </button>
      {c.saved.message && <p role="status">{c.saved.message}</p>}
    </>
  );
}
function focusOwned(
  source: HTMLButtonElement | null,
  target: HTMLHeadingElement | null,
) {
  if (!source?.isConnected || source.ownerDocument.activeElement !== source)
    return;
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "nearest" });
}
export function ManagedScreenComparisonFollowup(
  props: ScreenComparisonFollowupProps,
) {
  const c = useScreenComparisonFollowupReview(props);
  return <ManagedScreenComparisonFollowupView controls={c} />;
}
export function ManagedScreenComparisonFollowupView({
  controls: c,
}: {
  controls: ScreenComparisonFollowupControls;
}) {
  const id = useId(),
    heading = useRef<HTMLHeadingElement | null>(null);
  const capturedHeading = useRef<HTMLHeadingElement | null>(null);
  const previewButton = useRef<HTMLButtonElement | null>(null);
  const focusFrom = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (c.state.preview) focusOwned(focusFrom.current, heading.current);
    focusFrom.current = null;
  }, [c.state.preview]);
  useLayoutEffect(() => {
    if (c.state.capture) focusOwned(focusFrom.current, capturedHeading.current);
    focusFrom.current = null;
  }, [c.state.capture]);
  return (
    <details
      id="screen-comparison-followup"
      className="managed-screen-comparison-followup"
      open={c.state.open}
    >
      <summary
        id="screen-comparison-followup-toggle"
        onClick={(event) => {
          event.preventDefault();
          c.setOpen(!c.state.open);
        }}
      >
        Keep a dated comparison check
      </summary>
      <div aria-labelledby={`${id}-heading`}>
        <h4 id={`${id}-heading`}>Comparison check</h4>
        <p>
          Capture the current pair, then choose one exact editable Watchlist
          company. Capture makes no source request and changes no draft.
        </p>
        <button
          id="screen-comparison-followup-capture"
          type="button"
          className="trial-secondary"
          disabled={!c.canCapture}
          onClick={(event) => {
            focusFrom.current = event.currentTarget;
            c.capture();
          }}
        >
          Capture comparison for dated check
        </button>
        {c.state.capture && (
          <h5 ref={capturedHeading} tabIndex={-1}>
            Comparison captured at {c.state.capture.comparison.preparedAt}
          </h5>
        )}
        <ManagedScreenComparisonFollowupFields controls={c} />
        <Load controls={c} />
        <ManagedScreenComparisonFollowupReadiness controls={c} />
        <div className="trial-actions">
          <button
            id="screen-comparison-followup-preview"
            ref={previewButton}
            type="button"
            className="trial-secondary"
            disabled={!c.canPrepare}
            onClick={(event) => {
              focusFrom.current = event.currentTarget;
              c.prepare();
            }}
          >
            Preview dated check
          </button>
          <button
            id="screen-comparison-followup-cancel"
            type="button"
            className="trial-secondary"
            disabled={c.disabled}
            onClick={(event) => {
              const owned =
                event.currentTarget.ownerDocument.activeElement ===
                event.currentTarget;
              if (c.cancel() && owned)
                previewButton.current?.focus({ preventScroll: true });
            }}
          >
            Cancel preview
          </button>
        </div>
        <ManagedScreenComparisonFollowupResult controls={c} />
        <ManagedScreenComparisonFollowupPreview
          controls={c}
          heading={heading}
        />
      </div>
    </details>
  );
}
