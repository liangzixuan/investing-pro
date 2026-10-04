import type { ManagedResearchVisit } from "./managed-workspace";
import type { ManagedAnnualReport as AnnualModel } from "./managed-annual-report";
import type { ManagedEodHistory as EodModel } from "./managed-eod-history";
import { ManagedAnnualReport } from "./ManagedAnnualReport";
import { ManagedEodHistory } from "./ManagedEodHistory";

export function ManagedCompanyResearch({
  research,
  annual,
  eod,
  onSection,
  onBack,
}: {
  research: ManagedResearchVisit;
  annual: AnnualModel;
  eod: EodModel;
  onSection: (section: ManagedResearchVisit["section"]) => void;
  onBack: () => void;
}) {
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
      <nav
        className="managed-company-sections"
        aria-label="Company research sections"
      >
        {(["eod", "annual"] as const).map((section) => (
          <button
            key={section}
            className="trial-secondary"
            aria-label={`${section === "eod" ? "Price" : "Annual"} section for ${listing.symbol}`}
            aria-pressed={research.section === section}
            aria-controls="managed-company-content"
            onClick={() => onSection(section)}
          >
            {section === "eod" ? "Price" : "Annual"}
          </button>
        ))}
      </nav>
      <div id="managed-company-content">
        {research.section === "annual" ? (
          <ManagedAnnualReport model={annual} />
        ) : (
          <ManagedEodHistory model={eod} />
        )}
      </div>
    </section>
  );
}
