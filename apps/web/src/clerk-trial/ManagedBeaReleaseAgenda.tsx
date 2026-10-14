import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { BeaReleaseAgenda } from "../features/markets/BeaReleaseAgenda";
import {
  projectBeaReleaseView,
  type BeaReleaseRefreshView,
} from "../features/markets/bea-release-view";
import { projectManagedBeaUpdatesView } from "./managed-bea-updates-view";
import {
  ManagedBeaReleaseNoteAction,
  type ManagedBeaReleaseNoteContext,
} from "./ManagedBeaReleaseNoteAction";
import type { ManagedBeaReleaseAgenda as Model } from "./managed-bea-release-agenda";

export function ManagedBeaReleaseAgenda({
  model,
  headingRef,
  noteContext,
}: {
  model: Model;
  noteContext: ManagedBeaReleaseNoteContext;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const comparison =
    state.refreshComparison?.current === state.agenda
      ? state.refreshComparison
      : null;
  const [choice, setChoice] = useState<{
    model: Model;
    agenda: typeof state.agenda;
    comparison: typeof comparison;
    date: string;
    query: string;
    refreshView: BeaReleaseRefreshView;
    resetNotice: boolean;
  }>(() => ({
    model,
    agenda: state.agenda,
    comparison,
    date: "",
    query: "",
    refreshView: "all",
    resetNotice: false,
  }));
  const selection: typeof choice =
    choice.model === model && choice.agenda === state.agenda
      ? choice.comparison === comparison
        ? choice
        : { ...choice, comparison, refreshView: "all", resetNotice: false }
      : {
          model,
          agenda: state.agenda,
          comparison,
          date: "",
          query: "",
          refreshView: "all",
          resetNotice: choice.agenda !== null && state.agenda !== null,
        };
  if (selection !== choice) setChoice(selection);
  const updates = useMemo(
    () =>
      projectManagedBeaUpdatesView(
        projectBeaReleaseView(state.agenda, selection.date, selection.query),
        comparison,
        selection.refreshView,
      ),
    [
      state.agenda,
      selection.date,
      selection.query,
      comparison,
      selection.refreshView,
    ],
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
      snapshot.refreshComparison?.current === snapshot.agenda
        ? snapshot.refreshComparison
        : null;
    return (
      committed.current === selection &&
      snapshot.agenda === selection.agenda &&
      currentComparison === comparison
    );
  };
  const changeDate = (date: string) => {
    if (!matchesCurrentSelection()) return;
    if (date !== "" && !view.groups.some((group) => group.key === date)) return;
    setChoice((current) =>
      current === selection
        ? { ...current, date, resetNotice: false }
        : current,
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
  const changeRefreshView = (refreshView: BeaReleaseRefreshView) => {
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
  const load = useRef<HTMLButtonElement>(null);
  const restoreLoad = useRef(false);
  useLayoutEffect(() => {
    if (!state.busy && restoreLoad.current) {
      restoreLoad.current = false;
      load.current?.focus();
    }
  }, [state.busy]);
  return (
    <BeaReleaseAgenda
      {...state}
      headingRef={headingRef}
      className="trial-panel"
      filterView={{
        view,
        resetNotice: selection.resetNotice,
        onDateChange: changeDate,
        onQueryChange: changeQuery,
        updatesView: {
          mode: updates.refreshView,
          available: updates.available,
          onChange: changeRefreshView,
        },
      }}
      noteAction={
        <ManagedBeaReleaseNoteAction
          {...noteContext}
          state={state}
          view={view}
        />
      }
      enabled
      loadButtonRef={load}
      onLoad={() => void model.load()}
      onCancel={(event) => {
        restoreLoad.current = document.activeElement === event.currentTarget;
        model.cancel();
      }}
    />
  );
}
