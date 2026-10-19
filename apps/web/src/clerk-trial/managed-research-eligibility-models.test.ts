import { describe, expect, it, vi } from "vitest";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedSecAccess } from "./managed-sec-access";
import { ManagedWatchlistAnnualComparison } from "./managed-watchlist-annual-comparison";
import { ManagedWatchlistFilings } from "./managed-watchlist-filings";
import { ManagedFinancialScreen } from "./managed-financial-screen";
import { eodSelection } from "./eod-history-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";

const digest = eodSelection.catalogSnapshotSha256;
const draft: MainWatchlistPayload = {
  schemaVersion: 1,
  name: "My Watchlist",
  snapshotSha256: digest,
  memberships: [{ ...eodSelection.listing, note: "Untouched invented draft" }],
};

describe("nested research source eligibility", () => {
  it("refuses unsupported Watchlist Annual before an operation, cooldown or read even when Filings is admitted", async () => {
    const access = new ManagedSecAccess();
    const cooldown = vi.spyOn(access, "getNextAllowedAt");
    const read = vi.fn<ManagedApi["annualReport"]>();
    const model = new ManagedWatchlistAnnualComparison(read, vi.fn(), access, {
      coverage: { ...inventedManagedResearchCoverage, annualIssuers: [] },
    });
    model.reconcile(draft, digest, true, true);
    const member = model.getSnapshot().memberships[0]!;
    model.select("left", model.getSnapshot(), member);
    const before = model.getSnapshot();
    expect(before.left.report.supported).toBe(false);
    await model.load("left", member);
    expect(model.getSnapshot()).toBe(before);
    expect(before.pending).toBeNull();
    expect(cooldown).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(draft.memberships[0]!.note).toBe("Untouched invented draft");
    model.retire();
  });

  it("refuses unsupported selected Watchlist Filings before an operation, cooldown or read even when Annual is admitted", async () => {
    const access = new ManagedSecAccess();
    const cooldown = vi.spyOn(access, "getNextAllowedAt");
    const read = vi.fn<ManagedApi["recentFilings"]>();
    const model = new ManagedWatchlistFilings(read, vi.fn(), access, {
      coverage: { ...inventedManagedResearchCoverage, filingsIssuers: [] },
    });
    model.reconcile(draft, digest, true, true);
    const member = model.getSnapshot().memberships[0]!;
    model.select(model.getSnapshot(), member);
    const before = model.getSnapshot();
    expect(before.filings.supported).toBe(false);
    await model.load(member);
    expect(model.getSnapshot()).toBe(before);
    expect(before.pending).toBeNull();
    expect(cooldown).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    model.retire();
  });

  it("resolves identity without selecting or running an unsupported screen issuer", async () => {
    const access = new ManagedSecAccess();
    const cooldown = vi.spyOn(access, "getNextAllowedAt");
    const annualReport = vi.fn<ManagedApi["annualReport"]>();
    const resolve = vi.fn<ManagedApi["resolve"]>().mockResolvedValue({
      snapshotSha256: digest,
      results: [
        {
          listingId: eodSelection.listing.listingId,
          listing: eodSelection.listing,
        },
      ],
    });
    const model = new ManagedFinancialScreen(
      { resolve, annualReport },
      vi.fn(),
      access,
      {
        listingIds: [eodSelection.listing.listingId],
        coverage: { ...inventedManagedResearchCoverage, annualIssuers: [] },
      },
    );
    model.reconcile(digest, true, true);
    await model.loadUniverse(model.getSnapshot());
    const before = model.getSnapshot();
    const member = before.memberships[0]!;
    expect(model.hasCoverage(member)).toBe(false);
    expect(before.selected).toEqual([]);
    model.select(before, member, true);
    await model.run(model.getSnapshot());
    expect(model.getSnapshot()).toBe(before);
    expect(before.pending).toBeNull();
    expect(before.run).toBeNull();
    expect(resolve).toHaveBeenCalledOnce();
    expect(cooldown).not.toHaveBeenCalled();
    expect(annualReport).not.toHaveBeenCalled();
    model.retire();
  });
});
