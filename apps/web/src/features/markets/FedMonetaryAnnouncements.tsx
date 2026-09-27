"use client";

import {
  PERSONAL_FED_MONETARY_SOURCE,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import type { PersonalWorkspaceApiErrorCode } from "../../lib/personal-workspace-api";
import "./fed-announcements.css";

export interface FedMonetaryAnnouncementsProps {
  readonly announcements: PersonalMonetaryAnnouncementsDto | null;
  readonly busy: boolean;
  readonly error: PersonalWorkspaceApiErrorCode | null;
  readonly enabled: boolean;
  readonly onLoad: () => void;
}

const timestamp = new Intl.DateTimeFormat("en-US", {
  timeZone: PERSONAL_FED_MONETARY_SOURCE.timeZone,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export function FedMonetaryAnnouncements({
  announcements,
  busy,
  error,
  enabled,
  onLoad,
}: FedMonetaryAnnouncementsProps) {
  return (
    <section
      className="fed-announcements"
      aria-labelledby="fed-announcements-title"
    >
      <header className="fed-announcements-heading">
        <div>
          <h2 id="fed-announcements-title">Federal Reserve announcements</h2>
          <p>Monetary policy · Announcements from this feed.</p>
        </div>
        <button type="button" disabled={!enabled || busy} onClick={onLoad}>
          {busy
            ? "Loading announcements…"
            : announcements === null
              ? "Load announcements"
              : "Refresh announcements"}
        </button>
      </header>
      <p className="fed-announcements-source">
        {PERSONAL_FED_MONETARY_SOURCE.name} · All times Eastern.{" "}
        <a
          href={PERSONAL_FED_MONETARY_SOURCE.directoryUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Official Federal Reserve feeds
        </a>
      </p>
      {error !== null && (
        <p role="alert" className="fed-announcements-error">
          {error === "invalid_response"
            ? "The announcements response could not be verified."
            : error === "rate_limited"
              ? "The announcements request was rate limited. Try again later."
              : "The announcements could not be loaded. Try again when available."}
          {announcements !== null &&
            " The previously loaded announcements are still shown below."}
        </p>
      )}
      <div aria-busy={busy}>
        {announcements === null ? (
          <p className="fed-announcements-note">
            {enabled
              ? "Load up to ten announcements from the Federal Reserve monetary-policy feed."
              : "Announcements are available when local access is ready."}
          </p>
        ) : (
          <>
            <p className="fed-announcements-note">
              Showing {announcements.items.length} of{" "}
              {announcements.availableItemCount} announcements from this feed.
              Loaded{" "}
              <time dateTime={announcements.fetchedAt}>
                {timestamp.format(new Date(announcements.fetchedAt))}
              </time>
              .
            </p>
            {announcements.items.length === 0 ? (
              <p className="fed-announcements-note">
                No announcements were listed in this loaded feed.
              </p>
            ) : (
              <ul className="fed-announcements-list">
                {announcements.items.map((item) => (
                  <li key={item.url}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.title}
                    </a>
                    <p>
                      {item.publishedAt === null ? (
                        "Unknown publication time"
                      ) : (
                        <>
                          Published{" "}
                          <time dateTime={item.publishedAt}>
                            {timestamp.format(new Date(item.publishedAt))}
                          </time>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
