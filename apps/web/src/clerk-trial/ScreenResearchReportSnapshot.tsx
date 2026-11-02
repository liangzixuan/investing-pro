import {
  isPreparedScreenResearchReport,
  type PreparedScreenResearchReport,
} from "./managed-screen-research-review";
import { ScreenComparisonReportSnapshot } from "./ScreenComparisonReportSnapshot";
import {
  ManagedScreenResearchReading,
  OfflineResearchReading,
} from "./ManagedScreenResearchReading";

/** Every disclosure contains its complete data before this passive file is saved. */
export function ScreenResearchReportSnapshot({
  report,
}: {
  readonly report: PreparedScreenResearchReport;
}) {
  if (!isPreparedScreenResearchReport(report)) return null;
  return (
    <article aria-label="Complete paired company research report">
      <h1>Paired company research</h1>
      <p>
        Report prepared {report.preparedAt}. Each reading keeps its original
        capture, calculation and source times. Captured notes include authored
        drafts; this report does not establish that a thesis or other resource
        was saved.
      </p>
      <p>
        Private historical reading copy. It cannot restore inputs, rank
        companies, create a check or update an account.
      </p>
      <ScreenComparisonReportSnapshot report={report.reading.comparison} />
      <OfflineResearchReading value={true}>
        <ManagedScreenResearchReading capture={report.reading.left} />
        <ManagedScreenResearchReading capture={report.reading.right} />
      </OfflineResearchReading>
      <details>
        <summary>Complete paired research payload (JSON)</summary>
        <pre data-paired-research-payload="true">{JSON.stringify(report)}</pre>
      </details>
    </article>
  );
}
