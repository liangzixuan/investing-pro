import {
  resolveValuationFollowupScenario,
  type ValuationFollowupPreview,
  type ValuationFollowupScenarioSummary,
} from "./managed-valuation-followup";
import {
  VALUATION_FOLLOWUP_STALE,
  type ManagedValuationFollowupActions,
  type ValuationFollowupInteraction,
} from "./valuation-followup-review-state";

type Context = ReturnType<ManagedValuationFollowupActions["getContext"]>;
function currentPreview(
  i: ValuationFollowupInteraction,
): ValuationFollowupPreview | null {
  const preview = i.render.form.preview;
  if (preview !== i.lifetime.preview) return null;
  if (i.render.navigationPending) return null;
  return preview?.isCurrent() ? preview : null;
}
function formAvailable(i: ValuationFollowupInteraction) {
  return !i.render.navigationPending && i.lifetime.loading === null;
}
function contextAvailable(i: ValuationFollowupInteraction, context: Context) {
  if (i.render.saved.draft === null) return false;
  if (!i.render.actions.model.canEdit()) return false;
  return context.port?.isCurrent() ?? false;
}
function statusMessage(
  i: ValuationFollowupInteraction,
  preview: ValuationFollowupPreview | null,
  reason: string | null,
) {
  if (i.render.form.preview !== null && preview === null)
    return VALUATION_FOLLOWUP_STALE;
  return i.render.form.message ?? reason;
}
function canPrepare(
  i: ValuationFollowupInteraction,
  context: Context,
  summary: ValuationFollowupScenarioSummary | null,
) {
  return formAvailable(i) && contextAvailable(i, context) && summary !== null;
}
function canLoad(i: ValuationFollowupInteraction) {
  return (
    formAvailable(i) &&
    i.render.saved.draft === null &&
    i.render.actions.canLoad()
  );
}
export function valuationFollowupDisplay(i: ValuationFollowupInteraction) {
  const { render, lifetime } = i;
  const context = render.actions.getContext();
  const resolution = resolveValuationFollowupScenario(
    render.valuationState.calculation,
    render.form.model,
    render.form.scenario,
  );
  const preview = currentPreview(i);
  return {
    form: render.form,
    saved: render.saved,
    preview,
    lifetime,
    summary: resolution.summary,
    message: statusMessage(i, preview, context.reason ?? resolution.reason),
    canPrepare: canPrepare(i, context, resolution.summary),
    canLoad: canLoad(i),
    disabled: render.navigationPending,
  };
}
