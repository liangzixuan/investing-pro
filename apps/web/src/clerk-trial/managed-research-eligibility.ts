import {
  membershipMatchesResult,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { MANAGED_FINANCIAL_SCREEN_CATALOG_SHA256 } from "./managed-financial-screen-cohort";

export interface ManagedResearchCoverageListing {
  readonly listing: ManagedEodIdentity;
  readonly cik: string;
}

/** Fixed composition only; neither requests nor saved drafts configure source coverage. */
export interface ManagedResearchCoverage {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listings: readonly ManagedResearchCoverageListing[];
  readonly annualIssuers: readonly string[];
  readonly filingsIssuers: readonly string[];
}

/** Exact public catalog identities, not provider availability or a live-response claim. */
const listings: readonly ManagedResearchCoverageListing[] = Object.freeze(
  (
    [
      {
        cik: "0000320193",
        listing: {
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
      },
      {
        cik: "0000004977",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-955ec5f868644b0da919e233e36d6e49",
          issuerName: "AFLAC INC",
          listingId: "oid-listing-df5875b9129b425eb7a71639d386bf0f",
          securityId: "oid-security-07a0ad3ce580474ab54cadf1d9c2dfbe",
          securityName: "Common Stock, $.10 Par Value",
          shareClassId: "oid-share-class-150e061f80a840a48d1ee3e1597ffd41",
          shareClassName: "Common Stock, $.10 Par Value",
          symbol: "AFL",
        },
      },
      {
        cik: "0000005272",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-89d261609bcc4630bb23f59ce420097f",
          issuerName: "AMERICAN INTERNATIONAL GROUP, INC.",
          listingId: "oid-listing-ca6320aaed1546b4b60a39cfac5216c6",
          securityId: "oid-security-c9ff1c5aeb8c4f94848e8e9bd4a18d73",
          securityName: "Common Stock, Par Value $2.50 Per Share",
          shareClassId: "oid-share-class-a51711ff2d88491ba98f3b09465df9d0",
          shareClassName: "Common Stock, Par Value $2.50 Per Share",
          symbol: "AIG",
        },
      },
      {
        cik: "0000003545",
        listing: {
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-77324088f0b44d5dad69f1e0c2677e89",
          issuerName: "ALICO, INC.",
          listingId: "oid-listing-aaa05639eb514de0b4e50eca8e2772a8",
          securityId: "oid-security-baa555d25c4c4d208148a32dbd5bf088",
          securityName: "Common Stock",
          shareClassId: "oid-share-class-d24f858b0b194c23a3a6edc04198b186",
          shareClassName: "Common Stock",
          symbol: "ALCO",
        },
      },
      {
        cik: "0000002488",
        listing: {
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-a1a475874935425ab378daefabedb969",
          issuerName: "ADVANCED MICRO DEVICES INC",
          listingId: "oid-listing-e2f6df3fdcf14a7c8dad342145ed2865",
          securityId: "oid-security-de62febbcd3046439e01f77e264e10c2",
          securityName: "Common Stock, $0.01 par value per share",
          shareClassId: "oid-share-class-5bb57c1a1d8a48b5b3532addaabd4aeb",
          shareClassName: "Common Stock, $0.01 par value per share",
          symbol: "AMD",
        },
      },
      {
        cik: "0000006176",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-7ed3fc2cfcae44598f4c26ef7d9d32fb",
          issuerName: "AMPCO PITTSBURGH CORP",
          listingId: "oid-listing-7caea5222b61491bbdf4e108858bec02",
          securityId: "oid-security-cc7ed2f9b47b4399a7fa589e19cf4ea7",
          securityName: "Common Stock, $1 par value",
          shareClassId: "oid-share-class-3f062c5bf71046a19dc65e8a3313ccb5",
          shareClassName: "Common Stock, $1 par value",
          symbol: "AP",
        },
      },
      {
        cik: "0000005981",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-fac43be7e1b64d2e9275b02cc0ab35f7",
          issuerName: "AMERICAN VANGUARD CORP",
          listingId: "oid-listing-761dd788312e43ec94fa70152b714ef2",
          securityId: "oid-security-9f1726e352894d308a350248966c3a36",
          securityName: "Common Stock, $0.10 par value",
          shareClassId: "oid-share-class-455d20d96b9b4fcc8e52ecba1e04dcb7",
          shareClassName: "Common Stock, $0.10 par value",
          symbol: "AVD",
        },
      },
      {
        cik: "0000004962",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-e202447ec5b94c6692e73f5f318bdf18",
          issuerName: "AMERICAN EXPRESS CO",
          listingId: "oid-listing-1c349e39481c4ac3a809de85320ac624",
          securityId: "oid-security-d2567ee865064e0887326dc0f234f5f0",
          securityName: "Common Shares (par value $0.20 per Share)",
          shareClassId: "oid-share-class-492dd604d28149a88ce8792d4abf2da1",
          shareClassName: "Common Shares (par value $0.20 per Share)",
          symbol: "AXP",
        },
      },
      {
        cik: "0000002186",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-21fa02c0803d46818e246bbded430e14",
          issuerName: "BK Technologies Corp",
          listingId: "oid-listing-34697b1c4cea41238c7142c2fd450af6",
          securityId: "oid-security-b38da2d8836a4e95b7b800fc044c7576",
          securityName: "Common Stock, par value $0.60",
          shareClassId: "oid-share-class-a88c058f344f4b149618260c2b9727d4",
          shareClassName: "Common Stock, par value $0.60",
          symbol: "BKTI",
        },
      },
      {
        cik: "0001652044",
        listing: {
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
      },
      {
        cik: "0001652044",
        listing: {
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
      },
      {
        cik: "0000004281",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-2e21cdbb77dd4f668011eb3f09e733ca",
          issuerName: "Howmet Aerospace Inc.",
          listingId: "oid-listing-4d7eaeadda75432580d22693b0b0550d",
          securityId: "oid-security-9868af6953ac461791fd55cca4c0a1c4",
          securityName: "Common Stock, par value $1.00 per share",
          shareClassId: "oid-share-class-60e7a6d751204ef58e16461cfc722f00",
          shareClassName: "Common Stock, par value $1.00 per share",
          symbol: "HWM",
        },
      },
      {
        cik: "0000003570",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-a3a488c7c80145418f9fd0b71c0f7221",
          issuerName: "Cheniere Energy, Inc.",
          listingId: "oid-listing-f2b374cd393c440da682a6117d0f0722",
          securityId: "oid-security-f9560004efc44a8b9da5950e79ddf65a",
          securityName: "Common Stock, $ 0.003 par value",
          shareClassId: "oid-share-class-75b6b94aabff47de8c739b68943dd84d",
          shareClassName: "Common Stock, $ 0.003 par value",
          symbol: "LNG",
        },
      },
      {
        cik: "0000003453",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-b827d01928714597994ee82c6024c90b",
          issuerName: "Matson, Inc.",
          listingId: "oid-listing-fa59842c214846238f516e08f48d0dd6",
          securityId: "oid-security-4b46128ba6184802a9e59cab4f0145f4",
          securityName: "Common Stock, without par value",
          shareClassId: "oid-share-class-58ed1182f2b74e2e8e03820cf8e9ada6",
          shareClassName: "Common Stock, without par value",
          symbol: "MATX",
        },
      },
      {
        cik: "0000789019",
        listing: {
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-e7c1e6ac71e24818b40d36b0d0f91b8f",
          issuerName: "MICROSOFT CORP",
          listingId: "oid-listing-eac65ef4a5d24849a600626df89fc761",
          securityId: "oid-security-d947b85284824c86ae3424d2d209348c",
          securityName: "Common stock, $0.00000625 par value per share",
          shareClassId: "oid-share-class-10ba14af13b14f048b4105f6b0e16a5b",
          shareClassName: "Common stock, $0.00000625 par value per share",
          symbol: "MSFT",
        },
      },
      {
        cik: "0000004127",
        listing: {
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-131ab919fd8f448abf0b43b47818da5c",
          issuerName: "SKYWORKS SOLUTIONS, INC.",
          listingId: "oid-listing-ec4641726d8e48a1b1eee268a2134d00",
          securityId: "oid-security-03b8e087c29346569539c0141a3f0bb3",
          securityName: "Common Stock, par value $0.25 per share",
          shareClassId: "oid-share-class-660abf2a5a194d798d1fd20e24270477",
          shareClassName: "Common Stock, par value $0.25 per share",
          symbol: "SWKS",
        },
      },
      {
        cik: "0000004457",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-43d151a561ae486fa79a1bc309ff706d",
          issuerName: "U-Haul Holding Co /NV/",
          listingId: "oid-listing-aab6d6f78b3442a3a6260edef5df0819",
          securityId: "oid-security-5313be33291d42419c1d1c8f034bcdda",
          securityName: "Common stock, $0.25 par value",
          shareClassId: "oid-share-class-5f5acfe0188b4438931c9f8b168d4cee",
          shareClassName: "Common stock, $0.25 par value",
          symbol: "UHAL",
        },
      },
      {
        cik: "0000005513",
        listing: {
          country: "US",
          exchangeMic: "XNYS",
          instrumentType: "common_stock",
          issuerId: "oid-issuer-c207d9abbb824fa09ec2f45641edea1f",
          issuerName: "Unum Group",
          listingId: "oid-listing-f4cdc0dadb6844d382c8efa99a85022f",
          securityId: "oid-security-b7313a2457544658b75d8eda23948fb9",
          securityName: "Common stock, $0.10 par value",
          shareClassId: "oid-share-class-7b816de13bca4359a69d7d595ad2caa1",
          shareClassName: "Common stock, $0.10 par value",
          symbol: "UNM",
        },
      },
    ] satisfies readonly ManagedResearchCoverageListing[]
  ).map((row) =>
    Object.freeze({ cik: row.cik, listing: Object.freeze(row.listing) }),
  ),
);

