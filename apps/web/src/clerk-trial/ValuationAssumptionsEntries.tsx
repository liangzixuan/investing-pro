import {
  membershipMatchesResult,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import type { ValuationCatalogReview } from "./managed-valuation-assumptions";
import type { ValuationAssumptionsView } from "./useValuationAssumptionsView";
import { ValuationAssumptionReview } from "./ValuationAssumptionReview";

export function ValuationConflictChoices({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { model, ready, canChooseConflict } = view;
  return (
    <div className="trial-actions">
      <button
        id="managed-valuation-use-saved-version"
        disabled={!canChooseConflict}
        onClick={() => {
          if (ready() && canChooseConflict) model.coordinator.useSaved();
        }}
      >
        Use saved version
      </button>
      <button
        id="managed-valuation-keep-draft"
        disabled={!canChooseConflict}
        onClick={() => {
          if (ready() && canChooseConflict) model.coordinator.keepDraft();
        }}
      >
        Keep valuation draft
      </button>
    </div>
  );
}

export function ValuationDraftEntry({
  entry,
  view,
}: {
  readonly entry: ValuationAssumptionEntry;
  readonly view: ValuationAssumptionsView;
}) {
  return (
    <section>
      <details>
        <summary>
          {entry.listing.symbol} · {entry.listing.listingId}
        </summary>
        <ValuationAssumptionReview entry={entry} />
      </details>
      <button
        className="trial-secondary"
        disabled={!view.editable}
        onClick={() => {
          if (view.ready()) view.model.remove(entry);
        }}
      >
        Remove {entry.listing.symbol} from valuation draft
      </button>
    </section>
  );
}

const catalogLabels = {
  current: "Current identity",
  update: "Metadata update available",
  missing: "Identity refused",
  rebound: "Identity refused",
  issuer_mismatch: "Identity refused",
} as const;
export function ValuationCatalogIdentityRow({
  row,
}: {
  readonly row: ValuationCatalogReview["entries"][number];
}) {
  return (
    <section>
      <p>
        {catalogLabels[row.status]} · {row.status}
      </p>
      <div className="managed-valuation-comparison">
        <section>
          <h5>Previous entry</h5>
          <ValuationAssumptionReview entry={row.previous} />
        </section>
        <section>
          <h5>Reviewed entry</h5>
          {row.entry ? (
            <ValuationAssumptionReview entry={row.entry} />
          ) : (
            <p>
              No accepted current identity. Remove this draft entry to continue.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function matchesCurrentCompany(
  entry: ValuationAssumptionEntry,
  view: ValuationAssumptionsView,
): boolean {
  const context = view.editor.context;
  if (!context) return false;
  if (entry.catalogSnapshotSha256 !== view.state.catalogSnapshotSha256)
    return false;
  return membershipMatchesResult(
    { ...entry.listing, note: "" },
    context.listing,
  );
}
export function ValuationConfirmedEntry({
  entry,
  view,
}: {
  readonly entry: ValuationAssumptionEntry;
  readonly view: ValuationAssumptionsView;
}) {
  const matching = matchesCurrentCompany(entry, view);
  return (
    <section>
      <details>
        <summary>
          Saved {entry.listing.symbol} · {entry.listing.listingId}
        </summary>
        <ValuationAssumptionReview entry={entry} />
      </details>
      <button
        className="trial-secondary"
        disabled={!view.editable || !matching}
        onClick={() => {
          if (view.ready() && matching) view.model.reviewSavedInputs(entry);
        }}
      >
        Review saved inputs for {entry.listing.symbol}
      </button>
    </section>
  );
}
