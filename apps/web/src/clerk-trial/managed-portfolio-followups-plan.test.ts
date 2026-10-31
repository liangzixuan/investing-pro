import { describe, expect, it } from "vitest";
import {
  projectPersonalPortfolioLedger,
  type ManagedEodIdentity,
  type PersonalPortfolioLedgerPayloadV3,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import { eodSelection } from "./eod-history-fixture";
import type { FollowupsReviewContext } from "./managed-research-followups";
import { prepareManagedPortfolioFollowupsPlan as plan } from "./managed-portfolio-followups-plan";

const digest = eodSelection.catalogSnapshotSha256;
const first = eodSelection.listing;
const alternate = {
  ...first,
  listingId: "listing-class-c",
  securityId: "security-class-c",
  shareClassId: "class-c",
  shareClassName: "Class C",
  securityName: "Invented Class C",
  symbol: "ZEROC",
};
function listing(index: number): ManagedEodIdentity {
  return {
    ...first,
    listingId: `listing-${index}`,
    issuerId: `issuer-${index}`,
    securityId: `security-${index}`,
    shareClassId: `class-${index}`,
  };
}
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
function check(identity = first, index = 1): ResearchFollowup {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    catalogSnapshotSha256: digest,
    listing: identity,
    check: `Full invented question ${index}`,
    result: "  Raw result 東京 📈\nsecond line  ",
    dueOn: "2026-10-31",
    status: "open",
    completedOn: null,
  };
}
function context(entries: readonly ResearchFollowup[]): FollowupsReviewContext {
  return {
    scope: {},
    draft: { schemaVersion: 1, entries },
    catalogSnapshotSha256: digest,
    assessedOn: "2026-10-31",
  };
}

