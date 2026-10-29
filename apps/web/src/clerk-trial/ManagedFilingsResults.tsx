import {
  ManagedFilingsAssessment,
  type ManagedFilingsAssessmentActions,
} from "./ManagedFilingsAssessment";
import {
  ManagedFilingsFollowup,
  type ManagedFilingsFollowupActions,
} from "./ManagedFilingsFollowup";
import { useState } from "react";
import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";
import {
  ManagedFilingsNoteAction,
  type ManagedFilingsNoteActions,
} from "./ManagedFilingsNoteAction";
import { ManagedFilingsResultsRegion } from "./ManagedFilingsResultsRegion";
import { ManagedFilingsSource } from "./ManagedFilingsSource";
import { ManagedFilingsAnnualScope } from "./ManagedFilingsAnnualScope";
import { ManagedFilingsRefreshView } from "./ManagedFilingsRefreshView";
import type { ManagedFilingsAnnualBaseline } from "./managed-filings-annual-baseline";
import type { ManagedFilingsRefreshComparison } from "./managed-filings-refresh-comparison";
import { ManagedFilingsRefreshComparisonDetails } from "./ManagedFilingsRefreshComparisonDetails";

import {
  MANAGED_FILINGS_PAGE_SIZE,
  bindManagedFilingsFilter,
  initialManagedFilingsFilter,
  projectManagedFilingsFilter,
  selectManagedFilingsForm,
  selectManagedFilingsPage,
  selectManagedFilingsScope,
  selectManagedFilingsRefreshView,
} from "./managed-filings-filter";

export function ManagedFilingsResults({
  response,
  baseline = null,
  annualPrevious = false,
  annualFromComparison = false,
  refreshComparison = null,
  noteActions,
  followupActions,
  assessmentActions,
}: {
  response: ManagedSecFilingsResponseDto;
  baseline?: ManagedFilingsAnnualBaseline | null;
  annualPrevious?: boolean;
  annualFromComparison?: boolean;
  refreshComparison?: ManagedFilingsRefreshComparison | null;
  noteActions?: ManagedFilingsNoteActions;
  followupActions?: ManagedFilingsFollowupActions;
  assessmentActions?: ManagedFilingsAssessmentActions;
}) {
  const [filter, setFilter] = useState(() =>
    initialManagedFilingsFilter(response, baseline, refreshComparison),
  );
  const selection = bindManagedFilingsFilter(
    filter,
    response,
    baseline,
    refreshComparison,
  );
  if (selection !== filter) setFilter(selection);

  const { page } = selection;
  const view = projectManagedFilingsFilter(selection);
  const available = response.issuer.status === "available";
  const comparison = selection.refreshComparison;

  return (
    <ManagedFilingsResultsRegion
      response={response}
      baselineResponse={baseline?.response ?? null}
      refreshComparison={comparison}
    >
      <ManagedFilingsSource response={response} />
      {assessmentActions && (
        <ManagedFilingsAssessment
          response={response}
          actions={assessmentActions}
        />
      )}
      {comparison && (
        <ManagedFilingsRefreshComparisonDetails comparison={comparison} />
      )}
      <div className="managed-filings-filters">
        <div className="managed-filings-filter">
          <label htmlFor="managed-filings-form">Form</label>
          <select
            id="managed-filings-form"
            className="managed-filings-form-select"
            value={selection.form}
            aria-describedby="managed-filings-filter-help"
            onChange={(event) => {
              const form = event.currentTarget.value;
              setFilter((current) =>
                selectManagedFilingsForm(current, selection, form),
              );
            }}
          >
            <option value="">All forms</option>
            {view.forms.map((form) => (
              <option key={form} value={form}>
                {form}
              </option>
            ))}
          </select>
          <p id="managed-filings-filter-help" className="managed-filings-scope">
            {available
              ? "Filter only the filings loaded in this response."
              : "Form filtering is unavailable for this response."}
          </p>
        </div>
        <ManagedFilingsAnnualScope
          baseline={baseline}
          available={available}
          scope={selection.scope}
          previous={annualPrevious}
          fromComparison={annualFromComparison}
          fromDate={response.window.fromDate}
          throughDate={response.window.throughDate}
          onScope={(scope) =>
            setFilter((current) =>
              selectManagedFilingsScope(current, selection, scope),
            )
          }
        />
        <ManagedFilingsRefreshView
          value={selection.refreshView}
          available={comparison !== null}
          onSelect={(value) =>
            setFilter((current) =>
              selectManagedFilingsRefreshView(current, selection, value),
            )
          }
        />
      </div>
      <p className="managed-filings-filter-reset" role="status">
        {selection.resetNotice === "filings-replaced"
          ? "Filings response changed; showing All forms, all filing dates and All loaded filings from page one."
          : selection.resetNotice === "annual-baseline-changed"
            ? "Annual baseline changed; showing all filing dates from page one. Your Form and Refresh view filters are unchanged."
            : selection.resetNotice === "refresh-comparison-changed"
              ? "Loaded-list comparison changed; showing All loaded filings from page one. Your Form and Filing date filters are unchanged."
              : selection.resetNotice ===
                  "annual-and-refresh-comparison-changed"
                ? "Annual baseline and loaded-list comparison changed; showing all filing dates and All loaded filings from page one. Your Form filter is unchanged."
                : ""}
      </p>
      {noteActions && (
        <p id="managed-filings-note-scope" className="managed-filings-scope">
          Add a filing reference and its original source dates to your existing
          note draft. Nothing is saved here.
        </p>
      )}
      {available && (
        <>
          <p className="managed-filings-count" role="status">
            {view.matchingCount} of {view.loadedCount} loaded filings · Page{" "}
            {page + 1} of {view.pages}
          </p>
          {selection.refreshView === "new" && view.matchingCount === 0 && (
            <p className="managed-filings-empty">
              No newly observed filings match these filters in this loaded
              response. This does not establish that no new SEC filings exist.
            </p>
          )}
          {selection.refreshView === "all" && view.loadedCount === 0 && (
            <p className="managed-filings-empty">
              No matching filings were observed in the checked source object.
            </p>
          )}
          {selection.refreshView === "all" &&
            view.loadedCount > 0 &&
            view.matchingCount === 0 && (
              <p className="managed-filings-empty">
                {selection.scope === "after-annual"
                  ? "No later-dated filings match these filters in this loaded response. This does not establish that no subsequent filings exist."
                  : "No loaded filings match this Form filter."}
              </p>
            )}
          <FilingsList
            response={response}
            rows={view.rows}
            page={page}
            newAccessions={comparison?.newAccessions ?? []}
            {...(noteActions ? { noteActions } : {})}
            {...(followupActions ? { followupActions } : {})}
          />
        </>
      )}

      <nav className="managed-filings-pagination" aria-label="Filings pages">
        <button
          className="trial-secondary"
          aria-disabled={!available || page === 0}
          onClick={() => {
            setFilter((current) =>
              selectManagedFilingsPage(current, selection, page - 1),
            );
          }}
        >
          Previous filings page
        </button>

        <button
          className="trial-secondary"
          aria-disabled={!available || page + 1 >= view.pages}
          onClick={() => {
            setFilter((current) =>
              selectManagedFilingsPage(current, selection, page + 1),
            );
          }}
        >
          Next filings page
        </button>
      </nav>
    </ManagedFilingsResultsRegion>
  );
}

