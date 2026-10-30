import { describe, expect, it, vi } from "vitest";
import {
  projectPersonalPortfolioLedger,
  type ManagedEodIdentity,
  type PersonalPortfolioLedgerPayloadV3,
} from "@research-cockpit/contracts";
import { eodSelection } from "./eod-history-fixture";
import { ManagedFinancialScreen } from "./managed-financial-screen";
import { prepareManagedPortfolioScreenSelection } from "./managed-portfolio-screen-selection-plan";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";

const digest = eodSelection.catalogSnapshotSha256;
const first = eodSelection.listing;
const alternate = {
  ...first,
  listingId: "listing-other",
  securityId: "security-other",
  shareClassId: "class-other",
  shareClassName: "Class C",
  securityName: "Zero Class C",
  symbol: "ZEROC",
};
const second = {
  ...first,
  listingId: "listing-one",
  issuerId: "issuer-one",
  issuerName: "One Company",
  securityId: "security-one",
  shareClassId: "class-one",
  symbol: "ONE",
};
const outside = { ...second, listingId: "listing-outside", symbol: "OUT" };
const uncovered = {
  ...second,
  listingId: "listing-uncovered",
  issuerId: "issuer-uncovered",
  symbol: "UNC",
};
function ledger(
  identities: readonly ManagedEodIdentity[],
): PersonalPortfolioLedgerPayloadV3 {
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: digest,
    basisMethod: "fifo_with_opening_pool",
    identities,
    opening: {
      asOfDate: "2026-10-01",
      cashUsd: null,
      holdings: identities.map((identity) => ({
        listingId: identity.listingId,
        shares: "2.000002",
        totalCostBasisUsd: null,
        confirmedOn: "2026-10-01",
      })),
    },
    transactions: [],
  };
}
async function fixture(listings = [first, alternate, second, uncovered]) {
  const annualReport = vi.fn(() =>
    Promise.reject(new Error("No Annual read before Run")),
  );
  const model = new ManagedFinancialScreen(
    {
      resolve: (request) =>
        Promise.resolve({
          snapshotSha256: digest,
          results: request.listingIds.map((listingId) => ({
            listingId,
            listing: listings.find(
              (listing) => listing.listingId === listingId,
            )!,
          })),
        }),
      annualReport,
    },
    vi.fn(),
    undefined,
    {
      listingIds: listings.map((listing) => listing.listingId),
      coverage: createManagedResearchCoverageFixture(
        listings
          .filter((listing) => listing !== uncovered)
          .map((listing, index) => ({
            listing,
            cik:
              listing.issuerId === first.issuerId
                ? "0000000001"
                : String(index + 2).padStart(10, "0"),
          })),
      ),
    },
  );
  model.reconcile(digest, true, true);
  await model.loadUniverse(model.getSnapshot());
  const screen = model.getSnapshot();
  return {
    model,
    screen,
    annualReport,
    coveredMembers: screen.memberships.filter((member) =>
      model.hasCoverage(member),
    ),
  };
}

