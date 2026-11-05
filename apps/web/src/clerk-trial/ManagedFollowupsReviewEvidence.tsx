import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type {
  FollowupsReviewEvidenceState,
  PassiveFollowupEvidenceReading,
} from "./managed-followups-review-evidence";
import { ListingIdentity, identityLabels } from "./ManagedListingIdentity";
import { CompanySourcePassResults } from "./ManagedCompanySourcePassControls";
import {
  CapturedCompanySources,
  CapturedSourcePacket,
} from "./ManagedScreenResearchReading";
import "./managed-followups-review-evidence.css";

/** Detached packets and original clocks. No source or authored action is available. */
export function FollowupEvidenceReading({
  reading,
}: {
  reading: PassiveFollowupEvidenceReading;
}) {
  return (
    <article
      className="managed-followups-evidence-reading"
      aria-label="Retained check source reading"
    >
      <p>
        <ListingIdentity member={reading.selection.listing} />
      </p>
      <p>
        Captured at{" "}
        <time dateTime={reading.capturedAt}>{reading.capturedAt}</time>. Source
        dates stay separate; retaining a reading does not refresh evidence.
      </p>
      <p className="managed-followups-authored">
        Question at capture: {reading.check.check}
      </p>
      <p>
        Due {reading.check.dueOn} UTC. Check identity: {reading.check.id}.
      </p>
      <details>
        <summary>Complete check and company identity at capture</summary>
        <dl>
          {Object.entries(identityLabels).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {reading.selection.listing[key as keyof typeof identityLabels]}
              </dd>
            </div>
          ))}
          <div>
            <dt>CIK</dt>
            <dd>{reading.selection.cik ?? "Not established"}</dd>
          </div>
          <div>
            <dt>Catalog snapshot</dt>
            <dd>{reading.selection.catalogSnapshotSha256}</dd>
          </div>
        </dl>
        <p>
          Authored status at capture: {reading.check.status}; completed on{" "}
          {reading.check.completedOn ?? "not completed"}.
        </p>
        <p className="managed-followups-authored">
          Assessment at capture:{" "}
          {reading.check.result || "No authored assessment."}
        </p>
      </details>
      <section aria-label="Retained source pass">
        <h4>Source pass at capture</h4>
        <p>Pass state: {reading.sourcePass.phase}.</p>
        <CompanySourcePassResults
          rows={reading.sourcePass.rows}
          message={reading.sourcePass.message}
        />
        <CapturedSourcePacket
          label="Complete source pass record"
          value={reading.sourcePass}
        />
      </section>
      <CapturedCompanySources
        evidence={reading.evidence}
        pricePresentation="table"
      />
      <CapturedSourcePacket
        label="Complete retained check reading"
        value={reading}
      />
    </article>
  );
}

type Context = {
  workspace: Pick<
    ManagedWorkspace,
    "reviewEvidence" | "captureFollowupEvidence"
  >;
};

export function ManagedFollowupEvidenceCapture({
  workspace,
  navigationPending,
}: Context & { navigationPending: boolean }) {
  const model = workspace.reviewEvidence;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<FollowupsReviewEvidenceState | null>(null);
  const [committed, setCommitted] =
    useState<FollowupsReviewEvidenceState | null>(null);
  useLayoutEffect(() => {
    const requested = pending.current;
    pending.current = null;
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
  if (state.phase !== "reviewing" || !state.selected) return null;
  const reading = state.selected.reading;
  return (
    <section
      className="managed-followups-evidence"
      aria-labelledby="managed-followups-evidence-capture-heading"
    >
      <h2
        id="managed-followups-evidence-capture-heading"
        ref={heading}
        tabIndex={-1}
      >
        Sources for this chosen check
      </h2>
      <p className="managed-followups-authored">{state.selected.entry.check}</p>
      <p>
        Use the separate source pass or source controls below, then retain the
        settled reading beside this check. Assessing, completing and saving the
        check remain separate.
      </p>
      <button
        id="managed-followups-evidence-capture"
        disabled={navigationPending || !state.canCapture}
        onClick={() => {
          if (navigationPending || state !== model.getSnapshot()) return;
          const installed = workspace.captureFollowupEvidence(state);
          if (installed && installed === model.getSnapshot()) {
            pending.current = installed;
            setCommitted(installed);
          }
        }}
      >
        {reading
          ? "Replace retained check reading"
          : "Retain sources for this check"}
      </button>
      {state.reason && <p role="status">{state.reason}</p>}
      {reading && (
        <details>
          <summary>Inspect retained source reading</summary>
          <FollowupEvidenceReading reading={reading} />
        </details>
      )}
    </section>
  );
}

export function ManagedFollowupsReviewEvidence({
  workspace,
}: Pick<Context, "workspace">) {
  const model = workspace.reviewEvidence;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  if (state.phase === "inactive") return null;
  const rows =
    state.phase === "finished"
      ? state.rows
      : state.selected
        ? [state.selected]
        : [];
  return (
    <section
      className="managed-followups-evidence"
      aria-label="Chosen check source readings"
    >
      <h4>
        {state.phase === "finished"
          ? "Source readings in chosen order"
          : "Sources retained for this check"}
      </h4>
      <p>
        Temporary source readings stay separate from your current assessment and
        completion status. Save follow-ups saves authored checks, not these
        packets.
      </p>
      <ol>
        {rows.map((row) => (
          <li key={row.entry.id} data-followup-evidence-id={row.entry.id}>
            <p>
              <ListingIdentity member={row.entry.listing} />
            </p>
            <p className="managed-followups-authored">{row.entry.check}</p>
            {row.reading ? (
              <details>
                <summary>Inspect retained source reading</summary>
                <FollowupEvidenceReading reading={row.reading} />
              </details>
            ) : (
              <p>No source reading was retained for this check.</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
