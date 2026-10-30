import type { ManagedWorkspace } from "./managed-workspace";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { usePortfolioScreenSelection } from "./usePortfolioScreenSelection";
import type { PortfolioScreenSelectionPlan } from "./managed-portfolio-screen-selection-plan";
import "./managed-portfolio-screen-selection.css";

const id = "managed-portfolio-screen";

function HoldingRows({ rows }: { rows: PortfolioScreenSelectionPlan["rows"] }) {
  return (
    <ol className="managed-portfolio-screen-rows">
      {rows.map((row) => (
        <li
          key={row.holding.identity.listingId}
          data-listing-id={row.holding.identity.listingId}
        >
          <p>
            <ListingIdentity member={row.holding.identity} />
          </p>
          <p>
            Projected shares:{" "}
            <span data-holding-shares>{row.holding.shares}</span>. Confirmed on:{" "}
            {row.holding.confirmedOn}.
          </p>
          <p data-holding-outcome>{row.reason}</p>
          <dl className="managed-portfolio-screen-identity">
            {Object.entries(identityLabels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {
                    row.holding.identity[
                      key as keyof typeof row.holding.identity
                    ]
                  }
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ol>
  );
}

export function ManagedPortfolioScreenSelection({
  workspace,
  routeActive,
}: {
  workspace: ManagedWorkspace;
  routeActive: () => boolean;
}) {
  const controls = usePortfolioScreenSelection(workspace, routeActive);
  const { context, plan, preview, reason } = controls;
  if (context.session.phase !== "active") return null;
  return (
    <details className="managed-portfolio-screen-selection" id={id}>
      <summary id={`${id}-open`}>Portfolio companies</summary>
      <section aria-labelledby={`${id}-heading`}>
        <h3 id={`${id}-heading`} ref={controls.heading} tabIndex={-1}>
          Use your held companies in this screen
        </h3>
        <p>
          Load Portfolio in its own tab and load the screening cohort below.
          Review all holdings, choose a held share class when needed, then
          preview the complete selection. Run screen is a separate action.
        </p>
        <p id={`${id}-saved-state`}>
          {context.saved.baseVersion === null
            ? "Portfolio is not loaded."
            : `Portfolio saved base version ${context.saved.baseVersion}.`}
          {context.saved.dirty
            ? " The current Portfolio has unsaved changes."
            : ""}
          {context.view.snapshot
            ? ` Catalog: ${context.view.snapshot.snapshotSha256}.`
            : ""}
        </p>
        <h4>Current held companies</h4>
        {plan.rows.length > 0 ? (
          <HoldingRows rows={plan.rows} />
        ) : (
          <p>No current holdings are available for this selection.</p>
        )}
        {plan.choiceGroups.map((group, index) => (
          <label key={group.issuerId} htmlFor={`${id}-choice-${index}`}>
            Choose one held share class for{" "}
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
              <option value="">Choose a held share class</option>
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
          Preview Portfolio selection
        </button>
        {preview && (
          <section aria-labelledby={`${id}-preview`}>
            <h4
              id={`${id}-preview`}
              ref={controls.previewHeading}
              tabIndex={-1}
            >
              Complete Portfolio selection preview
            </h4>
            <p>
              {preview.unchanged
                ? "The identical ordered selection keeps the current run, shortlist and comparison."
                : "Apply replaces the complete company selection and clears the earlier run, shortlist and comparison. Criteria, sorting and Portfolio stay unchanged."}
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
            <h5>Every holding and its selection outcome</h5>
            <HoldingRows rows={preview.plan.rows} />
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
