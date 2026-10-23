import type { ReactNode } from "react";
import type { ManagedAnnualStatementsReviewActions } from "./ManagedAnnualStatementsReview";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { ManagedCompanyFilings } from "./ManagedCompanyFilings";
import { ManagedCompanyReport } from "./ManagedCompanyReport";
import { ManagedCompanySnapshot } from "./ManagedCompanySnapshot";
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
import type { ManagedValuationWorkbench as ValuationModel } from "./managed-valuation-workbench";
import type { ManagedValuationAssumptions as AssumptionsModel } from "./managed-valuation-assumptions";
import { ManagedValuationAssumptions } from "./ManagedValuationAssumptions";

export function ManagedCompanyResearch({
  research,
  navigationPending,
  reportDelivery,
  readReportWatchlist,
  annual,
  filings,
  eod,
  onSection,
  onRequestSource,
  onCancelSource,
  onBack,
  watchlist,
  onAdd,
  onNote,
  onReview,
  thesisFollowup,
  researchFollowup,
  annualNoteActions,
  annualCashNoteActions,
  annualLiquidityNoteActions,
  annualOperatingNoteActions,
  financialReviewActions,
  annualStatementsActions,
  valuation,
  valuationAssumptions,
  valuationNoteActions,
  valuationDraftFiles,
  priceNoteActions,
  priceStudiesActions,
  filingsNoteActions,
  companyNavigationState,
  canOpenCompany,
  onOpenCompany,
}: {
  research: ManagedResearchVisit;
  navigationPending: boolean;
  reportDelivery?: CompanyReportDeliveryAdapter;
  readReportWatchlist?: (
    selection: ManagedResearchSelection,
  ) => ResearchWatchlistState;
  annual: AnnualModel;
  filings: FilingsModel;
  eod: EodModel;
  onSection: (section: ManagedResearchVisit["section"]) => void;
  onRequestSource: (section: ManagedResearchVisit["section"]) => Promise<void>;
  onCancelSource: (section: ManagedResearchVisit["section"]) => void;
  onBack: () => void;
  watchlist: ResearchWatchlistState;
  onAdd: () => void;
  onNote: (note: string, expectedNote?: string) => void;
  onReview: () => void;
  thesisFollowup?: ThesisFollowupContext | undefined;
  researchFollowup?: ReactNode;
  annualNoteActions: ManagedAnnualNoteActions;
  annualCashNoteActions: ManagedAnnualCashNoteActions;
  annualLiquidityNoteActions: ManagedAnnualLiquidityNoteActions;
  annualOperatingNoteActions: ManagedAnnualOperatingNoteActions;
  financialReviewActions?: ManagedFinancialReviewActions;
  annualStatementsActions?: ManagedAnnualStatementsReviewActions;
  valuation?: ValuationModel;
  valuationAssumptions: AssumptionsModel;
  valuationNoteActions?: ManagedValuationNoteActions;
  valuationDraftFiles?: ReactNode;
  priceNoteActions: ManagedPriceNoteActions;
  priceStudiesActions?: ManagedPriceStudiesActions;
  filingsNoteActions: ManagedFilingsNoteActions;
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
  const labels = { eod: "Price", annual: "Annual", filings: "Filings" };
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
      {researchFollowup}
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
        filings={filings}
        onRequest={(section) => void onRequestSource(section)}
        onCancel={onCancelSource}
        onOpen={onSection}
      />
      <ManagedCompanySnapshot
        navigationPending={navigationPending}
        key={`${research.selection.catalogSnapshotSha256}:${listing.listingId}`}
        selection={research.selection}
        price={eod}
        annual={annual}
        filings={filings}
        onSection={onSection}
      />
      <ManagedCompanyReport
        navigationPending={navigationPending}
        key={`report:${research.selection.catalogSnapshotSha256}:${listing.listingId}`}
        selection={research.selection}
        price={eod}
        annual={annual}
        filings={filings}
        watchlist={watchlist}
        {...(valuation ? { valuation } : {})}
        {...(reportDelivery ? { reportDelivery } : {})}
        {...(readReportWatchlist ? { readReportWatchlist } : {})}
        onSection={onSection}
      />
      {valuation && valuationNoteActions && (
        <>
          <ManagedValuationWorkbench
            model={valuation}
            selection={research.selection}
            navigationPending={navigationPending}
            noteActions={valuationNoteActions}
            watchlist={watchlist}
            price={eod}
            onOpenPrice={() => onSection("eod")}
          />
          {valuationDraftFiles}
          <ManagedValuationAssumptions
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
            {(["eod", "annual", "filings"] as const).map((section) => (
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
            ))}
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