/** Each source has its own admission; one source never grants another. */
export const MANAGED_RESEARCH_COVERAGE: ManagedResearchCoverage = Object.freeze(
  {
    catalogSnapshotSha256: MANAGED_FINANCIAL_SCREEN_CATALOG_SHA256,
    listings,
    annualIssuers: Object.freeze([
      "0000320193",
      "0001652044",
      "0000789019",
      "0000002186",
      "0000002488",
      "0000003453",
      "0000003545",
      "0000003570",
      "0000004127",
      "0000004281",
      "0000004457",
      "0000004962",
      "0000004977",
      "0000005272",
      "0000005513",
      "0000005981",
      "0000006176",
    ]),
    filingsIssuers: Object.freeze([
      "0000320193",
      "0001652044",
      "0000789019",
      "0000002186",
      "0000002488",
      "0000003453",
      "0000003545",
      "0000003570",
      "0000004127",
      "0000004281",
      "0000004457",
      "0000004962",
      "0000004977",
      "0000005272",
      "0000005513",
      "0000005981",
      "0000006176",
    ]),
  },
);

/** Exact catalog identity fixes the issuer; a claim cannot change it or grant source eligibility. */
export function getManagedResearchCoverageCik(
  selection: ManagedResearchSelection,
  coverage: ManagedResearchCoverage = MANAGED_RESEARCH_COVERAGE,
): string | null {
  if (selection.catalogSnapshotSha256 !== coverage.catalogSnapshotSha256)
    return null;
  const row = coverage.listings.find(
    (entry) => entry.listing.listingId === selection.listing.listingId,
  );
  if (!row) return null;
  if (!membershipMatchesResult({ ...selection.listing, note: "" }, row.listing))
    return null;
  return row.cik;
}

function hasSourceCoverage(
  selection: ManagedResearchSelection,
  coverage: ManagedResearchCoverage,
  issuers: readonly string[],
) {
  const cik = getManagedResearchCoverageCik(selection, coverage);
  if (cik === null) return false;
  if (selection.cik !== null && selection.cik !== cik) return false;
  return issuers.includes(cik);
}

export function hasManagedAnnualCoverage(
  selection: ManagedResearchSelection,
  coverage: ManagedResearchCoverage = MANAGED_RESEARCH_COVERAGE,
): boolean {
  return hasSourceCoverage(selection, coverage, coverage.annualIssuers);
}

export function hasManagedFilingsCoverage(
  selection: ManagedResearchSelection,
  coverage: ManagedResearchCoverage = MANAGED_RESEARCH_COVERAGE,
): boolean {
  return hasSourceCoverage(selection, coverage, coverage.filingsIssuers);
}
