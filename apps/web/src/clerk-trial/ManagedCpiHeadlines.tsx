import { ManagedCpiHeadlineList } from "./ManagedCpiHeadlineList";
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { CalendarSourceCapture } from "./managed-calendar-followup";
import { ManagedCpiFollowupForm } from "./ManagedCpiFollowupForm";
import "./managed-calendar-followup.css";
import "./managed-cpi-headlines.css";
export interface ManagedCpiHeadlinesProps {
  headingRef?: Ref<HTMLHeadingElement>;
  workspace: ManagedWorkspace;
  isCurrent: () => boolean;
  navigationPending: boolean;
  onReview: (entry: ResearchFollowup) => void;
  onManageWatchlist: () => void;
}
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
export function ManagedCpiHeadlines(props: ManagedCpiHeadlinesProps) {
  const state = useSources(props.workspace);
  const [filter, setFilter] = useState("");
  const [choice, setChoice] = useState<{
    capture: CalendarSourceCapture | null;
    revision: number;
  }>({ capture: null, revision: 0 });
  const epoch = useRef({});
  const opener = useRef<HTMLElement | null>(null);
  const render = { props, state };
  const committed = useRef<typeof render | null>(null);
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) {
        committed.current = null;
      }
    };
  });
  const current = () =>
    committed.current === render &&
    props.isCurrent() &&
    !props.navigationPending;
  const keep = (url: string, target: HTMLElement) => {
    if (!current() || state.busy) return;
    epoch.current = {};
    const token = epoch.current;
    const selected = () =>
      epoch.current === token && props.isCurrent() && !props.navigationPending;
    const result = props.workspace.captureCpiHeadlineSource(url, selected);
    if (!result.capture || !current()) return;
    opener.current = target;
    setChoice({ capture: result.capture, revision: choice.revision + 1 });
  };
  const changeFilter = (value: string) => {
    if (!current()) return;
    epoch.current = {};
    setFilter(value);
  };
  const load = () => {
    if (current()) void props.workspace.cpiHeadlines.load();
  };
  return (
    <section
      className="managed-cpi-headlines"
      aria-labelledby="managed-cpi-heading"
    >
      <h2 id="managed-cpi-heading" ref={props.headingRef} tabIndex={-1}>
        Published CPI headlines
      </h2>
      <p>
        U.S. Bureau of Labor Statistics CPI statistical-release headline
        metadata. No article bodies or economic values are loaded. Feed clocks
        do not independently establish release or embargo times.
      </p>
      <button
        id="cpi-headlines-load"
        type="button"
        className="trial-secondary"
        disabled={!props.isCurrent() || props.navigationPending || state.busy}
        onClick={load}
      >
        {state.headlines ? "Refresh CPI headlines" : "Load CPI headlines"}
      </button>
      {state.busy && (
        <button
          id="cpi-headlines-cancel"
          type="button"
          className="trial-secondary"
          onClick={() => {
            if (current()) props.workspace.cpiHeadlines.cancel();
          }}
        >
          Cancel CPI headlines
        </button>
      )}
      <label htmlFor="cpi-headlines-filter">Filter loaded CPI headlines</label>
      <input
        id="cpi-headlines-filter"
        value={filter}
        disabled={!props.isCurrent() || props.navigationPending}
        onChange={(e) => changeFilter(e.currentTarget.value)}
      />
      <p role="status" aria-live="polite">
        {state.message}
      </p>
      {state.showingPrevious && (
        <p>
          Retained previous packet. This attempt has not confirmed newer source
          data; its original clocks remain unchanged.
        </p>
      )}
      <ManagedCpiHeadlineList
        state={state}
        filter={filter}
        disabled={state.busy || !props.isCurrent() || props.navigationPending}
        onKeep={keep}
      />
      {choice.capture && (
        <ManagedCpiFollowupForm
          key={choice.revision}
          {...props}
          capture={choice.capture}
          onClose={() => {
            if (props.isCurrent() && opener.current?.isConnected)
              opener.current.focus({ preventScroll: true });
          }}
        />
      )}
    </section>
  );
}
