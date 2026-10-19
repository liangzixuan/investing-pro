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
  readonly canLoad: boolean;
  readonly canStage: boolean;
  readonly canReview: boolean;
  readonly canRecover: boolean;
  readonly canChooseConflict: boolean;
  readonly canReviewCatalog: boolean;
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
function reviewAllowed(
  model: ManagedValuationAssumptions,
  saved: ValuationAssumptionsView["saved"],
  editable: boolean,
): boolean {
  return editable && saved.dirty && model.canSavePayload();
}
function loadAllowed(
  view: Pick<ValuationAssumptionsView, "idle" | "saved" | "pendingReview">,
): boolean {
  return view.idle && !view.saved.uncertain && !view.pendingReview;
}
function stageAllowed(
  view: Pick<ValuationAssumptionsView, "editable" | "editor" | "saved">,
): boolean {
  return (
    view.editable &&
    view.editor.editable &&
    !view.editor.inputIssue &&
    view.saved.draft !== null
  );
}
function resourceIdle(
  saved: ValuationAssumptionsView["saved"],
  state: ValuationAssumptionsView["state"],
  navigationPending: boolean,
): boolean {
  return saved.phase === "idle" && !navigationPending && !state.reviewing;
}
function currentViewGuard(
  props: ManagedValuationAssumptionsProps,
  snapshots: Pick<ValuationAssumptionsView, "state" | "saved" | "editor">,
  committed: () => boolean,
): () => boolean {
  return () =>
    committed() &&
    !props.navigationPending &&
    props.model.getSnapshot() === snapshots.state &&
    props.model.coordinator.getSnapshot() === snapshots.saved &&
    props.workbench.getSnapshot() === snapshots.editor;
}
function useDraftReview(
  model: ManagedValuationAssumptions,
  saved: ValuationAssumptionsView["saved"],
  ready: () => boolean,
) {
  const [reviewed, setReviewed] = useState<Review>(null);
  const reviewDraft = () => {
    if (!ready()) return;
    if (!model.canSavePayload()) return;
    if (!saved.draft) return;
    setReviewed({ draft: saved.draft, baseVersion: saved.baseVersion });
  };
  return { reviewDraft, reviewCurrent: isReviewed(saved, reviewed) };
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
  const ready = currentViewGuard(
    { model, workbench, navigationPending },
    { state, saved, editor },
    committed,
  );
  const review = useDraftReview(model, saved, ready);
  const idle = resourceIdle(saved, state, navigationPending);
  const editable = idle && model.canEdit();
  const hasReview = pendingReview(state);
  const canReview = reviewAllowed(model, saved, editable);
  return {
    model,
    state,
    saved,
    editor,
    ready,
    idle,
    editable,
    navigationPending,
    ...review,
    pendingReview: hasReview,
    canSave: review.reviewCurrent && canReview,
    canLoad: loadAllowed({ idle, saved, pendingReview: hasReview }),
    canStage: stageAllowed({ editable, editor, saved }),
    canReview,
    canRecover: idle && !hasReview,
    canChooseConflict: idle && saved.latestLoaded,
    canReviewCatalog: editable && !hasReview,
  };
}
