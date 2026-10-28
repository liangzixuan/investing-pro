import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { ManagedResearchFollowups } from "./managed-research-followups";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import {
  prepareValuationFollowup,
  resolveValuationFollowupScenario,
  type ValuationFollowupPort,
} from "./managed-valuation-followup";

export interface ManagedValuationFollowupActions {
  model: ManagedResearchFollowups;
  getContext: () => {
    port: ValuationFollowupPort | null;
    reason: string | null;
  };
  canLoad: () => boolean;
  load: (formIsCurrent: () => boolean) => Promise<void>;
}
export interface ValuationFollowupReviewOptions {
  valuation: ManagedValuationWorkbench;
  actions: ManagedValuationFollowupActions;
  owner: object;
  navigationPending: boolean;
}
type Preview = NonNullable<
  ReturnType<typeof prepareValuationFollowup>["preview"]
>;
type Field = "model" | "scenario" | "question" | "dueOn";
interface Form {
  owner: object;
  modelOwner: ManagedResearchFollowups;
  valuationOwner: ManagedValuationWorkbench;
  model: string;
  scenario: string;
  question: string;
  dueOn: string;
  preview: Preview | null;
  message: string | null;
}
interface Lifetime {
  token: object;
  preview: Preview | null;
  loading: object | null;
  loadingCurrent: (() => boolean) | null;
  busy: boolean;
  creating: boolean;
  focusFrom: HTMLButtonElement | null;
}
interface Render extends ValuationFollowupReviewOptions {
  token: object;
  form: Form;
  valuationState: ReturnType<ManagedValuationWorkbench["getSnapshot"]>;
  draftFileActivity: object;
  state: ReturnType<ManagedResearchFollowups["getSnapshot"]>;
  saved: ReturnType<ManagedResearchFollowups["coordinator"]["getSnapshot"]>;
}
interface Interaction {
  render: Render;
  committed: RefObject<Render | null>;
  lifetime: Lifetime;
  form: RefObject<Form>;
  publish: (form: Form) => void;
}
const stale =
  "This preview no longer matches the scenario, question, date or drafts. Preview the current context again.";
