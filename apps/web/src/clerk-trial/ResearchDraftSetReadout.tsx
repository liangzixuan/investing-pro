import type { ResearchDraftMember } from "./managed-research-draft-set-file";
import { DraftListings } from "./ManagedWatchlistDraftFiles";
import { PortfolioLedgerDetails } from "./ManagedPortfolioLedgerDetails";
import { FollowupsDraftDetails } from "./ManagedFollowupsDraftDetails";
import { CompletePayload } from "./ValuationAssumptionsPanels";
export function ResearchDraftMemberReadout({
  content,
}: {
  content: ResearchDraftMember;
}) {
  return (
    <>
      <p>
        Reported resource capture time: {content.capturedAt}.{" "}
        {"baseVersion" in content
          ? `Reported file base: ${content.baseVersion}.`
          : "This collection file does not report an online save base."}
      </p>
      <ResourcePayload content={content} />
    </>
  );
}
function ResourcePayload({ content }: { content: ResearchDraftMember }) {
  switch (content.format) {
    case "investment-watchlist-draft":
      return <DraftListings draft={content.draft} />;
    case "investment-portfolio-draft":
      return <PortfolioLedgerDetails ledger={content.draft} />;
    case "investment-followups-draft":
      return <FollowupsDraftDetails draft={content.draft} />;
    case "investment-valuation-collection-draft":
      return (
        <CompletePayload
          label="Complete staged valuation entries"
          payload={content.payload}
        />
      );
  }
}
