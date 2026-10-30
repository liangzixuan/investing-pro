import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  ManagedResearchDraftSetRecovery,
  type ResearchDraftSetRecoveryState,
} from "./managed-research-draft-set-recovery";
import type { ManagedResearchDraftSetFileDeliveryAdapter } from "./research-draft-set-file-delivery";
import type { ResearchDraftResource } from "./managed-research-draft-set-file";
export interface ResearchDraftSetFilesProps {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedResearchDraftSetFileDeliveryAdapter | undefined;
  routeActive: () => boolean;
  navigationPending: boolean;
}
type Controller = ManagedResearchDraftSetRecovery;
interface Binding {
  controller: Controller;
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ResearchDraftSetFilesProps["delivery"];
}
const empty: ResearchDraftSetRecoveryState = Object.freeze({
  phase: "idle",
  selected: [],
  eligibility: {
    watchlist: false,
    portfolio: false,
    followups: false,
    valuation: false,
  },
  file: null,
  comparison: null,
  canCapture: false,
  canImport: false,
  message: "",
});
const emptySource = { subscribe: () => () => {}, getSnapshot: () => empty };
function routeAvailable(p: ResearchDraftSetFilesProps) {
  return !p.navigationPending && p.routeActive();
}
function matchesBinding(b: Binding, p: ResearchDraftSetFilesProps) {
  return (
    b.workspace === p.workspace &&
    b.accountScope === p.accountScope &&
    b.delivery === p.delivery
  );
}
export function useResearchDraftSetFiles(props: ResearchDraftSetFilesProps) {
  const latest = useRef(props);
  latest.current = props;
  const active = useRef<Binding | null>(null),
    [controller, setController] = useState<Controller | null>(null),
    committed = useRef<object | null>(null),
    render = {};
  useLayoutEffect(() => {
    const model = new ManagedResearchDraftSetRecovery({
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
  const source = controller ?? emptySource,
    state = useSyncExternalStore(
      source.subscribe,
      source.getSnapshot,
      source.getSnapshot,
    );
  const currentController = () => {
    if (committed.current !== render || !controller) return null;
    const binding = active.current;
    if (
      !binding ||
      binding.controller !== controller ||
      !matchesBinding(binding, latest.current) ||
      controller.getSnapshot() !== state ||
      !routeAvailable(latest.current)
    )
      return null;
    return controller;
  };
  useLayoutEffect(() => {
    committed.current = render;
    controller?.reconcile();
    return () => {
      committed.current = null;
    };
  });
  return {
    state,
    available: routeAvailable(props),
    currentController,
    isCurrent: () => currentController() !== null,
  };
}
export type ResearchDraftSetFileView = ReturnType<
  typeof useResearchDraftSetFiles
>;
export type DraftSetFocusTarget =
  "heading" | "input" | "capture" | ResearchDraftResource;
export interface DraftSetFocusRequest {
  state: ResearchDraftSetRecoveryState;
  source: HTMLButtonElement;
  ownedBeforeAction: boolean;
  target: DraftSetFocusTarget;
}
export function createResearchDraftSetActions(
  view: ResearchDraftSetFileView,
  requested: RefObject<DraftSetFocusRequest | null>,
  reading: RefObject<HTMLInputElement | null>,
) {
  const commit = (
    source: HTMLButtonElement,
    target: DraftSetFocusTarget,
    action: (controller: Controller) => boolean,
  ) => {
    const controller = view.currentController();
    if (!controller) return;
    const ownedBeforeAction = document.activeElement === source;
    if (!action(controller)) return;
    requested.current = {
      state: controller.getSnapshot(),
      source,
      ownedBeforeAction,
      target,
    };
  };
  return {
    select: (key: ResearchDraftResource, selected: boolean) =>
      view.currentController()?.selectResource(key, selected),
    capture: (source: HTMLButtonElement) =>
      commit(source, "heading", (c) => c.captureDrafts()),
    save: () => {
      void view.currentController()?.saveFile();
    },
    read: (source: HTMLInputElement, file: File) => {
      const c = view.currentController();
      if (!c || !view.state.canImport) return;
      reading.current = source;
      void c.readFile(file);
    },
    compare: (key: ResearchDraftResource, source: HTMLButtonElement) =>
      commit(source, "heading", (c) => c.compareResource(key)),
    restore: (source: HTMLButtonElement) => {
      const key = view.state.comparison?.resource;
      if (key) commit(source, key, (c) => c.restoreResource());
    },
    cancel: (source: HTMLButtonElement) =>
      commit(
        source,
        view.state.comparison?.resource ??
          (view.state.phase === "reading" ? "input" : "capture"),
        (c) => {
          c.cancel();
          return true;
        },
      ),
    close: (source: HTMLButtonElement) =>
      commit(source, "input", (c) => {
        c.closeFile();
        return true;
      }),
  };
}
export type ResearchDraftSetActions = ReturnType<
  typeof createResearchDraftSetActions
>;
