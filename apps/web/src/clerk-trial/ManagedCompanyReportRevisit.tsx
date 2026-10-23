import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ResearchWatchlistState } from "./managed-workspace";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import type { CompanyEvidenceModels } from "./useCompanySnapshotEvidence";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import {
  companyReportBlock,
  prepareCompanyReport,
} from "./managed-company-report";
import {
  projectCurrentCompanyReport,
  type CompanyReportRevisitSnapshot,
} from "./managed-company-report-archive";
import {
  CompanyReportRevisit,
  type CompanyReportRevisitState,
  type CompanyReportRevisitTarget,
} from "./company-report-revisit";
import { identityLabels } from "./ManagedListingIdentity";

interface Props extends CompanyEvidenceModels {
  valuation?: ManagedValuationWorkbench;
  readWatchlist: (
    selection: ManagedResearchSelection,
  ) => ResearchWatchlistState;
  target: () => CompanyReportRevisitTarget | null;
}
const empty: CompanyReportRevisitState = {
  phase: "idle",
  archive: null,
  current: null,
  assessment: "",
  preview: null,
  message: "",
};
const emptySnapshot = () => empty;
const noop = () => () => {};

/** Capture live models without starting a read, calculation, storage or source operation. */
function capture(props: Props) {
  const target = props.target();
  if (!target?.isCurrent()) return null;
  const price = props.price.getSnapshot();
  const annual = props.annual.getSnapshot();
  const filings = props.filings.getSnapshot();
  const valuation = props.valuation?.getSnapshot();
  const watchlist = props.readWatchlist(props.selection);
  const evidence = companySnapshotEvidence(
    props.selection,
    price,
    annual,
    filings,
  );
  const calculation = valuation?.calculation ?? null;
  return {
    report: prepareCompanyReport(
      props.selection,
      evidence,
      watchlist,
      undefined,
      calculation,
    ),
    reason: companyReportBlock(
      props.selection,
      evidence,
      watchlist,
      calculation,
    ),
    isCurrent: () =>
      target.isCurrent() &&
      props.price.getSnapshot() === price &&
      props.annual.getSnapshot() === annual &&
      props.filings.getSnapshot() === filings &&
      props.valuation?.getSnapshot() === valuation,
    append: target.append,
  };
}

function useRevisit(props: Props) {
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const [controller, setController] = useState<CompanyReportRevisit | null>(
    null,
  );
  const { selection, price, annual, filings, valuation } = props;
  useLayoutEffect(() => {
    const next = new CompanyReportRevisit({
      selection,
      active: () =>
        latest.current.selection === selection &&
        latest.current.target()?.isCurrent() === true,
      capture: () => capture(latest.current),
    });
    setController(next);
    return () => next.dispose();
  }, [selection, price, annual, filings, valuation]);
  useLayoutEffect(() => controller?.reconcile());
  const state = useSyncExternalStore(
    controller?.subscribe ?? noop,
    controller?.getSnapshot ?? emptySnapshot,
    controller?.getSnapshot ?? emptySnapshot,
  );
  // Old handlers cannot act after another render, local edit, append or unmount.
  const frame = {};
  const committed = useRef<object | null>(null);
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      committed.current = null;
    };
  });
  const act = (action: () => void) => {
    if (committed.current !== frame || !controller) return;
    committed.current = null;
    action();
  };
  return { controller, state, act };
}

