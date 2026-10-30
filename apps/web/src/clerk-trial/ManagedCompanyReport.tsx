import { ManagedCompanyReportRevisit } from "./ManagedCompanyReportRevisit";
import type { CompanyReportComparisonCheckActions } from "./company-report-comparison-check-actions";
import type { CompanyReportRevisitTarget } from "./company-report-revisit";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { ManagedCompanyReportDelivery } from "./ManagedCompanyReportDelivery";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { ManagedValuationResults } from "./ManagedValuationResults";
import { ManagedValuationPriceContext } from "./ManagedValuationPriceContext";
import { CapturedPriceStudies } from "./ManagedPriceStudies";
import type { ResearchWatchlistState } from "./managed-workspace";
import { CompanySnapshotEvidenceView } from "./ManagedCompanySnapshot";
import { CompanyReportDocument } from "./CompanyReportDocument";
import {
  useCompanySnapshotEvidence,
  type CompanyEvidenceModels,
} from "./useCompanySnapshotEvidence";
import {
  companyReportBlock,
  companyReportIsCurrent,
  prepareCompanyReport,
  type PreparedCompanyReport,
} from "./managed-company-report";
import "./managed-company-report.css";

export function ManagedCompanyReport({
  navigationPending,
  watchlist,
  reportDelivery,
  readReportWatchlist,
  reportRevisitTarget,
  reportComparisonCheck,
  onSection,
  valuation,
  ...models
}: CompanyEvidenceModels & {
  navigationPending: boolean;
  valuation?: ManagedValuationWorkbench;
  watchlist: ResearchWatchlistState;
  reportDelivery?: CompanyReportDeliveryAdapter;
  reportRevisitTarget?: () => CompanyReportRevisitTarget | null;
  reportComparisonCheck?: CompanyReportComparisonCheckActions;
  readReportWatchlist?: (
    selection: ManagedResearchSelection,
  ) => ResearchWatchlistState;
  onSection: (section: "eod" | "annual" | "interim" | "filings") => void;
}) {
  const evidence = useCompanySnapshotEvidence(models);
  const valuationState = useSyncExternalStore(
    valuation?.subscribe ?? subscribeNone,
    valuation?.getSnapshot ?? emptyValuation,
    valuation?.getSnapshot ?? emptyValuation,
  );
  const calculation = valuationState?.calculation ?? null;
  const [preview, setPreview] = useState<{
    report: PreparedCompanyReport | null;
    invalidated: boolean;
  }>({ report: null, invalidated: false });
  const { report } = preview;
  const block = companyReportBlock(
    models.selection,
    evidence,
    watchlist,
    calculation,
  );
  const current =
    report &&
    companyReportIsCurrent(
      report,
      models.selection,
      evidence,
      watchlist,
      calculation,
    );
  useEffect(() => {
    if (report && !current) setPreview({ report: null, invalidated: true });
  }, [report, current]);
  return (
    <CompanyReportView
      navigationPending={navigationPending}
      report={report}
      block={block}
      current={Boolean(current)}
      invalidated={preview.invalidated}
      onPrepare={() =>
        setPreview({
          report: prepareCompanyReport(
            models.selection,
            evidence,
            watchlist,
            undefined,
            calculation,
          ),
          invalidated: false,
        })
      }
      onClear={() => setPreview({ report: null, invalidated: false })}
      onSection={onSection}
      revisit={
        reportRevisitTarget && readReportWatchlist ? (
          <ManagedCompanyReportRevisit
            {...models}
            {...(valuation ? { valuation } : {})}
            readWatchlist={readReportWatchlist}
            target={reportRevisitTarget}
            {...(reportComparisonCheck
              ? { comparisonCheck: reportComparisonCheck }
              : {})}
          />
        ) : null
      }
      download={
        report && current && reportDelivery && readReportWatchlist ? (
          <ManagedCompanyReportDelivery
            report={report}
            delivery={reportDelivery}
            isCurrent={() =>
              companyReportIsCurrent(
                report,
                models.selection,
                companySnapshotEvidence(
                  models.selection,
                  models.price.getSnapshot(),
                  models.annual.getSnapshot(),
                  models.filings.getSnapshot(),
                  models.interim.getSnapshot(),
                ),
                readReportWatchlist(models.selection),
                valuation?.getSnapshot().calculation ?? null,
              )
            }
          />
        ) : null
      }
    />
  );
}

export function CompanyReportView({
  navigationPending,
  report,
  block,
  current,
  invalidated,
  download,
  revisit,
  onPrepare,
  onClear,
  onSection,
}: {
  navigationPending: boolean;
  report: PreparedCompanyReport | null;
  block: string | null;
  current: boolean;
  invalidated: boolean;
  download?: ReactNode;
  revisit?: ReactNode;
  onPrepare: () => void;
  onClear: () => void;
  onSection: (section: "eod" | "annual" | "interim" | "filings") => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="managed-company-report"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Research report</summary>
      <p>
        Prepare a read-only view of this company's loaded evidence and your
        watchlist draft, including any calculated valuation assumptions.
        Preparation makes no request or saved change.
      </p>
      <div className="trial-actions">
        <button
          className="trial-secondary"
          disabled={block !== null}
          onClick={onPrepare}
        >
          Prepare research report
        </button>
        {report && (
          <button className="trial-secondary" onClick={onClear}>
            Clear report preview
          </button>
        )}
      </div>
      {block && <p role="status">{block}</p>}
      {((report && !current) || invalidated) && (
        <p role="status">
          Sources, company selection, valuation inputs or the note changed.
          Prepare a new report.
        </p>
      )}
      {report && current && (
        <section aria-labelledby="managed-prepared-report-heading">
          <h3 id="managed-prepared-report-heading">
            Research report · {report.selection.listing.symbol}
          </h3>
          <p>
            {report.selection.listing.issuerName} ·{" "}
            {report.selection.listing.securityName} ·{" "}
            {report.selection.listing.shareClassName} ·{" "}
            {report.selection.listing.exchangeMic},{" "}
            {report.selection.listing.country}
          </p>
          <p role="status">
            Prepared <time>{report.preparedAt}</time>. Preparation does not
            renew the source dates below.
          </p>
          {download}
          <section aria-labelledby="managed-report-note-heading">
            <h4 id="managed-report-note-heading">
              Your watchlist draft at preparation
            </h4>
            <p>
              Authored research. Claims and links in this note are not checked
              by the report. This preview does not establish that the draft is
              saved.
            </p>
            <p className="managed-company-report-note">
              {report.note === null
                ? "This company has no note in your watchlist draft."
                : report.note === ""
                  ? "The watchlist note is empty."
                  : report.note}
            </p>
          </section>
          {report.valuation && (
            <ManagedValuationResults calculation={report.valuation} />
          )}
          {report.valuationPrice && (
            <ManagedValuationPriceContext context={report.valuationPrice} />
          )}
          {report.priceStudies && (
            <CapturedPriceStudies
              studies={report.priceStudies}
              showingPrevious={report.evidence.price?.showingPrevious ?? false}
            />
          )}
          <h4>Loaded source evidence</h4>
          <CompanySnapshotEvidenceView
            navigationPending={navigationPending}
            evidence={report.evidence}
            onSection={onSection}
          />
          <CompanyReportDocument report={report} />
        </section>
      )}
      {open && revisit}
    </details>
  );
}
const subscribeNone = () => () => {};
const emptyValuation = () => null;
