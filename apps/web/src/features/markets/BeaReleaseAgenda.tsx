"use client";

import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  PERSONAL_ECONOMIC_CALENDAR_WINDOW_DAYS,
  type PersonalEconomicCalendarDto,
  type PersonalEconomicCalendarEventDto,
} from "@research-cockpit/contracts";
import type { PersonalWorkspaceApiErrorCode } from "../../lib/personal-workspace-api";
import "./bea-release-agenda.css";

export interface BeaReleaseAgendaProps {
  readonly agenda: PersonalEconomicCalendarDto | null;
  readonly busy: boolean;
  readonly error: PersonalWorkspaceApiErrorCode | null;
  readonly enabled: boolean;
  readonly onLoad: () => void;
}
const date = new Intl.DateTimeFormat("en-US", {
  timeZone: PERSONAL_BEA_CALENDAR_SOURCE.timeZone,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const time = new Intl.DateTimeFormat("en-US", {
  timeZone: PERSONAL_BEA_CALENDAR_SOURCE.timeZone,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});
const timestamp = (instant: string) =>
  `${date.format(new Date(instant))}, ${time.format(new Date(instant))}`;

export function BeaReleaseAgenda({
  agenda,
  busy,
  error,
  enabled,
  onLoad,
}: BeaReleaseAgendaProps) {
  const groups = new Map<string, PersonalEconomicCalendarEventDto[]>();
  for (const event of agenda?.events ?? []) {
    const day = date.format(new Date(event.scheduledAt));
    const group = groups.get(day) ?? [];
    group.push(event);
    groups.set(day, group);
  }
  return (
    <section className="bea-release-agenda" aria-labelledby="bea-agenda-title">
      <header className="bea-agenda-heading">
        <div>
          <h2 id="bea-agenda-title">Economic calendar</h2>
          <p>
            BEA releases · {PERSONAL_ECONOMIC_CALENDAR_WINDOW_DAYS}-day agenda
          </p>
        </div>
        <button type="button" disabled={!enabled || busy} onClick={onLoad}>
          {busy
            ? "Loading agenda…"
            : agenda === null
              ? "Load agenda"
              : "Refresh agenda"}
        </button>
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
              : "The agenda is available when local access is ready."}
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
            {groups.size === 0 ? (
              <p className="bea-agenda-empty">
                No BEA releases are listed in this loaded 30-day window.
              </p>
            ) : (
              <div className="bea-agenda-days">
                {[...groups].map(([day, events]) => (
                  <section
                    className="bea-agenda-day"
                    key={day}
                    aria-label={day}
                  >
                    <h3>{day}</h3>
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
