"use client";

import {
  isPersonalFilingMonitorTimeZone,
  type PersonalFilingMonitorDto,
  type PersonalFilingMonitorPolicyDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";
import {
  acknowledgePersonalFilingMonitor,
  configurePersonalFilingMonitor,
  fetchPersonalFilingMonitor,
  pausePersonalFilingMonitor,
  resetPersonalFilingMonitor,
  validatePersonalFilingMonitorBinding,
} from "../../lib/personal-filing-monitor-api";
import {
  PersonalWorkspaceApiError,
  type PersonalWatchlistMembership,
} from "../../lib/personal-workspace-api";

export interface PersonalFilingMonitorProps {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly watchlistVersion: number;
  readonly memberships: readonly PersonalWatchlistMembership[];
  readonly enabled: boolean;
  readonly onSessionUnavailable: () => void;
}
type Draft = Pick<
  PersonalFilingMonitorPolicyDto,
  | "listingIds"
  | "dailyTime"
  | "timeZone"
  | "quietHours"
  | "desktopNotifications"
>;
type Action = "load" | "configure" | "pause" | "reset" | "acknowledge";
const initialMessage =
  "Load monitor settings and inbox when ready. Loading does not enable checks.";
const deliveryLabels = {
  disabled: "Desktop notices off",
  pending: "Waiting for desktop delivery",
  reserved: "Desktop attempt reserved; outcome pending",
  not_submitted: "Desktop notice not submitted",
  submission_unconfirmed: "Desktop submission returned; display unconfirmed",
  observed_shown: "Windows reported the notice shown",
  delivery_uncertain: "Desktop delivery uncertain; no automatic retry",
} as const;

export function PersonalFilingMonitor(props: PersonalFilingMonitorProps) {
  const {
    catalogSnapshotSha256,
    watchlistVersion,
    memberships,
    enabled,
    onSessionUnavailable,
  } = props;
  const key = JSON.stringify([
    catalogSnapshotSha256,
    watchlistVersion,
    memberships,
    enabled,
  ]);
  const context = useRef({ key, version: 0 });
  if (context.current.key !== key)
    context.current = { key, version: context.current.version + 1 };
  const version = context.current.version;
  const [state, setState] = useState<{
    version: number;
    response: PersonalFilingMonitorDto | null;
    draft: Draft;
    action: Action | null;
    message: string;
    error: boolean;
  }>({
    version,
    response: null,
    draft: defaultDraft(memberships),
    action: null,
    message: initialMessage,
    error: false,
  });
  const [query, setQuery] = useState("");
  const [selectionPage, setSelectionPage] = useState(0);
  const [inboxPage, setInboxPage] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const mounted = useRef(false);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const sessionCallback = useRef(onSessionUnavailable);
  sessionCallback.current = onSessionUnavailable;
  const loadButton = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<{
    version: number;
    epoch: number;
    origin: HTMLButtonElement;
  } | null>(null);

  useEffect(() => {
    mounted.current = true;
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    pendingFocus.current = null;
    setState({
      version,
      response: null,
      draft: defaultDraft(memberships),
      action: null,
      message: initialMessage,
      error: false,
    });
    setQuery("");
    setSelectionPage(0);
    setInboxPage(0);
    setConfirmReset(false);
    return () => {
      mounted.current = false;
      epoch.current += 1;
      controller.current?.abort();
      controller.current = null;
      pendingFocus.current = null;
    };
  }, [version]);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || state.action !== null) return;
    pendingFocus.current = null;
    const button = loadButton.current;
    if (
      mounted.current &&
      enabled &&
      pending.version === context.current.version &&
      pending.epoch === epoch.current &&
      button?.isConnected &&
      !button.closest("[hidden]") &&
      (document.activeElement === pending.origin ||
        document.activeElement === document.body)
    )
      button.focus();
  }, [state, enabled]);

  const currentContext = enabled && state.version === version;
  const current = currentContext ? state.response : null;
  const running = currentContext && state.action !== null;
  const draft = state.draft;
  const renderEpoch = epoch.current;
  const validRender = () =>
    mounted.current &&
    enabled &&
    state.version === version &&
    context.current.version === version &&
    epoch.current === renderEpoch;
  const binding = { catalogSnapshotSha256, watchlistVersion, memberships };
  const selectionValid =
    draft.listingIds.length > 0 &&
    draft.listingIds.length <= 20 &&
    draft.listingIds.every((id) =>
      memberships.some((item) => item.listingId === id),
    );
  const settingsValid =
    selectionValid &&
    /^([01]\d|2[0-3]):[0-5]\d$/u.test(draft.dailyTime) &&
    validZone(draft.timeZone);

  function edit(next: Partial<Draft>) {
    if (!validRender() || !current || controller.current !== null) return;
    setState((previous) => ({
      ...previous,
      draft: { ...previous.draft, ...next },
    }));
  }
  async function operate(action: Action, eventIds: readonly string[] = []) {
    if (
      !validRender() ||
      controller.current !== null ||
      (action !== "load" && !current)
    )
      return;
    if (action === "configure" && !settingsValid) return;
    if (
      action === "reset" &&
      (!confirmReset || current?.policy?.enabled !== false)
    )
      return;
    if (action === "pause" && current?.policy?.enabled !== true) return;
    if (
      action === "acknowledge" &&
      (!eventIds.length ||
        !eventIds.every((id) =>
          current?.inbox.some(
            (entry) => entry.id === id && entry.readAt === null,
          ),
        ))
    )
      return;
    const operation = ++epoch.current;
    const abort = new AbortController();
    controller.current = abort;
    pendingFocus.current = null;
    const expectedVersion = current?.version ?? 0;
    setState((previous) => ({
      ...previous,
      response: null,
      action,
      message:
        action === "load"
          ? "Loading monitor settings and inbox…"
          : "Saving monitor change…",
      error: false,
    }));
    const valid = () =>
      mounted.current &&
      context.current.version === version &&
      epoch.current === operation &&
      !abort.signal.aborted;
    try {
      const command = { schemaVersion: "1.0.0" as const, expectedVersion };
      const response =
        action === "load"
          ? await fetchPersonalFilingMonitor(abort.signal)
          : action === "configure"
            ? await configurePersonalFilingMonitor(
                {
                  ...command,
                  policy: {
                    ...draft,
                    enabled: true,
                    catalogSnapshotSha256,
                    watchlistVersion,
                  },
                },
                abort.signal,
              )
            : action === "pause"
              ? await pausePersonalFilingMonitor(command, abort.signal)
              : action === "reset"
                ? await resetPersonalFilingMonitor(command, abort.signal)
                : await acknowledgePersonalFilingMonitor(
                    { ...command, eventIds },
                    abort.signal,
                  );
      if (!valid()) return;
      validatePersonalFilingMonitorBinding(response, binding);
      setState({
        version,
        response,
        draft: response.policy
          ? { ...response.policy }
          : defaultDraft(memberships),
        action: null,
        message:
          action === "load"
            ? "Monitor loaded. Reload explicitly for the latest worker and delivery status."
            : action === "reset"
              ? "Monitor history reset. The monitor remains paused; the next enable starts a new baseline."
              : "Monitor change saved.",
        error: false,
      });
      setConfirmReset(false);
      setInboxPage(0);
    } catch (error) {
      if (!valid()) return;
      const code =
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
      setState((previous) => ({
        ...previous,
        response: null,
        action: null,
        error: true,
        message: errorMessage(code, action !== "load"),
      }));
      if (code === "session_unavailable") sessionCallback.current();
    } finally {
      if (valid()) controller.current = null;
    }
  }
  function cancel(origin: HTMLButtonElement) {
    if (!validRender() || !running || !controller.current) return;
    epoch.current += 1;
    controller.current.abort();
    controller.current = null;
    pendingFocus.current =
      document.activeElement === origin
        ? { version, epoch: epoch.current, origin }
        : null;
    setState((previous) => ({
      ...previous,
      response: null,
      action: null,
      message:
        previous.action === "load"
          ? "Load cancelled. Load again when ready."
          : "Stopped waiting for the save. It may already have committed; load again to confirm.",
      error: false,
    }));
  }
  const matching = memberships.filter((item) =>
    `${item.symbol} ${item.issuerName}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const page = Math.min(
    selectionPage,
    Math.max(0, Math.ceil(matching.length / 50) - 1),
  );
  const inbox = current?.inbox ?? [];
  const inboxIndex = Math.min(
    inboxPage,
    Math.max(0, Math.ceil(inbox.length / 20) - 1),
  );
  const unread = inbox.filter((entry) => entry.readAt === null);

  return (
    <section
      className="watchlist-panel"
      aria-labelledby="filing-monitor-title"
      aria-busy={running}
    >
      <div className="discovery-section-heading">
        <div>
          <p className="eyebrow">Saved watchlist follow-up</p>
          <h2 id="filing-monitor-title">Daily SEC filing monitor</h2>
        </div>
      </div>
      <p className="discovery-copy">
        Opt in to daily checks of up to 20 saved listings. Checks continue while
        the local API is running, even after you close the browser or sign out.
        Stopping the API stops checks; reopening it performs one overdue check.
      </p>
      <p className="discovery-copy">
        The first complete observation establishes a baseline without notices
        for old filings. Later checks cover a rolling 30-day SEC filing-date
        window. This is not complete filing history.
      </p>
      {!enabled && (
        <p className="discovery-warning">
          Revalidate the session and save the current watchlist before using the
          monitor.
        </p>
      )}
      <div className="personal-stock-screener-run-actions">
        <button
          ref={loadButton}
          type="button"
          className="secondary-action compact-action"
          disabled={!enabled || running}
          onClick={() => {
            void operate("load");
          }}
        >
          {current ? "Reload monitor" : "Load monitor"}
        </button>
        {running && (
          <button
            type="button"
            className="text-button"
            onClick={(event) => cancel(event.currentTarget)}
          >
            Cancel waiting
          </button>
        )}
      </div>
      <p
        role={state.error && currentContext ? "alert" : "status"}
        aria-live="polite"
        className={
          state.error && currentContext ? "discovery-warning" : "discovery-copy"
        }
      >
        {currentContext ? state.message : initialMessage}
      </p>
      {current && (
        <>
          <p className="discovery-copy">
            {current.policy?.enabled ? "Enabled" : "Paused / off"} ·{" "}
            {current.running ? "Check in progress" : "No check in progress"} ·{" "}
            {current.unreadCount} unread inbox entries
          </p>
          <p className="discovery-copy">
            Next check (UTC): {current.nextCheckAt ?? "Not scheduled"}. Last
            check (UTC): {current.lastCheckAt ?? "Not yet checked"}. Outcome:{" "}
            {outcomeLabel(current.lastOutcome)}.
          </p>
          {current.bindingStatus === "needs_rebind" && (
            <p className="discovery-warning">
              The saved monitor no longer matches the current catalog or
              watchlist. Review the selected listings and explicitly rebind.
              Changing identities while history is retained may require pausing
              and resetting history first.
            </p>
          )}
          {current.coverageGap && (
            <p className="discovery-warning">
              Coverage gap recorded. An incomplete check, retention overflow or
              a gap longer than 30 days may leave filings unobserved. A later
              successful check does not erase this warning.
            </p>
          )}
          <fieldset className="watchlist-filings-selection" disabled={running}>
            <legend>Monitor settings</legend>
            <label className="watchlist-filings-filter">
              <span>Find saved listings</span>
              <input
                aria-label="Find monitor listings"
                value={query}
                onChange={(event) => {
                  if (validRender()) {
                    setQuery(event.target.value);
                    setSelectionPage(0);
                  }
                }}
              />
            </label>
            <p className="discovery-copy">
              {draft.listingIds.length} of 20 slots selected. Only current saved
              listings can be enabled.
            </p>
            {draft.listingIds.some(
              (id) => !memberships.some((item) => item.listingId === id),
            ) && (
              <p className="discovery-warning">
                Some previously selected listings are no longer saved. Clear the
                selection and choose current listings before rebinding.
              </p>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => edit({ listingIds: [] })}
            >
              Clear monitor selection
            </button>
            <div className="watchlist-filings-choices">
              {matching.slice(page * 50, (page + 1) * 50).map((item) => (
                <label key={item.listingId}>
                  <input
                    type="checkbox"
                    aria-label={`Monitor ${item.symbol} (${item.listingId})`}
                    checked={draft.listingIds.includes(item.listingId)}
                    disabled={
                      !draft.listingIds.includes(item.listingId) &&
                      draft.listingIds.length >= 20
                    }
                    onChange={(event) => {
                      if (event.target.checked) {
                        if (
                          draft.listingIds.length < 20 &&
                          !draft.listingIds.includes(item.listingId)
                        )
                          edit({
                            listingIds: [...draft.listingIds, item.listingId],
                          });
                      } else
                        edit({
                          listingIds: draft.listingIds.filter(
                            (id) => id !== item.listingId,
                          ),
                        });
                    }}
                  />
                  {item.symbol} · {item.issuerName}
                </label>
              ))}
            </div>
            {matching.length > 50 && (
              <div className="personal-stock-screener-pagination">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => {
                    if (validRender()) setSelectionPage(page - 1);
                  }}
                >
                  Previous monitor listings
                </button>
                <span>
                  Page {page + 1} of {Math.ceil(matching.length / 50)}
                </span>
                <button
                  type="button"
                  disabled={(page + 1) * 50 >= matching.length}
                  onClick={() => {
                    if (validRender()) setSelectionPage(page + 1);
                  }}
                >
                  Next monitor listings
                </button>
              </div>
            )}
            <div className="watchlist-filings-controls">
              <label>
                Daily local time
                <input
                  aria-label="Monitor daily local time"
                  type="time"
                  value={draft.dailyTime}
                  onChange={(event) => edit({ dailyTime: event.target.value })}
                />
              </label>
              <label>
                IANA time zone
                <input
                  aria-label="Monitor IANA time zone"
                  value={draft.timeZone}
                  placeholder="America/Chicago"
                  onChange={(event) => edit({ timeZone: event.target.value })}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  aria-label="Monitor quiet hours"
                  checked={draft.quietHours}
                  onChange={(event) =>
                    edit({ quietHours: event.target.checked })
                  }
                />
                Delay desktop notices from 22:00 to 08:00 in this zone; checks
                and inbox updates continue.
              </label>
              <label>
                <input
                  type="checkbox"
                  aria-label="Allow generic desktop notices"
                  checked={draft.desktopNotifications}
                  onChange={(event) =>
                    edit({ desktopNotifications: event.target.checked })
                  }
                />
                Allow generic Windows desktop notices. Notice text contains no
                company, filing or account details.
              </label>
            </div>
            {!validZone(draft.timeZone) && (
              <p className="discovery-warning">
                Enter a valid IANA time zone, such as America/Chicago.
              </p>
            )}
            <p className="discovery-copy">
              A skipped daylight-saving time uses the first available minute
              after it. A repeated local time runs once. Windows may suppress a
              notice; delivery callbacks do not establish that you read it.
            </p>
            <div className="personal-stock-screener-run-actions">
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={!settingsValid}
                onClick={() => {
                  void operate("configure");
                }}
              >
                {current.bindingStatus === "needs_rebind"
                  ? "Rebind and enable monitor"
                  : current.policy?.enabled
                    ? "Save monitor settings"
                    : "Enable daily monitor"}
              </button>
              {current.policy?.enabled && (
                <button
                  type="button"
                  className="secondary-action compact-action"
                  onClick={() => {
                    void operate("pause");
                  }}
                >
                  Pause monitor
                </button>
              )}
            </div>
          </fieldset>
          {current.policy?.enabled === false && (
            <details>
              <summary>Reset monitor history</summary>
              <p className="discovery-warning">
                Reset discards this monitor's seen filings, inbox and delivery
                history. It stays paused. Enabling afterward starts a new
                baseline without old-filing notices.
              </p>
              <label>
                <input
                  aria-label="Confirm monitor history reset"
                  type="checkbox"
                  checked={confirmReset}
                  onChange={(event) => {
                    if (validRender()) setConfirmReset(event.target.checked);
                  }}
                />
                I want to discard monitor history.
              </label>
              <button
                type="button"
                disabled={!confirmReset}
                onClick={() => {
                  void operate("reset");
                }}
              >
                Reset monitor history
              </button>
            </details>
          )}
          <details>
            <summary>Issuer coverage ({current.issuers.length})</summary>
            <ul>
              {current.issuers.map((issuer) => (
                <li key={issuer.cik}>
                  {issuer.listings.map((item) => item.symbol).join(", ")} · CIK{" "}
                  {issuer.cik} · {coverageLabel(issuer.status)} · Last complete
                  observation (UTC): {issuer.lastCompleteAt ?? "None"}
                  {issuer.coverageGap ? " · Coverage gap retained" : ""}
                </li>
              ))}
            </ul>
          </details>
          <h3>Filing inbox</h3>
          <p className="discovery-copy">
            Observed times below are UTC. SEC filing and report dates are
            calendar dates. Acknowledgement records your explicit action;
            desktop display and clicks never acknowledge entries.
          </p>
          {unread.length > 0 && (
            <button
              type="button"
              onClick={() => {
                void operate(
                  "acknowledge",
                  unread.map((entry) => entry.id),
                );
              }}
            >
              Acknowledge all {unread.length} unread entries
            </button>
          )}
          {inbox.length === 0 ? (
            <p className="discovery-empty-state">
              No retained filing events. New events appear after an issuer's
              first complete baseline.
            </p>
          ) : (
            <ul>
              {inbox
                .slice(inboxIndex * 20, (inboxIndex + 1) * 20)
                .map((entry) => (
                  <li key={entry.id}>
                    <p>
                      <strong>
                        {entry.listings.map((item) => item.symbol).join(", ")} ·{" "}
                        {entry.filing.form}
                      </strong>{" "}
                      ·{" "}
                      <a
                        href={entry.filing.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        SEC filing {entry.filing.accessionNumber}
                      </a>
                    </p>
                    <p>
                      SEC filed: {entry.filing.filingDate} · Report date:{" "}
                      {entry.filing.reportDate ?? "Not supplied"} · First
                      observed (UTC): {entry.firstSeenAt}
                    </p>
                    <p>
                      {deliveryLabels[entry.delivery.status]}
                      {entry.delivery.shownObserved &&
                      entry.delivery.status !== "observed_shown"
                        ? " · Windows also reported a shown callback; final delivery remains uncertain"
                        : ""}{" "}
                      · Attempt (UTC): {entry.delivery.attemptedAt ?? "None"} ·
                      Completion (UTC): {entry.delivery.completedAt ?? "None"} ·
                      Read state:{" "}
                      {entry.readAt === null
                        ? "Unacknowledged"
                        : `Acknowledged (UTC) ${entry.readAt}`}
                    </p>
                    {entry.readAt === null && (
                      <button
                        type="button"
                        onClick={() => {
                          void operate("acknowledge", [entry.id]);
                        }}
                      >
                        Acknowledge {entry.filing.accessionNumber}
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          )}
          {inbox.length > 20 && (
            <div className="personal-stock-screener-pagination">
              <button
                type="button"
                disabled={inboxIndex === 0}
                onClick={() => {
                  if (validRender()) setInboxPage(inboxIndex - 1);
                }}
              >
                Previous inbox entries
              </button>
              <span>
                Page {inboxIndex + 1} of {Math.ceil(inbox.length / 20)}
              </span>
              <button
                type="button"
                disabled={(inboxIndex + 1) * 20 >= inbox.length}
                onClick={() => {
                  if (validRender()) setInboxPage(inboxIndex + 1);
                }}
              >
                Next inbox entries
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function defaultDraft(
  memberships: readonly PersonalWatchlistMembership[],
): Draft {
  let timeZone = "UTC";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* UTC remains an explicit editable default. */
  }
  return {
    listingIds:
      memberships.length <= 20 ? memberships.map((item) => item.listingId) : [],
    dailyTime: "09:00",
    timeZone,
    quietHours: true,
    desktopNotifications: false,
  };
}
function validZone(zone: string): boolean {
  return isPersonalFilingMonitorTimeZone(zone);
}
function outcomeLabel(
  outcome: PersonalFilingMonitorDto["lastOutcome"],
): string {
  return outcome === null
    ? "None yet"
    : (
        {
          seeded: "Baseline established",
          checked: "Check completed",
          partial: "Partial coverage",
          provider_busy: "SEC provider busy",
          provider_unavailable: "SEC provider unavailable",
          needs_rebind: "Saved identities need rebinding",
        } as const
      )[outcome];
}
function coverageLabel(
  status: PersonalFilingMonitorDto["issuers"][number]["status"],
): string {
  return (
    {
      unseeded: "Awaiting first complete baseline",
      complete: "Complete observation",
      unavailable: "Source unavailable",
      truncated: "Response truncated; incomplete",
      overflow: "Retention limit reached; observation held",
    } as const
  )[status];
}
function errorMessage(code: string, mutation: boolean): string {
  if (code === "session_unavailable")
    return "Session unavailable. Revalidate the owner session before loading the monitor again.";
  if (code === "conflict")
    return "The monitor or saved identities changed. Reload before retrying. To change identities with retained history, pause and explicitly reset history first.";
  if (code === "invalid_request")
    return "The monitor settings were not accepted. Check the selection, local time and time zone, then reload.";
  return mutation
    ? "Could not confirm the monitor change. It may already have committed; reload before retrying."
    : "Could not load a valid monitor snapshot. Load again when ready.";
}
