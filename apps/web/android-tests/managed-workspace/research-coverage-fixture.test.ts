import { describe, expect, it } from "vitest";
import {
  hasManagedAnnualCoverage,
  hasManagedFilingsCoverage,
} from "../../src/clerk-trial/managed-research-eligibility";
import { inventedManagedResearchCoverage } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import { createFixture } from "./fixture";

describe("fixed native research coverage composition", () => {
  it.each([
    "default",
    "watchlist-comparison",
    "financial-screen",
    "screen-comparison",
  ] as const)(
    "binds %s to only the two full invented identities",
    async (scenario) => {
      const fixture = await createFixture(scenario);
      const coverage = fixture.researchCoverage;
      expect(coverage).toBe(inventedManagedResearchCoverage);
      expect(Object.isFrozen(coverage)).toBe(true);
      expect(
        coverage.listings.map(({ listing, cik }) => [listing.symbol, cik]),
      ).toEqual([
        ["ZERO", "0000000001"],
        ["ONE", "0000000002"],
      ]);
      for (const row of coverage.listings) {
        const selection = {
          catalogSnapshotSha256: coverage.catalogSnapshotSha256,
          origin: "discover" as const,
          listing: row.listing,
          cik: row.cik,
        };
        for (const qualifies of [
          hasManagedAnnualCoverage,
          hasManagedFilingsCoverage,
        ]) {
          expect(qualifies(selection, coverage)).toBe(true);
          expect(qualifies({ ...selection, cik: "0000000003" }, coverage)).toBe(
            false,
          );
          expect(
            qualifies(
              {
                ...selection,
                catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
              },
              coverage,
            ),
          ).toBe(false);
          expect(
            qualifies(
              {
                ...selection,
                listing: {
                  ...selection.listing,
                  shareClassId: "foreign-class",
                },
              },
              coverage,
            ),
          ).toBe(false);
        }
      }
      expect(fixture.getSnapshot()).toMatchObject({
        annual: 0,
        filings: 0,
        resolve: 0,
        marketsResolve: 0,
        save: 0,
      });
    },
  );
});
