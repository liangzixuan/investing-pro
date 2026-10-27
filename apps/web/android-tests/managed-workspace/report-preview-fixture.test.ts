import { describe, expect, it } from "vitest";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import {
  companyReportIsCurrent,
  prepareCompanyReport,
} from "../../src/clerk-trial/managed-company-report";

describe("composed prepared company report", () => {
  it("keeps explicit source counts and the exact draft across navigation, edit, close and retirement", async () => {
    const fixture = await createFixture("company-snapshot");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        researchCoverage: fixture.researchCoverage,
        priceCoverage: fixture.priceCoverage,
      },
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    workspace.note("listing-zero", "Draft survives native Back");
    workspace.move("listing-zero", 1);
    const member = workspace.coordinator.getSnapshot().draft!.memberships[1]!;
    workspace.openWatchlistAnnual(member);
    const selected = workspace.getSnapshot().research!.selection;
    const evidence = () =>
      companySnapshotEvidence(
        selected,
        workspace.eod.getSnapshot(),
        workspace.annual.getSnapshot(),
        workspace.filings.getSnapshot(),
        workspace.interim.getSnapshot(),
      );
    const currentDraft = () => workspace.getResearchWatchlist(selected);
    expect(
      prepareCompanyReport(selected, evidence(), currentDraft()),
    ).toBeNull();
    workspace.switchToEod();
    await workspace.eod.load();
    workspace.switchToAnnual();
    await workspace.annual.load();
    workspace.switchToFilings();
    await workspace.filings.load();
    const before = structuredClone(workspace.coordinator.getSnapshot().draft);
    const prepared = prepareCompanyReport(
      selected,
      evidence(),
      currentDraft(),
    )!;
    expect(prepared.note).toBe("Draft survives native Back");
    workspace.switchToAnnual();
    expect(
      companyReportIsCurrent(
        prepared,
        workspace.getSnapshot().research!.selection,
        evidence(),
        currentDraft(),
      ),
    ).toBe(true);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(before);
    workspace.note("listing-zero", "Draft survives native Back changed");
    expect(
      companyReportIsCurrent(prepared, selected, evidence(), currentDraft()),
    ).toBe(false);
    const updated = prepareCompanyReport(selected, evidence(), currentDraft())!;
    expect(updated.note).toBe("Draft survives native Back changed");
    workspace.closeResearch();
    workspace.openWatchlistAnnual(member);
    expect(workspace.getSnapshot().research).toBeNull(); // The old member has an intervening note edit.
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!,
    );
    expect(
      companyReportIsCurrent(
        updated,
        workspace.getSnapshot().research!.selection,
        evidence(),
        currentDraft(),
      ),
    ).toBe(false);
    expect(
      prepareCompanyReport(
        workspace.getSnapshot().research!.selection,
        evidence(),
        currentDraft(),
      ),
    ).toBeNull();
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
    ).toBe("Draft survives native Back changed");
    workspace.coordinator.retire();
    expect(fixture.getSnapshot()).toMatchObject({
      eod: 1,
      annual: 1,
      filings: 1,
      save: 0,
      token: 0,
      signOut: 0,
    });
    expect(workspace.coordinator.getSnapshot().phase).toBe("retired");
    expect(
      prepareCompanyReport(selected, evidence(), currentDraft()),
    ).toBeNull();
  });
});
