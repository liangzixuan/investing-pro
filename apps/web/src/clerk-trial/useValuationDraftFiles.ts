import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedValuationDraftFileDeliveryAdapter } from "./valuation-draft-file-delivery";
import { ManagedValuationDraftRecovery } from "./managed-valuation-draft-recovery";

export interface ValuationDraftFilesProps {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedValuationDraftFileDeliveryAdapter | undefined;
  selection: ManagedResearchSelection;
  navigationPending: boolean;
  routeActive: () => boolean;
}
export type ValuationDraftFileState = ReturnType<
  ManagedValuationDraftRecovery["getSnapshot"]
>;
export type ValuationFileFocusRequest = { source: HTMLElement } | null;
interface Binding {
  controller: ManagedValuationDraftRecovery;
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ValuationDraftFilesProps["delivery"];
}
interface Lifetime {
  latest: RefObject<ValuationDraftFilesProps>;
  active: RefObject<Binding | null>;
  controller: ManagedValuationDraftRecovery | null;
}
export interface ValuationDraftFileView {
  state: ValuationDraftFileState;
  isCurrent: () => boolean;
  currentController: () => ManagedValuationDraftRecovery | null;
}
const empty: ValuationDraftFileState = Object.freeze({
  phase: "idle",
  preview: null,
  currentEditor: null,
  canExport: false,
  canImport: false,
  message: "",
});
const emptySource = {
  subscribe: () => () => {},
  getSnapshot: () => empty,
};
function routeAvailable(props: ValuationDraftFilesProps) {
  if (props.navigationPending) return false;
  return props.routeActive();
}
function createBinding(
  props: ValuationDraftFilesProps,
  latest: Lifetime["latest"],
): Binding {
  const { workspace, accountScope, delivery } = props;
  const controller = new ManagedValuationDraftRecovery({
    workspace,
    accountScope,
    delivery,
    selection: () => latest.current.selection,
    routeActive: () => routeAvailable(latest.current),
  });
  return { controller, workspace, accountScope, delivery };
}
function releaseBinding(active: Lifetime["active"], binding: Binding) {
  if (active.current === binding) active.current = null;
  binding.controller.dispose();
}
function useDraftFileLifetime(props: ValuationDraftFilesProps): Lifetime {
  const latest = useRef(props);
  latest.current = props;
  const active = useRef<Binding | null>(null);
  const [controller, setController] =
    useState<ManagedValuationDraftRecovery | null>(null);
  const { workspace, accountScope, delivery } = props;
  useLayoutEffect(() => {
    const binding = createBinding(
      { ...props, workspace, accountScope, delivery },
      latest,
    );
    active.current = binding;
    setController(binding.controller);
    return () => releaseBinding(active, binding);
  }, [workspace, accountScope, delivery]);
  useLayoutEffect(() => controller?.reconcile());
  return { latest, active, controller };
}
function matchesBinding(binding: Binding, latest: ValuationDraftFilesProps) {
  if (binding.workspace !== latest.workspace) return false;
  if (binding.accountScope !== latest.accountScope) return false;
  return binding.delivery === latest.delivery;
}
function matchesSelection(
  latest: ValuationDraftFilesProps,
  rendered: ValuationDraftFilesProps,
) {
  if (latest.selection !== rendered.selection) return false;
  return routeAvailable(latest);
}
function admitController(
  lifetime: Lifetime,
  state: ValuationDraftFileState,
  rendered: ValuationDraftFilesProps,
) {
  const { controller, latest } = lifetime;
  if (controller === null) return null;
  const active = lifetime.active.current;
  if (active === null) return null;
  if (active.controller !== controller) return null;
  if (!matchesBinding(active, latest.current)) return null;
  if (!matchesSelection(latest.current, rendered)) return null;
  if (controller.getSnapshot() !== state) return null;
  return controller;
}
export function useValuationDraftFiles(
  props: ValuationDraftFilesProps,
): ValuationDraftFileView {
  const lifetime = useDraftFileLifetime(props);
  const source = lifetime.controller ?? emptySource;
  const state = useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getSnapshot,
  );
  const currentController = () => admitController(lifetime, state, props);
  return {
    state,
    currentController,
    isCurrent: () => currentController() !== null,
  };
}
function exportInputs(view: ValuationDraftFileView) {
  const controller = view.currentController();
  if (!controller) return;
  if (!view.state.canExport) return;
  void controller.exportInputs();
}
function readFile(view: ValuationDraftFileView, file: File) {
  const controller = view.currentController();
  if (!controller) return;
  if (!view.state.canImport) return;
  void controller.readFile(file);
}
function cancelReview(
  view: ValuationDraftFileView,
  requested: RefObject<ValuationFileFocusRequest>,
  source: HTMLButtonElement,
) {
  const controller = view.currentController();
  if (!controller) return;
  requested.current = { source };
  controller.cancel();
}
function restoreReview(
  view: ValuationDraftFileView,
  requested: RefObject<ValuationFileFocusRequest>,
  source: HTMLButtonElement,
) {
  const controller = view.currentController();
  if (!controller) return;
  if (view.state.phase !== "review") return;
  requested.current = { source };
  if (!controller.restore()) requested.current = null;
}
export function createValuationDraftFileActions(
  view: ValuationDraftFileView,
  requested: RefObject<ValuationFileFocusRequest>,
) {
  return {
    exportInputs: () => exportInputs(view),
    readFile: (file: File) => readFile(view, file),
    cancel: (source: HTMLButtonElement) =>
      cancelReview(view, requested, source),
    restore: (source: HTMLButtonElement) =>
      restoreReview(view, requested, source),
  };
}
export type ValuationDraftFileActions = ReturnType<
  typeof createValuationDraftFileActions
>;
