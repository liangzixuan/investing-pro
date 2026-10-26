import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { ManagedResearchFollowups } from "./managed-research-followups";
import {
  prepareHoldingFollowup,
  type HoldingFollowupPort,
  type HoldingFollowupPreview,
} from "./managed-holding-followup";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import "./managed-holding-followup.css";

export interface ManagedHoldingFollowupActions {
  model: ManagedResearchFollowups;
  getContext: () => {
    port: HoldingFollowupPort | null;
    reason: string | null;
  };
  canLoad: () => boolean;
  load: (formIsCurrent: () => boolean) => Promise<void>;
  reviewExisting: () => void;
}
interface Props {
  actions: ManagedHoldingFollowupActions;
  owner: object;
  position: HoldingFollowupPreview["position"] | null;
}
interface Capture {
  value: HoldingFollowupPreview;
  owner: object;
  model: ManagedResearchFollowups;
  token: object;
}
interface FormState {
  owner: object;
  model: ManagedResearchFollowups;
  question: string;
  dueOn: string;
  preview: Capture | null;
  message: string | null;
}
interface Lifetime {
  token: object;
  preview: HoldingFollowupPreview | null;
  loading: object | null;
  busy: boolean;
  focusFrom: HTMLButtonElement | null;
}
interface Render extends Props {
  token: object;
  form: FormState;
}
interface Interaction {
  render: Render;
  committed: RefObject<Render | null>;
  lifetime: Lifetime;
  form: RefObject<FormState>;
  publish: (next: FormState) => void;
}
const stale =
  "This preview no longer matches the holding, question, date or drafts. Preview the current context again.";
function emptyForm(props: Props): FormState {
  return {
    owner: props.owner,
    model: props.actions.model,
    question: "",
    dueOn: "",
    preview: null,
    message: null,
  };
}
function sameHost(current: Render | null, host: Render) {
  return (
    current?.owner === host.owner &&
    current.actions.model === host.actions.model
  );
}
function formIsCurrent(interaction: Interaction, token: object) {
  return (
    sameHost(interaction.committed.current, interaction.render) &&
    interaction.lifetime.token === token
  );
}
function actionIsCurrent(interaction: Interaction) {
  return (
    interaction.committed.current === interaction.render &&
    formIsCurrent(interaction, interaction.render.token)
  );
}
function retire(lifetime: Lifetime) {
  lifetime.token = {};
  const preview = lifetime.preview;
  lifetime.preview = null;
  lifetime.loading = null;
  lifetime.focusFrom = null;
  preview?.cancel();
}
function cancel(interaction: Interaction) {
  if (!actionIsCurrent(interaction)) return;
  retire(interaction.lifetime);
  interaction.publish({
    ...interaction.form.current,
    preview: null,
    message: null,
  });
}
function edit(
  interaction: Interaction,
  field: "question" | "dueOn",
  raw: string,
) {
  if (!actionIsCurrent(interaction)) return;
  retire(interaction.lifetime);
  interaction.publish({
    ...interaction.form.current,
    [field]: raw,
    preview: null,
    message: null,
  });
}
function prepare(interaction: Interaction, source: HTMLButtonElement | null) {
  const { render, lifetime } = interaction;
  if (!actionIsCurrent(interaction) || lifetime.busy || lifetime.loading)
    return;
  lifetime.busy = true;
  retire(lifetime);
  const token = lifetime.token;
  const current = () => formIsCurrent(interaction, token);
  try {
    const context = render.actions.getContext();
    const result = context.port
      ? prepareHoldingFollowup(
          context.port,
          render.form.question,
          render.form.dueOn,
          current,
        )
      : { preview: null, reason: context.reason };
    if (!current()) {
      result.preview?.cancel();
      return;
    }
    lifetime.preview = result.preview;
    lifetime.focusFrom = source;
    interaction.publish({
      ...interaction.form.current,
      preview: result.preview
        ? {
            value: result.preview,
            owner: render.owner,
            model: render.actions.model,
            token,
          }
        : null,
      message: result.reason,
    });
  } finally {
    lifetime.busy = false;
  }
}
function create(interaction: Interaction, captured: Capture) {
  const { lifetime } = interaction;
  if (!actionIsCurrent(interaction) || lifetime.busy) return;
  if (lifetime.preview !== captured.value) return;
  lifetime.busy = true;
  lifetime.preview = null;
  try {
    const result = captured.value.create();
    if (!formIsCurrent(interaction, captured.token)) return;
    retire(lifetime);
    interaction.publish({
      ...interaction.form.current,
      preview: null,
      message: result
        ? "Created in the Follow-ups draft. Open Follow-ups to review and Save follow-ups. Portfolio and My Watchlist are unchanged."
        : stale,
    });
  } finally {
    lifetime.busy = false;
  }
}
async function loadFollowups(interaction: Interaction) {
  const { render, lifetime } = interaction;
  if (!actionIsCurrent(interaction) || lifetime.busy || lifetime.loading)
    return;
  if (render.actions.model.coordinator.getSnapshot().draft) return;
  if (!render.actions.canLoad()) return;
  retire(lifetime);
  const request = {};
  const token = lifetime.token;
  lifetime.loading = request;
  const current = () =>
    formIsCurrent(interaction, token) && lifetime.loading === request;
  interaction.publish({
    ...interaction.form.current,
    preview: null,
    message: null,
  });
  let message: string | null = null;
  try {
    await render.actions.load(current);
  } catch {
    message =
      "Follow-ups could not be loaded. Your question and due date are retained.";
  } finally {
    if (current()) {
      lifetime.loading = null;
      interaction.publish({ ...interaction.form.current, message });
    }
  }
}
function reviewExisting(interaction: Interaction) {
  if (!actionIsCurrent(interaction) || interaction.lifetime.busy) return;
  interaction.lifetime.busy = true;
  retire(interaction.lifetime);
  try {
    interaction.render.actions.reviewExisting();
  } finally {
    interaction.lifetime.busy = false;
  }
}
type SavedFollowups = ReturnType<
  ManagedResearchFollowups["coordinator"]["getSnapshot"]
