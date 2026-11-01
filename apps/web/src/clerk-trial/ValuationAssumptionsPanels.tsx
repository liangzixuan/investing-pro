import { type ValuationAssumptionsPayload } from "@research-cockpit/contracts";
import {
  ValuationAssumptionReview,
  ValuationEditorReview,
} from "./ValuationAssumptionReview";
import type { ValuationAssumptionsView } from "./useValuationAssumptionsView";
import {
  ValuationConflictChoices,
  ValuationDraftEntry,
  ValuationCatalogIdentityRow,
  ValuationConfirmedEntry,
  type ValuationBaselineActions,
} from "./ValuationAssumptionsEntries";
export function CompletePayload({
  payload,
  label,
}: {
  readonly payload: ValuationAssumptionsPayload;
  readonly label: string;
}) {
  return (
    <section aria-label={label}>
      <h4>{label}</h4>
      {payload.entries.length === 0 ? (
        <p>No saved input entries.</p>
      ) : (
        payload.entries.map((entry) => (
          <ValuationAssumptionReview
            key={entry.listing.listingId}
            entry={entry}
          />
        ))
      )}
    </section>
  );
}

export function ValuationConflictReview({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { saved } = view;
  return (
    <>
      {saved.conflict && (
        <section aria-label="Valuation saved version review">
          <p>
            Load the latest version, compare both complete sets, then choose
            which set to keep. Keep draft requires a separate Review and Save.
          </p>
          {saved.saved && (
            <CompletePayload
              label={
                saved.latestLoaded
                  ? `Latest saved inputs (version ${saved.saved.version})`
                  : `Previously confirmed inputs (version ${saved.saved.version}); load latest to compare`
              }
              payload={saved.saved.payload}
            />
          )}
          {saved.draft && (
            <CompletePayload
              label="Retained valuation draft"
              payload={saved.draft}
            />
          )}
          <ValuationConflictChoices view={view} />
        </section>
      )}
    </>
  );
}
export function ValuationStagingReview({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { model, state, editable, ready } = view;
  return (
    <>
      {state.stageReview && (
        <section aria-label="Valuation staging review">
          <h4>Review complete inputs before staging</h4>
          <div className="managed-valuation-comparison">
            <section>
              <h5>Previous draft entry</h5>
              {state.stageReview.previous ? (
                <ValuationAssumptionReview entry={state.stageReview.previous} />
              ) : (
                <p>No previous draft entry for this listing.</p>
              )}
            </section>
            <section>
              <h5>Current editor inputs</h5>
              <ValuationAssumptionReview
                entry={state.stageReview.capture.entry}
              />
            </section>
          </div>
          <p>
            Staging replaces only this listing's draft entry. It does not save
            or calculate.
          </p>
          <button
            id="managed-valuation-stage"
            disabled={!editable}
            onClick={() => {
              if (ready()) model.stageCurrent(state.stageReview);
            }}
          >
            Stage reviewed inputs
          </button>
        </section>
      )}
    </>
  );
}
export function ValuationRestoreReview({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { model, state, editor, editable, ready } = view;
  return (
    <>
      {state.restoreReview && (
        <section aria-label="Saved valuation restore review">
          <h4>Compare before replacing the editor</h4>
          <div className="managed-valuation-comparison">
            <section>
              <h5>Current editor inputs</h5>
              <ValuationEditorReview editor={editor} />
            </section>
            <section>
              <h5>Confirmed saved inputs</h5>
              <ValuationAssumptionReview entry={state.restoreReview.entry} />
            </section>
          </div>
          <p>
            Use replaces the local editor and clears calculated results. Select
            Calculate authored scenarios separately. Other saved resources and
            note drafts stay unchanged.
          </p>
          <button
            id="managed-valuation-use-inputs"
            disabled={!editable}
            onClick={() => {
              if (ready()) model.useSavedInputs(state.restoreReview);
            }}
          >
            Use reviewed saved inputs
          </button>
        </section>
      )}
    </>
  );
}
export function ValuationCatalogReview({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { model, state, editable, ready } = view;
  return (
    <>
      {state.catalogReview && (
        <section aria-label="Valuation catalog identity review">
          {state.catalogReview.entries.map((row) => (
            <ValuationCatalogIdentityRow
              key={row.previous.listing.listingId}
              row={row}
            />
          ))}
          <button
            id="managed-valuation-apply-catalog"
            disabled={
              !editable || state.catalogReview.entries.some((row) => !row.entry)
            }
            onClick={() => {
              if (ready()) model.applyCatalogReview(state.catalogReview);
            }}
          >
            Apply reviewed valuation identities
          </button>
        </section>
      )}
    </>
  );
}
export function ValuationDraftEntries({
  view,
}: {
  readonly view: ValuationAssumptionsView;
}) {
  const { model, saved, ready, canReviewCatalog } = view;
  return (
    <>
      {saved.draft && (
        <details>
          <summary>Valuation draft entries and catalog review</summary>
          <p>
            Removing an entry changes only this draft. Review and Save to
            confirm removal. For an older catalog, review and apply identities,
            then Save before using the updated saved inputs.
          </p>
          {saved.draft.entries.map((entry) => (
            <ValuationDraftEntry
              key={entry.listing.listingId}
              entry={entry}
              view={view}
            />
          ))}
          <button
            id="managed-valuation-catalog-review"
            className="trial-secondary"
            disabled={!canReviewCatalog}
            onClick={() => {
              if (ready() && canReviewCatalog) void model.reviewCatalog();
            }}
          >
            Review valuation catalog identities
          </button>
          <ValuationCatalogReview view={view} />
        </details>
      )}
    </>
  );
}
export function ValuationSavedEntries({
  view,
  baselineActions,
}: {
  readonly view: ValuationAssumptionsView;
  readonly baselineActions?: ValuationBaselineActions;
}) {
  const { saved } = view;
  return (
    <>
      {saved.saved && (
        <section aria-label="Confirmed saved valuation inputs">
          <h4>Confirmed saved inputs</h4>
          <p>
            Open the matching company to use its saved inputs. Historical
            catalog entries need the separate identity review and Save above.
            Staged entries are available here only after a confirmed save.
          </p>
          {saved.saved.payload.entries.length === 0 && (
            <p>No confirmed saved inputs.</p>
          )}
          {saved.saved.payload.entries.map((entry) => (
            <ValuationConfirmedEntry
              key={entry.listing.listingId}
              entry={entry}
              view={view}
              {...(baselineActions ? { baselineActions } : {})}
            />
          ))}
        </section>
      )}
    </>
  );
}
