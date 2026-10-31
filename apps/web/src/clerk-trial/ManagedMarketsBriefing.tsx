import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedMarketsBriefingReading as Reading } from "./managed-markets-briefing";
import { ManagedMarketsBriefingReading } from "./ManagedMarketsBriefingReading";

/** Only the owned return action can focus a retained reading. */
export function ManagedMarketsBriefing({
  workspace,
  navigationPending,
  navigate,
}: {
  workspace: ManagedWorkspace;
  navigationPending: boolean;
  navigate: () => boolean;
}) {
  const view = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const reading = workspace.getMarketsBriefingReading();
  const heading = useRef<HTMLHeadingElement>(null);
  const focus = useRef<Reading | null>(null);
  const render = { workspace, reading, navigationPending, navigate };
  const committed = useRef<typeof render | null>(null);
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    const expected = focus.current;
    if (!expected || view.view !== "markets") return;
    focus.current = null;
    if (
      !navigationPending &&
      !view.research &&
      !view.companyRoute &&
      reading === expected &&
      workspace.getMarketsBriefingReading() === expected
    )
      heading.current?.focus();
  }, [workspace, reading, view, navigationPending]);
  if (view.research || view.companyRoute) return null;
  if (!reading) {
    if (view.view !== "markets" || !workspace.isMarketsBriefingPassive())
      return null;
    return (
      <section className="trial-panel" aria-label="Retired Markets briefing">
        <h2>Start another Markets briefing</h2>
        <p role="status">
          The retained briefing is no longer current for this workspace. Start
          another briefing to use current source controls. No source read starts
          automatically.
        </p>
        <button
          type="button"
          className="trial-secondary"
          id="markets-briefing-new"
          disabled={navigationPending}
          onClick={() => {
            if (
              committed.current === render &&
              !navigationPending &&
              workspace.isMarketsBriefingPassive() &&
              workspace.getMarketsBriefingReading() === null
            )
              navigate();
          }}
        >
          Start another briefing
        </button>
      </section>
    );
  }
  if (view.view === "followups")
    return (
      <section
        className="trial-panel"
        aria-label="Return to original Markets briefing"
      >
        <p>
          The original briefing and selected source item are retained.
          Follow-ups Save remains separate.
        </p>
        <button
          type="button"
          className="trial-secondary"
          id="markets-briefing-return"
          disabled={navigationPending}
          onClick={() => {
            if (
              committed.current !== render ||
              navigationPending ||
              workspace.getMarketsBriefingReading() !== reading
            )
              return;
            focus.current = reading;
            if (!workspace.returnToMarketsBriefing(navigate))
              focus.current = null;
          }}
        >
          Return to Markets briefing
        </button>
      </section>
    );
  if (view.view !== "markets") return null;
  return (
    <>
      <ManagedMarketsBriefingReading reading={reading} headingRef={heading} />
      <section
        className="trial-panel"
        aria-label="Start another Markets briefing"
      >
        <p>
          This reading keeps the original source times. Start another briefing
          to use current source controls. Each source read still needs an
          explicit action.
        </p>
        <button
          type="button"
          className="trial-secondary"
          id="markets-briefing-new"
          disabled={navigationPending}
          onClick={() => {
            if (
              committed.current === render &&
              !navigationPending &&
              workspace.getMarketsBriefingReading() === reading
            )
              navigate();
          }}
        >
          Start another briefing
        </button>
      </section>
    </>
  );
}
