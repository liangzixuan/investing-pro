import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ValuationAssumptionsPayload } from "@research-cockpit/contracts";
import type { ManagedValuationAssumptions } from "./managed-valuation-assumptions";
import type {
  ManagedValuationWorkbench,
  ManagedValuationSnapshot,
} from "./managed-valuation-workbench";

export interface ManagedValuationAssumptionsProps {
  readonly model: ManagedValuationAssumptions;
  readonly workbench: ManagedValuationWorkbench;
  readonly navigationPending: boolean;
}
export interface ValuationAssumptionsView {
  readonly model: ManagedValuationAssumptions;
  readonly state: ReturnType<ManagedValuationAssumptions["getSnapshot"]>;
  readonly saved: ReturnType<
    ManagedValuationAssumptions["coordinator"]["getSnapshot"]
  >;
  readonly editor: ManagedValuationSnapshot;
  readonly idle: boolean;
  readonly editable: boolean;
  readonly ready: () => boolean;
  readonly pendingReview: boolean;
  readonly navigationPending: boolean;
  readonly reviewCurrent: boolean;
  readonly canSave: boolean;
  readonly reviewDraft: () => void;
}
type Review = {
  readonly draft: ValuationAssumptionsPayload;
  readonly baseVersion: number | null;
} | null;
function isReviewed(
  saved: ValuationAssumptionsView["saved"],
  review: Review,
): boolean {
  return (
    review !== null &&
    review.draft === saved.draft &&
    review.baseVersion === saved.baseVersion
  );
}
function pendingReview(state: ValuationAssumptionsView["state"]): boolean {
  return Boolean(
    state.stageReview || state.restoreReview || state.catalogReview,
  );
}
function useCommittedRender() {
  const live = useRef<object | null>(null);
  const rendered = {};
  useLayoutEffect(() => {
    live.current = rendered;
    return () => {
      live.current = null;
    };
  });
  return () => live.current === rendered;
}
function saveEnabled(
  model: ManagedValuationAssumptions,
  saved: ValuationAssumptionsView["saved"],
  editable: boolean,
  reviewed: boolean,
): boolean {
  return editable && reviewed && saved.dirty && model.canSavePayload();
}

export function useValuationAssumptionsView({
  model,
  workbench,
  navigationPending,
}: ManagedValuationAssumptionsProps): ValuationAssumptionsView {
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
  const editor = useSyncExternalStore(
    workbench.subscribe,
    workbench.getSnapshot,
    workbench.getSnapshot,
  );
  const committed = useCommittedRender();
  const [reviewed, setReviewed] = useState<Review>(null);
  const ready = () =>
    committed() &&
    !navigationPending &&
    model.getSnapshot() === state &&
    model.coordinator.getSnapshot() === saved &&
    workbench.getSnapshot() === editor;
  const idle = saved.phase === "idle" && !navigationPending && !state.reviewing;
  const editable = idle && model.canEdit();
  const reviewCurrent = isReviewed(saved, reviewed);
  return {
    model,
    state,
    saved,
    editor,
    ready,
    idle,
    editable,
    navigationPending,
    reviewCurrent,
    pendingReview: pendingReview(state),
    canSave: saveEnabled(model, saved, editable, reviewCurrent),
    reviewDraft: () => {
      if (ready() && model.canSavePayload() && saved.draft)
        setReviewed({ draft: saved.draft, baseVersion: saved.baseVersion });
    },
  };
}
