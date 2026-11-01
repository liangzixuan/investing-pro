import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";

export function ManagedWatchlistDailyChecks({
  workspace,
  active,
}: {
  workspace: ManagedWorkspace;
  active: boolean;
}) {
  useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  useSyncExternalStore(
    workspace.filingsReview.subscribe,
    workspace.filingsReview.getSnapshot,
    workspace.filingsReview.getSnapshot,
  );
  const model = workspace.followups;
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const context = workspace.getWatchlistDailyChecks();
  const committed = useRef(context);
  useLayoutEffect(() => {
    committed.current = context;
    return () => {
      committed.current = null;
    };
  });
  if (!context) return null;
  return (
    <section aria-label="Authored checks for this daily review">
      <h4>Authored checks</h4>
      <p>
        Source results do not complete a research check. Open company Research
        to choose an existing check, write an assessment or keep a dated filing
        question. Save each changed resource separately.
      </p>
      {context.canLoad && (
        <button
          type="button"
          disabled={!active}
          onClick={() => {
            if (active && committed.current === context) void context.load();
          }}
        >
          Load Follow-ups for daily review
        </button>
      )}
      <ol aria-label="Checks for chosen companies">
        {context.rows.map(({ member, check }) => (
          <li key={member.listing.listingId}>
            <h5>
              {member.listing.symbol} · {member.listing.shareClassName} ·{" "}
              {member.listing.exchangeMic}
            </h5>
            {check?.value ? (
              <>
                <p className="managed-company-context-raw">
                  {check.value.check}
                </p>
                <p>Due date (UTC): {check.value.dueOn}</p>
                <p>Status: {check.value.status}</p>
                <p className="managed-company-context-raw">
                  {check.value.result || "No authored assessment."}
                </p>
              </>
            ) : (
              <p>
                {check?.reason ??
                  (check?.status === "unloaded"
                    ? "Follow-ups have not been loaded."
                    : check?.status === "empty"
                      ? "The loaded Follow-ups draft has no checks."
                      : check?.status === "absent"
                        ? "No check for this exact listing."
                        : "A current check is unavailable for this listing.")}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
