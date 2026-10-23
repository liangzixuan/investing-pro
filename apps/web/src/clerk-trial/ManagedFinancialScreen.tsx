import { useId, useState, useSyncExternalStore } from "react";
import {
  MANAGED_FINANCIAL_SCREEN_FIELDS,
  compareManagedFinancialScreenRows,
  type ManagedFinancialScreenCriteria,
  type ManagedFinancialScreenField,
  type ManagedFinancialScreenMetric,
} from "./managed-financial-screen-results";
import type {
  ManagedFinancialScreen as ScreenModel,
  ManagedFinancialScreenReportCapture,
  ManagedFinancialScreenResultRow,
} from "./managed-financial-screen";
import "./managed-financial-screen.css";
import { ManagedFinancialScreenComparison } from "./ManagedFinancialScreenComparison";
import { ManagedFinancialScreenRecipes } from "./ManagedFinancialScreenRecipes";
import type { ManagedFinancialScreenRecipeDeliveryAdapter } from "./financial-screen-recipe-delivery";
import {
  AnnualStatementObservation,
  AnnualStatementsContext,
} from "./ManagedAnnualStatements";

type Draft = {
  clauses: {
    field: ManagedFinancialScreenField;
    operator: "gte" | "lte";
    value: string;
  }[];
  sort: {
    field: "symbol" | ManagedFinancialScreenField;
    direction: "asc" | "desc";
  };
};
const copyCriteria = (criteria: ManagedFinancialScreenCriteria): Draft => ({
  clauses: criteria.clauses.map((clause) => ({ ...clause })),
  sort: { ...criteria.sort },
});

