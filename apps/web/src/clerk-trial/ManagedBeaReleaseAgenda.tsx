import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { BeaReleaseAgenda } from "../features/markets/BeaReleaseAgenda";
import { groupBeaReleaseDates } from "../features/markets/bea-release-dates";
import type { ManagedBeaReleaseAgenda as Model } from "./managed-bea-release-agenda";

export function ManagedBeaReleaseAgenda({
  model,
  headingRef,
}: {
  model: Model;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const [choice, setChoice] = useState(() => ({
    model,
    agenda: state.agenda,
    date: "",
    resetNotice: false,
  }));
  const selection =
    choice.model === model && choice.agenda === state.agenda
      ? choice
      : {
          model,
          agenda: state.agenda,
          date: "",
          resetNotice: choice.agenda !== null && state.agenda !== null,
        };
  if (selection !== choice) setChoice(selection);
  const committed = useRef<typeof selection | null>(null);
  useLayoutEffect(() => {
    committed.current = selection;
    return () => {
      committed.current = null;
    };
  }, [selection]);
  const changeDate = (date: string) => {
    if (
      committed.current !== selection ||
      model.getSnapshot().agenda !== selection.agenda
    )
      return;
    if (
      date !== "" &&
      !groupBeaReleaseDates(selection.agenda).some(
        (group) => group.key === date,
      )
    )
      return;
    setChoice((current) =>
      current === selection
        ? { ...current, date, resetNotice: false }
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
      dateView={{
        selectedDate: selection.date,
        resetNotice: selection.resetNotice,
        onDateChange: changeDate,
      }}
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
