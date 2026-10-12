import { ManagedCompanyFilings } from "./ManagedCompanyFilings";
import type { ManagedCompanyFilings as FilingsModel } from "./managed-company-filings";
import type {
  ManagedResearchVisit,
  ResearchWatchlistState,
} from "./managed-workspace";
import type { ManagedAnnualReport as AnnualModel } from "./managed-annual-report";
import type { ManagedEodHistory as EodModel } from "./managed-eod-history";
import { ManagedAnnualReport } from "./ManagedAnnualReport";
import { ManagedEodHistory } from "./ManagedEodHistory";
import { ManagedResearchNote } from "./ManagedResearchNote";
import type { ManagedAnnualNoteActions } from "./ManagedAnnualNoteAction";
import type { ManagedPriceNoteActions } from "./ManagedPriceNoteAction";

export function ManagedCompanyResearch({
  research,
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
  priceNoteActions,
}: {
  research: ManagedResearchVisit;
  annual: AnnualModel;
  filings: FilingsModel;
  eod: EodModel;
  onSection: (section: ManagedResearchVisit["section"]) => void;
  onBack: () => void;
  watchlist: ResearchWatchlistState;
  onAdd: () => void;
  onNote: (note: string) => void;
  onReview: () => void;
  annualNoteActions: ManagedAnnualNoteActions;
  priceNoteActions: ManagedPriceNoteActions;
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
              />
            ) : research.section === "eod" ? (
              <ManagedEodHistory model={eod} noteActions={priceNoteActions} />
            ) : research.section === "filings" ? (
              <ManagedCompanyFilings model={filings} />
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
