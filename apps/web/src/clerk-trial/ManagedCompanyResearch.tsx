import type { ManagedFilingsAssessmentActions } from "./ManagedFilingsAssessment";
import { ManagedInterimReport } from "./ManagedInterimReport";
import type { ManagedInterimStatementsActions } from "./ManagedInterimStatementsReview";
import type { ManagedInterimReport as InterimModel } from "./managed-interim-report";
import {
  ManagedHoldingFollowup,
  type ManagedHoldingFollowupActions,
} from "./ManagedHoldingFollowup";
import type { HoldingFollowupPreview } from "./managed-holding-followup";
import type { ManagedFilingsFollowupActions } from "./ManagedFilingsFollowup";
import type { ReactNode } from "react";
import type { CompanyReportRevisitTarget } from "./company-report-revisit";
import type { ManagedAnnualStatementsReviewActions } from "./ManagedAnnualStatementsReview";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { ManagedCompanyFilings } from "./ManagedCompanyFilings";
import { ManagedCompanyReport } from "./ManagedCompanyReport";
import { ManagedCompanySnapshot } from "./ManagedCompanySnapshot";
import { ManagedCompanySnapshotLoading } from "./ManagedCompanySnapshotLoading";
import { ManagedCompanySourcePass } from "./ManagedCompanySourcePass";
import type { ComponentProps } from "react";
import type { ManagedCompanySnapshotLoad } from "./managed-company-snapshot-load";
import { ManagedCompanyEvidenceActions } from "./ManagedCompanyEvidenceActions";
import type { ManagedCompanyFilings as FilingsModel } from "./managed-company-filings";
import type {
  ManagedResearchVisit,
  ResearchCompanyNavigationState,
  ResearchWatchlistState,
} from "./managed-workspace";
import type { ManagedAnnualReport as AnnualModel } from "./managed-annual-report";
import type { ManagedEodHistory as EodModel } from "./managed-eod-history";
import { ManagedAnnualReport } from "./ManagedAnnualReport";
import { ManagedEodHistory } from "./ManagedEodHistory";
import { ManagedResearchNote } from "./ManagedResearchNote";
import type { ThesisFollowupContext } from "./managed-thesis-followup";
import type { ManagedAnnualNoteActions } from "./ManagedAnnualNoteAction";
import type { ManagedAnnualCashNoteActions } from "./ManagedAnnualCashNoteAction";
import type { ManagedAnnualOperatingNoteActions } from "./ManagedAnnualOperatingNoteAction";
import type { ManagedAnnualLiquidityNoteActions } from "./ManagedAnnualLiquidityNoteAction";
import type { ManagedPriceNoteActions } from "./ManagedPriceNoteAction";
import type { ManagedPriceStudiesActions } from "./managed-price-studies-note";
import type { ManagedFilingsNoteActions } from "./ManagedFilingsNoteAction";
import type { WatchlistMembership } from "@research-cockpit/contracts";
import { ManagedResearchCompanyNavigation } from "./ManagedResearchCompanyNavigation";
import type { ManagedFinancialReviewActions } from "./managed-financial-review";
import {
  ManagedValuationWorkbench,
  type ManagedValuationNoteActions,
} from "./ManagedValuationWorkbench";
import type { ManagedValuationRevenueBasisActions } from "./use-valuation-revenue-basis-review";
import type { ManagedValuationWorkbench as ValuationModel } from "./managed-valuation-workbench";
import type { ManagedValuationAssumptions as AssumptionsModel } from "./managed-valuation-assumptions";
import { ManagedValuationAssumptions } from "./ManagedValuationAssumptions";

