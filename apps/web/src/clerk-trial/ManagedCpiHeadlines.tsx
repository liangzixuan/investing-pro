import { useCpiHeadlinesControls } from "./ManagedCpiHeadlinesControls";
import { ManagedCpiHeadlineList } from "./ManagedCpiHeadlineList";
import type { Ref } from "react";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
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
export function ManagedCpiHeadlines(props: ManagedCpiHeadlinesProps) {
  const {
    state,
    filter,
    choice,
    keep,
    changeFilter,
    load,
    cancel,
    close,
    readDisabled,
    filterDisabled,
    listDisabled,
    readLabel,
  } = useCpiHeadlinesControls(props);
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
        disabled={readDisabled}
        onClick={load}
      >
        {readLabel}
      </button>
      {state.busy && (
        <button
          id="cpi-headlines-cancel"
          type="button"
          className="trial-secondary"
          onClick={cancel}
        >
          Cancel CPI headlines
        </button>
      )}
      <label htmlFor="cpi-headlines-filter">Filter loaded CPI headlines</label>
      <input
        id="cpi-headlines-filter"
        value={filter}
        disabled={filterDisabled}
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
        disabled={listDisabled}
        onKeep={keep}
      />
      {choice.capture && (
        <ManagedCpiFollowupForm
          key={choice.revision}
          {...props}
          capture={choice.capture}
          onClose={close}
        />
      )}
    </section>
  );
}
