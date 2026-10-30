import type { ChangeEvent } from "react";
import type { CompanyReportRevisitSnapshot } from "./managed-company-report-archive";
import type {
  CompanyReportRevisitControls,
  CompanyReportRevisitFocus,
} from "./use-company-report-revisit";
import { CompanyReportRevisitSnapshotView } from "./CompanyReportRevisitSnapshot";

type Controls = CompanyReportRevisitControls;
function selectReportFile(
  event: ChangeEvent<HTMLInputElement>,
  controls: Controls,
) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (file)
    controls.act(() => {
      void controls.controller?.readFile(file);
    });
}
function fileInputDisabled(controls: Controls) {
  if (!controls.controller) return true;
  return controls.state.phase === "reading";
}
function reportFileInput(controls: Controls, focus: CompanyReportRevisitFocus) {
  return (
    <label className="managed-draft-file-input">
      Select a company report file
      <input
        ref={focus.input}
        type="file"
        accept="application/json,.json"
        disabled={fileInputDisabled(controls)}
        onChange={(event) => selectReportFile(event, controls)}
      />
    </label>
  );
}
function clearReportAction(
  controls: Controls,
  focus: CompanyReportRevisitFocus,
) {
  if (!controls.state.archive && controls.state.phase !== "reading")
    return null;
  return (
    <button
      type="button"
      className="trial-secondary"
      onClick={() =>
        controls.act(() => {
          controls.controller?.clear();
          focus.input.current?.focus();
        })
      }
    >
      {controls.state.phase === "reading"
        ? "Cancel report read"
        : "Clear reopened report"}
    </button>
  );
}
/** Pure render functions keep control callbacks owned by the parent hook frame. */
export function reportFileActions(
  controls: Controls,
  focus: CompanyReportRevisitFocus,
) {
  return (
    <>
      {reportFileInput(controls, focus)}
      {clearReportAction(controls, focus)}
    </>
  );
}
function unverifiedAppendix(value: string) {
  return (
    <details className="managed-report-document">
      <summary>Unverified file appendix</summary>
      <p>
        File-reported derived Annual views, Price studies and valuation fields.
        These values are not admitted financial inputs, current eligibility or
        verified calculations.
      </p>
      <label>
        Complete unverified appendix
        <textarea readOnly spellCheck={false} value={value} rows={10} />
      </label>
    </details>
  );
}
function assessmentInput(controls: Controls) {
  return (
    <label>
      Your comparison assessment
      <textarea
        id="managed-report-revisit-assessment"
        value={controls.state.assessment}
        onChange={(event) => {
          const value = event.currentTarget.value;
          controls.act(() => controls.controller?.setAssessment(value));
        }}
        rows={4}
      />
    </label>
  );
}
function wholeNotePreview(controls: Controls) {
  if (!controls.state.preview) return null;
  return (
    <section aria-label="Complete comparison note preview">
      <h4>Complete Watchlist note preview</h4>
      <p className="managed-company-report-note">
        {controls.state.preview.note}
      </p>
      <button
        type="button"
        className="trial-secondary"
        onClick={() =>
          controls.act(() => {
            controls.controller?.append();
          })
        }
      >
        Append comparison to note draft
      </button>
    </section>
  );
}
function currentComparison(
  current: CompanyReportRevisitSnapshot | null,
  controls: Controls,
  canCompare: boolean,
) {
  if (!current) return null;
  if (!canCompare) return null;
  return (
    <>
      <CompanyReportRevisitSnapshotView
        snapshot={current}
        title="Current report capture"
      />
      {assessmentInput(controls)}
      <p>
        Write your own assessment. The complete note must fit the existing
        2,000-character single-line Watchlist limit. Nothing is clipped.
      </p>
      <button
        type="button"
        className="trial-secondary"
        onClick={() => controls.act(() => controls.controller?.prepareNote())}
      >
        Preview comparison note
      </button>
      {wholeNotePreview(controls)}
    </>
  );
}
export function reopenedReport(
  controls: Controls,
  focus: CompanyReportRevisitFocus,
  current: CompanyReportRevisitSnapshot | null,
  canCompare: boolean,
) {
  const archive = controls.state.archive;
  if (!archive) return null;
  return (
    <section aria-labelledby="managed-report-revisit-heading">
      <h3 id="managed-report-revisit-heading" ref={focus.heading} tabIndex={-1}>
        Reopened report · {archive.listing.symbol}
      </h3>
      <p>
        File contents and authored claims remain unverified. Matching identity
        and valid source structure do not prove file authenticity. Report
        preparation does not renew source dates. Source provenance is compared
        without financial deltas or an investment verdict.
      </p>
      <CompanyReportRevisitSnapshotView
        snapshot={archive}
        title="Archived report"
      />
      {unverifiedAppendix(archive.unverifiedAppendix)}
      <button
        type="button"
        className="trial-secondary"
        onClick={() =>
          controls.act(() => controls.controller?.captureCurrent())
        }
      >
        Capture current report for comparison
      </button>
      {currentComparison(current, controls, canCompare)}
    </section>
  );
}
