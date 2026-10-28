import {
  prepareValuationFollowup,
  type ValuationFollowupPreview,
  type ValuationFollowupPreparation,
} from "./managed-valuation-followup";
import {
  VALUATION_FOLLOWUP_STALE,
  type ValuationFollowupField,
  type ValuationFollowupInteraction,
} from "./valuation-followup-review-state";
import {
  retireValuationFollowup,
  valuationFollowupCanMutate,
  valuationFollowupCanStart,
  valuationFollowupFormCurrent,
  valuationFollowupResourcesCurrent,
} from "./valuation-followup-review-lifetime";

function edit(
  i: ValuationFollowupInteraction,
  field: ValuationFollowupField,
  value: string,
) {
  if (!valuationFollowupCanMutate(i)) return;
  retireValuationFollowup(i.lifetime);
  i.publish({
    ...i.form.current,
    [field]: value,
    preview: null,
    message: null,
  });
}
function cancel(i: ValuationFollowupInteraction) {
  if (i.committed.current !== i.render) return false;
  if (i.lifetime.busy) return false;
  retireValuationFollowup(i.lifetime);
  i.publish({ ...i.form.current, preview: null, message: null });
  return true;
}
function prepareContext(
  i: ValuationFollowupInteraction,
  current: () => boolean,
): ValuationFollowupPreparation {
  const context = i.render.actions.getContext();
  if (!context.port) return { preview: null, reason: context.reason };
  const { model, scenario, question, dueOn } = i.render.form;
  return prepareValuationFollowup(
    context.port,
    { model, scenario, question, dueOn },
    current,
  );
}
function publishPrepared(
  i: ValuationFollowupInteraction,
  result: ValuationFollowupPreparation,
  source: HTMLButtonElement | null,
) {
  i.lifetime.preview = result.preview;
  i.lifetime.focusFrom = result.preview ? source : null;
  i.publish({
    ...i.form.current,
    preview: result.preview,
    message: result.reason,
  });
}
function prepare(
  i: ValuationFollowupInteraction,
  source: HTMLButtonElement | null,
) {
  if (!valuationFollowupCanStart(i)) return;
  const { lifetime } = i;
  lifetime.busy = true;
  retireValuationFollowup(lifetime);
  const token = lifetime.token;
  const current = () =>
    valuationFollowupFormCurrent(i, token) &&
    valuationFollowupResourcesCurrent(i.render);
  try {
    const result = prepareContext(i, current);
    if (!current()) {
      result.preview?.cancel();
      return;
    }
    publishPrepared(i, result, source);
  } finally {
    lifetime.busy = false;
  }
}
function creationMessage(created: boolean) {
  return created
    ? "Created in the Follow-ups draft. Open Follow-ups to review, then Save follow-ups separately."
    : VALUATION_FOLLOWUP_STALE;
}
function create(
  i: ValuationFollowupInteraction,
  preview: ValuationFollowupPreview | null,
) {
  if (!preview) return;
  if (!valuationFollowupCanMutate(i)) return;
  const { lifetime } = i;
  if (lifetime.preview !== preview) return;
  const token = lifetime.token;
  lifetime.busy = true;
  lifetime.creating = true;
  lifetime.preview = null;
  try {
    const result = preview.create();
    if (!valuationFollowupFormCurrent(i, token)) return;
    retireValuationFollowup(lifetime);
    i.publish({
      ...i.form.current,
      preview: null,
      message: creationMessage(Boolean(result)),
    });
  } finally {
    lifetime.busy = false;
    lifetime.creating = false;
  }
}
function loadAllowed(i: ValuationFollowupInteraction) {
  if (!valuationFollowupCanStart(i)) return false;
  if (i.render.actions.model.coordinator.getSnapshot().draft !== null)
    return false;
  return i.render.actions.canLoad();
}
function beginLoad(i: ValuationFollowupInteraction) {
  retireValuationFollowup(i.lifetime);
  const request = {};
  const token = i.lifetime.token;
  i.lifetime.loading = request;
  const current = () =>
    valuationFollowupFormCurrent(i, token) && i.lifetime.loading === request;
  i.lifetime.loadingCurrent = current;
  i.publish({ ...i.form.current, preview: null, message: null });
  return current;
}
function finishLoad(i: ValuationFollowupInteraction, message: string | null) {
  i.lifetime.loading = null;
  i.lifetime.loadingCurrent = null;
  i.publish({ ...i.form.current, message });
}
async function load(i: ValuationFollowupInteraction) {
  if (!loadAllowed(i)) return;
  const current = beginLoad(i);
  let message: string | null = null;
  try {
    await i.render.actions.load(current);
  } catch {
    message =
      "Follow-ups could not be loaded. Your choices, question and due date are retained.";
  } finally {
    if (current()) finishLoad(i, message);
  }
}
export function valuationFollowupCommands(
  i: ValuationFollowupInteraction,
  preview: ValuationFollowupPreview | null,
) {
  return {
    edit: (field: ValuationFollowupField, value: string) =>
      edit(i, field, value),
    cancel: () => cancel(i),
    prepare: (event?: { currentTarget: HTMLButtonElement }) =>
      prepare(i, event?.currentTarget ?? null),
    create: () => create(i, preview),
    load: () => {
      void load(i);
    },
  };
}
