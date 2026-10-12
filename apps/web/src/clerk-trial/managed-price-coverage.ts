import {
  membershipMatchesResult,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";

/** Declared price cohort; runtime configuration and provider refusals remain authoritative. */
export const MANAGED_PRICE_COVERAGE: readonly ManagedEodIdentity[] =
  Object.freeze(
    [
      {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "oid-issuer-0e4ae79b2a6b4443b11946c6b9171c45",
        issuerName: "Apple Inc.",
        listingId: "oid-listing-fdc1a316c06e4efca10b09944c908bbc",
        securityId: "oid-security-2c607f13eb744e61a209f61b7a1e172d",
        securityName: "Common Stock, $0.00001 par value per share",
        shareClassId: "oid-share-class-de665b6392eb4a03b7ec2c09ba97dc1c",
        shareClassName: "Common Stock, $0.00001 par value per share",
        symbol: "AAPL",
      },
      {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "oid-issuer-2744343830e3421ab970a3e5f4e4a719",
        issuerName: "Alphabet Inc.",
        listingId: "oid-listing-44bc5fe9c57246a3adef40bbcbcb88a7",
        securityId: "oid-security-b3826929532e4221a42d3c753046c7c8",
        securityName: "Class C Capital Stock, $0.001 par value",
        shareClassId: "oid-share-class-f81365021c5a4909aa983603a54f634d",
        shareClassName: "Class C Capital Stock, $0.001 par value",
        symbol: "GOOG",
      },
      {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "oid-issuer-2744343830e3421ab970a3e5f4e4a719",
        issuerName: "Alphabet Inc.",
        listingId: "oid-listing-5acae2cd933a4a32a3ac19e428ab27ce",
        securityId: "oid-security-0377495156384622865c558c1bf79449",
        securityName: "Class A Common Stock, $0.001 par value",
        shareClassId: "oid-share-class-75f07939ba714dbcbfac6a097deba503",
        shareClassName: "Class A Common Stock, $0.001 par value",
        symbol: "GOOGL",
      },
    ].map((listing) => Object.freeze(listing)) as ManagedEodIdentity[],
  );

export function hasManagedPriceCoverage(
  listing: ManagedEodIdentity,
  coverage: readonly ManagedEodIdentity[],
): boolean {
  return coverage.some((entry) =>
    membershipMatchesResult({ ...entry, note: "" }, listing),
  );
}
