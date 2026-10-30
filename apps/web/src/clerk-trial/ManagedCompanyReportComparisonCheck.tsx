import type { CompanyReportRevisit } from "./company-report-revisit";
import type { CompanyReportComparisonCheckActions } from "./company-report-comparison-check-actions";
import { useCompanyReportComparisonCheck } from "./use-company-report-comparison-check";
import "./managed-company-report-comparison-check.css";

export function ManagedCompanyReportComparisonCheck({
  controller,
  actions,
}: {
  controller: CompanyReportRevisit;
  actions: CompanyReportComparisonCheckActions;
}) {
  const controls = useCompanyReportComparisonCheck(controller, actions);
  const { target, preview, message } = controls;
  return (
    <section
      id="managed-report-comparison-check"
      className="managed-report-comparison-check"
      aria-labelledby="managed-report-comparison-check-heading"
    >
      <h4
        id="managed-report-comparison-check-heading"
        ref={controls.targetHeading}
        tabIndex={-1}
      >
        Comparison for your research check
      </h4>
      {!target ? (
        <p>
          Open this company from Follow-ups, or use an existing check in Your
          research for this company.
        </p>
      ) : (
        <>
          <p>
            {target.entry.listing.symbol} · {target.entry.listing.issuerName} ·{" "}
            {target.entry.listing.securityName} ·{" "}
            {target.entry.listing.shareClassName} ·{" "}
            {target.entry.listing.exchangeMic}, {target.entry.listing.country}
          </p>
          <p>Check ID: {target.entry.id}</p>
          <p>Catalog: {target.entry.catalogSnapshotSha256}</p>
          <h5>Destination question</h5>
          <p
            id="managed-report-comparison-check-question"
            className="managed-report-comparison-raw"
          >
            {target.entry.check}
          </p>
          <p>
            Due date (UTC): {target.entry.dueOn}.{" "}
            {target.entry.status === "completed"
              ? `Completed for ${target.entry.completedOn}.`
              : "Open check."}
          </p>
          <h5>Current assessment draft</h5>
          <p
            id="managed-report-comparison-check-current-result"
            className="managed-report-comparison-raw"
          >
            {target.entry.result === ""
              ? "The current assessment is empty."
              : target.entry.result}
          </p>
          <p>
            {target.dirty ? "Follow-ups has unsaved changes. " : ""}Use your
            comparison assessment above. Review the complete result before
            applying it to this exact check. The result must fit 2,000 Unicode
            characters on one line; nothing is clipped.
          </p>
          <button
            id="managed-report-comparison-check-prepare"
            type="button"
            className="trial-secondary"
            ref={controls.prepareButton}
            disabled={!target.editable || !target.isCurrent()}
            onClick={controls.prepare}
          >
            Preview comparison for check
          </button>
          {target.reason && <p role="status">{target.reason}</p>}
        </>
      )}
      {preview && (
        <section aria-labelledby="managed-report-comparison-check-preview">
          <h5
            id="managed-report-comparison-check-preview"
            ref={controls.previewHeading}
            tabIndex={-1}
          >
            Complete check assessment preview
          </h5>
          <label htmlFor="managed-report-comparison-check-result">
            Complete existing assessment and comparison
          </label>
          <textarea
            id="managed-report-comparison-check-result"
            readOnly
            rows={12}
            value={preview.result}
          />
          <p>{Array.from(preview.result).length} / 2,000 Unicode characters</p>
          <h5>Comparison reference and authored assessment</h5>
          <p className="managed-report-comparison-raw">{preview.excerpt}</p>
          <div className="trial-actions">
            <button
              id="managed-report-comparison-check-apply"
              type="button"
              onClick={controls.apply}
            >
              Apply to check
            </button>
            <button
              id="managed-report-comparison-check-cancel"
              type="button"
              className="trial-secondary"
              onClick={controls.cancel}
            >
              Cancel check preview
            </button>
          </div>
        </section>
      )}
      {message && (
        <p
          id="managed-report-comparison-check-status"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
      <p>
        Apply changes only this check's assessment draft. Use Review follow-ups
        or Back, then complete and Save follow-ups separately. The Watchlist
        note action stays separate.
      </p>
    </section>
  );
}
