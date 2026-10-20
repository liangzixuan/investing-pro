import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { MANAGED_BLS_CALENDAR_SOURCE } from "@research-cockpit/contracts";
import { groupBeaReleaseDates } from "../features/markets/bea-release-dates";
import "./managed-bls-calendar.css";
import type { ManagedBlsCalendar as Model } from "./managed-bls-calendar";

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

export function ManagedBlsCalendar({
  model,
  headingRef,
}: {
  readonly model: Model;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const [choice, setChoice] = useState({
    model,
    calendar: state.calendar,
    query: "",
    date: "",
  });
  const selection =
    choice.model === model && choice.calendar === state.calendar
      ? choice
      : { model, calendar: state.calendar, query: "", date: "" };
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
  const groups = groupBeaReleaseDates(state.calendar);
  const visible = groups.flatMap((group) => {
    if (selection.date && selection.date !== group.key) return [];
    const events = group.events.filter((event) =>
      normalize(event.series).includes(normalize(selection.query)),
    );
    return events.length ? [{ ...group, events }] : [];
  });
  const load = useRef<HTMLButtonElement>(null);
  const restore = useRef(false);
  useLayoutEffect(() => {
    if (!state.busy && restore.current) {
      restore.current = false;
      load.current?.focus();
    }
  }, [state.busy]);
  return (
    <section
      className="trial-panel managed-bls-calendar"
      aria-labelledby="bls-calendar-title"
    >
      <h2 id="bls-calendar-title" tabIndex={-1} ref={headingRef}>
        BLS release calendar
      </h2>
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
      <div className="trial-actions">
        <button
          type="button"
          ref={load}
          disabled={state.busy}
          onClick={() => {
            if (current()) {
              restore.current = true;
              void model.load();
            }
          }}
        >
          {state.calendar ? "Refresh BLS calendar" : "Load BLS calendar"}
        </button>
        {state.busy && (
          <button
            type="button"
            onClick={() => {
              if (current()) model.cancel();
            }}
          >
            Cancel BLS load
          </button>
        )}
      </div>
      {state.message && <p role="status">{state.message}</p>}
      {state.error && (
        <p role="alert">
          {state.error === "invalid_response"
            ? "The BLS response could not be verified."
            : "The BLS calendar could not be loaded."}
        </p>
      )}
      {state.showingPrevious && state.calendar && (
        <p>
          Previous calendar. This attempt has not confirmed a newer schedule.
        </p>
      )}
      {state.calendar && (
        <>
          <p>
            Retrieved{" "}
            <time dateTime={state.calendar.fetchedAt}>
              {eastern.format(new Date(state.calendar.fetchedAt))}
            </time>
            . UTC: {state.calendar.fetchedAt}
          </p>
          <p>
            Loaded window: {state.calendar.window.fromInclusive} (inclusive) to{" "}
            {state.calendar.window.toExclusive} (exclusive). Release times use
            Eastern time, including daylight time.
          </p>
          <div className="trial-fields">
            <label>
              Search BLS releases
              <input
                id="bls-calendar-search"
                type="search"
                value={selection.query}
                maxLength={256}
                onChange={(event) => {
                  if (current())
                    setChoice({
                      ...selection,
                      query: event.currentTarget.value,
                    });
                }}
              />
            </label>
            <label>
              BLS release date
              <select
                id="bls-calendar-date"
                value={selection.date}
                onChange={(event) => {
                  const date = event.currentTarget.value;
                  if (
                    current() &&
                    (date === "" || groups.some((group) => group.key === date))
                  )
                    setChoice({ ...selection, date });
                }}
              >
                <option value="">All loaded dates</option>
                {groups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p role="status">
            {visible.reduce((count, group) => count + group.events.length, 0)}{" "}
            of {state.calendar.events.length} loaded releases.
          </p>
          {state.calendar.events.length === 0 ? (
            <p>
              No scheduled BLS releases in this loaded window. Other economic
              events may exist.
            </p>
          ) : visible.length === 0 ? (
            <p>No releases match this search and date.</p>
          ) : (
            visible.map((group) => (
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
            ))
          )}
        </>
      )}
    </section>
  );
}