export function CompanyReportRevisitSnapshotView({
  snapshot,
  title,
}: {
  snapshot: CompanyReportRevisitSnapshot;
  title: string;
}) {
  return (
    <section aria-label={title}>
      <h4>{title}</h4>
      <dl className="managed-metadata">
        <div>
          <dt>Report preparation time</dt>
          <dd>{snapshot.preparedAt}</dd>
        </div>
        <div>
          <dt>Catalog snapshot SHA-256</dt>
          <dd>{snapshot.catalogSnapshotSha256}</dd>
        </div>
        <div>
          <dt>CIK</dt>
          <dd>{snapshot.selectionCik ?? "Not supplied"}</dd>
        </div>
        {(Object.keys(identityLabels) as (keyof typeof identityLabels)[]).map(
          (key) => (
            <div key={key}>
              <dt>{identityLabels[key]}</dt>
              <dd>{snapshot.listing[key]}</dd>
            </div>
          ),
        )}
      </dl>
      <h5>Whole authored Watchlist note</h5>
      <p className="managed-company-report-note">
        {snapshot.note === null
          ? "This company was outside the Watchlist at capture."
          : snapshot.note === ""
            ? "The Watchlist note was empty at capture."
            : snapshot.note}
      </p>
      {snapshot.sources.map((source) => (
        <section
          key={source.source}
          aria-label={`${title} ${source.source} provenance`}
        >
          <h5>
            {source.source === "price"
              ? "Price"
              : source.source === "annual"
                ? "Annual"
                : "Filings"}{" "}
            source provenance
          </h5>
          <p>
            {source.status === "loaded"
              ? "Loaded in this capture."
              : "Not loaded in this capture."}{" "}
            {source.retainedPrevious ? "Retained previous response. " : ""}
            {source.lastAttemptFailed ? "Last attempt failed." : ""}
          </p>
          {source.responseOrigin && (
            <p>Original response origin: {source.responseOrigin}</p>
          )}
          <dl className="managed-metadata">
            {source.fields.map((field, index) => (
              <div key={index}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
          {source.references.length > 0 && (
            <ul>
              {source.references.map((reference, index) => (
                <li key={index}>
                  {reference.label}: {reference.url}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </section>
  );
}

export function ManagedCompanyReportRevisit(props: Props) {
  const { controller, state, act } = useRevisit(props);
  const input = useRef<HTMLInputElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previous = useRef(state.phase);
  useLayoutEffect(() => {
    if (
      previous.current === "reading" &&
      state.phase === "review" &&
      document.activeElement === input.current
    )
      heading.current?.focus();
    previous.current = state.phase;
  }, [state.phase]);
  const current = state.current
    ? projectCurrentCompanyReport(state.current)
    : null;
  const canCompare = controller?.comparisonIsCurrent() === true;
  return (
    <details
      className="managed-report-document managed-report-revisit"
      onToggle={(event) => {
        if (!event.currentTarget.open) controller?.clear();
      }}
    >
      <summary>Revisit a saved report</summary>
      <p>
        Select a format 5 JSON report for this exact company. Compare its full
        note and original source provenance with a new current capture. Files
        stay in this company visit. Opening a report makes no source request or
        saved change.
      </p>
      <label className="managed-draft-file-input">
        Select a company report file
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          disabled={!controller || state.phase === "reading"}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file)
              act(() => {
                void controller?.readFile(file);
              });
          }}
        />
      </label>
      {(state.archive || state.phase === "reading") && (
        <button
          type="button"
          className="trial-secondary"
          onClick={() =>
            act(() => {
              controller?.clear();
              input.current?.focus();
            })
          }
        >
          {state.phase === "reading"
            ? "Cancel report read"
            : "Clear reopened report"}
        </button>
      )}
      {state.message && <p role="status">{state.message}</p>}
      {state.archive && (
        <section aria-labelledby="managed-report-revisit-heading">
          <h3 id="managed-report-revisit-heading" ref={heading} tabIndex={-1}>
            Reopened report · {state.archive.listing.symbol}
          </h3>
          <p>
            File contents and authored claims remain unverified. Matching
            identity and valid source structure do not prove file authenticity.
            Report preparation does not renew source dates. Source provenance is
            compared without financial deltas or an investment verdict.
          </p>
          <CompanyReportRevisitSnapshotView
            snapshot={state.archive}
            title="Archived report"
          />
          <details className="managed-report-document">
            <summary>Unverified file appendix</summary>
            <p>
              File-reported derived Annual views, Price studies and valuation
              fields. These values are not admitted financial inputs, current
              eligibility or verified calculations.
            </p>
            <label>
              Complete unverified appendix
              <textarea
                readOnly
                spellCheck={false}
                value={state.archive.unverifiedAppendix}
                rows={10}
              />
            </label>
          </details>
          <button
            type="button"
            className="trial-secondary"
            onClick={() => act(() => controller?.captureCurrent())}
          >
            Capture current report for comparison
          </button>
          {current && canCompare && (
            <>
              <CompanyReportRevisitSnapshotView
                snapshot={current}
                title="Current report capture"
              />
              <label>
                Your comparison assessment
                <textarea
                  value={state.assessment}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    act(() => controller?.setAssessment(value));
                  }}
                  rows={4}
                />
              </label>
              <p>
                Write your own assessment. The complete note must fit the
                existing 2,000-character single-line Watchlist limit. Nothing is
                clipped.
              </p>
              <button
                type="button"
                className="trial-secondary"
                onClick={() => act(() => controller?.prepareNote())}
              >
                Preview comparison note
              </button>
              {state.preview && (
                <section aria-label="Complete comparison note preview">
                  <h4>Complete Watchlist note preview</h4>
                  <p className="managed-company-report-note">
                    {state.preview.note}
                  </p>
                  <button
                    type="button"
                    className="trial-secondary"
                    onClick={() =>
                      act(() => {
                        controller?.append();
                      })
                    }
                  >
                    Append comparison to note draft
                  </button>
                </section>
              )}
            </>
          )}
        </section>
      )}
    </details>
  );
}
