import { describe, expect, it } from "vitest";
import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import { eodSelection } from "./eod-history-fixture";
import { MANAGED_FINANCIAL_SCREEN_LISTING_IDS } from "./managed-financial-screen-cohort";
import {
  MANAGED_PRICE_COVERAGE,
  hasManagedPriceCoverage,
} from "./managed-price-coverage";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  MANAGED_RESEARCH_COVERAGE,
  getManagedResearchCoverageCik,
  hasManagedAnnualCoverage,
  hasManagedFilingsCoverage,
  type ManagedResearchCoverage,
  type ManagedResearchCoverageListing,
} from "./managed-research-eligibility";

function selection(
  row: ManagedResearchCoverageListing = MANAGED_RESEARCH_COVERAGE.listings[0]!,
  cik: string | null = row.cik,
): ManagedResearchSelection {
  return {
    catalogSnapshotSha256: MANAGED_RESEARCH_COVERAGE.catalogSnapshotSha256,
    listing: row.listing,
    cik,
    origin: "discover",
  };
}
function expectRefused(value: ManagedResearchSelection) {
  expect(hasManagedAnnualCoverage(value)).toBe(false);
  expect(hasManagedFilingsCoverage(value)).toBe(false);
}

describe("closed managed research source eligibility", () => {
  it("keeps the exact 18-listing screen order and independent immutable source memberships", () => {
    const coverage = MANAGED_RESEARCH_COVERAGE;
    expect(coverage.listings.map((row) => row.listing.listingId)).toEqual(
      MANAGED_FINANCIAL_SCREEN_LISTING_IDS,
    );
    expect(new Set(coverage.listings.map((row) => row.cik)).size).toBe(17);
    expect(
      new Set(coverage.listings.map((row) => row.listing.listingId)).size,
    ).toBe(18);
    expect(coverage.annualIssuers).not.toBe(coverage.filingsIssuers);
    for (const value of [
      coverage,
      coverage.listings,
      coverage.annualIssuers,
      coverage.filingsIssuers,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    for (const row of coverage.listings) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(Object.isFrozen(row.listing)).toBe(true);
    }
  });

  it.each(MANAGED_RESEARCH_COVERAGE.listings)(
    "admits only the matched $listing.symbol identity with its CIK or null CIK",
    (row) => {
      for (const cik of [row.cik, null]) {
        expect(getManagedResearchCoverageCik(selection(row, cik))).toBe(
          row.cik,
        );
        expect(hasManagedAnnualCoverage(selection(row, cik))).toBe(true);
        expect(hasManagedFilingsCoverage(selection(row, cik))).toBe(true);
      }
      expect(getManagedResearchCoverageCik(selection(row, "0000000000"))).toBe(
        row.cik,
      );
      expectRefused(selection(row, "0000000000"));
    },
  );

  it.each([
    "discover",
    "watchlist",
    "markets",
    "route",
    "followups",
    "portfolio",
    "screening",
  ] as const)(
    "uses the exact known identity for a null-CIK %s selection",
    (origin) => {
      const known = { ...selection(undefined, null), origin };
      expect(hasManagedAnnualCoverage(known)).toBe(true);
      expect(hasManagedFilingsCoverage(known)).toBe(true);
    },
  );

  it.each(
    Object.keys(
      MANAGED_RESEARCH_COVERAGE.listings[0]!.listing,
    ) as (keyof ManagedEodIdentity)[],
  )(
    "refuses altered identity field %s even when listing ID, symbol or CIK is claimed",
    (field) => {
      const known = selection();
      const changed = {
        ...known,
        listing: {
          ...known.listing,
          [field]: `${known.listing[field]}-changed`,
        },
      };
      expect(getManagedResearchCoverageCik(changed)).toBeNull();
      expectRefused(changed);
    },
  );

  it("refuses an unknown catalog or invented listing despite a qualified CIK", () => {
    const oldCatalog = {
      ...selection(),
      catalogSnapshotSha256: `sha256:${"0".repeat(64)}` as const,
    };
    const unknown = { ...selection(), listing: eodSelection.listing };
    expect(getManagedResearchCoverageCik(oldCatalog)).toBeNull();
    expect(getManagedResearchCoverageCik(unknown)).toBeNull();
    expectRefused(oldCatalog);
    expectRefused(unknown);
  });

  it("does not exchange Alphabet share classes or use an issuer-level Price shortcut", () => {
    const goog = MANAGED_RESEARCH_COVERAGE.listings.find(
      (row) => row.listing.symbol === "GOOG",
    )!;
    const googl = MANAGED_RESEARCH_COVERAGE.listings.find(
      (row) => row.listing.symbol === "GOOGL",
    )!;
    expect(goog.cik).toBe(googl.cik);
    expect(goog.listing.issuerId).toBe(googl.listing.issuerId);
    expect(goog.listing.securityId).not.toBe(googl.listing.securityId);
    expect(goog.listing.shareClassId).not.toBe(googl.listing.shareClassId);
    expectRefused({
      ...selection(goog),
      listing: { ...goog.listing, listingId: googl.listing.listingId },
    });
    const supported = MANAGED_RESEARCH_COVERAGE.listings.filter((row) =>
      hasManagedPriceCoverage(row.listing, MANAGED_PRICE_COVERAGE),
    );
    expect(supported.map((row) => row.listing.symbol)).toEqual([
      "AAPL",
      "GOOG",
      "GOOGL",
    ]);
  });

  it("keeps Annual and Filings eligibility independent for a fixed injected fixture roster", () => {
    const coverage: ManagedResearchCoverage = Object.freeze({
      catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
      listings: Object.freeze([
        Object.freeze({
          listing: Object.freeze({ ...eodSelection.listing }),
          cik: "0000000001",
        }),
      ]),
      annualIssuers: Object.freeze(["0000000001"]),
      filingsIssuers: Object.freeze([]),
    });
    const known = { ...eodSelection, cik: null };
    expect(hasManagedAnnualCoverage(known)).toBe(false);
    expect(hasManagedFilingsCoverage(known)).toBe(false);
    expect(hasManagedAnnualCoverage(known, coverage)).toBe(true);
    expect(hasManagedFilingsCoverage(known, coverage)).toBe(false);
    const filingsOnly = {
      ...coverage,
      annualIssuers: [],
      filingsIssuers: ["0000000001"],
    };
    expect(hasManagedAnnualCoverage(known, filingsOnly)).toBe(false);
    expect(hasManagedFilingsCoverage(known, filingsOnly)).toBe(true);
    expect(
      hasManagedAnnualCoverage({ ...known, cik: "0000000002" }, coverage),
    ).toBe(false);
    expect(getManagedResearchCoverageCik(known, coverage)).toBe("0000000001");
    const identityOnly = { ...coverage, annualIssuers: [], filingsIssuers: [] };
    expect(getManagedResearchCoverageCik(known, identityOnly)).toBe(
      "0000000001",
    );
    expect(hasManagedAnnualCoverage(known, identityOnly)).toBe(false);
    expect(hasManagedFilingsCoverage(known, identityOnly)).toBe(false);
    expect(
      getManagedResearchCoverageCik({ ...known, cik: "0000000002" }, coverage),
    ).toBe("0000000001");
  });
});
