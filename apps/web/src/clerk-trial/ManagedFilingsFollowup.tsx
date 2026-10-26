import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type {
  ManagedSecFilingsResponseDto,
  PersonalSecRecentFilingDto,
} from "@research-cockpit/contracts";
import type { ManagedResearchFollowups } from "./managed-research-followups";
import {
  prepareFilingsFollowup,
  type FilingsFollowupPort,
  type FilingsFollowupPreview,
} from "./managed-filings-followup";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";
import { ManagedFilingsSource } from "./ManagedFilingsSource";
import "./managed-filings-followup.css";

export interface ManagedFilingsFollowupActions {
  model: ManagedResearchFollowups;
  getContext: (
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ) => { port: FilingsFollowupPort | null; reason: string | null };
  canLoad: (
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ) => boolean;
  load: (
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
    isCurrent: () => boolean,
  ) => Promise<void>;
}
interface Props {
  response: ManagedSecFilingsResponseDto;
  filing: PersonalSecRecentFilingDto;
  actions: ManagedFilingsFollowupActions;
}
interface CapturedPreview {
  value: FilingsFollowupPreview;
  host: Props;
  token: object;
  showingPrevious: boolean;
}
interface FormState {
  question: string;
  dueOn: string;
  preview: CapturedPreview | null;
  message: string | null;
}
interface Lifetime {
  token: object;
  preview: FilingsFollowupPreview | null;
  loading: object | null;
  busy: boolean;
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
const EMPTY: FormState = {
  question: "",
  dueOn: "",
  preview: null,
  message: null,
};
function sameHost(current: Props | null, host: Props) {
  return (
    current !== null &&
    current.response === host.response &&
    current.filing === host.filing &&
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
function retirePreview(lifetime: Lifetime) {
  lifetime.token = {};
  const preview = lifetime.preview;
  lifetime.preview = null;
  lifetime.loading = null;
  preview?.cancel();
}
function editField(
  interaction: Interaction,
  field: "question" | "dueOn",
  raw: string,
) {
  if (!actionIsCurrent(interaction)) return;
  retirePreview(interaction.lifetime);
  interaction.publish({
    ...interaction.form.current,
    [field]: raw,
    preview: null,
    message: null,
  });
}
function cancelPreview(interaction: Interaction) {
  if (!actionIsCurrent(interaction)) return;
  retirePreview(interaction.lifetime);
  interaction.publish({
    ...interaction.form.current,
    preview: null,
    message: null,
  });
}
function preparePreview(interaction: Interaction) {
  if (!actionIsCurrent(interaction) || interaction.lifetime.busy) return;
  const { render, lifetime } = interaction;
  lifetime.busy = true;
  retirePreview(lifetime);
  const token = lifetime.token;
  try {
    const context = render.actions.getContext(render.response, render.filing);
    const current = () => formIsCurrent(interaction, token);
    const result = context.port
      ? prepareFilingsFollowup(
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
    interaction.publish({
      ...interaction.form.current,
      preview: result.preview
        ? {
            value: result.preview,
            host: render,
            token,
            showingPrevious: context.port!.showingPrevious,
          }
        : null,
      message: result.reason,
    });
  } finally {
    lifetime.busy = false;
  }
}
function createDraft(interaction: Interaction, captured: CapturedPreview) {
  const { lifetime } = interaction;
  if (
    !actionIsCurrent(interaction) ||
    lifetime.busy ||
    lifetime.preview !== captured.value
  )
    return;
  lifetime.busy = true;
  lifetime.preview = null;
  try {
    const created = captured.value.create();
    if (!formIsCurrent(interaction, captured.token)) return;
    retirePreview(lifetime);
    interaction.publish({
      ...interaction.form.current,
      preview: null,
      message: created
        ? "Created in the Follow-ups draft. Open Follow-ups to review and Save follow-ups. My Watchlist is unchanged."
        : "This preview is no longer current. Nothing was created. Prepare the check again.",
    });
  } finally {
    lifetime.busy = false;
  }
}
async function loadFollowups(interaction: Interaction) {
  const { render, lifetime } = interaction;
  if (!actionIsCurrent(interaction) || lifetime.loading || lifetime.busy)
    return;
  if (
    render.actions.model.coordinator.getSnapshot().draft ||
    !render.actions.canLoad(render.response, render.filing)
  )
    return;
  retirePreview(lifetime);
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
    await render.actions.load(render.response, render.filing, current);
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
function useFilingsFollowup(props: Props) {
  const { model } = props.actions;
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const [state, setState] = useState<FormState>(EMPTY);
  const form = useRef<FormState>(EMPTY);
  const lifetime = useRef<Lifetime>({
    token: {},
    preview: null,
    loading: null,
    busy: false,
  }).current;
  const committed = useRef<Render | null>(null);
  const render: Render = { ...props, form: state, token: lifetime.token };
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    render.token = lifetime.token;
    return () => retirePreview(lifetime);
  }, [props.response, props.filing, model, lifetime]);
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
  const context = props.actions.getContext(props.response, props.filing);
  const captured = state.preview;
  const preview =
    captured &&
    sameHost(props, captured.host) &&
    captured.token === lifetime.token &&
    captured.value.isCurrent()
      ? captured
      : null;
  const stale = captured !== null && preview === null;
  useLayoutEffect(() => {
    if (stale && lifetime.preview === captured?.value) {
      retirePreview(lifetime);
      if (committed.current === render) render.token = lifetime.token;
    }
  }, [captured, stale, lifetime]);
  return {
    state,
    saved,
    preview,
    message: stale
      ? "This preview no longer matches the current company, filing or drafts. Prepare the check again."
      : (state.message ?? context.reason),
    canPrepare:
      saved.draft !== null && context.port !== null && context.port.isCurrent(),
    canLoad:
      lifetime.loading === null &&
      props.actions.canLoad(props.response, props.filing),
    edit: (field: "question" | "dueOn", raw: string) =>
      editField(interaction, field, raw),
    prepare: () => preparePreview(interaction),
    create: () => {
      if (preview) createDraft(interaction, preview);
    },
    cancel: () => cancelPreview(interaction),
    load: () => {
      void loadFollowups(interaction);
    },
  };
}
type Controls = ReturnType<typeof useFilingsFollowup>;
function questionFields(id: string, controls: Controls) {
  return (
    <div className="managed-filings-followup-fields">
      <div>
        <label htmlFor={`${id}-question`}>
          Research question (required, one line)
        </label>
        <textarea
          id={`${id}-question`}
          rows={3}
          value={controls.state.question}
          aria-describedby={`${id}-help ${id}-status`}
          onChange={(event) =>
            controls.edit("question", event.currentTarget.value)
          }
        />
      </div>
      <div>
        <label htmlFor={`${id}-due`}>
          Due date (required, UTC, YYYY-MM-DD)
        </label>
        <input
          id={`${id}-due`}
          type="text"
          placeholder="YYYY-MM-DD"
          value={controls.state.dueOn}
          aria-invalid={
            controls.state.dueOn !== "" &&
            !isResearchFollowupDueDate(controls.state.dueOn)
          }
          aria-describedby={`${id}-help ${id}-status`}
          onChange={(event) =>
            controls.edit("dueOn", event.currentTarget.value)
          }
        />
      </div>
    </div>
  );
}
function fullPreview(
  id: string,
  captured: CapturedPreview | null,
  controls: Controls,
) {
  if (!captured) return null;
  const { value, host } = captured;
  return (
    <section
      className="managed-filings-followup-preview"
      aria-label="Dated research question preview"
    >
      <label htmlFor={`${id}-preview`}>Complete cited check preview</label>
      <textarea id={`${id}-preview`} rows={6} readOnly value={value.check} />
      <p>
        {value.listing.symbol} · {value.listing.shareClassName} ·{" "}
        {value.listing.exchangeMic}
      </p>
      <dl>
        <div>
          <dt>Listing</dt>
          <dd>{value.listing.listingId}</dd>
        </div>
        <div>
          <dt>Security</dt>
          <dd>{value.listing.securityId}</dd>
        </div>
        <div>
          <dt>Share class</dt>
          <dd>{value.listing.shareClassId}</dd>
        </div>
        <div>
          <dt>Due date (UTC)</dt>
          <dd>{value.dueOn}</dd>
        </div>
      </dl>
      <p>
        Filing metadata only; the filing document was not read. The due date is
        a planning date, not an evidence refresh.
      </p>
      <p>
        <a href={host.filing.sourceUrl} target="_blank" rel="noreferrer">
          Form {host.filing.form} · {host.filing.accessionNumber}
        </a>{" "}
        · Filed {host.filing.filingDate} · Report date{" "}
        {host.filing.reportDate ?? "Not reported"}
      </p>
      {captured.showingPrevious && (
        <p className="managed-filings-warning">
          This is a retained previous Filings response. Its original source
          dates remain unchanged.
        </p>
      )}
      <ManagedFilingsSource response={host.response} />
      <button
        id={`${id}-create`}
        type="button"
        className="trial-secondary"
        onClick={controls.create}
      >
        Create follow-up draft
      </button>
    </section>
  );
}
export function ManagedFilingsFollowup(props: Props) {
  const controls = useFilingsFollowup(props);
  const id = `managed-filings-followup-${props.filing.accessionNumber}`;
  return (
    <details
      className="managed-filings-followup"
      onToggle={(event) => {
        if (!event.currentTarget.open) controls.cancel();
      }}
    >
      <summary>Keep a dated research question</summary>
      {questionFields(id, controls)}
      <p id={`${id}-help`}>
        The complete question and filing citation must fit 500 characters on one
        line. No text is clipped. Load Follow-ups explicitly, prepare the full
        check, then create its draft. Save follow-ups and Save watchlist remain
        separate actions.
      </p>
      {!controls.saved.draft && (
        <>
          <button
            id={`${id}-load`}
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
        id={`${id}-prepare`}
        type="button"
        className="trial-secondary"
        disabled={!controls.canPrepare}
        onClick={controls.prepare}
      >
        Preview dated question
      </button>
      {fullPreview(id, controls.preview, controls)}
      <button
        id={`${id}-cancel`}
        type="button"
        className="trial-secondary"
        onClick={controls.cancel}
      >
        Cancel question
      </button>
      <p id={`${id}-status`} role="status" aria-live="polite">
        {controls.message}
      </p>
    </details>
  );
}
