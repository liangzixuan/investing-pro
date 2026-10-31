import {
  isPreparedPortfolioComparisonReport,
  type PreparedPortfolioComparisonReport,
} from "./portfolio-comparison-report";
import { PortfolioReportComparisonRows } from "./PortfolioReportComparisonRows";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";

/** One passive complete view for the captured preview and private HTML file. */
export function PortfolioComparisonReportSnapshot({
  report,
}: {
  readonly report: PreparedPortfolioComparisonReport;
}) {
  if (!isPreparedPortfolioComparisonReport(report)) return null;
  return (
    <article aria-label="Captured Portfolio saved/current comparison">
      <h2>Portfolio saved/current comparison</h2>
      <p>
        Prepared {report.preparedAt}. Private reading copy of two complete
        reports and their full listing comparison. Preparation does not renew
        any source or capture time.
      </p>
      <p>
        The saved file is unverified private evidence. This report does not
        establish authenticity, source freshness or an online saved Portfolio
        version. It is not an importable draft.
      </p>
      <dl>
        <dt>Saved filename</dt>
        <dd>{report.savedFilename}</dd>
      </dl>
      <p>
        Each side keeps its own dates and qualifications. Absent holdings and
        unavailable values remain distinct. No returns, profit or loss, or
        differences in value are calculated.
      </p>
      <section aria-label="Complete listing comparison">
        <h3>Every listing in either report</h3>
        <PortfolioReportComparisonRows comparison={report.comparison} />
      </section>
      <section aria-label="Complete saved report: unverified private evidence">
        <h3>Saved report: unverified private evidence</h3>
        <PortfolioReviewReportSnapshot
          report={report.comparison.saved}
          compositionId="portfolio-comparison-report-saved-composition"
        />
      </section>
      <section aria-label="Complete current captured report">
        <h3>Current captured report</h3>
        <PortfolioReviewReportSnapshot
          report={report.comparison.current}
          compositionId="portfolio-comparison-report-current-composition"
        />
      </section>
      <details>
        <summary>
          Complete comparison document and original source packets
        </summary>
        <pre data-portfolio-comparison-document="1">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </article>
  );
}
