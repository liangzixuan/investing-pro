import type { RefObject } from "react";
import type { ManagedResearchFollowups } from "./managed-research-followups";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import type {
  ValuationFollowupPort,
  ValuationFollowupPreview,
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
export type ValuationFollowupField =
  "model" | "scenario" | "question" | "dueOn";
export interface ValuationFollowupForm {
  owner: object;
  modelOwner: ManagedResearchFollowups;
  valuationOwner: ManagedValuationWorkbench;
  model: string;
  scenario: string;
  question: string;
  dueOn: string;
  preview: ValuationFollowupPreview | null;
  message: string | null;
}
export interface ValuationFollowupLifetime {
  token: object;
  preview: ValuationFollowupPreview | null;
  loading: object | null;
  loadingCurrent: (() => boolean) | null;
  busy: boolean;
  creating: boolean;
  focusFrom: HTMLButtonElement | null;
}
export interface ValuationFollowupRender extends ValuationFollowupReviewOptions {
  token: object;
  form: ValuationFollowupForm;
  valuationState: ReturnType<ManagedValuationWorkbench["getSnapshot"]>;
  draftFileActivity: object;
  state: ReturnType<ManagedResearchFollowups["getSnapshot"]>;
  saved: ReturnType<ManagedResearchFollowups["coordinator"]["getSnapshot"]>;
}
export interface ValuationFollowupInteraction {
  render: ValuationFollowupRender;
  committed: RefObject<ValuationFollowupRender | null>;
  lifetime: ValuationFollowupLifetime;
  form: RefObject<ValuationFollowupForm>;
  publish: (form: ValuationFollowupForm) => void;
}
export const VALUATION_FOLLOWUP_STALE =
  "This preview no longer matches the scenario, question, date or drafts. Preview the current context again.";
export function emptyValuationFollowupForm(
  props: ValuationFollowupReviewOptions,
): ValuationFollowupForm {
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
export function valuationFollowupFormOwned(
  form: ValuationFollowupForm,
  props: ValuationFollowupReviewOptions,
) {
  return (
    form.owner === props.owner &&
    form.modelOwner === props.actions.model &&
    form.valuationOwner === props.valuation
  );
}
export function emptyValuationFollowupLifetime(): ValuationFollowupLifetime {
  return {
    token: {},
    preview: null,
    loading: null,
    loadingCurrent: null,
    busy: false,
    creating: false,
    focusFrom: null,
  };
}