describe("current holdings due-check plan", () => {
  it("retains both share classes, full raw evidence and a holding with no check without mutating either source", () => {
    const projection = projectPersonalPortfolioLedger(
      ledger([first, alternate, listing(3)]),
    );
    if (projection.status !== "valid")
      throw new Error("Invalid invented ledger");
    const entries = [
      { ...check(first), check: "📈".repeat(500), dueOn: "2026-10-30" },
      check(alternate, 2),
    ];
    const input = { projection, context: context(entries) };
    const before = JSON.stringify(input);
    const result = plan(input);
    expect(result.status).toBe("ready");
    expect(result.assessedOn).toBe("2026-10-31");
    expect(result.eligible).toEqual(entries);
    expect(result.eligible[0]).toBe(entries[0]);
    expect(result.checks.map((row) => row.due)).toEqual(["overdue", "today"]);
    expect(result.holdings[0]!.holding).toBe(projection.portfolio.holdings[0]);
    expect(result.holdings[0]!.holding).toMatchObject({
      shares: "2.000002",
      totalCostBasisUsd: null,
      confirmedOn: "2026-10-01",
    });
    expect(result.holdings[2]!.checks).toEqual([]);
    expect(result.checks[0]!.entry.result).toBe(entries[0]!.result);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.eligible)).toBe(true);
    expect(Object.isFrozen(result.checks[0]!.reasons)).toBe(true);
  });
  it("retains every excluded check with independent due and identity facts", () => {
    const identities = Array.from({ length: 5 }, (_, i) => listing(i));
    const entries: ResearchFollowup[] = [
      { ...check(identities[0], 1), dueOn: "2999-12-31" },
      {
        ...check(identities[1], 2),
        status: "completed",
        completedOn: "2026-10-30",
      },
      { ...check(identities[2], 3), dueOn: "2026-02-30" },
      {
        ...check(identities[3], 4),
        listing: { ...identities[3]!, issuerName: "Changed name" },
      },
      check(listing(99), 5),
    ];
    const result = plan({
      projection: projectPersonalPortfolioLedger(ledger(identities)),
      context: context(entries),
    });
    expect(result.checks.map((row) => row.due)).toEqual([
      "later",
      "completed",
      "invalid_date",
      "today",
      "today",
    ]);
    expect(result.checks.map((row) => row.identity)).toEqual([
      "matched",
      "matched",
      "matched",
      "mismatch",
      "not_held",
    ]);
    expect(result.eligible).toEqual([]);
    expect(result.checks.map((row) => row.entry)).toEqual(entries);
    expect(result.checks.every((row) => row.reasons.length === 2)).toBe(true);
    expect(result.holdings[3]!.checks[0]).toBe(entries[3]);
    expect(result.holdings[4]!.checks).toEqual([]);
  });
  it.each(Object.keys(first) as (keyof ManagedEodIdentity)[])(
    "rejects an altered exact identity field: %s",
    (key) => {
      const entry = check();
      const changed = {
        ...entry,
        listing: { ...entry.listing, [key]: `${entry.listing[key]}-changed` },
      };
      const result = plan({
        projection: projectPersonalPortfolioLedger(ledger([first])),
        context: context([changed]),
      });
      expect(result.eligible).toEqual([]);
      expect(result.checks[0]!.identity).toBe(
        key === "listingId" ? "not_held" : "mismatch",
      );
    },
  );
  it("distinguishes unavailable, invalid, valid empty, unloaded Follow-ups and catalog mismatch", () => {
    const ctx = context([check()]);
    const missing = plan({ projection: null, context: ctx });
    expect(missing.status).toBe("portfolio_unavailable");
    expect(missing.checks[0]!.identity).toBe("unavailable");
    const invalid = plan({
      projection: projectPersonalPortfolioLedger({}),
      context: ctx,
    });
    expect(invalid.status).toBe("portfolio_invalid");
    expect(invalid.checks[0]!.entry).toBe(ctx.draft.entries[0]);
    const empty = plan({
      projection: projectPersonalPortfolioLedger(ledger([])),
      context: ctx,
    });
    expect(empty).toMatchObject({
      status: "ready",
      holdings: [],
      eligible: [],
    });
    expect(empty.checks[0]!.identity).toBe("not_held");
    const projection = projectPersonalPortfolioLedger(ledger([first]));
    const unloaded = plan({ projection, context: null });
    expect(unloaded).toMatchObject({
      status: "followups_unavailable",
      checks: [],
      eligible: [],
    });
    expect(unloaded.holdings).toHaveLength(1);
    const mismatch = plan({
      projection,
      context: { ...ctx, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` },
    });
    expect(mismatch.status).toBe("catalog_mismatch");
    expect(mismatch.checks[0]!.identity).toBe("mismatch");
    expect(mismatch.eligible).toEqual([]);
  });
  it("refuses a stale check catalog and does not renew an invalid captured assessment day", () => {
    const projection = projectPersonalPortfolioLedger(ledger([first]));
    const old = {
      ...check(),
      catalogSnapshotSha256: `sha256:${"c".repeat(64)}` as const,
    };
    expect(
      plan({ projection, context: context([old]) }).checks[0],
    ).toMatchObject({ identity: "mismatch", eligible: false });
    expect(
      plan({
        projection,
        context: { ...context([check()]), assessedOn: "2026-02-30" },
      }),
    ).toMatchObject({
      status: "followups_unavailable",
      assessedOn: null,
      eligible: [],
    });
  });
  it("uses the exact projected split quantity and excludes a fully sold position", () => {
    const base = ledger([first, alternate]);
    const projection = projectPersonalPortfolioLedger({
      ...base,
      transactions: [
        {
          id: "invented-split",
          date: "2026-10-02",
          type: "split",
          listingId: first.listingId,
          ratioNumerator: "3",
          ratioDenominator: "2",
        },
        {
          id: "invented-sale",
          date: "2026-10-03",
          type: "sell",
          listingId: alternate.listingId,
          shares: "2.000002",
          grossUsd: "1.00",
          feeUsd: "0.00",
        },
      ],
    });
    expect(projection.status).toBe("valid");
    const result = plan({
      projection,
      context: context([check(), check(alternate, 2)]),
    });
    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0]!.holding.shares).toBe("3.000003");
    expect(result.checks[1]!.identity).toBe("not_held");
    expect(result.eligible).toHaveLength(1);
  });
});
