import type { ManagedResearchCoverage } from "./managed-research-eligibility";
import { eodSelection } from "./eod-history-fixture";

/** Capture an explicit test roster before any selection or source mutation. */
export function createManagedResearchCoverageFixture(
  rows: ManagedResearchCoverage["listings"],
  catalogSnapshotSha256 = eodSelection.catalogSnapshotSha256,
): ManagedResearchCoverage {
  const issuers = Object.freeze([...new Set(rows.map((row) => row.cik))]);
  return Object.freeze({
    catalogSnapshotSha256,
    listings: Object.freeze(
      rows.map((row) =>
        Object.freeze({
          listing: Object.freeze({ ...row.listing }),
          cik: row.cik,
        }),
      ),
    ),
    annualIssuers: issuers,
    filingsIssuers: Object.freeze([...issuers]),
  });
}

/** Two explicit invented identities; no provider access or runtime admission. */
export const inventedManagedResearchCoverage: ManagedResearchCoverage =
  Object.freeze({
    catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
    listings: Object.freeze([
      Object.freeze({
        listing: Object.freeze({ ...eodSelection.listing }),
        cik: "0000000001",
      }),
      Object.freeze({
        listing: Object.freeze({
          ...eodSelection.listing,
          listingId: "listing-one",
          issuerId: "issuer-one",
          issuerName: "One Company",
          securityId: "security-one",
          securityName: "One Class A",
          shareClassId: "class-one",
          symbol: "ONE",
        }),
        cik: "0000000002",
      }),
    ]),
    annualIssuers: Object.freeze(["0000000001", "0000000002"]),
    filingsIssuers: Object.freeze(["0000000001", "0000000002"]),
  });
