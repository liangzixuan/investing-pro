import type { WatchlistMembership } from "@research-cockpit/contracts";

export function ListingIdentity({
  member,
}: {
  member: Omit<WatchlistMembership, "note">;
}) {
  return (
    <>
      <strong>{member.symbol}</strong> · {member.issuerName}
      <span className="managed-listing-detail">
        {member.shareClassName} · {member.exchangeMic} ·{" "}
        {member.instrumentType === "adr" ? "ADR" : "Common stock"}
      </span>
    </>
  );
}

export const identityLabels: Record<
  keyof Omit<WatchlistMembership, "note">,
  string
> = {
  country: "Country",
  exchangeMic: "Exchange MIC",
  instrumentType: "Instrument type",
  issuerId: "Issuer ID",
  issuerName: "Company name",
  listingId: "Listing ID",
  securityId: "Security ID",
  securityName: "Security name",
  shareClassId: "Share class ID",
  shareClassName: "Share class name",
  symbol: "Ticker",
};
