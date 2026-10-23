import type { CompanyReportRevisitProps } from "./company-report-revisit-capture";
import { projectCurrentCompanyReport } from "./managed-company-report-archive";
import {
  useCompanyReportRevisit,
  useCompanyReportRevisitFocus,
} from "./use-company-report-revisit";
import {
  reportFileActions,
  reopenedReport,
} from "./CompanyReportRevisitPanels";

export function ManagedCompanyReportRevisit(props: CompanyReportRevisitProps) {
  const controls = useCompanyReportRevisit(props);
  const { controller, state } = controls;
  const focus = useCompanyReportRevisitFocus(state.phase);
  const current = state.current
    ? projectCurrentCompanyReport(state.current)
    : null;
  const canCompare = controller?.comparisonIsCurrent() === true;
  return (
    <details
      className="managed-report-revisit"
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
      {reportFileActions(controls, focus)}
      {state.message && <p role="status">{state.message}</p>}
      {reopenedReport(controls, focus, current, canCompare)}
    </details>
  );
}
