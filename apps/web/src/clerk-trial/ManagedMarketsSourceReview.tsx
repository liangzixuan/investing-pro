import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import type { ManagedMarketsSourceReview as Controller } from "./managed-markets-source-review";
import type {
  ManagedMarketsSourceReviewState,
  MarketsSourceOutcome,
  MarketsSourceReviewRow,
} from "./managed-markets-source-review-types";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import "./managed-markets-source-review.css";

export type ManagedMarketsSourceReviewModel = Pick<
  Controller,
  "getSnapshot" | "subscribe" | "choose" | "preview" | "start" | "cancel"
>;
export interface ManagedMarketsSourceReviewProps {
  model: ManagedMarketsSourceReviewModel;
  isCurrent: () => boolean;
  disabled?: boolean;
}
interface Host extends ManagedMarketsSourceReviewProps {
  snapshot: ManagedMarketsSourceReviewState;
  open: boolean;
  token: object;
}
interface Lifetime {
  open: boolean;
  token: object;
  busy: boolean;
}
interface Interaction {
  host: Host;
  committed: RefObject<Host | null>;
  lifetime: Lifetime;
  setOpen: (open: boolean) => void;
}
const outcomeLabels: Record<MarketsSourceOutcome, string> = {
  not_attempted: "Not attempted",
  retained: "Retained previous evidence",
  running: "Reading source",
  checked: "Checked",
  checked_empty: "Checked empty",
  failed: "Failed",
  cancelled: "Cancelled",
};
function currentOwner({ host, committed, lifetime }: Interaction) {
  return (
    committed.current === host &&
    lifetime.token === host.token &&
    !lifetime.busy &&
    !host.disabled &&
    host.isCurrent()
  );
}
function currentHost(interaction: Interaction) {
  return (
    currentOwner(interaction) &&
    interaction.host.model.getSnapshot() === interaction.host.snapshot
  );
}
function cancelOnClose(interaction: Interaction) {
  if (!currentOwner(interaction)) return;
  const phase = interaction.host.model.getSnapshot().phase;
  if (phase !== "preview" && phase !== "running") return;
  interaction.lifetime.busy = true;
  try {
    interaction.host.model.cancel();
  } finally {
    interaction.lifetime.busy = false;
  }
}
function currentAction(interaction: Interaction) {
  return (
    interaction.host.open &&
    interaction.lifetime.open &&
    currentHost(interaction)
  );
}
function dispatch(interaction: Interaction, action: () => void) {
  if (!currentAction(interaction)) return;
  interaction.lifetime.busy = true;
  try {
    action();
  } finally {
    interaction.lifetime.busy = false;
  }
}
function toggle(interaction: Interaction, open: boolean) {
  if (interaction.committed.current !== interaction.host) return;
  if (!open) cancelOnClose(interaction);
  if (!open) interaction.lifetime.token = {};
  interaction.lifetime.open = open;
  interaction.setOpen(open);
}
function choose(
  interaction: Interaction,
  row: MarketsSourceReviewRow,
  selected: boolean,
) {
  if (!row.eligible || row.busy) return;
  const phase = interaction.host.snapshot.phase;
  if (phase === "running") return;
  dispatch(interaction, () => interaction.host.model.choose(row.id, selected));
}
function preview(interaction: Interaction) {
  if (!interaction.host.snapshot.canPreview) return;
  dispatch(interaction, () => interaction.host.model.preview());
}
function start(interaction: Interaction) {
  if (!interaction.host.snapshot.canStart) return;
  dispatch(interaction, () => {
    void interaction.host.model.start();
  });
}
function SourceIdentity({ row }: { row: MarketsSourceReviewRow }) {
  if (!row.identity) return null;
  return (
    <div className="managed-markets-source-review-identity">
      <p>
        <ListingIdentity member={row.identity} />
      </p>
      <dl>
        {Object.entries(identityLabels).map(([field, label]) => (
          <div key={field}>
            <dt>{label}</dt>
            <dd>{row.identity?.[field as keyof typeof identityLabels]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
function SourceEvidence({ row }: { row: MarketsSourceReviewRow }) {
  return (
    <>
      <SourceIdentity row={row} />
      <p className="managed-markets-source-review-evidence">{row.evidence}</p>
      <p data-source-outcome={row.outcome}>{outcomeLabels[row.outcome]}</p>
    </>
  );
}
function SourceChoice({
  row,
  interaction,
  disabled,
}: {
  row: MarketsSourceReviewRow;
  interaction: Interaction;
  disabled: boolean;
}) {
  const id = `markets-source-review-choice-${row.id}`;
  return (
    <li data-source-id={row.id}>
      <h3>{row.label}</h3>
      <label htmlFor={id} className="managed-markets-source-review-choice">
        <input
          id={id}
          type="checkbox"
          checked={row.selected}
          disabled={disabled || !row.eligible || row.busy}
          onChange={(event) =>
            choose(interaction, row, event.currentTarget.checked)
          }
        />
        <span>
          {row.mode === "refresh" ? "Refresh" : "Load"} {row.label}
        </span>
      </label>
      {!row.eligible && <p>Unavailable for this plan</p>}
      {row.busy && <p>Source read in progress</p>}
      <SourceEvidence row={row} />
    </li>
  );
}
function SelectedPlan({ state }: { state: ManagedMarketsSourceReviewState }) {
  if (!state.plan.length) return null;
  return (
    <section
      id="markets-source-review-plan"
      aria-label="Selected source read plan"
    >
      <h3>Selected source read plan</h3>
      <p>
        This plan records the selected actions and evidence before Start.
        Current results are shown above.
      </p>
      <ol>
        {state.plan.map((row) => (
          <li key={row.id}>
            <h4>
              {row.mode === "refresh" ? "Refresh" : "Load"} {row.label}
            </h4>
            <SourceEvidence row={row} />
          </li>
        ))}
      </ol>
    </section>
  );
}
function ReviewContent({
  state,
  interaction,
  disabled,
}: {
  state: ManagedMarketsSourceReviewState;
  interaction: Interaction;
  disabled: boolean;
}) {
  const locked = disabled || state.phase === "running";
  return (
    <>
      <p>
        Select the source reads to preview. Each source keeps its own evidence
        and original dates.
      </p>
      <ul className="managed-markets-source-review-rows">
        {state.rows.map((row) => (
          <SourceChoice
            key={row.id}
            row={row}
            interaction={interaction}
            disabled={locked}
          />
        ))}
      </ul>
      <div className="managed-markets-source-review-actions">
        <button
          id="markets-source-review-preview"
          type="button"
          disabled={disabled || !state.canPreview}
          onClick={() => preview(interaction)}
        >
          Preview selected source reads
        </button>
        <button
          id="markets-source-review-start"
          type="button"
          disabled={disabled || !state.canStart}
          onClick={() => start(interaction)}
        >
          Start selected source reads
        </button>
        {(state.phase === "preview" || state.phase === "running") && (
          <button
            id="markets-source-review-cancel"
            type="button"
            disabled={disabled}
            onClick={() =>
              dispatch(interaction, () => interaction.host.model.cancel())
            }
          >
            Cancel source review
          </button>
        )}
      </div>
      <SelectedPlan state={state} />
      <div role="status" aria-live="polite" aria-atomic="true">
        {state.phase === "running" && <p>Source review in progress</p>}
        <p>{state.message}</p>
      </div>
      {state.phase === "running" && (
        <progress aria-label="Selected source reads in progress" />
      )}
    </>
  );
}
export function ManagedMarketsSourceReview(
  props: ManagedMarketsSourceReviewProps,
) {
  const snapshot = useSyncExternalStore(
    props.model.subscribe,
    props.model.getSnapshot,
    props.model.getSnapshot,
  );
  const [open, setOpen] = useState(false);
  const lifetime = useRef<Lifetime>({ open: false, token: {}, busy: false });
  const committed = useRef<Host | null>(null);
  const host: Host = {
    ...props,
    snapshot,
    open,
    token: lifetime.current.token,
  };
  useLayoutEffect(() => {
    committed.current = host;
    return () => {
      if (committed.current === host) committed.current = null;
    };
  });
  const model = props.model;
  useLayoutEffect(() => () => model.cancel(), [model]);
  const interaction = { host, committed, lifetime: lifetime.current, setOpen };
  const disabled = Boolean(props.disabled || !props.isCurrent());
  return (
    <details
      id="managed-markets-source-review"
      className="managed-markets-source-review"
      onToggle={(event) => toggle(interaction, event.currentTarget.open)}
    >
      <summary>Markets source review</summary>
      <ReviewContent
        state={snapshot}
        interaction={interaction}
        disabled={disabled}
      />
    </details>
  );
}