function emptyForm(props: ValuationFollowupReviewOptions): Form {
  return {
    owner: props.owner,
    modelOwner: props.actions.model,
    valuationOwner: props.valuation,
    model: "",
    scenario: "",
    question: "",
    dueOn: "",
    preview: null,
    message: null,
  };
}
function owned(form: Form, props: ValuationFollowupReviewOptions) {
  return (
    form.owner === props.owner &&
    form.modelOwner === props.actions.model &&
    form.valuationOwner === props.valuation
  );
}
function formCurrent(i: Interaction, token: object) {
  const current = i.committed.current;
  return (
    current !== null &&
    current.owner === i.render.owner &&
    current.actions.model === i.render.actions.model &&
    current.valuation === i.render.valuation &&
    !current.navigationPending &&
    i.lifetime.token === token &&
    i.render.valuation.getSnapshot() === i.render.valuationState &&
    i.render.valuation.getDraftFileActivityRevision() ===
      i.render.draftFileActivity
  );
}
function actionCurrent(i: Interaction) {
  return (
    i.committed.current === i.render &&
    formCurrent(i, i.render.token) &&
    i.render.actions.model.getSnapshot() === i.render.state &&
    i.render.actions.model.coordinator.getSnapshot() === i.render.saved
  );
}
function retire(lifetime: Lifetime) {
  lifetime.token = {};
  const preview = lifetime.preview;
  lifetime.preview = null;
  lifetime.loading = null;
  lifetime.loadingCurrent = null;
  lifetime.focusFrom = null;
  preview?.cancel();
}
function edit(i: Interaction, field: Field, value: string) {
  if (!actionCurrent(i) || i.lifetime.busy) return;
  retire(i.lifetime);
  i.publish({
    ...i.form.current,
    [field]: value,
    preview: null,
    message: null,
  });
}
function cancel(i: Interaction) {
  if (i.committed.current !== i.render || i.lifetime.busy) return false;
  retire(i.lifetime);
  i.publish({ ...i.form.current, preview: null, message: null });
  return true;
}
function prepare(i: Interaction, source: HTMLButtonElement | null) {
  if (!actionCurrent(i) || i.lifetime.busy || i.lifetime.loading) return;
  const { lifetime, render } = i;
  lifetime.busy = true;
  retire(lifetime);
  const token = lifetime.token;
  const current = () =>
    formCurrent(i, token) &&
    render.actions.model.getSnapshot() === render.state &&
    render.actions.model.coordinator.getSnapshot() === render.saved;
  try {
    const context = render.actions.getContext();
    const result = context.port
      ? prepareValuationFollowup(
          context.port,
          render.form.model,
          render.form.scenario,
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
    lifetime.focusFrom = result.preview ? source : null;
    i.publish({
      ...i.form.current,
      preview: result.preview,
      message: result.reason,
    });
  } finally {
    lifetime.busy = false;
  }
}
function create(i: Interaction, preview: Preview) {
  const { lifetime } = i;
  if (!actionCurrent(i) || lifetime.busy || lifetime.preview !== preview)
    return;
  const token = lifetime.token;
  lifetime.busy = true;
  lifetime.creating = true;
  lifetime.preview = null;
  try {
    const result = preview.create();
    if (!formCurrent(i, token)) return;
    retire(lifetime);
    i.publish({
      ...i.form.current,
      preview: null,
      message: result
        ? "Created in the Follow-ups draft. Open Follow-ups to review, then Save follow-ups separately."
        : stale,
    });
  } finally {
    lifetime.busy = false;
    lifetime.creating = false;
  }
}
async function load(i: Interaction) {
  const { render, lifetime } = i;
  if (!actionCurrent(i) || lifetime.busy || lifetime.loading) return;
  if (
    render.actions.model.coordinator.getSnapshot().draft !== null ||
    !render.actions.canLoad()
  )
    return;
  retire(lifetime);
  const request = {};
  const token = lifetime.token;
  lifetime.loading = request;
  const current = () => formCurrent(i, token) && lifetime.loading === request;
  lifetime.loadingCurrent = current;
  i.publish({ ...i.form.current, preview: null, message: null });
  let message: string | null = null;
  try {
    await render.actions.load(current);
  } catch {
    message =
      "Follow-ups could not be loaded. Your choices, question and due date are retained.";
  } finally {
    if (current()) {
      lifetime.loading = null;
      lifetime.loadingCurrent = null;
      i.publish({ ...i.form.current, message });
    }
  }
}
function subscribeLifetime(i: Interaction) {
  const fence = () => {
    if (i.lifetime.creating) return;
    const preview = i.lifetime.preview;
    if (preview && !preview.isCurrent()) retire(i.lifetime);
    if (i.lifetime.loadingCurrent && !i.lifetime.loadingCurrent())
      retire(i.lifetime);
  };
  const releases = [
    i.render.valuation.subscribe(fence),
    i.render.valuation.subscribeDraftFileActivity(fence),
    i.render.actions.model.subscribe(fence),
    i.render.actions.model.coordinator.subscribe(fence),
  ];
  return () => {
    releases.forEach((release) => release());
    retire(i.lifetime);
  };
}
function useLifetime(i: Interaction) {
  const { render, committed, lifetime } = i;
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    render.token = lifetime.token;
    if (!owned(i.form.current, render)) i.publish(emptyForm(render));
    return subscribeLifetime(i);
  }, [render.owner, render.actions.model, render.valuation, lifetime]);
  useLayoutEffect(() => {
    if (render.navigationPending) {
      retire(lifetime);
      render.token = lifetime.token;
    }
  }, [render.navigationPending, lifetime]);
  useLayoutEffect(() => {
    const preview = render.form.preview;
    if (preview && lifetime.preview === preview && !preview.isCurrent()) {
      retire(lifetime);
      render.token = lifetime.token;
    }
  });
}
export function useValuationFollowupReview(
  props: ValuationFollowupReviewOptions,
) {
  const model = props.actions.model;
  const valuationState = useSyncExternalStore(
    props.valuation.subscribe,
    props.valuation.getSnapshot,
    props.valuation.getSnapshot,
  );
  const draftFileActivity = useSyncExternalStore(
    props.valuation.subscribeDraftFileActivity,
    props.valuation.getDraftFileActivityRevision,
    props.valuation.getDraftFileActivityRevision,
  );
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const [stored, setStored] = useState<Form>(emptyForm(props));
  const form = useRef(stored);
  const lifetime = useRef<Lifetime>({
    token: {},
    preview: null,
    loading: null,
    loadingCurrent: null,
    busy: false,
    creating: false,
    focusFrom: null,
  }).current;
  const render: Render = {
    ...props,
    token: lifetime.token,
    form: owned(stored, props) ? stored : emptyForm(props),
    valuationState,
    draftFileActivity,
    state,
    saved,
  };
  const committed = useRef<Render | null>(null);
  const i: Interaction = {
    render,
    committed,
    lifetime,
    form,
    publish: (next) => {
      form.current = next;
      setStored(next);
    },
  };
  useLifetime(i);
  const context = props.actions.getContext();
  const resolution = resolveValuationFollowupScenario(
    valuationState.calculation,
    render.form.model,
    render.form.scenario,
  );
  const preview =
    render.form.preview === lifetime.preview &&
    !props.navigationPending &&
    render.form.preview?.isCurrent()
      ? render.form.preview
      : null;
  const stalePreview = render.form.preview !== null && preview === null;
  return {
    form: render.form,
    saved,
    preview,
    lifetime,
    summary: resolution.summary,
    message: stalePreview
      ? stale
      : (render.form.message ?? context.reason ?? resolution.reason),
    canPrepare:
      !props.navigationPending &&
      lifetime.loading === null &&
      saved.draft !== null &&
      model.canEdit() &&
      context.port !== null &&
      context.port.isCurrent() &&
      resolution.summary !== null,
    canLoad:
      !props.navigationPending &&
      lifetime.loading === null &&
      saved.draft === null &&
      props.actions.canLoad(),
    disabled: props.navigationPending,
    edit: (field: Field, value: string) => edit(i, field, value),
    cancel: () => cancel(i),
    prepare: (event?: { currentTarget: HTMLButtonElement }) =>
      prepare(i, event?.currentTarget ?? null),
    create: () => {
      if (preview) create(i, preview);
    },
    load: () => {
      void load(i);
    },
  };
}
