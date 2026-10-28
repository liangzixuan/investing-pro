import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { CalendarSourceCapture } from "./managed-calendar-followup";
import type { ManagedCpiHeadlinesProps } from "./ManagedCpiHeadlines";
function useSources(workspace: ManagedWorkspace) {
  useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
    workspace.coordinator.getSnapshot,
  );
  useSyncExternalStore(
    workspace.followups.subscribe,
    workspace.followups.getSnapshot,
    workspace.followups.getSnapshot,
  );
  useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
    workspace.followups.coordinator.getSnapshot,
  );
  useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  return useSyncExternalStore(
    workspace.cpiHeadlines.subscribe,
    workspace.cpiHeadlines.getSnapshot,
    workspace.cpiHeadlines.getSnapshot,
  );
}
interface Choice {
  capture: CalendarSourceCapture | null;
  revision: number;
}
interface Render {
  props: ManagedCpiHeadlinesProps;
  state: ReturnType<ManagedWorkspace["cpiHeadlines"]["getSnapshot"]>;
}
interface Interaction {
  render: Render;
  committed: RefObject<Render | null>;
  epoch: RefObject<object>;
  opener: RefObject<HTMLElement | null>;
  choice: Choice;
  setChoice: (choice: Choice) => void;
  setFilter: (value: string) => void;
}
function current(i: Interaction) {
  return (
    i.committed.current === i.render &&
    i.render.props.isCurrent() &&
    !i.render.props.navigationPending
  );
}
function selectionCurrent(i: Interaction, token: object) {
  return (
    i.epoch.current === token &&
    i.render.props.isCurrent() &&
    !i.render.props.navigationPending
  );
}
function keep(i: Interaction, url: string, target: HTMLElement) {
  if (!current(i) || i.render.state.busy) return;
  i.epoch.current = {};
  const token = i.epoch.current;
  const result = i.render.props.workspace.captureCpiHeadlineSource(url, () =>
    selectionCurrent(i, token),
  );
  if (!result.capture || !current(i)) return;
  i.opener.current = target;
  i.setChoice({ capture: result.capture, revision: i.choice.revision + 1 });
}
function changeFilter(i: Interaction, value: string) {
  if (!current(i)) return;
  i.epoch.current = {};
  i.setFilter(value);
}
function load(i: Interaction) {
  if (current(i)) void i.render.props.workspace.cpiHeadlines.load();
}
function cancel(i: Interaction) {
  if (current(i)) i.render.props.workspace.cpiHeadlines.cancel();
}
function close(i: Interaction) {
  if (i.render.props.isCurrent() && i.opener.current?.isConnected)
    i.opener.current.focus({ preventScroll: true });
}
function actions(i: Interaction) {
  return {
    keep: (url: string, target: HTMLElement) => keep(i, url, target),
    changeFilter: (value: string) => changeFilter(i, value),
    load: () => load(i),
    cancel: () => cancel(i),
    close: () => close(i),
  };
}
function panelDisplay(props: ManagedCpiHeadlinesProps, state: Render["state"]) {
  return {
    readDisabled: !props.isCurrent() || props.navigationPending || state.busy,
    filterDisabled: !props.isCurrent() || props.navigationPending,
    listDisabled: state.busy || !props.isCurrent() || props.navigationPending,
    readLabel: state.headlines ? "Refresh CPI headlines" : "Load CPI headlines",
  };
}
export function useCpiHeadlinesControls(props: ManagedCpiHeadlinesProps) {
  const state = useSources(props.workspace);
  const [filter, setFilter] = useState("");
  const [choice, setChoice] = useState<Choice>({ capture: null, revision: 0 });
  const epoch = useRef<object>({});
  const opener = useRef<HTMLElement | null>(null);
  const render = { props, state };
  const committed = useRef<Render | null>(null);
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) committed.current = null;
    };
  });
  const interaction: Interaction = {
    render,
    committed,
    epoch,
    opener,
    choice,
    setChoice,
    setFilter,
  };
  return {
    state,
    filter,
    choice,
    ...actions(interaction),
    ...panelDisplay(props, state),
  };
}
