import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  ManagedPortfolioPayload,
  PersonalPortfolioIdentity,
} from "@research-cockpit/contracts";
import { PersonalPortfolioLedgerEditor } from "../features/research/PersonalPortfolioLedgerEditor";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import type { PortfolioDraft } from "./managed-portfolio";
import { listingIdentity, type ManagedWorkspace } from "./managed-workspace";
import "./managed-portfolio.css";

const usd = (value: string | null) =>
  value === null ? "Unknown" : `USD ${value}`;
const reviewLabels = {
  current: "Current identity",
  update: "Metadata update available",
  missing: "Not in the current catalog",
  rebound: "Different stable identity; update refused",
} as const;

function Identity({ listing }: { listing: PersonalPortfolioIdentity }) {
  return (
    <details>
      <summary>
        <ListingIdentity member={listing} />
      </summary>
      <dl>
        {Object.entries(identityLabels).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{listing[key as keyof PersonalPortfolioIdentity]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function LedgerListing({
  ledger,
  listingId,
}: {
  ledger: ManagedPortfolioPayload;
  listingId: string | null;
}) {
  const listing = ledger.identities.find(
    (entry) => entry.listingId === listingId,
  );
  return listing ? <ListingIdentity member={listing} /> : <span>Cash</span>;
}
function ActivityRows({
  ledger,
  query = "",
  type = "all",
}: {
  ledger: ManagedPortfolioPayload;
  query?: string;
  type?: string;
}) {
  const term = query.trim().toLowerCase();
  const rows = ledger.transactions
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      const listing = ledger.identities.find(
        (item) => item.listingId === entry.listingId,
      );
      return (
        (type === "all" || entry.type === type) &&
        `${entry.date} ${entry.type} ${listing?.symbol ?? "Cash"} ${listing?.issuerName ?? ""}`
          .toLowerCase()
          .includes(term)
      );
    });
  return (
    <>
      {rows.length === 0 ? (
        <p>No matching activities.</p>
      ) : (
        <ol>
          {rows.map(({ entry, index }) => (
            <li key={entry.id} value={index + 1}>
              <p>
                {entry.date} · {entry.type}
              </p>
              <LedgerListing ledger={ledger} listingId={entry.listingId} />
              <p>
                {entry.type === "split"
                  ? `${entry.ratioNumerator} for ${entry.ratioDenominator}`
                  : `${entry.shares === null ? "No share amount" : `${entry.shares} shares`}; gross ${usd(entry.grossUsd)}; fee ${usd(entry.feeUsd)}`}
              </p>
              <details>
                <summary>Activity identifiers</summary>
                <p>
                  Activity ID: {entry.id}. Listing ID:{" "}
                  {entry.listingId ?? "Cash activity"}.
                </p>
              </details>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
function ActivityHistory({ ledger }: { ledger: ManagedPortfolioPayload }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  return (
    <section aria-label="Portfolio activity history">
      <h3>Activity history</h3>
      <p>
        Numbers show authored execution order, including same-day order.
        Searching and filtering never change the ledger.
      </p>
      <div className="ledger-form-grid">
        <label>
          Search activity
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <label>
          Activity type
          <select
            value={type}
            onChange={(event) => setType(event.currentTarget.value)}
          >
            {[
              "all",
              "buy",
              "sell",
              "deposit",
              "withdrawal",
              "dividend",
              "fee",
              "split",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ActivityRows ledger={ledger} query={query} type={type} />
    </section>
  );
}
function PortfolioReview({ ledger }: { ledger: ManagedPortfolioPayload }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const target = heading.current;
    if (target?.isConnected && !target.closest("[hidden], [inert]"))
      target.focus();
  }, []);
  return (
    <section
      aria-label="Portfolio save review"
      className="managed-portfolio-review"
    >
      <h3 ref={heading} tabIndex={-1}>
        Review this portfolio draft
      </h3>
      <p>
        Opening balances at the end of {ledger.opening.asOfDate}. Opening cash:{" "}
        {usd(ledger.opening.cashUsd)}. {ledger.identities.length} registered
        listings and {ledger.transactions.length} authored activities. Save
        sends this complete draft.
      </p>
      {ledger.identities.map((listing) => (
        <Identity key={listing.listingId} listing={listing} />
      ))}
      <details>
        <summary>Catalog reference</summary>
        <p>{ledger.snapshotSha256}</p>
      </details>
      <h4>Opening holdings</h4>
      {ledger.opening.holdings.length === 0 ? (
        <p>No opening holdings.</p>
      ) : (
        <ul>
          {ledger.opening.holdings.map((holding) => (
            <li key={holding.listingId}>
              <LedgerListing ledger={ledger} listingId={holding.listingId} />
              <p>
                {holding.shares} shares; basis {usd(holding.totalCostBasisUsd)};
                confirmed {holding.confirmedOn}.
              </p>
              <details>
                <summary>Holding identifier</summary>
                <p>Listing ID: {holding.listingId}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
      <h4>Complete authored activity order</h4>
      <ActivityRows ledger={ledger} />
      <p>
        FIFO uses an opening pool where earlier lots are unknown. Missing cash
        or basis stays unknown. This ledger does not calculate market value,
        investment returns or tax liability.
      </p>
    </section>
  );
}

function StartPortfolio({
  workspace,
  draft,
  active,
}: {
  workspace: ManagedWorkspace;
  draft: PortfolioDraft;
  active: () => boolean;
}) {
  const [date, setDate] = useState("");
  const [cash, setCash] = useState("");
  const [invalid, setInvalid] = useState(false);
  const model = workspace.portfolio;
  const edit = (nextDate: string, nextCash: string) => {
    if (!active() || !model.canEdit()) return;
    setDate(nextDate);
    setCash(nextCash);
    setInvalid(false);
    model.setPendingEditor(draft, nextDate !== "" || nextCash !== "");
  };
  return (
    <section aria-label="Start portfolio" className="managed-portfolio-start">
      <h3>Start your portfolio</h3>
      <p>
        No portfolio has been saved. Enter an opening date from your records.
        Blank cash means unknown; enter 0 when cash is zero.
      </p>
      <label>
        Opening date (YYYY-MM-DD)
        <input
          id="managed-portfolio-opening-date"
          value={date}
          placeholder="YYYY-MM-DD"
          disabled={!model.canEdit()}
          onChange={(event) => edit(event.currentTarget.value, cash)}
        />
      </label>
      <label>
        Opening cash (USD, blank means unknown)
        <input
          id="managed-portfolio-opening-cash"
          value={cash}
          inputMode="decimal"
          disabled={!model.canEdit()}
          onChange={(event) => edit(date, event.currentTarget.value)}
        />
      </label>
      <div className="trial-actions">
        <button
          id="managed-portfolio-start"
          disabled={!model.canEdit() || !workspace.getSnapshot().snapshot}
          onClick={() => {
            if (!active() || !model.canEdit()) return;
            model.start(date, cash === "" ? null : cash);
            if (model.coordinator.getSnapshot().draft === draft)
              setInvalid(true);
          }}
        >
          Start portfolio draft
        </button>
        <button
          className="trial-secondary"
          disabled={!model.canEdit()}
          onClick={() => edit("", "")}
        >
          Reset opening form
        </button>
      </div>
      {invalid && (
        <p role="alert">
          Enter a valid opening date that is not in the future and a nonnegative
          USD amount with at most two decimal places, or leave cash blank.
        </p>
      )}
    </section>
  );
}

/** An independent authored ledger; source requests remain explicit company actions. */
export function ManagedPortfolio({
  workspace,
  navigationPending,
  onResearch,
}: {
  workspace: ManagedWorkspace;
  navigationPending: boolean;
  onResearch: (
    draft: PortfolioDraft,
    listing: PersonalPortfolioIdentity,
    opener: HTMLButtonElement,
  ) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const entryFocusPending = useRef(true);
  useLayoutEffect(() => {
    if (!entryFocusPending.current || navigationPending) return;
    entryFocusPending.current = false;
    const current = workspace.getSnapshot();
    const target = heading.current;
    const portfolio = workspace.portfolio.getSnapshot();
    if (
      workspace.sessionOwner.getSnapshot().phase !== "active" ||
      current.view !== "portfolio" ||
      current.research ||
      current.companyRoute ||
      portfolio.pendingEditor ||
      portfolio.reviewing ||
      !target?.isConnected ||
      target.closest("[hidden], [inert]") ||
      target.getClientRects().length === 0 ||
      target
        .closest(".managed-portfolio")
        ?.contains(target.ownerDocument.activeElement)
    )
      return;
    target.focus();
  }, [navigationPending, workspace]);
  const model = workspace.portfolio;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const discovery = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const [reviewed, setReviewed] = useState<{
    draft: PortfolioDraft;
    baseVersion: number | null;
  } | null>(null);
  const draft = saved.draft;
  const ledger = draft?.ledger ?? null;
  const current = () => {
    const now = workspace.getSnapshot();
    return (
      workspace.sessionOwner.getSnapshot().phase === "active" &&
      now.view === "portfolio" &&
      !now.research &&
      !now.companyRoute &&
      model.coordinator.getSnapshot().draft === draft
    );
  };
  const ready = () =>
    current() &&
    !model.getSnapshot().pendingEditor &&
    !model.getSnapshot().reviewing;
  const idle = saved.phase === "idle";
  const pending = state.pendingEditor || state.reviewing;
  const editable = model.canEdit();
  const projection = model.getProjection();
  const reviewCurrent =
    reviewed?.draft === draft && reviewed?.baseVersion === saved.baseVersion;
  const canSave = reviewCurrent && model.canSavePayload() && saved.dirty;
  const candidates = discovery.results.filter(
    (listing) =>
      !ledger?.identities.some(
        (entry) => entry.listingId === listing.listingId,
      ),
  );
  return (
    <section
      className="managed-portfolio"
      aria-labelledby="managed-portfolio-heading"
    >
      <header>
        <h2 id="managed-portfolio-heading" ref={heading} tabIndex={-1}>
          Portfolio
        </h2>
        <p>
          Author your USD holdings and activity from your own records. Portfolio
          saves independently of My Watchlist and Follow-ups.
        </p>
      </header>
      <p className="managed-portfolio-coverage">
        {discovery.snapshot
          ? `${discovery.snapshot.coverage.activeListings} active listings in the current catalog.`
          : "Load the catalog to register identities."}{" "}
        Only admitted listings can be registered. This is limited coverage, not
        a complete investment universe. Identity coverage does not imply Price,
        Annual or Filings coverage.
      </p>
      <div className="trial-actions">
        <button
          id="managed-portfolio-load"
          className="trial-secondary"
          disabled={!idle || saved.uncertain || pending}
          onClick={() => {
            if (
              ready() &&
              model.coordinator.getSnapshot().phase === "idle" &&
              !model.coordinator.getSnapshot().uncertain
            )
              void model.coordinator.load();
          }}
        >
          {saved.phase === "loading"
            ? "Loading portfolio…"
            : saved.saved
              ? "Load latest portfolio"
              : "Load portfolio"}
        </button>
        <button
          id="managed-portfolio-review"
          className="trial-secondary"
          disabled={!editable || pending || !model.canSavePayload()}
          onClick={() => {
            if (ready() && model.canSavePayload())
              setReviewed(
                draft ? { draft, baseVersion: saved.baseVersion } : null,
              );
          }}
        >
          Review portfolio
        </button>
        <button
          id="managed-portfolio-save"
          disabled={!canSave || pending}
          onClick={() => {
            if (
              ready() &&
              reviewCurrent &&
              reviewed.baseVersion ===
                model.coordinator.getSnapshot().baseVersion &&
              model.canSavePayload()
            )
              void model.coordinator.save();
          }}
        >
          Save Portfolio
        </button>
        {saved.uncertain && (
          <button
            id="managed-portfolio-reconcile"
            disabled={!idle || pending}
            onClick={() => {
              if (ready()) void model.coordinator.reconcile();
            }}
          >
            Reconcile original portfolio save
          </button>
        )}
      </div>
      <p>
        {saved.baseVersion === null
          ? "Portfolio has not been loaded."
          : `Draft based on version ${saved.baseVersion}.`}
        {saved.saved ? ` Loaded saved version ${saved.saved.version}.` : ""}
        {saved.dirty ? " Unsaved portfolio changes." : ""}
      </p>
      <p role="status" aria-live="polite">
        {saved.message} {state.message}
      </p>
      {state.pendingEditor && (
        <p className="managed-portfolio-warning" id="managed-portfolio-pending">
          Apply or reset the portfolio form before Load, Review, Save, search or
          navigation. Your typed values remain in this form.
        </p>
      )}
      {saved.conflict && (
        <section aria-label="Portfolio saved version review">
          <p>
            {saved.replayPending
              ? "The original save is confirmed. Load the latest version before choosing."
              : "Your portfolio draft is retained. Load the latest saved version, then choose which complete ledger to keep."}
          </p>
          <div className="trial-actions">
            <button
              id="managed-portfolio-use-saved"
              disabled={!idle || !saved.latestLoaded || pending}
              onClick={() => {
                if (ready()) model.coordinator.useSaved();
              }}
            >
              Use saved portfolio
            </button>
            <button
              id="managed-portfolio-keep-draft"
              disabled={!idle || !saved.latestLoaded || pending}
              onClick={() => {
                if (ready()) model.coordinator.keepDraft();
              }}
            >
              Keep portfolio draft
            </button>
          </div>
        </section>
      )}
      {draft && ledger === null && (
        <StartPortfolio workspace={workspace} draft={draft} active={current} />
      )}
      {ledger && draft && (
        <>
          <p>
            Review catalog identities and apply the accepted review before
            reviewing this draft for Save. Every activity date must be on or
            before today. Apply or reset any open form first.
          </p>
          <section aria-label="Current authored holdings">
            <h3>Holdings and cash</h3>
            {projection?.status === "valid" ? (
              <>
                <dl>
                  <div>
                    <dt>Cash</dt>
                    <dd>{usd(projection.portfolio.cashUsd)}</dd>
                  </div>
                  <div>
                    <dt>Known realized gain subtotal</dt>
                    <dd>{usd(projection.realized.knownGainSubtotalUsd)}</dd>
                  </div>
                  <div>
                    <dt>Total realized gain</dt>
                    <dd>{usd(projection.realized.totalGainUsd)}</dd>
                  </div>
                  <div>
                    <dt>Sales with unknown basis</dt>
                    <dd>
                      {projection.realized.unknownSales} of{" "}
                      {projection.realized.sales}
                    </dd>
                  </div>
                </dl>
                {projection.cashCheck === "unknown_opening_cash" && (
                  <p>
                    Opening cash is unknown. The running cash balance cannot be
                    confirmed.
                  </p>
                )}
                <div
                  className="managed-portfolio-table"
                  role="region"
                  aria-label="Authored holdings table"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Listing</th>
                        <th>Shares</th>
                        <th>Cost basis</th>
                        <th>Confirmed on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projection.portfolio.holdings.map((holding) => (
                        <tr key={holding.identity.listingId}>
                          <th>
                            <ListingIdentity member={holding.identity} />
                          </th>
                          <td>{holding.shares}</td>
                          <td>{usd(holding.totalCostBasisUsd)}</td>
                          <td>{holding.confirmedOn}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {projection.portfolio.holdings.length === 0 && (
                  <p>No current holdings.</p>
                )}
              </>
            ) : (
              <p role="alert">
                The ledger cannot be projected:{" "}
                {projection?.status === "invalid"
                  ? projection.error.code
                  : "unavailable"}
                . Correct the draft before saving.
              </p>
            )}
          </section>
          <section aria-label="Portfolio identities">
            <h3>Registered listings</h3>
            <p>
              Use the catalog search below, then register the complete listing
              identity. Registration does not buy shares or add a Watchlist
              entry.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (ready() && !navigationPending) void workspace.search();
              }}
            >
              <label>
                Find a listing for Portfolio
                <input
                  id="managed-portfolio-search"
                  value={discovery.query}
                  disabled={pending || navigationPending}
                  onChange={(event) => {
                    if (ready()) workspace.setQuery(event.currentTarget.value);
                  }}
                />
              </label>
              <button
                disabled={
                  pending || discovery.read !== null || navigationPending
                }
              >
                Search catalog
              </button>
            </form>
            <ul>
              {candidates.map((listing) => (
                <li key={listing.listingId}>
                  <Identity listing={listing} />
                  <button
                    disabled={
                      !editable || pending || ledger.identities.length >= 20
                    }
                    onClick={() => {
                      if (
                        ready() &&
                        workspace.getSnapshot().results.includes(listing)
                      )
                        void model.register(listingIdentity(listing));
                    }}
                  >
                    Register {listing.symbol}
                  </button>
                </li>
              ))}
            </ul>
            <ul>
              {ledger.identities.map((listing) => (
                <li key={listing.listingId}>
                  <Identity listing={listing} />
                  <button
                    className="trial-secondary"
                    disabled={
                      !editable ||
                      pending ||
                      navigationPending ||
                      ledger.snapshotSha256 !==
                        discovery.snapshot?.snapshotSha256
                    }
                    onClick={(event) => {
                      if (ready() && !navigationPending)
                        onResearch(draft, listing, event.currentTarget);
                    }}
                  >
                    Research {listing.symbol}
                  </button>
                </li>
              ))}
            </ul>
            <button
              id="managed-portfolio-review-identities"
              className="trial-secondary"
              disabled={!editable || pending || !discovery.snapshot}
              onClick={() => {
                if (ready()) void model.reviewCatalog();
              }}
            >
              Review catalog identities
            </button>
            {state.reviewing && (
              <button
                onClick={() => {
                  if (current()) model.cancelReview();
                }}
              >
                Cancel identity check
              </button>
            )}
            {state.review && (
              <div>
                <p>
                  Review every registered identity before applying the current
                  catalog. History stays in this ledger.
                </p>
                <ul>
                  {state.review.entries.map((entry) => (
                    <li key={entry.previous.listingId}>
                      <p>{reviewLabels[entry.status]}</p>
                      <Identity listing={entry.previous} />
                      {entry.status === "update" && entry.listing && (
                        <Identity listing={entry.listing} />
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={
                    pending ||
                    state.review.entries.some(
                      (entry) =>
                        entry.status === "missing" ||
                        entry.status === "rebound",
                    )
                  }
                  onClick={() => {
                    if (ready()) model.applyReview();
                  }}
                >
                  Apply reviewed identities
                </button>
                <button
                  className="trial-secondary"
                  onClick={() => {
                    if (current()) model.cancelReview();
                  }}
                >
                  Cancel identity review
                </button>
              </div>
            )}
          </section>
          <ActivityHistory ledger={ledger} />
          <PersonalPortfolioLedgerEditor
            ledger={ledger}
            profile="managed"
            saveHelp="Apply edits to this portfolio draft, then Review portfolio and Save Portfolio to keep the complete ledger on your signed-in devices."
            selectedListing={null}
            disabled={!editable}
            onPendingEditsChange={(value) => {
              if (current()) model.setPendingEditor(draft, value);
            }}
            onChange={(next) => {
              if (current() && next.schemaVersion === 3)
                model.replace(draft, next);
            }}
          />
          {reviewCurrent && !state.pendingEditor && (
            <PortfolioReview ledger={ledger} />
          )}
        </>
      )}
    </section>
  );
}
