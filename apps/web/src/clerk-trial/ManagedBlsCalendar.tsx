import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  type ManagedBlsCalendarDto,
} from "@research-cockpit/contracts";
import { groupBeaReleaseDates } from "../features/markets/bea-release-dates";
import type {
  ManagedBlsCalendar as Model,
  ManagedBlsCalendarState,
} from "./managed-bls-calendar";
import "./managed-bls-calendar.css";

const eastern = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});
const normalize = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/gu, " ");
type DateGroups = ReturnType<typeof groupBeaReleaseDates>;
function filteredGroups(
  groups: DateGroups,
  date: string,
  query: string,
): DateGroups {
  const matchingDate = date
    ? groups.filter((group) => group.key === date)
    : groups;
  return matchingDate.flatMap((group) => {
    const events = group.events.filter((event) =>
      normalize(event.series).includes(normalize(query)),
    );
    return events.length ? [{ ...group, events }] : [];
  });
}
function useLoadFocus(busy: boolean) {
  const load = useRef<HTMLButtonElement>(null);
  const restore = useRef(false);
  useLayoutEffect(() => {
    if (busy || !restore.current) return;
    restore.current = false;
    load.current?.focus();
  }, [busy]);
  return { load, restore };
}
function useCalendarSelection(
  model: Model,
  calendar: ManagedBlsCalendarDto | null,
) {
  const [choice, setChoice] = useState({
    model,
    calendar: calendar,
    query: "",
    date: "",
  });
  const matches = choice.model === model && choice.calendar === calendar;
  const selection = matches
    ? choice
    : { model, calendar: calendar, query: "", date: "" };
  if (selection !== choice) setChoice(selection);
  const committed = useRef<typeof selection | null>(null);
  useLayoutEffect(() => {
    committed.current = selection;
    return () => {
      committed.current = null;
    };
  }, [selection]);
  const current = () =>
    committed.current === selection &&
    model.getSnapshot().calendar === selection.calendar;
  const groups = groupBeaReleaseDates(calendar);
  const visible = filteredGroups(groups, selection.date, selection.query);
  const onQuery = (query: string) => {
    if (current()) setChoice({ ...selection, query });
  };
  const onDate = (date: string) => {
    if (!current()) return;
    if (date !== "" && !groups.some((group) => group.key === date)) return;
    setChoice({ ...selection, date });
  };
  return { selection, groups, visible, current, onQuery, onDate };
}

function useCalendarView(model: Model) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const selection = useCalendarSelection(model, state.calendar);
  const focus = useLoadFocus(state.busy);
  const onLoad = () => {
    if (!selection.current()) return;
    focus.restore.current = true;
    void model.load();
  };
  const onCancel = () => {
    if (selection.current()) model.cancel();
  };
  return { ...selection, state, load: focus.load, onLoad, onCancel };
}

function CalendarDescription() {
  return (
    <>
      <p>
        Scheduled labor, employment and inflation releases from the U.S. Bureau
        of Labor Statistics. Load the next 30 days explicitly.
      </p>
      <p>
        <a
          href={MANAGED_BLS_CALENDAR_SOURCE.scheduleUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Official BLS schedule
        </a>
        . Dates can change. This calendar does not include released values,
        forecasts or company earnings.
      </p>
    </>
  );
}
function CalendarStatus({
  state,
}: {
  readonly state: ManagedBlsCalendarState;
}) {
  const previous = state.showingPrevious && state.calendar !== null;
  return (
    <>
      {state.message && <p role="status">{state.message}</p>}
      {state.error && (
        <p role="alert">
          {state.error === "invalid_response"
            ? "The BLS response could not be verified."
            : "The BLS calendar could not be loaded."}
        </p>
      )}
      {previous && (
        <p>
          Previous calendar. This attempt has not confirmed a newer schedule.
        </p>
      )}
    </>
  );
}
function CalendarProvenance({
  calendar,
}: {
  readonly calendar: ManagedBlsCalendarDto;
}) {
  return (
    <>
      <p>
        Retrieved{" "}
        <time dateTime={calendar.fetchedAt}>
          {eastern.format(new Date(calendar.fetchedAt))}
        </time>
        . UTC: {calendar.fetchedAt}
      </p>
      <p>
        Loaded window: {calendar.window.fromInclusive} (inclusive) to{" "}
        {calendar.window.toExclusive} (exclusive). Release times use Eastern
        time, including daylight time.
      </p>
    </>
  );
}
function CalendarRows({
  groups,
  empty,
}: {
  readonly groups: DateGroups;
  readonly empty: boolean;
}) {
  if (empty)
    return (
      <p>
        No scheduled BLS releases in this loaded window. Other economic events
        may exist.
      </p>
    );
  if (groups.length === 0)
    return <p>No releases match this search and date.</p>;
  return (
    <>
      {groups.map((group) => (
        <section key={group.key} aria-label={`BLS ${group.label}`}>
          <h3>
            <time dateTime={group.key}>{group.label}</time>
          </h3>
          <ul>
            {group.events.map((event) => (
              <li key={JSON.stringify([event.series, event.scheduledAt])}>
                <p>{event.series}</p>
                <p>
                  <time dateTime={event.scheduledAt}>
                    {eastern.format(new Date(event.scheduledAt))}
                  </time>
                  <br />
                  UTC: {event.scheduledAt}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function ManagedBlsCalendar({
  model,
  headingRef,
}: {
  readonly model: Model;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}) {
  const view = useCalendarView(model);
  const { state, selection } = view;
  return (
    <section
      className="trial-panel managed-bls-calendar"
      aria-labelledby="bls-calendar-title"
    >
      <h2 id="bls-calendar-title" tabIndex={-1} ref={headingRef}>
        BLS release calendar
      </h2>
      <CalendarDescription />
      <div className="trial-actions">
        <button
          type="button"
          ref={view.load}
          disabled={state.busy}
          onClick={view.onLoad}
        >
          {state.calendar ? "Refresh BLS calendar" : "Load BLS calendar"}
        </button>
        {state.busy && (
          <button type="button" onClick={view.onCancel}>
            Cancel BLS load
          </button>
        )}
      </div>
      <CalendarStatus state={state} />
      {state.calendar && (
        <>
          <CalendarProvenance calendar={state.calendar} />
          <div className="trial-fields">
            <label>
              Search BLS releases
              <input
                id="bls-calendar-search"
                type="search"
                value={selection.query}
                maxLength={256}
                onChange={(event) => view.onQuery(event.currentTarget.value)}
              />
            </label>
            <label>
              BLS release date
              <select
                id="bls-calendar-date"
                value={selection.date}
                onChange={(event) => view.onDate(event.currentTarget.value)}
              >
                <option value="">All loaded dates</option>
                {view.groups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p role="status">
            {view.visible.reduce(
              (count, group) => count + group.events.length,
              0,
            )}{" "}
            of {state.calendar.events.length} loaded releases.
          </p>
          <CalendarRows
            groups={view.visible}
            empty={state.calendar.events.length === 0}
          />
        </>
      )}
    </section>
  );
}
