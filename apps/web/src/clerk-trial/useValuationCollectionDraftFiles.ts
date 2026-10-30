import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  ManagedValuationCollectionDraftRecovery,
  type ValuationCollectionRecoveryState,
} from "./managed-valuation-collection-recovery";
import type { ManagedValuationCollectionDraftFileDeliveryAdapter } from "./valuation-collection-draft-file-delivery";
import type { ValuationCollectionFileFocus } from "./useValuationCollectionDraftFileFocus";

export interface ValuationCollectionFilesProps {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedValuationCollectionDraftFileDeliveryAdapter | undefined;
  routeActive: () => boolean;
  navigationPending: boolean;
}
type Controller = ManagedValuationCollectionDraftRecovery;
interface Binding {
  controller: Controller;
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ValuationCollectionFilesProps["delivery"];
}
function matchesBinding(
  binding: Binding,
  latest: ValuationCollectionFilesProps,
) {
  if (binding.workspace !== latest.workspace) return false;
  if (binding.accountScope !== latest.accountScope) return false;
  return binding.delivery === latest.delivery;
}
export interface ValuationCollectionFileView {
  state: ValuationCollectionRecoveryState;
  available: boolean;
  currentController: () => Controller | null;
  isCurrent: () => boolean;
}
const empty: ValuationCollectionRecoveryState = Object.freeze({
  phase: "idle",
  preview: null,
  currentDraft: null,
  currentSavedVersion: null,
  canExport: false,
  canImport: false,
  message: "",
});
const emptySource = { subscribe: () => () => {}, getSnapshot: () => empty };
function routeAvailable(props: ValuationCollectionFilesProps) {
  if (props.navigationPending) return false;
  return props.routeActive();
}
export function collectionCaptureVisible(
  state: ValuationCollectionRecoveryState,
) {
  return state.phase === "capture" || state.phase === "exporting";
}
export function useValuationCollectionDraftFiles(
  props: ValuationCollectionFilesProps,
): ValuationCollectionFileView {
  const latest = useRef(props);
  latest.current = props;
  const active = useRef<Binding | null>(null);
  const [controller, setController] = useState<Controller | null>(null);
  const liveRender = useRef<object | null>(null),
    render = {};
  useLayoutEffect(() => {
    const model = new ManagedValuationCollectionDraftRecovery({
      workspace: props.workspace,
      accountScope: props.accountScope,
      delivery: props.delivery,
      routeActive: () => routeAvailable(latest.current),
    });
    const binding = {
      controller: model,
      workspace: props.workspace,
      accountScope: props.accountScope,
      delivery: props.delivery,
    };
    active.current = binding;
    setController(model);
    return () => {
      if (active.current === binding) active.current = null;
      model.dispose();
    };
  }, [props.workspace, props.accountScope, props.delivery]);
  const source = controller ?? emptySource;
  const state = useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getSnapshot,
  );
  const currentController = () => {
    if (liveRender.current !== render) return null;
    if (controller === null) return null;
    const binding = active.current;
    if (!binding || binding.controller !== controller) return null;
    if (!matchesBinding(binding, latest.current)) return null;
    if (controller.getSnapshot() !== state) return null;
    if (!routeAvailable(latest.current)) return null;
    return controller;
  };
  useLayoutEffect(() => {
    liveRender.current = render;
    controller?.reconcile();
    return () => {
      liveRender.current = null;
    };
  });
  return {
    state,
    available: routeAvailable(props),
    currentController,
    isCurrent: () => currentController() !== null,
  };
}
function captureCollection(
  view: ValuationCollectionFileView,
  focus: ValuationCollectionFileFocus,
  source: HTMLButtonElement,
) {
  if (!view.state.canExport) return;
  const controller = view.currentController();
  if (!controller?.captureDraft()) return;
  focus.requested.current = {
    state: controller.getSnapshot(),
    source,
    to: "heading",
  };
}
function readCollection(
  view: ValuationCollectionFileView,
  focus: ValuationCollectionFileFocus,
  source: HTMLInputElement,
  file: File,
) {
  if (!view.state.canImport) return;
  const controller = view.currentController();
  if (!controller) return;
  focus.reading.current = source;
  void controller.readFile(file);
}
function restoreCollection(
  view: ValuationCollectionFileView,
  focus: ValuationCollectionFileFocus,
  source: HTMLButtonElement,
) {
  const controller = view.currentController();
  if (!controller?.restoreDraft()) return;
  focus.requested.current = {
    state: controller.getSnapshot(),
    source,
    to: "input",
  };
}
function cancelCollection(
  view: ValuationCollectionFileView,
  focus: ValuationCollectionFileFocus,
  source: HTMLButtonElement,
) {
  const controller = view.currentController();
  if (!controller) return;
  controller.cancel();
  focus.requested.current = {
    state: controller.getSnapshot(),
    source,
    to: collectionCaptureVisible(view.state) ? "capture" : "input",
  };
}
export function createValuationCollectionFileActions(
  view: ValuationCollectionFileView,
  focus: ValuationCollectionFileFocus,
) {
  return {
    capture: (source: HTMLButtonElement) =>
      captureCollection(view, focus, source),
    readFile: (source: HTMLInputElement, file: File) =>
      readCollection(view, focus, source, file),
    saveFile: () => {
      void view.currentController()?.saveFile();
    },
    restore: (source: HTMLButtonElement) =>
      restoreCollection(view, focus, source),
    cancel: (source: HTMLButtonElement) =>
      cancelCollection(view, focus, source),
  };
}
export type ValuationCollectionFileActions = ReturnType<
  typeof createValuationCollectionFileActions
>;