>;
type HoldingContext = ReturnType<ManagedHoldingFollowupActions["getContext"]>;
function currentCapture(render: Render, lifetime: Lifetime) {
  const captured = render.form.preview;
  if (!captured) return null;
  if (
    captured.owner !== render.owner ||
    captured.model !== render.actions.model
  )
    return null;
  if (captured.token !== lifetime.token) return null;
  return captured.value.isCurrent() ? captured : null;
}
function availableContext(saved: SavedFollowups, context: HoldingContext) {
  if (saved.draft === null || context.port === null) return false;
  return context.port.isCurrent();
}
function statusMessage(
  state: FormState,
  context: HoldingContext,
  stalePreview: boolean,
  existing: boolean,
) {
  if (stalePreview) return stale;
  if (state.message) return state.message;
  if (existing)
    return "This listing already has a follow-up. Review it without replacing its question or assessment.";
  return context.reason;
}
function holdingDisplay(
  render: Render,
  lifetime: Lifetime,
  saved: SavedFollowups,
) {
  const context = render.actions.getContext();
  const preview = currentCapture(render, lifetime);
  const stalePreview = render.form.preview !== null && preview === null;
  const existing =
    saved.draft?.entries.some(
      (entry) => entry.listing.listingId === render.position?.listing.listingId,
    ) ?? false;
  const available = availableContext(saved, context);
  return {
    state: render.form,
    saved,
    preview,
    stale: stalePreview,
    message: statusMessage(render.form, context, stalePreview, existing),
    canLoad: lifetime.loading === null && render.actions.canLoad(),
    canPrepare: available && !existing,
    canReview: existing && available,
  };
}
function useCommittedHolding(interaction: Interaction) {
  const { render, committed, lifetime, form, publish } = interaction;
  const model = render.actions.model;
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    render.token = lifetime.token;
    if (form.current.owner !== render.owner || form.current.model !== model)
      publish(emptyForm(render));
    return () => retire(lifetime);
  }, [render.owner, model, lifetime]);
}
function retireStale(
  interaction: Interaction,
  captured: Capture | null,
  stalePreview: boolean,
) {
  const { lifetime, committed, render } = interaction;
  if (!stalePreview || lifetime.preview !== captured?.value) return;
  retire(lifetime);
  if (committed.current === render) render.token = lifetime.token;
}
function useHoldingFollowup(props: Props) {
  const model = props.actions.model;
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const [state, setState] = useState<FormState>(emptyForm(props));
  const form = useRef(state);
  const lifetime = useRef<Lifetime>({
    token: {},
    preview: null,
    loading: null,
    busy: false,
    focusFrom: null,
  }).current;
  const owned = state.owner === props.owner && state.model === model;
  const render: Render = {
    ...props,
    token: lifetime.token,
    form: owned ? state : emptyForm(props),
  };
  const committed = useRef<Render | null>(null);
  const interaction: Interaction = {
    render,
    committed,
    lifetime,
    form,
    publish: (next) => {
      form.current = next;
      setState(next);
    },
  };
  useCommittedHolding(interaction);
  const display = holdingDisplay(render, lifetime, saved);
  const captured = render.form.preview;
  useLayoutEffect(
    () => retireStale(interaction, captured, display.stale),
    [captured, display.stale, lifetime],
  );
  return {
    ...display,
    lifetime,
    edit: (field: "question" | "dueOn", raw: string) =>
      edit(interaction, field, raw),
    cancel: () => cancel(interaction),
    prepare: (event?: { currentTarget: HTMLButtonElement }) =>
      prepare(interaction, event?.currentTarget ?? null),
    create: () => {
      if (display.preview) create(interaction, display.preview);
    },
    load: () => {
      void loadFollowups(interaction);
    },
    review: () => reviewExisting(interaction),
  };
}
function Position({
  position,
  prefix,
}: {
  position: HoldingFollowupPreview["position"];
  prefix: string;
}) {
  return (
    <div className="managed-holding-followup-position">
      <p>
        <ListingIdentity member={position.listing} />
      </p>
      <dl>
        <div>
          <dt>Authored shares</dt>
          <dd id={`${prefix}-shares`}>{position.shares}</dd>
        </div>
        <div>
          <dt>Total cost basis (USD)</dt>
          <dd id={`${prefix}-basis`}>
            {position.totalCostBasisUsd ?? "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Original holding confirmation date</dt>
          <dd id={`${prefix}-confirmed`}>{position.confirmedOn}</dd>
        </div>
      </dl>
      <details>
        <summary>Complete holding identity</summary>
        <dl>
          {Object.entries(identityLabels).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{position.listing[key as keyof typeof identityLabels]}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
export function ManagedHoldingFollowup(props: Props) {
  const controls = useHoldingFollowup(props);
  const heading = useRef<HTMLHeadingElement | null>(null);
  useLayoutEffect(() => {
    const source = controls.lifetime.focusFrom;
    controls.lifetime.focusFrom = null;
    if (
      !controls.preview ||
      !source?.isConnected ||
      source.ownerDocument.activeElement !== source
    )
      return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [controls.preview, controls.lifetime]);
  return (
    <section
      id="managed-holding-followup"
      className="managed-holding-followup"
      aria-label="Authored holding and next check"
    >
      <h3>Authored Portfolio draft position</h3>
      {props.position ? (
        <Position position={props.position} prefix="holding-followup" />
      ) : (
        <p>Current holding context is unavailable.</p>
      )}
      <p>
        These are authored Portfolio values. The original holding confirmation
        date and company research source dates remain separate.
      </p>
      <details
        onToggle={(event) => {
          if (!event.currentTarget.open) controls.cancel();
        }}
      >
        <summary>Review holding and keep a next check</summary>
        <div className="managed-holding-followup-fields">
          <div>
            <label htmlFor="holding-followup-question">
              Research question (required, one line)
            </label>
            <textarea
              id="holding-followup-question"
              rows={3}
              value={controls.state.question}
              aria-describedby="holding-followup-help holding-followup-status"
              onChange={(event) =>
                controls.edit("question", event.currentTarget.value)
              }
            />
          </div>
          <div>
            <label htmlFor="holding-followup-due">
              Due date (required, UTC, YYYY-MM-DD)
            </label>
            <input
              id="holding-followup-due"
              type="text"
              placeholder="YYYY-MM-DD"
              value={controls.state.dueOn}
              aria-invalid={
                controls.state.dueOn !== "" &&
                !isResearchFollowupDueDate(controls.state.dueOn)
              }
              aria-describedby="holding-followup-help holding-followup-status"
              onChange={(event) =>
                controls.edit("dueOn", event.currentTarget.value)
              }
            />
          </div>
        </div>
        <p id="holding-followup-help">
          Enter 1 to 500 characters on one line. No text is clipped. Load
          Follow-ups explicitly, preview the complete question, then create its
          local draft. Save follow-ups remains separate.
        </p>
        {!controls.saved.draft && (
          <>
            <button
              id="holding-followup-load"
              type="button"
              className="trial-secondary"
              disabled={!controls.canLoad}
              onClick={controls.load}
            >
              {controls.saved.phase === "loading"
                ? "Loading follow-ups…"
                : "Load follow-ups for this question"}
            </button>
            {controls.saved.message && (
              <p role="status">{controls.saved.message}</p>
            )}
          </>
        )}
        <button
          id="holding-followup-preview"
          type="button"
          className="trial-secondary"
          disabled={!controls.canPrepare}
          onClick={controls.prepare}
        >
          Preview next check
        </button>
        {controls.preview && (
          <section
            className="managed-holding-followup-preview"
            aria-label="Holding next check preview"
          >
            <h4 ref={heading} tabIndex={-1}>
              Review the complete next check
            </h4>
            <label htmlFor="holding-followup-check">
              Complete next check preview
            </label>
            <textarea
              id="holding-followup-check"
              rows={4}
              readOnly
              value={controls.preview.value.check}
            />
            <p>Due date (UTC): {controls.preview.value.dueOn}</p>
            <Position
              position={controls.preview.value.position}
              prefix="holding-followup-preview"
            />
            <p>
              The position context is not saved with this check. Only the
              complete question and due date become an open Follow-ups draft
              entry. Portfolio and My Watchlist are unchanged.
            </p>
            <button
              id="holding-followup-create"
              type="button"
              className="trial-secondary"
              onClick={controls.create}
            >
              Create follow-up draft
            </button>
          </section>
        )}
        {controls.canReview && (
          <button
            id="holding-followup-review"
            type="button"
            className="trial-secondary"
            onClick={controls.review}
          >
            Review existing follow-up
          </button>
        )}
        <button
          id="holding-followup-cancel"
          type="button"
          className="trial-secondary"
          onClick={controls.cancel}
        >
          Cancel preview
        </button>
        <p id="holding-followup-status" role="status" aria-live="polite">
          {controls.message}
        </p>
      </details>
    </section>
  );
}