export function ManagedFinancialScreen({
  model,
  onOpenReport,
  recipeDelivery,
  recipesRouteActive,
}: {
  model: ScreenModel;
  recipeDelivery?: ManagedFinancialScreenRecipeDeliveryAdapter;
  recipesRouteActive?: () => boolean;
  onOpenReport: (
    capture: ManagedFinancialScreenReportCapture,
    opener: HTMLButtonElement,
  ) => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const id = useId();
  const [form, setForm] = useState({
    owner: model,
    draft: copyCriteria(state.criteria),
  });
  const [notice, setNotice] = useState("");
  if (form.owner !== model) {
    setForm({ owner: model, draft: copyCriteria(state.criteria) });
    setNotice("");
  }
  const draft =
    form.owner === model ? form.draft : copyCriteria(state.criteria);
  const edit = (next: Draft) => {
    model.stageCriteria(state);
    setForm({ owner: model, draft: next });
    setNotice("");
  };
  const busy = state.pending !== null;
  const disabled = !state.active || !state.canRead;
  const run = state.run;
  const rows = [...(run?.rows ?? [])].sort((left, right) => {
    if (left.evaluation && right.evaluation && run)
      return compareManagedFinancialScreenRows(
        left.evaluation,
        right.evaluation,
        run.criteria.sort,
      );
    if (left.evaluation !== right.evaluation) return left.evaluation ? -1 : 1;
    return left.member.listing.symbol.localeCompare(
      right.member.listing.symbol,
      "en",
    );
  });
  return (
    <section
      className="managed-financial-screen"
      aria-labelledby={id + "-heading"}
    >
      <h3 id={id + "-heading"}>Annual financial screen</h3>
      <p>
        Screen a named cohort of 18 listings for 17 issuers. This is not a
        whole-market universe. Each company keeps its own filing dates, missing
        fields and original source times.
      </p>
      <button
        type="button"
        className="trial-secondary"
        disabled={disabled || busy}
        onClick={() => void model.loadUniverse(state)}
      >
        Load screening cohort
      </button>
      {state.memberships.length > 0 && (
        <fieldset disabled={disabled || busy}>
          <legend>Companies for the next run</legend>
          <p>
            Choose one listing per issuer. Source reads start only when you
            select Run screen. Allow at least 20 seconds between companies; 17
            companies take at least 5 minutes and 20 seconds between the first
            and last start.
          </p>
          <div className="managed-screen-cohort">
            {state.memberships.map((member) => (
              <label key={member.listing.listingId}>
                <input
                  type="checkbox"
                  disabled={!model.hasCoverage(member)}
                  checked={state.selected.includes(member)}
                  onChange={(event) =>
                    model.select(state, member, event.target.checked)
                  }
                />
                <span>
                  {member.listing.symbol} · {member.listing.exchangeMic}
                  <small>{member.listing.issuerName}</small>
                  {!model.hasCoverage(member) && (
                    <small>Annual is not available for this listing.</small>
                  )}
                </span>
              </label>
            ))}
          </div>
          <p>
            {state.selected.length} companies selected. AEM is outside this
            Annual cohort; its current 40-F is not supported.
          </p>
        </fieldset>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          model.setCriteria(state, draft);
          if (model.getSnapshot().criteriaStaged)
            setNotice(
              "Enter valid decimal thresholds in at most seven criteria, then apply them.",
            );
          else
            setNotice(
              "Criteria applied. Run explicitly to load the selected companies.",
            );
        }}
      >
        <fieldset disabled={disabled}>
          <legend>Criteria for the next run</legend>
          <p>
            All criteria must pass. Unknown means required evidence is
            unavailable or not eligible for current use. A known failed
            criterion makes a nonmatch. USD amounts are exact reported amounts;
            the current ratio uses the existing rounded result.
          </p>
          {draft.clauses.map((clause, index) => (
            <div className="managed-screen-clause" key={index}>
              <label>
                Field
                <select
                  value={clause.field}
                  onChange={(event) =>
                    edit({
                      ...draft,
                      clauses: draft.clauses.map((value, at) =>
                        at === index
                          ? {
                              ...value,
                              field: event.target
                                .value as ManagedFinancialScreenField,
                            }
                          : value,
                      ),
                    })
                  }
                >
                  {MANAGED_FINANCIAL_SCREEN_FIELDS.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label} ({field.unit})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Comparison
                <select
                  value={clause.operator}
                  onChange={(event) =>
                    edit({
                      ...draft,
                      clauses: draft.clauses.map((value, at) =>
                        at === index
                          ? {
                              ...value,
                              operator: event.target.value as "gte" | "lte",
                            }
                          : value,
                      ),
                    })
                  }
                >
                  <option value="gte">At least</option>
                  <option value="lte">At most</option>
                </select>
              </label>
              <label>
                Threshold
                <input
                  type="text"
                  inputMode="decimal"
                  maxLength={64}
                  value={clause.value}
                  onChange={(event) =>
                    edit({
                      ...draft,
                      clauses: draft.clauses.map((value, at) =>
                        at === index
                          ? { ...value, value: event.target.value }
                          : value,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="trial-secondary"
                onClick={() =>
                  edit({
                    ...draft,
                    clauses: draft.clauses.filter((_, at) => at !== index),
                  })
                }
              >
                Remove criterion {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="trial-secondary"
            disabled={draft.clauses.length >= 7}
            onClick={() =>
              edit({
                ...draft,
                clauses: [
                  ...draft.clauses,
                  { field: "operatingCashFlow", operator: "gte", value: "0" },
                ],
              })
            }
          >
            Add criterion
          </button>
          <div className="managed-screen-sort">
            <label>
              Sort by
              <select
                value={draft.sort.field}
                onChange={(event) =>
                  edit({
                    ...draft,
                    sort: {
                      ...draft.sort,
                      field: event.target.value as Draft["sort"]["field"],
                    },
                  })
                }
              >
                <option value="symbol">Symbol</option>
                {MANAGED_FINANCIAL_SCREEN_FIELDS.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Order
              <select
                value={draft.sort.direction}
                onChange={(event) =>
                  edit({
                    ...draft,
                    sort: {
                      ...draft.sort,
                      direction: event.target.value as "asc" | "desc",
                    },
                  })
                }
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
          <button type="submit" className="trial-secondary">
            Apply criteria
          </button>
        </fieldset>
      </form>
      {notice && <p role="status">{notice}</p>}
      {state.criteriaStaged && (
        <p>
          Criteria have unapplied edits. Existing results keep their original
          run criteria.
        </p>
      )}
      <ManagedFinancialScreenRecipes
        model={model}
        {...(recipeDelivery ? { delivery: recipeDelivery } : {})}
        {...(recipesRouteActive ? { routeActive: recipesRouteActive } : {})}
        onApplied={() => {
          const current = model.getSnapshot();
          if (!current.criteriaStaged) {
            setForm({ owner: model, draft: copyCriteria(current.criteria) });
            setNotice("");
          }
        }}
      />
      <div className="trial-actions">
        <button
          type="button"
          disabled={
            disabled ||
            busy ||
            state.criteriaStaged ||
            state.selected.length === 0
          }
          onClick={() => void model.run(state)}
        >
          Run screen ({state.selected.length} companies)
        </button>
        {state.pending && (
          <button
            type="button"
            className="trial-secondary"
            onClick={state.pending.cancel}
          >
            Cancel screen
          </button>
        )}
      </div>
      <p role={state.error ? "alert" : "status"} aria-live="polite">
        {state.message}
      </p>
      {run && (
        <>
          <h4>Screen results</h4>
          <p>
            Started {run.startedAt}.{" "}
            {run.completedAt
              ? `Finished ${run.completedAt}.`
              : "Run in progress."}{" "}
            Status: {run.status}.{" "}
            {
              rows.filter(
                (row) => !row.failure && row.evaluation?.match === "match",
              ).length
            }{" "}
            matches,{" "}
            {
              rows.filter(
                (row) => !row.failure && row.evaluation?.match === "nonmatch",
              ).length
            }{" "}
            nonmatches,{" "}
            {
              rows.filter(
                (row) => !row.failure && row.evaluation?.match === "unknown",
              ).length
            }{" "}
            unknown, {rows.filter((row) => row.failure !== null).length} failed
            or incomplete reads,{" "}
            {
              rows.filter((row) => row.report === null && row.failure === null)
                .length
            }{" "}
            not loaded. {state.shortlist.length} shortlisted.
          </p>
          <details>
            <summary>Criteria used for these results</summary>
            <p>
              Sort: {run.criteria.sort.field}, {run.criteria.sort.direction}.
            </p>
            {run.criteria.clauses.length ? (
              <ul>
                {run.criteria.clauses.map((clause, index) => (
                  <li key={index}>
                    {
                      MANAGED_FINANCIAL_SCREEN_FIELDS.find(
                        (field) => field.key === clause.field,
                      )?.label
                    }{" "}
                    {clause.operator === "gte" ? "at least" : "at most"}{" "}
                    {clause.value}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No numerical criteria; every successfully admitted company is
                included.
              </p>
            )}
          </details>
          <div
            className="managed-screen-table"
            role="region"
            aria-label="Financial screen results table"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Company and research</th>
                  <th scope="col">Result</th>
                  {MANAGED_FINANCIAL_SCREEN_FIELDS.map((field) => (
                    <th scope="col" key={field.key}>
                      {field.label} ({field.unit})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const response = row.report?.response;
                  const capture = response ? { run, row, response } : null;
                  const actionable =
                    capture && !disabled && model.canAdmitReport(capture);
                  return (
                    <tr key={row.member.listing.listingId}>
                      <th scope="row">
                        {row.member.listing.symbol}
                        <small>{row.member.listing.issuerName}</small>
                        <label>
                          <input
                            type="checkbox"
                            checked={state.shortlist.includes(row)}
                            disabled={!actionable}
                            onChange={() => model.toggleShortlist(state, row)}
                          />
                          Shortlist {row.member.listing.symbol}
                        </label>
                        <button
                          type="button"
                          className="trial-secondary"
                          disabled={!actionable}
                          onClick={(event) => {
                            if (capture)
                              onOpenReport(capture, event.currentTarget);
                          }}
                        >
                          Research {row.member.listing.symbol}
                        </button>
                        <div className="managed-screen-compare-actions">
                          {(["left", "right"] as const).map((side) => (
                            <button
                              key={side}
                              type="button"
                              className="trial-secondary"
                              aria-pressed={state.comparison[side] === row}
                              disabled={
                                !actionable ||
                                state.comparison[
                                  side === "left" ? "right" : "left"
                                ] === row
                              }
                              onClick={() =>
                                model.selectComparison(state, side, row)
                              }
                            >
                              Compare {side} {row.member.listing.symbol}
                            </button>
                          ))}
                        </div>
                        <Evidence row={row} />
                      </th>
                      <td>
                        {row.failure
                          ? "Read failed or incomplete"
                          : (row.evaluation?.match ??
                            (state.pending?.member === row.member
                              ? "Waiting or loading"
                              : "Not loaded"))}
                        {row.failure && <p>{row.failure}</p>}
                      </td>
                      {MANAGED_FINANCIAL_SCREEN_FIELDS.map((field) => (
                        <td key={field.key}>
                          {row.evaluation ? (
                            <Metric
                              metric={row.evaluation.metrics[field.key]}
                            />
                          ) : (
                            "Unavailable"
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>
            Available numeric values sort before unknown values in either
            direction. Missing fields are not zero. This screen is descriptive
            research and does not give a buy, sell or financial-health verdict.
            Shortlist choices stay in this session and do not save a watchlist.
          </p>
        </>
      )}
      <ManagedFinancialScreenComparison
        model={model}
        state={state}
        onOpenReport={onOpenReport}
      />
    </section>
  );
}

function Metric({ metric }: { metric: ManagedFinancialScreenMetric }) {
  if (metric.status === "unavailable")
    return <span>Unknown: {metric.reason.replaceAll("_", " ")}</span>;
  return (
    <span>
      {metric.value}
      <small>
        {"asOfDate" in metric
          ? `As of ${metric.asOfDate}`
          : `${metric.startDate} to ${metric.endDate}`}
      </small>
      {!metric.currentUseEligible && (
        <small>Historical evidence; excluded from current filters.</small>
      )}
    </span>
  );
}

function Evidence({ row }: { row: ManagedFinancialScreenResultRow }) {
  const response = row.report?.response;
  if (!response) return null;
  const { evidence } = response;
  return (
    <details className="managed-screen-evidence">
      <summary>Inspect {row.member.listing.symbol} evidence</summary>
      <p>
        CIK {response.security.cik}. Original load cutoff{" "}
        {evidence.generation.cutoffAt}; completed{" "}
        {evidence.generation.completedAt}. Generation{" "}
        {evidence.generation.sha256}.
      </p>
      {row.report?.view && (
        <AnnualStatementsContext
          evidence={evidence}
          statements={row.report.view.statements}
          presentation="report"
        />
      )}
      {row.evaluation &&
        MANAGED_FINANCIAL_SCREEN_FIELDS.map((field) => {
          const metric = row.evaluation!.metrics[field.key];
          return (
            <details key={field.key}>
              <summary>{field.label} source</summary>
              <Metric metric={metric} />
              {metric.observationIds.map((reference) => {
                const observation = evidence.facts.observations.find(
                  (item) => item.id === reference,
                );
                return observation ? (
                  <AnnualStatementObservation
                    key={reference}
                    observation={observation}
                  />
                ) : null;
              })}
            </details>
          );
        })}
    </details>
  );
}
