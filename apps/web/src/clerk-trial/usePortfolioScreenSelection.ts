import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedFinancialScreenMember } from "./managed-financial-screen";
import {
  getPortfolioScreenSelection,
  preparePortfolioScreenSelection,
  stalePortfolioScreenSelection,
  type PortfolioScreenSelectionPreview,
} from "./managed-portfolio-screen-selection";

function usePortfolioScreenSources(workspace: ManagedWorkspace) {
  useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  useSyncExternalStore(
    workspace.portfolio.subscribe,
    workspace.portfolio.getSnapshot,
    workspace.portfolio.getSnapshot,
  );
  useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
    workspace.portfolio.coordinator.getSnapshot,
  );
  useSyncExternalStore(
    workspace.financialScreen.subscribe,
    workspace.financialScreen.getSnapshot,
    workspace.financialScreen.getSnapshot,
  );
}
function ownsFocus(element: Element | null) {
  return (
    element !== null &&
    (document.activeElement === element ||
      (!element.isConnected && document.activeElement === document.body))
  );
}
interface State {
  owner: ManagedWorkspace;
  choices: readonly ManagedFinancialScreenMember[];
  preview: PortfolioScreenSelectionPreview | null;
  message: string | null;
}

export function usePortfolioScreenSelection(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
) {
  usePortfolioScreenSources(workspace);
  const [state, setState] = useState<State>({
    owner: workspace,
    choices: [],
    preview: null,
    message: null,
  });
  const choices = state.owner === workspace ? state.choices : [];
  const readout = getPortfolioScreenSelection(workspace, routeActive, choices);
  const preview = state.owner === workspace ? state.preview : null;
  const currentPreview = preview?.isCurrent() ?? false;
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previewHeading = useRef<HTMLHeadingElement | null>(null);
  const prepareButton = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<(() => void) | null>(null);
  const committed = useRef<object | null>(null);
  const host = useRef<object | null>(null);
  const lease = useRef<PortfolioScreenSelectionPreview | null>(null);
  const busy = useRef(false);
  const frame = {};
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      if (committed.current === frame) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    const owner = {};
    host.current = owner;
    return () => {
      if (host.current === owner) host.current = null;
      lease.current?.cancel();
      lease.current = null;
      pendingFocus.current = null;
    };
  }, [workspace, routeActive]);
  useLayoutEffect(() => {
    const action = pendingFocus.current;
    pendingFocus.current = null;
    action?.();
  });
  const current = () =>
    host.current !== null &&
    committed.current === frame &&
    !busy.current &&
    readout.context.isCurrent();
  const choose = (
    issuerId: string,
    member: ManagedFinancialScreenMember | null,
  ) => {
    if (!current()) return;
    const group = readout.plan.choiceGroups.find(
      (item) => item.issuerId === issuerId,
    );
    if (!group || (member !== null && !group.members.includes(member))) return;
    lease.current?.cancel();
    lease.current = null;
    const next = choices.filter(
      (choice) => choice.listing.issuerId !== issuerId,
    );
    setState({
      owner: workspace,
      choices: member ? [...next, member] : next,
      preview: null,
      message: null,
    });
  };
  const prepare = () => {
    if (!current()) return;
    const owner = host.current;
    const initiating = document.activeElement;
    lease.current?.cancel();
    const result = preparePortfolioScreenSelection(
      workspace,
      routeActive,
      choices,
    );
    if (host.current !== owner) {
      result.preview?.cancel();
      return;
    }
    lease.current = result.preview;
    const prepared = result.preview;
    if (prepared)
      pendingFocus.current = () => {
        if (
          host.current === owner &&
          lease.current === prepared &&
          prepared.isCurrent() &&
          ownsFocus(initiating)
        )
          previewHeading.current?.focus();
      };
    setState({
      owner: workspace,
      choices,
      preview: prepared,
      message: result.reason,
    });
  };
  const resetChoices = () => {
    if (!current() || choices.length === 0) return;
    const owner = host.current;
    const initiating = document.activeElement;
    lease.current?.cancel();
    lease.current = null;
    pendingFocus.current = () => {
      if (
        host.current === owner &&
        readout.context.isCurrent() &&
        ownsFocus(initiating)
      )
        heading.current?.focus();
    };
    setState({
      owner: workspace,
      choices: [],
      preview: null,
      message:
        "Share-class choices cleared. Review the current holdings before previewing again.",
    });
  };
  const cancel = () => {
    if (!current()) return;
    const owner = host.current;
    const initiating = document.activeElement;
    const owned = preview?.isCurrent() ?? false;
    lease.current?.cancel();
    lease.current = null;
    pendingFocus.current = () => {
      if (
        host.current === owner &&
        owned &&
        readout.context.isCurrent() &&
        ownsFocus(initiating)
      )
        prepareButton.current?.focus();
    };
    setState({ owner: workspace, choices, preview: null, message: null });
  };
  const apply = () => {
    if (!current() || !preview || lease.current !== preview) return;
    const owner = host.current;
    const initiating = document.activeElement;
    busy.current = true;
    try {
      const applied = preview.apply();
      lease.current = null;
      if (host.current !== owner || !applied?.isCurrent()) return;
      pendingFocus.current = () => {
        if (
          host.current === owner &&
          applied.isCurrent() &&
          ownsFocus(initiating)
        )
          heading.current?.focus();
      };
      setState({
        owner: workspace,
        choices,
        preview: null,
        message: applied.unchanged
          ? "These companies are already selected in this order. The current screen is retained."
          : "Portfolio companies selected. Run screen separately when ready. Portfolio and criteria are unchanged.",
      });
    } finally {
      busy.current = false;
    }
  };
  return {
    ...readout,
    preview,
    currentPreview,
    message:
      preview && !currentPreview
        ? stalePortfolioScreenSelection
        : state.message,
    heading,
    previewHeading,
    prepareButton,
    hasChoices: choices.length > 0,
    resetChoices,
    choose,
    prepare,
    cancel,
    apply,
  };
}