export function ManagedCompanyResearch({
  research,
  navigationPending,
  reportDelivery,
  readReportWatchlist,
  reportRevisitTarget,
  annual,
  interim,
  interimStatementsActions,
  filings,
  eod,
  onSection,
  onRequestSource,
  sourcePass,
  onPreviewSourcePass,
  onRunSourcePass,
  onCancelSourcePass,
  onClearSourcePass,
  snapshotLoad,
  onLoadSnapshot,
  onCancelSnapshot,
  onCancelSource,
  onBack,
  watchlist,
  onAdd,
  onNote,
  onReview,
  thesisFollowup,
  researchFollowup,
  companyResearchChecks,
  annualNoteActions,
  annualCashNoteActions,
  annualLiquidityNoteActions,
  annualOperatingNoteActions,
  financialReviewActions,
  annualStatementsActions,
  valuation,
  valuationAssumptions,
  valuationNoteActions,
  valuationRevenueBasisActions,
  valuationDraftFiles,
  valuationCollectionFiles,
  valuationFollowup,
  priceNoteActions,
  priceStudiesActions,
  filingsNoteActions,
  filingsFollowupActions,
  filingsAssessmentActions,
  holdingFollowupActions,
  holdingPosition,
  companyNavigationState,
  canOpenCompany,
  onOpenCompany,
}: {
  research: ManagedResearchVisit;
  navigationPending: boolean;
  reportDelivery?: CompanyReportDeliveryAdapter;
  reportRevisitTarget?: () => CompanyReportRevisitTarget | null;
  readReportWatchlist?: (
    selection: ManagedResearchSelection,
  ) => ResearchWatchlistState;
  annual: AnnualModel;
  interim: InterimModel;
  interimStatementsActions: ManagedInterimStatementsActions;
  filings: FilingsModel;
  eod: EodModel;
  onSection: (section: ManagedResearchVisit["section"]) => void;
  onRequestSource: (section: ManagedResearchVisit["section"]) => Promise<void>;
  sourcePass: ComponentProps<typeof ManagedCompanySourcePass>["model"];
  onPreviewSourcePass: ComponentProps<
    typeof ManagedCompanySourcePass
  >["onPreview"];
  onRunSourcePass: ComponentProps<typeof ManagedCompanySourcePass>["onRun"];
  onCancelSourcePass: () => void;
  onClearSourcePass: () => void;
  snapshotLoad: ManagedCompanySnapshotLoad;
  onLoadSnapshot: () => Promise<void>;
  onCancelSnapshot: () => void;
  onCancelSource: (section: ManagedResearchVisit["section"]) => void;
  onBack: () => void;
  watchlist: ResearchWatchlistState;
  onAdd: () => void;
  onNote: (note: string, expectedNote?: string) => void;
  onReview: () => void;
  thesisFollowup?: ThesisFollowupContext | undefined;
  researchFollowup?: ReactNode;
  companyResearchChecks?: ReactNode;
  annualNoteActions: ManagedAnnualNoteActions;
  annualCashNoteActions: ManagedAnnualCashNoteActions;
  annualLiquidityNoteActions: ManagedAnnualLiquidityNoteActions;
  annualOperatingNoteActions: ManagedAnnualOperatingNoteActions;
  financialReviewActions?: ManagedFinancialReviewActions;
  annualStatementsActions?: ManagedAnnualStatementsReviewActions;
  valuation?: ValuationModel;
  valuationAssumptions: AssumptionsModel;
  valuationNoteActions?: ManagedValuationNoteActions;
  valuationRevenueBasisActions?: ManagedValuationRevenueBasisActions;
  valuationDraftFiles?: ReactNode;
  valuationCollectionFiles?: ReactNode;
  valuationFollowup?: ReactNode;
  priceNoteActions: ManagedPriceNoteActions;
  priceStudiesActions?: ManagedPriceStudiesActions;
  filingsNoteActions: ManagedFilingsNoteActions;
  filingsFollowupActions?: ManagedFilingsFollowupActions;
  filingsAssessmentActions?: ManagedFilingsAssessmentActions;
  holdingFollowupActions?: ManagedHoldingFollowupActions;
  holdingPosition?: HoldingFollowupPreview["position"] | null;
  companyNavigationState: ResearchCompanyNavigationState;
  canOpenCompany: (
    visit: ManagedResearchVisit,
    member: WatchlistMembership,
  ) => boolean;
  onOpenCompany: (
    visit: ManagedResearchVisit,
    member: WatchlistMembership,
  ) => void;
}) {
  const labels = {
    eod: "Price",
    annual: "Annual",
    interim: "Interim",
    filings: "Filings",
  };
  const listing = research.selection.listing;
  return (
    <section
      className="trial-panel managed-company-visit"
      aria-labelledby="managed-company-heading"
    >
      <div className="trial-toolbar">
        <h2 id="managed-company-heading">
          Company research · {listing.symbol}
        </h2>
        <button
          className="trial-secondary"
          disabled={navigationPending}
          onClick={onBack}
        >
          Back to workspace
        </button>
      </div>
      <p className="managed-company-identity">
        <strong>{listing.issuerName}</strong>
        <span>
          {listing.securityName} · {listing.shareClassName} ·{" "}
          {listing.exchangeMic}
        </span>
      </p>
      {companyResearchChecks}
      {researchFollowup}
      <HoldingResearchNextCheck
        selection={research.selection}
        actions={holdingFollowupActions}
        position={holdingPosition}
      />
      <ManagedResearchCompanyNavigation
        navigationPending={navigationPending}
        research={research}
        state={companyNavigationState}
        canOpen={canOpenCompany}
        onOpen={onOpenCompany}
      />
      <ManagedCompanyEvidenceActions
        navigationPending={navigationPending}
        selection={research.selection}
        price={eod}
        annual={annual}
        interim={interim}
        filings={filings}
        onRequest={(section) => void onRequestSource(section)}
        onCancel={onCancelSource}
        onOpen={onSection}
      />
      <ManagedCompanySnapshotLoading
        model={snapshotLoad}
        navigationPending={navigationPending}
        onLoad={onLoadSnapshot}
        onCancel={onCancelSnapshot}
      />
      <ManagedCompanySourcePass
        key={`${research.selection.catalogSnapshotSha256}:${listing.listingId}`}
        model={sourcePass}
        navigationPending={navigationPending}
        onPreview={onPreviewSourcePass}
        onRun={onRunSourcePass}
        onCancel={onCancelSourcePass}
        onClear={onClearSourcePass}
      />
      <ManagedCompanySnapshot
        navigationPending={navigationPending}
        key={`${research.selection.catalogSnapshotSha256}:${listing.listingId}`}
        selection={research.selection}
        price={eod}
        annual={annual}
        interim={interim}
        filings={filings}
        onSection={onSection}
      />
      <ManagedCompanyReport
        navigationPending={navigationPending}
        key={`report:${research.selection.catalogSnapshotSha256}:${listing.listingId}`}
        selection={research.selection}
        price={eod}
        annual={annual}
        interim={interim}
        filings={filings}
        watchlist={watchlist}
        {...(valuation ? { valuation } : {})}
        {...(reportDelivery ? { reportDelivery } : {})}
        {...(readReportWatchlist ? { readReportWatchlist } : {})}
        {...(reportRevisitTarget ? { reportRevisitTarget } : {})}
        onSection={onSection}
      />
      {valuation && valuationNoteActions && (
        <>
          <ManagedValuationWorkbench
            model={valuation}
            selection={research.selection}
            navigationPending={navigationPending}
            noteActions={valuationNoteActions}
            followup={valuationFollowup}
            annual={annual}
            {...(valuationRevenueBasisActions
              ? { revenueBasisActions: valuationRevenueBasisActions }
              : {})}
            watchlist={watchlist}
            price={eod}
            onOpenPrice={() => onSection("eod")}
          />
          {valuationDraftFiles}
          <ManagedValuationAssumptions
            collectionFiles={valuationCollectionFiles}
            model={valuationAssumptions}
            workbench={valuation}
            navigationPending={navigationPending}
          />
        </>
      )}
      <div className="managed-research-body">
        <div>
          <nav
            className="managed-company-sections"
            aria-label="Company research sections"
          >
            {(["eod", "annual", "interim", "filings"] as const).map(
              (section) => (
                <button
                  key={section}
                  className="trial-secondary"
                  aria-label={`${labels[section]} section for ${listing.symbol}`}
                  aria-pressed={research.section === section}
                  aria-controls="managed-company-content"
                  disabled={navigationPending}
                  onClick={() => onSection(section)}
                >
                  {labels[section]}
                </button>
              ),
            )}
          </nav>
          <div id="managed-company-content">
            {research.section === "annual" ? (
              <ManagedAnnualReport
                model={annual}
                noteActions={annualNoteActions}
                cashNoteActions={annualCashNoteActions}
                liquidityNoteActions={annualLiquidityNoteActions}
                operatingNoteActions={annualOperatingNoteActions}
                watchlist={watchlist}
                {...(financialReviewActions ? { financialReviewActions } : {})}
                {...(annualStatementsActions
                  ? { statementActions: annualStatementsActions }
                  : {})}
              />
            ) : research.section === "interim" ? (
              <ManagedInterimReport
                model={interim}
                actions={interimStatementsActions}
                blockedReason={
                  navigationPending
                    ? "Finish navigation before preparing a note."
                    : !watchlist.canEdit || !watchlist.member
                      ? (watchlist.reason ??
                        "Add this company to the Watchlist draft before preparing a note.")
                      : null
                }
                onLoad={() => void onRequestSource("interim")}
                onCancel={() => onCancelSource("interim")}
              />
            ) : research.section === "eod" ? (
              <ManagedEodHistory
                model={eod}
                noteActions={priceNoteActions}
                {...(priceStudiesActions
                  ? { studiesActions: priceStudiesActions }
                  : {})}
                studiesBlockedReason={
                  navigationPending
                    ? "Finish or cancel navigation before preparing study results."
                    : !watchlist.canEdit || !watchlist.member
                      ? (watchlist.reason ??
                        "Add this company to the watchlist draft before preparing study results.")
                      : null
                }
              />
            ) : research.section === "filings" ? (
              <ManagedCompanyFilings
                model={filings}
                annual={annual}
                noteActions={filingsNoteActions}
                {...(filingsAssessmentActions
                  ? { assessmentActions: filingsAssessmentActions }
                  : {})}
                {...(filingsFollowupActions
                  ? { followupActions: filingsFollowupActions }
                  : {})}
              />
            ) : null}
          </div>
        </div>
        <aside className="managed-research-aside" aria-label="Research note">
          <ManagedResearchNote
            navigationPending={navigationPending}
            state={watchlist}
            symbol={listing.symbol}
            onAdd={onAdd}
            onNote={onNote}
            onReview={onReview}
            followup={thesisFollowup}
          />
        </aside>
      </div>
    </section>
  );
}

function HoldingResearchNextCheck({
  selection,
  actions,
  position,
}: {
  selection: ManagedResearchSelection;
  actions: ManagedHoldingFollowupActions | undefined;
  position: HoldingFollowupPreview["position"] | null | undefined;
}) {
  if (selection.origin !== "portfolio" || !actions) return null;
  return (
    <ManagedHoldingFollowup
      actions={actions}
      owner={selection}
      position={position ?? null}
    />
  );
}