describe("Portfolio company selection planning", () => {
  it("shows every holding, eligibility reason and exact quantity in projection order", async () => {
    const f = await fixture();
    const authored = ledger([second, outside, first, uncovered]);
    const raw = JSON.stringify(authored);
    const projection = projectPersonalPortfolioLedger(authored);
    const plan = prepareManagedPortfolioScreenSelection({ ...f, projection });
    expect(plan.canApply).toBe(true);
    expect(plan.rows.map((row) => row.status)).toEqual([
      "included",
      "outside_cohort",
      "included",
      "uncovered",
    ]);
    expect(plan.members.map((member) => member.listing.listingId)).toEqual([
      second.listingId,
      first.listingId,
    ]);
    expect(plan.rows.every((row) => row.reason.length > 0)).toBe(true);
    expect(plan.rows[0]!.holding.shares).toBe("2.000002");
    expect(plan.rows[0]!.holding.confirmedOn).toBe("2026-10-01");
    expect(plan.rows[1]!.holding.identity).toEqual(outside);
    expect(JSON.stringify(authored)).toBe(raw);
    expect(f.annualReport).not.toHaveBeenCalled();
    expect(Object.isFrozen(plan.rows[0])).toBe(true);
    expect(Object.isFrozen(plan.members)).toBe(true);
  });
  it("requires an explicit eligible held share class without changing holding order", async () => {
    const f = await fixture();
    const projection = projectPersonalPortfolioLedger(
      ledger([second, alternate, first]),
    );
    const initial = prepareManagedPortfolioScreenSelection({
      ...f,
      projection,
    });
    expect(initial.canApply).toBe(false);
    expect(initial.choiceGroups).toHaveLength(1);
    expect(initial.choiceGroups[0]!.selected).toBeNull();
    expect(initial.rows.map((row) => row.status)).toEqual([
      "included",
      "choice_required",
      "choice_required",
    ]);
    const chosen = initial.choiceGroups[0]!.members[0]!;
    const plan = prepareManagedPortfolioScreenSelection({
      ...f,
      projection,
      choices: [chosen],
    });
    expect(plan.canApply).toBe(true);
    expect(plan.choiceGroups[0]!.selected).toBe(chosen);
    expect(plan.rows.map((row) => row.status)).toEqual([
      "included",
      "included",
      "other_share_class",
    ]);
    expect(plan.members.map((member) => member.listing.listingId)).toEqual([
      second.listingId,
      alternate.listingId,
    ]);
    expect(plan.rows[2]!.holding.identity).toEqual(first);
  });
  it("refuses foreign, unheld, duplicate and two-class choices rather than guessing", async () => {
    const f = await fixture();
    const projection = projectPersonalPortfolioLedger(
      ledger([first, alternate]),
    );
    const [a, b, unheld] = f.screen.memberships;
    for (const choices of [[{ ...a! }], [unheld!], [a!, a!], [a!, b!]]) {
      const plan = prepareManagedPortfolioScreenSelection({
        ...f,
        projection,
        choices,
      });
      expect(plan.canApply).toBe(false);
      expect(plan.reason).toContain("Choose only one current eligible");
    }
  });
  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)("checks complete current identity field %s", async (key) => {
    const f = await fixture();
    const changed = {
      ...first,
      [key]:
        key === "country"
          ? "CA"
          : key === "exchangeMic"
            ? "XNYS"
            : key === "instrumentType"
              ? "adr"
              : "CHANGED",
    };
    // Country is invalid in a US Portfolio and is rejected by the real projection.
    const projection = projectPersonalPortfolioLedger(ledger([changed]));
    const plan = prepareManagedPortfolioScreenSelection({ ...f, projection });
    expect(plan.canApply).toBe(false);
    if (key !== "country" && key !== "listingId")
      expect(plan.rows[0]!.status).toBe("identity_mismatch");
    if (key === "listingId")
      expect(plan.rows[0]!.status).toBe("outside_cohort");
  });
  it("blocks every selection on catalog drift while keeping all holdings visible", async () => {
    const f = await fixture();
    const projection = projectPersonalPortfolioLedger({
      ...ledger([first, outside]),
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    });
    const plan = prepareManagedPortfolioScreenSelection({ ...f, projection });
    expect(plan.canApply).toBe(false);
    expect(plan.rows.map((row) => row.status)).toEqual([
      "identity_mismatch",
      "identity_mismatch",
    ]);
  });
  it("uses only positive projected holdings and exact split-adjusted shares", async () => {
    const f = await fixture();
    const base = ledger([first, second, outside]);
    const authored = {
      ...base,
      opening: { ...base.opening, holdings: base.opening.holdings.slice(0, 2) },
      transactions: [
        {
          id: "manual-split",
          date: "2026-10-02",
          type: "split" as const,
          listingId: first.listingId,
          ratioNumerator: "3",
          ratioDenominator: "2",
        },
        {
          id: "sold-one",
          date: "2026-10-03",
          type: "sell" as const,
          listingId: second.listingId,
          shares: "2.000002",
          grossUsd: "1.00",
          feeUsd: "0.00",
        },
      ],
    };
    const projection = projectPersonalPortfolioLedger(authored);
    expect(projection.status).toBe("valid");
    const plan = prepareManagedPortfolioScreenSelection({ ...f, projection });
    expect(plan.canApply).toBe(true);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]!.holding.shares).toBe("3.000003");
    expect(plan.rows[0]!.holding.identity).toEqual(first);
  });
  it("refuses uninitialized, invalid, empty and entirely ineligible portfolios", async () => {
    const f = await fixture();
    for (const projection of [
      null,
      projectPersonalPortfolioLedger({}),
      projectPersonalPortfolioLedger(ledger([])),
      projectPersonalPortfolioLedger(ledger([outside, uncovered])),
    ]) {
      const plan = prepareManagedPortfolioScreenSelection({ ...f, projection });
      expect(plan.canApply).toBe(false);
      expect(plan.members).toEqual([]);
      expect(plan.reason).toBeTruthy();
    }
  });
  it("keeps holdings visible before cohort loading and blocks staged or inactive screen state", async () => {
    const f = await fixture();
    const projection = projectPersonalPortfolioLedger(ledger([first]));
    const unloaded = prepareManagedPortfolioScreenSelection({
      ...f,
      projection,
      screen: { ...f.screen, memberships: [] },
    });
    expect(unloaded.rows[0]!.status).toBe("cohort_unloaded");
    expect(unloaded.canApply).toBe(false);
    for (const screen of [
      { ...f.screen, criteriaStaged: true },
      { ...f.screen, active: false },
      { ...f.screen, catalogChanged: true },
    ])
      expect(
        prepareManagedPortfolioScreenSelection({ ...f, projection, screen })
          .canApply,
      ).toBe(false);
  });
});
