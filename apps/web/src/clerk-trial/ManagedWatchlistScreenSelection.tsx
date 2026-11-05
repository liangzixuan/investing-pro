import { useState } from "react";
import { WatchlistScreenSelectionRows } from "./WatchlistScreenSelectionRows";
import type { ManagedWorkspace } from "./managed-workspace";
import { ListingIdentity } from "./ManagedListingIdentity";
import { useWatchlistScreenSelection } from "./useWatchlistScreenSelection";
import "./managed-watchlist-screen-selection.css";

const id = "managed-watchlist-screen";

export function ManagedWatchlistScreenSelection({
  workspace,
  routeActive,
}: {
  workspace: ManagedWorkspace;
  routeActive: () => boolean;
}) {
  const controls = useWatchlistScreenSelection(workspace, routeActive);
  const { context, plan, preview, reason } = controls;
  const [currentPage, setCurrentPage] = useState({
    owner: context.saved.draft,
    page: 0,
  });
  const [previewPage, setPreviewPage] = useState({ owner: preview, page: 0 });
  if (context.session.phase !== "active") return null;
  return (
    <details className="managed-watchlist-screen-selection" id={id}>
      <summary id={`${id}-open`}>Watchlist companies</summary>
      <section aria-labelledby={`${id}-heading`}>
        <h3 id={`${id}-heading`} ref={controls.heading} tabIndex={-1}>
          Use your watched companies in this screen
        </h3>
        <p>
          Load Watchlist in its own tab and load the screening cohort below.
          Review every eligibility outcome, choose a watched share class when
          needed, then preview the complete selection. Run screen is a separate
          action.
        </p>
        <p id={`${id}-saved-state`}>
          {context.saved.baseVersion === null
            ? "Watchlist is not loaded."
            : `Watchlist saved base version ${context.saved.baseVersion}.`}
          {context.saved.dirty
            ? " The current Watchlist has unsaved changes."
            : ""}
          {context.view.snapshot
            ? ` Catalog: ${context.view.snapshot.snapshotSha256}.`
            : ""}
        </p>
        <h4>Current watched companies</h4>
        {plan.rows.length > 0 ? (
          <WatchlistScreenSelectionRows
            rows={plan.rows}
            id={`${id}-current`}
            page={
              currentPage.owner === context.saved.draft ? currentPage.page : 0
            }
            onPage={(page) =>
              setCurrentPage({ owner: context.saved.draft, page })
            }
          />
        ) : (
          <p>No current Watchlist entries are available for this selection.</p>
        )}
        {plan.choiceGroups.map((group, index) => (
          <label key={group.issuerId} htmlFor={`${id}-choice-${index}`}>
            Choose one watched share class for{" "}
            {group.members[0]?.listing.issuerName}
            <select
              id={`${id}-choice-${index}`}
              data-issuer-id={group.issuerId}
              value={group.selected?.listing.listingId ?? ""}
              onChange={(event) =>
                controls.choose(
                  group.issuerId,
                  group.members.find(
                    (member) =>
                      member.listing.listingId === event.currentTarget.value,
                  ) ?? null,
                )
              }
            >
              <option value="">Choose a watched share class</option>
              {group.members.map((member) => (
                <option
                  key={member.listing.listingId}
                  value={member.listing.listingId}
                >
                  {member.listing.symbol} · {member.listing.securityName} ·{" "}
                  {member.listing.shareClassName} · {member.listing.exchangeMic}{" "}
                  · {member.listing.listingId}
                </option>
              ))}
            </select>
          </label>
        ))}
        {controls.hasChoices && (
          <button
            id={`${id}-reset-choices`}
            type="button"
            className="trial-secondary"
            disabled={!context.isCurrent()}
            onClick={controls.resetChoices}
          >
            Reset share-class choices
          </button>
        )}
        {reason && (
          <p id={`${id}-readiness`} role="status">
            {reason}
          </p>
        )}
        <button
          id={`${id}-prepare`}
          ref={controls.prepareButton}
          type="button"
          className="trial-secondary"
          disabled={reason !== null || !plan.canApply}
          onClick={controls.prepare}
        >
          Preview Watchlist selection
        </button>
        {preview && (
          <section aria-labelledby={`${id}-preview`}>
            <h4
              id={`${id}-preview`}
              ref={controls.previewHeading}
              tabIndex={-1}
            >
              Complete Watchlist selection preview
            </h4>
            <p>
              {preview.unchanged
                ? "The identical ordered selection keeps the current run, shortlist and comparison."
                : "Apply replaces the complete company selection and clears the earlier run, shortlist and comparison. Criteria, sorting and Watchlist stay unchanged."}
            </p>
            <h5>Companies to screen, in order</h5>
            <ol id={`${id}-selected`}>
              {preview.plan.members.map((member) => (
                <li key={member.listing.listingId}>
                  <ListingIdentity member={member.listing} /> ·{" "}
                  {member.listing.listingId}
                </li>
              ))}
            </ol>
            <h5>Every Watchlist entry and its selection outcome</h5>
            <WatchlistScreenSelectionRows
              rows={preview.plan.rows}
              id={`${id}-preview-rows`}
              page={previewPage.owner === preview ? previewPage.page : 0}
              onPage={(page) => setPreviewPage({ owner: preview, page })}
            />
            <div className="trial-actions">
              <button
                id={`${id}-apply`}
                type="button"
                disabled={!controls.currentPreview}
                onClick={controls.apply}
              >
                Apply companies
              </button>
              <button
                id={`${id}-cancel`}
                type="button"
                className="trial-secondary"
                onClick={controls.cancel}
              >
                Keep current selection
              </button>
            </div>
          </section>
        )}
        {controls.message && (
          <p id={`${id}-message`} role="status">
            {controls.message}
          </p>
        )}
      </section>
    </details>
  );
}
