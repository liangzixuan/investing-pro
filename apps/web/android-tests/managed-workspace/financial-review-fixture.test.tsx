import { describe, expect, it } from "vitest";
import { derivePersonalSecAnnualFinancialReview } from "@research-cockpit/personal-financial-analytics";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";

describe("invented native Financial review journey", () => {
  it("uses admitted independent facts, one complete Unicode append, retained failed/Cancel source, explicit Save/reload and retired late completion", async () => {
    const fixture = await createFixture("annual-financial-review");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        marketsCohort: fixture.marketsCohort,
        priceCoverage: fixture.priceCoverage,
      },
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    workspace.move("listing-zero", 1);
    workspace.note("listing-zero", fixture.financialReview!.prefix);
    const member = workspace.coordinator.getSnapshot().draft!.memberships[1]!;
    workspace.openWatchlistAnnual(member);
    workspace.setNavigationBlocked(true);
    await workspace.setCompanyRoute({
      kind: "company",
      listingId: "listing-zero",
      section: "annual",
    });
    const selection = workspace.getSnapshot().research!.selection;
    expect(fixture.getSnapshot().annual).toBe(0);
    await workspace.annual.load();
    const packet = workspace.annual.getSnapshot().response!;
    expect(packet.evidence.observations).toEqual([]);
    expect(
      derivePersonalSecAnnualFinancialReview(packet.evidence).map((row) =>
        row.value.status === "available" ? row.value.value : row.value.reason,
      ),
    ).toEqual(["250.125", "120.125", "-80.125", "0", "-7.5"]);
    const keys = ["operatingIncome", "shareholdersEquity"] as const;
    const prepare = () =>
      workspace.prepareFinancialReview(selection, packet, keys).preview!;
    const first = prepare();
    expect(first).not.toBeNull();
    expect(first.note).toBe(fixture.financialReview!.expectedNote);
    expect(first.note).toContain(
      "USD 250.125; period 2025-01-01 to 2025-12-31",
    );
    expect(first.note).toContain("USD -7.5; as of 2025-12-31");
    expect(first.note.match(/sec-fact:[a-f0-9]{64}/gu)).toHaveLength(2);
    expect(first.note).toContain(
      "Company Facts available, captured 2026-09-20T00:00:01.000Z",
    );
    workspace.note("listing-zero", first.note);
    workspace.note("listing-zero", fixture.financialReview!.prefix);
    expect(workspace.financialReviewPreviewIsCurrent(first)).toBe(false);
    expect(workspace.appendFinancialReview(first).appended).toBe(false);
    const preview = prepare();
    expect(workspace.appendFinancialReview(preview).appended).toBe(true);
    expect(workspace.appendFinancialReview(preview).appended).toBe(false);
    const draft = workspace.coordinator.getSnapshot().draft;
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: packet,
      showingPrevious: true,
      error: true,
    });
    const cancelled = workspace.annual.load();
    workspace.annual.cancel();
    fixture.settleCancelledRead();
    await cancelled;
    await Promise.resolve();
    expect(workspace.annual.getSnapshot().response).toBe(packet);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(fixture.getSnapshot()).toMatchObject({
      annual: 3,
      save: 0,
      aborted: 1,
      lateResolved: 1,
      refreshFailed: 1,
    });
    await workspace.coordinator.save();
    await workspace.coordinator.load();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      dirty: false,
      draft: {
        memberships: [
          { listingId: "listing-one", note: "Invented second note" },
          { listingId: "listing-zero", note: first.note },
        ],
      },
    });
    workspace.closeResearch();
    workspace.setNavigationBlocked(false);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!,
    );
    expect(workspace.annual.getSnapshot().response).toBeNull();
    const retired = workspace.annual.load();
    await workspace.refreshCatalog();
    fixture.settleCancelledRead();
    await retired;
    await Promise.resolve();
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(fixture.getSnapshot()).toMatchObject({
      annual: 4,
      save: 1,
      load: 2,
      status: 2,
      aborted: 2,
      lateResolved: 2,
      eod: 0,
      filings: 0,
      resolve: 0,
      search: 0,
      marketsEod: 0,
      calendar: 0,
      fed: 0,
      token: 0,
      signOut: 0,
    });
  });

  it("rejects an early Save, reload and unissued late response", async () => {
    const fixture = await createFixture("annual-financial-review");
    const signal = new AbortController().signal;
    const original = await fixture.api.load(signal);
    await expect(
      fixture.api.save(
        {
          expectedVersion: 1,
          idempotencyKey: "invented-invalid",
          payload: original.payload,
        },
        signal,
      ),
    ).rejects.toThrow();
    expect(fixture.getSnapshot().save).toBe(1);
    expect(fixture.getSnapshot().annual).toBe(0);
    expect(() => fixture.api.load(signal)).toThrow(
      "Unexpected financial review watchlist read",
    );
    expect(() => fixture.settleCancelledRead()).toThrow(
      "Only an aborted financial review read may settle",
    );
  });
});
