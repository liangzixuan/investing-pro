"use client";

import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  PERSONAL_ECONOMIC_CALENDAR_WINDOW_DAYS,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";
import type { MouseEventHandler, Ref } from "react";
import {
  formatBeaReleaseDate,
  groupBeaReleaseDates,
} from "./bea-release-dates";
import "./bea-release-agenda.css";

export interface BeaReleaseAgendaProps {
  readonly className?: string;
  readonly agenda: PersonalEconomicCalendarDto | null;
  readonly busy: boolean;
  readonly error: "invalid_response" | "rate_limited" | "unavailable" | null;
  readonly enabled: boolean;
  readonly onLoad: () => void;
  readonly onCancel?: MouseEventHandler<HTMLButtonElement>;
  readonly loadButtonRef?: Ref<HTMLButtonElement>;
  readonly showingPrevious?: boolean;
  readonly message?: string;
  readonly dateView?: {
    readonly selectedDate: string;
    readonly resetNotice: boolean;
    readonly onDateChange: (date: string) => void;
  };
}
const time = new Intl.DateTimeFormat("en-US", {
  timeZone: PERSONAL_BEA_CALENDAR_SOURCE.timeZone,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});
const timestamp = (instant: string) =>
  `${formatBeaReleaseDate(instant)}, ${time.format(new Date(instant))}`;

export function BeaReleaseAgenda({
  className = "",
  agenda,
  busy,
  error,
  enabled,
  onLoad,
  onCancel,
  loadButtonRef,
  showingPrevious = false,
  message = "",
  dateView,
}: BeaReleaseAgendaProps) {
  const groups = groupBeaReleaseDates(agenda);
  const selectedDate = groups.some(
    (group) => group.key === dateView?.selectedDate,
  )
    ? dateView!.selectedDate
    : "";
  const visible = selectedDate
    ? groups.filter((group) => group.key === selectedDate)
    : groups;
  const visibleCount = visible.reduce(
    (count, group) => count + group.events.length,
    0,
  );
  return (
    <section
      className={`bea-release-agenda ${className}`.trim()}
      aria-labelledby="bea-agenda-title"
    >
      <header className="bea-agenda-heading">
        <div>
          <h2 id="bea-agenda-title">Economic calendar</h2>
          <p>
            BEA releases · {PERSONAL_ECONOMIC_CALENDAR_WINDOW_DAYS}-day agenda
          </p>
        </div>
        <div className="bea-agenda-actions">
          <button
            ref={loadButtonRef}
            type="button"
            disabled={!enabled || busy}
            onClick={onLoad}
          >
            {busy
              ? "Loading agenda…"
              : agenda === null
                ? "Load agenda"
                : "Refresh agenda"}
          </button>
          {busy && onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel agenda
            </button>
          )}
        </div>
      </header>
      <p className="bea-agenda-source">
        {PERSONAL_BEA_CALENDAR_SOURCE.name} · All times Eastern.{" "}
        <a
          href={PERSONAL_BEA_CALENDAR_SOURCE.scheduleUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Official BEA schedule
        </a>
      </p>
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      {showingPrevious && agenda !== null && (
        <p className="bea-agenda-note">
          Previous agenda. This attempt has not confirmed a newer schedule.
        </p>
      )}
      {error !== null && (
        <p role="alert" className="bea-agenda-error">
          {error === "invalid_response"
            ? "The BEA schedule response could not be verified."
            : error === "rate_limited"
              ? "The agenda request was rate limited. Try again later."
              : "The BEA schedule could not be loaded. Try again when available."}
          {agenda !== null &&
            " The previous loaded window is still shown below."}
        </p>
      )}
      <div aria-busy={busy}>
        {agenda === null ? (
          <p className="bea-agenda-note">
            {enabled
              ? "Load scheduled BEA releases for the next 30 days. Forecasts and released values are not included."
              : "The agenda is available when your session is ready."}
          </p>
        ) : (
          <>
            <p className="bea-agenda-note">
              Loaded{" "}
              <time dateTime={agenda.fetchedAt}>
                {timestamp(agenda.fetchedAt)}
              </time>
              . This loaded window runs from{" "}
              {timestamp(agenda.window.fromInclusive)} until{" "}
              {timestamp(agenda.window.toExclusive)} (end excluded).
            </p>
            {dateView && (
              <div className="managed-bea-release-date">
                <label htmlFor="managed-bea-release-date">Release date</label>
                <select
                  id="managed-bea-release-date"
                  value={selectedDate}
                  aria-describedby="managed-bea-release-date-help managed-bea-release-date-count"
                  onChange={(event) =>
                    dateView.onDateChange(event.currentTarget.value)
                  }
                >
                  <option value="">All loaded dates</option>
                  {groups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.label} ({group.events.length})
                    </option>
                  ))}
                </select>
                <p id="managed-bea-release-date-help">
                  Filter this loaded window by Eastern release date.
                </p>
                <p
                  id="managed-bea-release-date-count"
                  role="status"
                  aria-live="polite"
                >
                  {visibleCount} of {agenda.events.length} loaded BEA releases.
                  {dateView.resetNotice &&
                    " Agenda response changed; showing All loaded dates."}
                </p>
              </div>
            )}
            {groups.length === 0 ? (
              <p className="bea-agenda-empty">
                No BEA releases are listed in this loaded 30-day window.
              </p>
            ) : (
              <div className="bea-agenda-days">
                {visible.map(({ key, label, events }) => (
                  <section
                    className="bea-agenda-day"
                    key={key}
                    aria-label={label}
                  >
                    <h3>{label}</h3>
                    <ul>
                      {events.map((event) => (
                        <li key={`${event.scheduledAt}:${event.series}`}>
                          <time dateTime={event.scheduledAt}>
                            {time.format(new Date(event.scheduledAt))}
                          </time>
                          <span>{event.series}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
            <p className="bea-agenda-note">
              Scheduled times may change. Refresh explicitly or check the
              official schedule.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
