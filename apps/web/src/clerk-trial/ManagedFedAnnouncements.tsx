import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { FedMonetaryAnnouncements } from "../features/markets/FedMonetaryAnnouncements";
import { projectFedAnnouncementView } from "../features/markets/fed-announcement-view";
import type { ManagedFedAnnouncements as Model } from "./managed-fed-announcements";
import { ManagedFedRefreshComparisonDetails } from "./ManagedFedRefreshComparisonDetails";
import {
  ManagedFedAnnouncementNoteAction,
  type ManagedFedAnnouncementNoteContext,
} from "./ManagedFedAnnouncementNoteAction";

export function ManagedFedAnnouncements({
  model,
  headingRef,
  noteContext,
}: {
  model: Model;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  noteContext: ManagedFedAnnouncementNoteContext;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const load = useRef<HTMLButtonElement>(null);
  const [choice, setChoice] = useState(() => ({
    model,
    response: state.announcements,
    query: "",
    resetNotice: false,
  }));
  const selection =
    choice.model === model && choice.response === state.announcements
      ? choice
      : {
          model,
          response: state.announcements,
          query: "",
          resetNotice: choice.response !== null && state.announcements !== null,
        };
  if (selection !== choice) setChoice(selection);
  const view = useMemo(
    () => projectFedAnnouncementView(state.announcements, selection.query),
    [state.announcements, selection.query],
  );
  const committed = useRef<typeof selection | null>(null);
  useLayoutEffect(() => {
    committed.current = selection;
    return () => {
      committed.current = null;
    };
  }, [selection]);
  const changeQuery = (query: string) => {
    if (
      committed.current !== selection ||
      model.getSnapshot().announcements !== selection.response
    )
      return;
    setChoice((current) =>
      current === selection
        ? { ...current, query, resetNotice: false }
        : current,
    );
  };
  const comparison =
    state.refreshComparison?.current === state.announcements
      ? state.refreshComparison
      : null;
  const restoreLoad = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (state.busy || !restoreLoad.current) return;
    const cancel = restoreLoad.current;
    restoreLoad.current = null;
    const button = load.current;
    if (
      (document.activeElement === cancel ||
        document.activeElement === document.body) &&
      button?.isConnected &&
      !button.disabled &&
      !button.closest("[hidden], [inert]") &&
      button.getClientRects().length > 0
    )
      button.focus();
  }, [state.busy]);
  return (
    <FedMonetaryAnnouncements
      {...state}
      headingRef={headingRef}
      filterView={{
        view,
        resetNotice: selection.resetNotice,
        onQueryChange: changeQuery,
      }}
      refreshSummary={
        comparison && (
          <ManagedFedRefreshComparisonDetails
            comparison={comparison}
            showingPrevious={state.showingPrevious}
          />
        )
      }
      newlyObservedUrls={comparison?.newUrls ?? []}
      noteAction={
        <ManagedFedAnnouncementNoteAction
          {...noteContext}
          state={state}
          view={view}
        />
      }
      className="trial-panel"
      enabled
      loadButtonRef={load}
      onLoad={() => void model.load()}
      onCancel={(event) => {
        restoreLoad.current =
          document.activeElement === event.currentTarget
            ? event.currentTarget
            : null;
        model.cancel();
      }}
    />
  );
}
