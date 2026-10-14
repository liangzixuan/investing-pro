import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { FedMonetaryAnnouncements } from "../features/markets/FedMonetaryAnnouncements";
import {
  projectFedAnnouncementView,
  type FedAnnouncementRefreshView,
} from "../features/markets/fed-announcement-view";
import { projectManagedFedUpdatesView } from "./managed-fed-updates-view";
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
  const comparison =
    state.refreshComparison?.current === state.announcements
      ? state.refreshComparison
      : null;
  const [choice, setChoice] = useState<{
    model: Model;
    response: typeof state.announcements;
    comparison: typeof comparison;
    query: string;
    refreshView: FedAnnouncementRefreshView;
    resetNotice: boolean;
  }>(() => ({
    model,
    response: state.announcements,
    comparison,
    query: "",
    refreshView: "all",
    resetNotice: false,
  }));
  const selection: typeof choice =
    choice.model === model && choice.response === state.announcements
      ? choice.comparison === comparison
        ? choice
        : {
            ...choice,
            comparison,
            refreshView: "all",
            resetNotice: false,
          }
      : {
          model,
          response: state.announcements,
          comparison,
          query: "",
          refreshView: "all",
          resetNotice: choice.response !== null && state.announcements !== null,
        };
  if (selection !== choice) setChoice(selection);
  const updates = useMemo(
    () =>
      projectManagedFedUpdatesView(
        projectFedAnnouncementView(state.announcements, selection.query),
        comparison,
        selection.refreshView,
      ),
    [state.announcements, selection.query, comparison, selection.refreshView],
  );
  const view = updates.view;
  const committed = useRef<typeof selection | null>(null);
  useLayoutEffect(() => {
    committed.current = selection;
    return () => {
      committed.current = null;
    };
  }, [selection]);
  const matchesCurrentSelection = () => {
    const snapshot = model.getSnapshot();
    const currentComparison =
      snapshot.refreshComparison?.current === snapshot.announcements
        ? snapshot.refreshComparison
        : null;
    return (
      committed.current === selection &&
      snapshot.announcements === selection.response &&
      currentComparison === comparison
    );
  };
  const changeQuery = (query: string) => {
    if (!matchesCurrentSelection()) return;
    setChoice((current) =>
      current === selection
        ? { ...current, query, resetNotice: false }
        : current,
    );
  };
  const changeRefreshView = (refreshView: FedAnnouncementRefreshView) => {
    if (
      !matchesCurrentSelection() ||
      (refreshView === "new" && !updates.available)
    )
      return;
    setChoice((current) =>
      current === selection
        ? { ...current, refreshView, resetNotice: false }
        : current,
    );
  };
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
        updatesView: {
          mode: updates.refreshView,
          available: updates.available,
          onChange: changeRefreshView,
        },
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
