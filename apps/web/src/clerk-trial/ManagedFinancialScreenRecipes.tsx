import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import type { ManagedFinancialScreen as ScreenModel } from "./managed-financial-screen";
import {
  ManagedFinancialScreenRecipes as Recipes,
  type ScreenRecipeFileSelection,
  type ScreenRecipeReview,
} from "./managed-financial-screen-recipes";
import {
  browserFinancialScreenRecipeAdapter,
  type ManagedFinancialScreenRecipeDeliveryAdapter,
} from "./financial-screen-recipe-delivery";
import { identityLabels } from "./ManagedListingIdentity";
import {
  MANAGED_FINANCIAL_SCREEN_FIELDS,
  type ManagedFinancialScreenCriteria,
} from "./managed-financial-screen-results";

const activeRoute = () => true;
export function ManagedFinancialScreenRecipes({
  model,
  delivery = browserFinancialScreenRecipeAdapter,
  routeActive = activeRoute,
  onApplied,
}: {
  model: ScreenModel;
  delivery?: ManagedFinancialScreenRecipeDeliveryAdapter;
  routeActive?: () => boolean;
  onApplied: () => void;
}) {
  const recipes = useMemo(
    () => new Recipes({ model, delivery, routeActive }),
    [model, delivery, routeActive],
  );
  const state = useSyncExternalStore(
    recipes.subscribe,
    recipes.getSnapshot,
    recipes.getSnapshot,
  );
  const token = useRef<ScreenRecipeFileSelection | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  useLayoutEffect(() => {
    const element = input.current;
    const cancel = () => recipes.cancelFileSelection(token.current);
    element?.addEventListener("cancel", cancel);
    return () => element?.removeEventListener("cancel", cancel);
  }, [recipes]);
  useLayoutEffect(() => {
    recipes.reconcile();
  });
  return (
    <details id="managed-screen-recipes" className="managed-screen-evidence">
      <summary>Portable screen recipe</summary>
      <p>
        Save applied criteria, sort and selected listing order. Recipes contain
        no results, notes or shortlist. Load the current screening cohort first.
        Unapplied criteria edits block capture and Apply.
      </p>
      <div className="managed-screen-clause">
        <label>
          Recipe name
          <input
            id="managed-screen-recipe-name"
            type="text"
            maxLength={80}
            value={state.name}
            onChange={(event) => recipes.setName(event.target.value, state)}
          />
        </label>
      </div>
      <button
        type="button"
        className="trial-secondary"
        disabled={!state.canCapture}
        onClick={() => void recipes.capture(state)}
      >
        Save screen recipe file
      </button>
      <div className="managed-screen-clause">
        <label htmlFor="managed-screen-recipe-file">
          Open screen recipe file
          <input
            ref={input}
            id="managed-screen-recipe-file"
            type="file"
            accept="application/json,.json"
            disabled={!state.canImport}
            onClick={(event) => {
              event.currentTarget.value = "";
              token.current = recipes.chooseFile(state);
              if (!token.current) event.preventDefault();
            }}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void recipes.readFile(file, token.current);
              else recipes.cancelFileSelection(token.current);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      {state.phase !== "idle" && (
        <button
          type="button"
          className="trial-secondary"
          onClick={() => recipes.cancel(state)}
        >
          Keep current screen definition
        </button>
      )}
      <p role="status" aria-live="polite">
        {state.message}
      </p>
      {state.review && (
        <ScreenRecipeReviewView
          review={state.review}
          onApply={() => {
            if (state.review && recipes.apply(state.review)) onApplied();
          }}
        />
      )}
    </details>
  );
}
export function ScreenRecipeReviewView({
  review,
  onApply,
}: {
  review: ScreenRecipeReview;
  onApply: () => void;
}) {
  return (
    <section aria-labelledby="managed-screen-recipe-review">
      <h4 id="managed-screen-recipe-review">Screen recipe review</h4>
      <p>
        Recipe name: {review.file.name}. File capture time:{" "}
        {review.file.capturedAt}. File catalog claim:{" "}
        {review.file.catalogSnapshotSha256}. These file values are unverified
        claims, not current source authority.
      </p>
      <p>
        Current catalog: {review.current.catalogSnapshotSha256}. No financial
        reports have been read for this review.
      </p>
      <h5>File criteria and sort</h5>
      <RecipeCriteria criteria={review.file.criteria} />
      <h5>Current applied criteria and sort</h5>
      <RecipeCriteria criteria={review.current.criteria} />
      <h5>File listings in saved order</h5>
      <ol>
        {review.rows.map((row) => (
          <li key={row.previous.listingId}>
            <p>Identity review: {row.status.replaceAll("_", " ")}</p>
            <h6>File identity</h6>
            <RecipeIdentity listing={row.previous} />
            <h6>Current cohort identity</h6>
            {row.current ? (
              <RecipeIdentity listing={row.current.listing} />
            ) : (
              <p>Missing from the current cohort.</p>
            )}
          </li>
        ))}
      </ol>
      <h5>Current selection in order</h5>
      {review.current.selected.length ? (
        <ol>
          {review.current.selected.map((member) => (
            <li key={member.listing.listingId}>
              <RecipeIdentity listing={member.listing} />
            </li>
          ))}
        </ol>
      ) : (
        <p>No listings selected.</p>
      )}
      <button
        type="button"
        className="trial-secondary"
        disabled={!review.canApply}
        onClick={onApply}
      >
        Apply recipe definition
      </button>
      <p>
        Apply replaces only the screen criteria and selected listings, and
        clears prior screen results, comparison and shortlist. Run, research,
        Back and Watchlist Review and Save remain separate.
      </p>
    </section>
  );
}
function RecipeCriteria({
  criteria,
}: {
  criteria: ManagedFinancialScreenCriteria;
}) {
  const label = (key: string) =>
    MANAGED_FINANCIAL_SCREEN_FIELDS.find((field) => field.key === key)?.label ??
    key;
  return (
    <>
      <p>
        Sort: {label(criteria.sort.field)},{" "}
        {criteria.sort.direction === "asc" ? "ascending" : "descending"}.
      </p>
      {criteria.clauses.length ? (
        <ol>
          {criteria.clauses.map((clause, index) => (
            <li key={index}>
              {label(clause.field)}{" "}
              {clause.operator === "gte" ? "at least" : "at most"}{" "}
              {clause.value}
            </li>
          ))}
        </ol>
      ) : (
        <p>No numerical criteria.</p>
      )}
    </>
  );
}
function RecipeIdentity({ listing }: { listing: ManagedEodIdentity }) {
  return (
    <dl>
      {Object.entries(identityLabels).map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{listing[key as keyof ManagedEodIdentity]}</dd>
        </div>
      ))}
    </dl>
  );
}
