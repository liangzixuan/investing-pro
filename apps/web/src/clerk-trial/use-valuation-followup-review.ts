import { useRef, useState, useSyncExternalStore } from "react";
import {
  emptyValuationFollowupForm,
  emptyValuationFollowupLifetime,
  valuationFollowupFormOwned,
  type ValuationFollowupForm,
  type ValuationFollowupInteraction,
  type ValuationFollowupRender,
  type ValuationFollowupReviewOptions,
} from "./valuation-followup-review-state";
import { useValuationFollowupLifetime } from "./valuation-followup-review-lifetime";
import { valuationFollowupCommands } from "./valuation-followup-review-actions";
import { valuationFollowupDisplay } from "./valuation-followup-review-display";

export type {
  ManagedValuationFollowupActions,
  ValuationFollowupReviewOptions,
} from "./valuation-followup-review-state";
function useFollowupSnapshots(props: ValuationFollowupReviewOptions) {
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
  return { valuationState, draftFileActivity, state, saved };
}
function useFollowupInteraction(
  props: ValuationFollowupReviewOptions,
): ValuationFollowupInteraction {
  const snapshots = useFollowupSnapshots(props);
  const [stored, setStored] = useState<ValuationFollowupForm>(
    emptyValuationFollowupForm(props),
  );
  const form = useRef(stored);
  const lifetime = useRef(emptyValuationFollowupLifetime()).current;
  const render: ValuationFollowupRender = {
    ...props,
    token: lifetime.token,
    form: valuationFollowupFormOwned(stored, props)
      ? stored
      : emptyValuationFollowupForm(props),
    ...snapshots,
  };
  const committed = useRef<ValuationFollowupRender | null>(null);
  return {
    render,
    committed,
    lifetime,
    form,
    publish: (next) => {
      form.current = next;
      setStored(next);
    },
  };
}
export function useValuationFollowupReview(
  props: ValuationFollowupReviewOptions,
) {
  const interaction = useFollowupInteraction(props);
  useValuationFollowupLifetime(interaction);
  const display = valuationFollowupDisplay(interaction);
  return {
    ...display,
    ...valuationFollowupCommands(interaction, display.preview),
  };
}
