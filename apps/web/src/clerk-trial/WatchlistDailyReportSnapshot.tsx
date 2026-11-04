import {
  isPreparedWatchlistDailyReport,
  type PreparedWatchlistDailyReport,
  type DailyReportResource,
} from "./watchlist-daily-report";

import { ManagedWatchlistDailyReviewEvidence } from "./ManagedWatchlistDailyReviewEvidence";

import { ValuationAssumptionReview } from "./ValuationAssumptionReview";

import { ManagedValuationResults } from "./ManagedValuationResults";

import {
  ManagedValuationPriceContext,
  valuationPriceRefusal,
} from "./ManagedValuationPriceContext";

function ResourceStatus({
  name,
  state,
}: {
  name: string;
  state: DailyReportResource;
}) {
  return (
    <p>
      {name}: loaded saved version {state.savedVersion ?? "unavailable"}; draft
      base version {state.baseVersion ?? "unavailable"};{" "}
      {state.dirty ? "unsaved changes" : "no unsaved changes reported"}. Latest
      Load confirmed: {state.latestLoaded ? "yes" : "no"}. State: {state.phase}.
    </p>
  );
}

function Scenario({
  report,
  index,
}: {
  report: PreparedWatchlistDailyReport;
  index: number;
}) {
  const scenario = report.scenarios;

  const row = scenario?.rows[index];

  if (!scenario || !row)
    return <p>Saved scenarios were not previewed for this review.</p>;

  const result = scenario.outcomes?.[index];

  return (
    <section aria-label="Captured saved scenarios">
      <h3>Saved scenarios</h3>

      <p>
        Confirmed collection version {scenario.collectionVersion}. Captured at
        (UTC): {scenario.capturedAt}.
      </p>

      <p>
        {scenario.evaluatedAt
          ? `Evaluated at (UTC): ${scenario.evaluatedAt}. Saved inputs evaluated at that action time; these are not historical calculated values.`
          : "Saved scenarios were previewed but not evaluated."}
      </p>

      {row.reason && (
        <p>
          {row.reason === "missing_saved_inputs"
            ? "No confirmed saved valuation inputs for this listing."
            : "Saved inputs do not match the captured catalog, full listing or admitted issuer."}
        </p>
      )}

      {row.entry && <ValuationAssumptionReview entry={row.entry} />}

      <p>
        {row.price.reason
          ? valuationPriceRefusal(row.price.reason)
          : `Retained raw close ${row.price.reference!.rawCloseUsd} USD on ${row.price.reference!.date}.`}
      </p>

      {result?.calculation && (
        <ManagedValuationResults calculation={result.calculation} />
      )}

      {result?.comparison && (
        <ManagedValuationPriceContext context={result.comparison} />
      )}
    </section>
  );
}

/** All disclosures are rendered before saving; this view never reads or evaluates sources. */

export function WatchlistDailyReportSnapshot({
  report,
}: {
  readonly report: PreparedWatchlistDailyReport;
}) {
  if (!isPreparedWatchlistDailyReport(report)) return null;

  return (
    <article aria-label="Complete Watchlist daily review report">
      <h1>Watchlist daily review</h1>

      <p>
        Report prepared (UTC): {report.preparedAt}. Source dates, saved-input
        capture and evaluation times remain independent. Preparation does not
        refresh evidence or save account resources.
      </p>

      <p>
        Private historical reading copy. Authored notes and assessments may
        include unsaved drafts. This file cannot restore inputs, create checks
        or update an account.
      </p>

      <ResourceStatus name="My Watchlist" state={report.resources.watchlist} />

      <ResourceStatus name="Follow-ups" state={report.resources.followups} />

      <ResourceStatus
        name="Valuation inputs"
        state={report.resources.valuationInputs}
      />

      <section aria-label="Captured daily source plan and outcomes">
        <h2>Daily source plan and outcomes</h2>

        <p>
          Review state: {report.daily.phase}. Selected sources:{" "}
          {report.daily.plan?.names.join(", ") || "No source plan prepared"}.
        </p>

        <ol>
          {report.daily.outcomes.map((outcome, index) => (
            <li key={index}>
              {outcome.member.listing.symbol} |{" "}
              {outcome.member.listing.shareClassName} | {outcome.source}:{" "}
              {outcome.disposition} / {outcome.status}
            </li>
          ))}
        </ol>
      </section>

      <ol aria-label="All chosen daily review companies">
        {report.rows.map((row, index) => (
          <li
            key={row.evidence.member.listing.listingId}
            data-daily-report-listing={row.evidence.member.listing.listingId}
          >
            <section aria-label={`Captured company ${index + 1}`}>
              <h2>
                {row.evidence.member.listing.symbol} |{" "}
                {row.evidence.member.listing.shareClassName}
              </h2>

              <h3>Authored Watchlist note</h3>

              <p>
                {row.watchlist.status}: {row.watchlist.reason}
              </p>

              <pre>
                {row.watchlist.value?.note ??
                  "No current authored note available for this exact listing."}
              </pre>

              <h3>Authored check</h3>

              <p>
                {row.check.status}: {row.check.reason}
              </p>

              {row.check.value ? (
                <>
                  <pre>{row.check.value.check}</pre>
                  <p>
                    Due (UTC): {row.check.value.dueOn}. Status:{" "}
                    {row.check.value.status}.
                  </p>
                  <pre>
                    {row.check.value.result || "No authored assessment."}
                  </pre>
                </>
              ) : (
                <p>
                  No captured check for this exact listing. Unloaded, absent and
                  unavailable states remain distinct above.
                </p>
              )}

              <ManagedWatchlistDailyReviewEvidence row={row.evidence} offline />

              <Scenario report={report} index={index} />
            </section>
          </li>
        ))}
      </ol>

      <details>
        <summary>Complete daily review payload (JSON)</summary>
        <pre data-watchlist-daily-report-payload="true">
          {JSON.stringify(report)}
        </pre>
      </details>
    </article>
  );
}
