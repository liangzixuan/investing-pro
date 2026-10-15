import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { ManagedCompanyFilings } from "./ManagedCompanyFilings";
import { ManagedCompanyReport } from "./ManagedCompanyReport";
import { ManagedCompanySnapshot } from "./ManagedCompanySnapshot";
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
import type { ManagedAnnualNoteActions } from "./ManagedAnnualNoteAction";
import type { ManagedAnnualCashNoteActions } from "./ManagedAnnualCashNoteAction";
import type { ManagedAnnualLiquidityNoteActions } from "./ManagedAnnualLiquidityNoteAction";
import type { ManagedPriceNoteActions } from "./ManagedPriceNoteAction";
import type { ManagedFilingsNoteActions } from "./ManagedFilingsNoteAction";
import type { WatchlistMembership } from "@research-cockpit/contracts";
import { ManagedResearchCompanyNavigation } from "./ManagedResearchCompanyNavigation";

export function ManagedCompanyResearch({
  research,
  reportDelivery,
  readReportWatchlist,
  annual,
  filings,
  eod,
  onSection,
  onBack,
  watchlist,
  onAdd,
  onNote,
  onReview,
  annualNoteActions,
  annualCashNoteActions,
  annualLiquidityNoteActions,
  priceNoteActions,
  filingsNoteActions,
  companyNavigationState,
  canOpenCompany,
  onOpenCompany,
}: {
  research: ManagedResearchVisit;
  reportDelivery?: CompanyReportDeliveryAdapter;
  readReportWatchlist?: (
    selection: ManagedResearchSelection,
  ) => ResearchWatchlistState;
  annual: AnnualModel;
  filings: FilingsModel;
  eod: EodModel;
  onSection: (section: ManagedResearchVisit["section"]) => void;
  onBack: () => void;
  watchlist: ResearchWatchlistState;
  onAdd: () => void;
  onNote: (note: string, expectedNote?: string) => void;
  onReview: () => void;
  annualNoteActions: ManagedAnnualNoteActions;
  annualCashNoteActions: ManagedAnnualCashNoteActions;
  annualLiquidityNoteActions: ManagedAnnualLiquidityNoteActions;
  priceNoteActions: ManagedPriceNoteActions;
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
        <button className="trial-secondary" onClick={onBack}>
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
      <ManagedResearchCompanyNavigation
        research={research}
        state={companyNavigationState}
        canOpen={canOpenCompany}
        onOpen={onOpenCompany}
      />
      <ManagedCompanySnapshot
        key={`${research.selection.catalogSnapshotSha256}:${listing.listingId}`}
        selection={research.selection}
        price={eod}
        annual={annual}
        filings={filings}
        onSection={onSection}
      />
      <ManagedCompanyReport
        key={`report:${research.selection.catalogSnapshotSha256}:${listing.listingId}`}
        selection={research.selection}
        price={eod}
        annual={annual}
        filings={filings}
        watchlist={watchlist}
        {...(reportDelivery ? { reportDelivery } : {})}
        {...(readReportWatchlist ? { readReportWatchlist } : {})}
        onSection={onSection}
      />
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
              />
            ) : research.section === "eod" ? (
              <ManagedEodHistory model={eod} noteActions={priceNoteActions} />
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
            state={watchlist}
            symbol={listing.symbol}
            onAdd={onAdd}
            onNote={onNote}
            onReview={onReview}
          />
        </aside>
      </div>
    </section>
  );
}