function FilingsList({
  response,
  rows,
  page,
  newAccessions,
  noteActions,
  followupActions,
}: {
  response: ManagedSecFilingsResponseDto;
  rows: ManagedSecFilingsResponseDto["issuer"]["filings"];
  page: number;
  newAccessions: readonly string[];
  noteActions?: ManagedFilingsNoteActions;
  followupActions?: ManagedFilingsFollowupActions;
}) {
  return (
    <ol
      className="managed-filings-list"
      start={page * MANAGED_FILINGS_PAGE_SIZE + 1}
    >
      {rows.map((filing) => (
        <li key={filing.accessionNumber}>
          <div>
            <a href={filing.sourceUrl} target="_blank" rel="noreferrer">
              Form {filing.form}
              <span className="managed-filings-accession">
                {filing.accessionNumber}
              </span>
            </a>
            {newAccessions.includes(filing.accessionNumber) && (
              <p
                className="managed-filings-new-observation"
                data-filings-new-accession={filing.accessionNumber}
              >
                Newly observed in this refresh
              </p>
            )}
          </div>
          <dl>
            <div>
              <dt>Filed</dt>
              <dd>{filing.filingDate}</dd>
            </div>
            <div>
              <dt>Report date</dt>
              <dd>{filing.reportDate ?? "Not reported"}</dd>
            </div>
          </dl>
          {noteActions && (
            <ManagedFilingsNoteAction
              response={response}
              filing={filing}
              actions={noteActions}
            />
          )}
          {followupActions && (
            <ManagedFilingsFollowup
              response={response}
              filing={filing}
              actions={followupActions}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
