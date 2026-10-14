"use client";

import {
  PERSONAL_FED_MONETARY_SOURCE,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import type { MouseEventHandler, ReactNode, Ref } from "react";
import type { PersonalWorkspaceApiErrorCode } from "../../lib/personal-workspace-api";
import type { FedAnnouncementView } from "./fed-announcement-view";
import "./fed-announcements.css";

export interface FedMonetaryAnnouncementsProps {
  readonly announcements: PersonalMonetaryAnnouncementsDto | null;
  readonly busy: boolean;
  readonly error: PersonalWorkspaceApiErrorCode | null;
  readonly enabled: boolean;
  readonly onLoad: () => void;
  readonly className?: string;
  readonly onCancel?: MouseEventHandler<HTMLButtonElement>;
  readonly loadButtonRef?: Ref<HTMLButtonElement>;
  readonly headingRef?: Ref<HTMLHeadingElement> | undefined;
  readonly showingPrevious?: boolean;
  readonly message?: string;
  readonly noteAction?: ReactNode;
  readonly refreshSummary?: ReactNode;
  readonly newlyObservedUrls?: readonly string[];
  readonly filterView?: {
    readonly view: FedAnnouncementView;
    readonly resetNotice: boolean;
    readonly onQueryChange: (query: string) => void;
  };
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
  className = "",
  onCancel,
  loadButtonRef,
  headingRef,
  showingPrevious = false,
  message = "",
  noteAction,
  refreshSummary,
  newlyObservedUrls,
  filterView,
}: FedMonetaryAnnouncementsProps) {
  const filters =
    filterView?.view.response === announcements ? filterView : undefined;
  const items = filters?.view.visibleItems ?? announcements?.items ?? [];
  return (
    <section
      className={`fed-announcements ${className}`.trim()}
      aria-labelledby="fed-announcements-title"
    >
      <header className="fed-announcements-heading">
        <div>
          <h2
            id="fed-announcements-title"
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
          >
            Federal Reserve announcements
          </h2>
          <p>Monetary policy · Announcements from this feed.</p>
        </div>
        <div className="fed-announcements-actions">
          <button
            ref={loadButtonRef}
            type="button"
            disabled={!enabled || busy}
            onClick={onLoad}
          >
            {busy
              ? "Loading announcements…"
              : announcements === null
                ? "Load announcements"
                : "Refresh announcements"}
          </button>
          {busy && onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel announcements
            </button>
          )}
        </div>
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
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      {showingPrevious && announcements !== null && (
        <p className="fed-announcements-note">
          Previous announcements. This attempt has not confirmed a newer feed.
        </p>
      )}
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
              {filters ? "Loaded" : "Showing"} {announcements.items.length} of{" "}
              {announcements.availableItemCount} announcements from this feed.
              Loaded{" "}
              <time dateTime={announcements.fetchedAt}>
                {timestamp.format(new Date(announcements.fetchedAt))}
              </time>
              .
            </p>
            {refreshSummary}
            {filters && (
              <div className="managed-fed-title-filter">
                <label htmlFor="managed-fed-title-search">
                  Search announcement titles
                </label>
                <div className="managed-fed-title-search-controls">
                  <input
                    id="managed-fed-title-search"
                    type="search"
                    value={filters.view.query}
                    aria-describedby="managed-fed-title-search-help managed-fed-title-count"
                    onChange={(event) =>
                      filters.onQueryChange(event.currentTarget.value)
                    }
                  />
                  <button
                    type="button"
                    className="trial-secondary"
                    onClick={() => filters.onQueryChange("")}
                  >
                    Clear title search
                  </button>
                </div>
                <p id="managed-fed-title-search-help">
                  Search full titles in this loaded feed.
                </p>
                <p
                  id="managed-fed-title-count"
                  role="status"
                  aria-live="polite"
                >
                  {items.length} of {announcements.items.length} loaded
                  announcements.
                  {filters.resetNotice &&
                    " Feed response changed; showing all loaded announcements."}
                </p>
              </div>
            )}
            {announcements.items.length === 0 ? (
              <p className="fed-announcements-note">
                No announcements were listed in this loaded feed.
              </p>
            ) : items.length === 0 ? (
              <p className="fed-announcements-note">
                No loaded announcements match this title search. Change or clear
                the search.
              </p>
            ) : (
              <ul className="fed-announcements-list">
                {items.map((item) => (
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
                    {newlyObservedUrls?.includes(item.url) && (
                      <p className="fed-announcements-new">
                        Newly observed in this refresh
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {noteAction}
          </>
        )}
      </div>
    </section>
  );
}
