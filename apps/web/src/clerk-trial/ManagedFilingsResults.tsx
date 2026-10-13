import { useState } from "react";
import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";
import {
  ManagedFilingsNoteAction,
  type ManagedFilingsNoteActions,
} from "./ManagedFilingsNoteAction";
import { ManagedFilingsResultsRegion } from "./ManagedFilingsResultsRegion";
import { ManagedFilingsAnnualScope } from "./ManagedFilingsAnnualScope";
import type { ManagedFilingsAnnualBaseline } from "./managed-filings-annual-baseline";

import {
  MANAGED_FILINGS_PAGE_SIZE,
  bindManagedFilingsFilter,
  initialManagedFilingsFilter,
  projectManagedFilingsFilter,
  selectManagedFilingsForm,
  selectManagedFilingsPage,
  selectManagedFilingsScope,
} from "./managed-filings-filter";

export function ManagedFilingsResults({
  response,
  baseline = null,
  annualPrevious = false,
  annualFromComparison = false,
  noteActions,
}: {
  response: ManagedSecFilingsResponseDto;
  baseline?: ManagedFilingsAnnualBaseline | null;
  annualPrevious?: boolean;
  annualFromComparison?: boolean;
  noteActions?: ManagedFilingsNoteActions;
}) {
  const [filter, setFilter] = useState(() =>
    initialManagedFilingsFilter(response, baseline),
  );
  const selection = bindManagedFilingsFilter(filter, response, baseline);
  if (selection !== filter) setFilter(selection);

  const { page } = selection;
  const view = projectManagedFilingsFilter(selection);
  const available = response.issuer.status === "available";

  return (
    <ManagedFilingsResultsRegion
      response={response}
      baselineResponse={baseline?.response ?? null}
    >
      <FilingsSource response={response} />
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
      </div>
      <p className="managed-filings-filter-reset" role="status">
        {selection.resetNotice === "filings-replaced"
          ? "Filings response changed; showing All forms and All loaded filings from page one."
          : selection.resetNotice === "annual-baseline-changed"
            ? "Annual baseline changed; showing All loaded filings from page one. Your Form filter is unchanged."
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
          {view.loadedCount === 0 && (
            <p className="managed-filings-empty">
              No matching filings were observed in the checked source object.
            </p>
          )}
          {view.loadedCount > 0 && view.matchingCount === 0 && (
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
            {...(noteActions ? { noteActions } : {})}
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
  noteActions,
}: {
  response: ManagedSecFilingsResponseDto;
  rows: ManagedSecFilingsResponseDto["issuer"]["filings"];
  page: number;
  noteActions?: ManagedFilingsNoteActions;
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
        </li>
      ))}
    </ol>
  );
}

function FilingsSource({
  response,
}: {
  response: ManagedSecFilingsResponseDto;
}) {
  const issuer = response.issuer;
  const available = issuer.status === "available";
  return (
    <>
      <p className="managed-filings-period">
        <strong>
          {response.window.fromDate} to {response.window.throughDate}
        </strong>{" "}
        · 90 days · CIK {issuer.cik}
      </p>

      <p className="managed-filings-source">
        <a href={issuer.sourceUrl} target="_blank" rel="noreferrer">
          SEC Submissions source
        </a>{" "}
        · {available ? "Retrieved" : "Checked"} {issuer.fetchedAt}
        <br />
        Request started {response.requestStartedAt} · Completed{" "}
        {response.completedAt}
      </p>

      <p className="managed-filings-scope">
        {available
          ? "Only the SEC current recent-filings object was checked."
          : "This attempt requested the SEC current recent-filings object; its contents were not successfully validated."}{" "}
        Older continuation files were not loaded; this list does not establish
        complete coverage of the 90-day window.
      </p>

      {issuer.olderHistoryAvailable && (
        <p className="managed-filings-scope">
          The source lists older continuation files.
        </p>
      )}

      {issuer.truncated && (
        <p className="managed-filings-warning">
          Showing {issuer.filings.length} of {issuer.matchingFilings} matching
          entries retained from the current source object. The response limit
          truncated this list.
        </p>
      )}
    </>
  );
}
