import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import type { ManagedBlsCalendar } from "./managed-bls-calendar";
import type { ManagedBeaReleaseAgenda } from "./managed-bea-release-agenda";
import type { ManagedFedAnnouncements } from "./managed-fed-announcements";
import {
  useManagedMarketsJump,
  type ManagedMarketsNavigationProps,
} from "./ManagedMarketsNavigation";
import {
  projectMarketsDayView,
  type MarketsDayEntry,
  type MarketsDaySource,
} from "./markets-day-view";
import "./managed-markets-day-view.css";

const easternTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});
function SourceTime({ instant }: { readonly instant: string }) {
  return (
    <>
      <time dateTime={instant}>{easternTime.format(new Date(instant))}</time>
      <span className="managed-day-utc">UTC: {instant}</span>
    </>
  );
}
function Entries({
  entries,
}: {
  readonly entries: readonly MarketsDayEntry[];
}) {
  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry.key} data-day-source={entry.source}>
          <p className="managed-day-kind">
            {entry.source === "bea"
              ? "Scheduled · BEA"
              : entry.source === "bls"
                ? "Scheduled · BLS"
                : "Published · Federal Reserve"}
          </p>
          <a href={entry.url} target="_blank" rel="noopener noreferrer">
            {entry.title}
          </a>
          <p>
            {entry.instant ? (
              <SourceTime instant={entry.instant} />
            ) : (
              "Publication time unknown. This item is not assigned to a date."
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ManagedMarketsDayView({
  blsCalendar: blsModel,
  agenda: agendaModel,
  announcements: feedModel,
  navigation,
  headingRef,
}: {
  readonly blsCalendar: ManagedBlsCalendar;
  readonly agenda: ManagedBeaReleaseAgenda;
  readonly announcements: ManagedFedAnnouncements;
  readonly navigation: ManagedMarketsNavigationProps;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}) {
  const agenda = useSyncExternalStore(
    agendaModel.subscribe,
    agendaModel.getSnapshot,
    agendaModel.getSnapshot,
  );
  const feed = useSyncExternalStore(
    feedModel.subscribe,
    feedModel.getSnapshot,
    feedModel.getSnapshot,
  );
  const bls = useSyncExternalStore(
    blsModel.subscribe,
    blsModel.getSnapshot,
    blsModel.getSnapshot,
  );
  const jump = useManagedMarketsJump(navigation);
  const [choice, setChoice] = useState<{
    bls: typeof bls.calendar;
    agenda: typeof agenda.agenda;
    feed: typeof feed.announcements;
    date: string;
    source: MarketsDaySource;
    reset: boolean;
  }>(() => ({
    bls: bls.calendar,
    agenda: agenda.agenda,
    feed: feed.announcements,
    date: "",
    source: "all",
    reset: false,
  }));
  const selection: typeof choice =
    choice.bls === bls.calendar &&
    choice.agenda === agenda.agenda &&
    choice.feed === feed.announcements
      ? choice
      : {
          bls: bls.calendar,
          agenda: agenda.agenda,
          feed: feed.announcements,
          date: "",
          source: "all",
          reset:
            choice.bls !== null ||
            choice.agenda !== null ||
            choice.feed !== null,
        };
  if (selection !== choice) setChoice(selection);
  const committedSelection = useRef<typeof selection | null>(null);
  useLayoutEffect(() => {
    committedSelection.current = selection;
    return () => {
      committedSelection.current = null;
    };
  }, [selection]);
  const view = projectMarketsDayView(
    bls.calendar,
    agenda.agenda,
    feed.announcements,
    selection.date,
    selection.source,
  );
  const current = () =>
    committedSelection.current === selection &&
    navigation.isCurrent() &&
    blsModel.getSnapshot().calendar === bls.calendar &&
    agendaModel.getSnapshot().agenda === agenda.agenda &&
    feedModel.getSnapshot().announcements === feed.announcements;
  return (
    <section
      className="managed-markets-day-view"
      aria-labelledby="managed-markets-day-heading"
    >
      <header>
        <h2 id="managed-markets-day-heading" tabIndex={-1} ref={headingRef}>
          Markets day view
        </h2>
        <p>
          Loaded BEA and BLS schedules and Federal Reserve announcements,
          grouped by Eastern date. Scheduled releases do not confirm publication
          or released values.
        </p>
      </header>
      <div className="managed-day-sources">
        <section aria-label="BLS source status">
          <h3>BLS schedule</h3>
          <a
            href="#bls-calendar-title"
            onClick={(event) => {
              event.preventDefault();
              jump("bls");
            }}
          >
            Inspect BLS calendar
          </a>
          <p>
            {bls.calendar
              ? `${bls.calendar.events.length} scheduled releases in this loaded 30-day window.`
              : "BLS schedule not loaded. Load it explicitly in BLS release calendar."}
          </p>
          {bls.calendar && (
            <>
              <p>
                Retrieved <SourceTime instant={bls.calendar.fetchedAt} />
              </p>
              <p>
                Window: {bls.calendar.window.fromInclusive} (inclusive) to{" "}
                {bls.calendar.window.toExclusive} (exclusive).
              </p>
              {bls.calendar.events.length === 0 && (
                <p>No scheduled BLS releases in this loaded window.</p>
              )}
            </>
          )}
          {bls.message && <p role="status">{bls.message}</p>}
          {bls.showingPrevious && bls.calendar && (
            <p className="managed-day-warning">
              Previous BLS schedule. This attempt has not confirmed a newer
              calendar.
            </p>
          )}
          {bls.error && (
            <p role="alert">
              {bls.error === "invalid_response"
                ? "The BLS response could not be verified."
                : "The BLS schedule could not be loaded."}
            </p>
          )}
        </section>
        <section aria-label="BEA source status">
          <h3>BEA schedule</h3>
          <a
            href="#bea-agenda-title"
            onClick={(event) => {
              event.preventDefault();
              jump("calendar");
            }}
          >
            Inspect Economic calendar
          </a>
          <p>
            {agenda.agenda
              ? `${agenda.agenda.events.length} scheduled releases in this loaded 30-day window.`
              : "BEA schedule not loaded. Load it explicitly in Economic calendar."}
          </p>
          {agenda.agenda && (
            <>
              <p>
                Retrieved <SourceTime instant={agenda.agenda.fetchedAt} />
              </p>
              <p>
                Window:{" "}
                <time dateTime={agenda.agenda.window.fromInclusive}>
                  {agenda.agenda.window.fromInclusive}
                </time>{" "}
                (inclusive) to{" "}
                <time dateTime={agenda.agenda.window.toExclusive}>
                  {agenda.agenda.window.toExclusive}
                </time>{" "}
                (exclusive).
              </p>
              {agenda.agenda.events.length === 0 && (
                <p>No scheduled releases in this loaded window.</p>
              )}
            </>
          )}
          {agenda.message && <p role="status">{agenda.message}</p>}
          {agenda.showingPrevious && agenda.agenda && (
            <p className="managed-day-warning">
              Previous schedule. This attempt has not confirmed a newer agenda.
            </p>
          )}
          {agenda.error && (
            <p role="alert">
              {agenda.error === "invalid_response"
                ? "The BEA response could not be verified."
                : "The BEA schedule could not be loaded."}
            </p>
          )}
        </section>
        <section aria-label="Federal Reserve source status">
          <h3>Federal Reserve announcements</h3>
          <a
            href="#fed-announcements-title"
            onClick={(event) => {
              event.preventDefault();
              jump("announcements");
            }}
          >
            Inspect Fed announcements
          </a>
          <p>
            {feed.announcements
              ? `${feed.announcements.items.length} of ${feed.announcements.availableItemCount} announcements from this loaded feed.`
              : "Fed announcements not loaded. Load them explicitly in Fed announcements."}
          </p>
          {feed.announcements && (
            <>
              <p>
                Retrieved <SourceTime instant={feed.announcements.fetchedAt} />
              </p>
              {feed.announcements.items.length === 0 && (
                <p>No announcements in this loaded feed.</p>
              )}
            </>
          )}
          {feed.message && <p role="status">{feed.message}</p>}
          {feed.showingPrevious && feed.announcements && (
            <p className="managed-day-warning">
              Previous announcements. This attempt has not confirmed a newer
              feed.
            </p>
          )}
          {feed.error && (
            <p role="alert">
              {feed.error === "invalid_response"
                ? "The Fed response could not be verified."
                : "Fed announcements could not be loaded."}
            </p>
          )}
        </section>
      </div>
      {(bls.calendar || agenda.agenda || feed.announcements) && (
        <>
          <div className="managed-day-filters">
            <label htmlFor="managed-day-date">
              Eastern date
              <select
                id="managed-day-date"
                value={view.selectedDate}
                onChange={(event) => {
                  const date = event.currentTarget.value;
                  if (
                    current() &&
                    (date === "" ||
                      view.groups.some((group) => group.date === date))
                  )
                    setChoice({ ...selection, date, reset: false });
                }}
              >
                <option value="">All loaded dates</option>
                {view.groups.map((group) => (
                  <option key={group.date} value={group.date}>
                    {group.label} · {group.entries.length}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="managed-day-source">
              Source
              <select
                id="managed-day-source"
                value={selection.source}
                onChange={(event) => {
                  const source = event.currentTarget.value;
                  if (
                    current() &&
                    (source === "all" ||
                      source === "bea" ||
                      source === "bls" ||
                      source === "fed")
                  )
                    setChoice({ ...selection, source, reset: false });
                }}
              >
                <option value="all">All sources</option>
                <option value="bls">BLS schedule</option>
                <option value="bea">BEA schedule</option>
                <option value="fed">Federal Reserve announcements</option>
              </select>
            </label>
          </div>
          <p role="status">
            {view.visibleDatedCount} dated items shown · {view.unknown.length}{" "}
            unknown-time items shown · {view.loadedCount} total loaded items.
            {selection.reset &&
              " Accepted source data changed; showing all sources and all loaded dates."}
          </p>
          <p>
            Unknown publication times stay separate even when a date is
            selected. Coverage is limited to these loaded sources; no company
            relevance or alert is inferred.
          </p>
          {view.loadedCount > 0 && view.visibleDatedCount === 0 && (
            <p>No dated items match this date and source selection.</p>
          )}
          {view.visibleGroups.map((group) => (
            <section aria-label={group.label} key={group.date}>
              <h3>
                <time dateTime={group.date}>{group.label}</time>
              </h3>
              <Entries entries={group.entries} />
            </section>
          ))}
          {view.unknown.length > 0 && (
            <section aria-label="Unknown publication time">
              <h3>Unknown publication time</h3>
              <Entries entries={view.unknown} />
            </section>
          )}
        </>
      )}
    </section>
  );
}
