import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { CompanySnapshotView } from "../../src/clerk-trial/ManagedCompanySnapshot";

async function setup() {
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
  return { fixture, workspace, member };
}

describe("bounded native company-snapshot journey", () => {
  it("combines three explicit packets without changing the draft and clears them for a new visit", async () => {
    const { fixture, workspace, member } = await setup();
    const before = structuredClone(workspace.coordinator.getSnapshot().draft);
    const html = () =>
      renderToStaticMarkup(
        <CompanySnapshotView
          navigationPending={false}
          evidence={companySnapshotEvidence(
            workspace.getSnapshot().research!.selection,
            workspace.eod.getSnapshot(),
            workspace.annual.getSnapshot(),
            workspace.filings.getSnapshot(),
          )}
          onSection={() => {}}
        />,
      );
    expect(html()).toContain("No filing metadata loaded");
    workspace.switchToEod();
    await workspace.eod.load();
    workspace.switchToAnnual();
    await workspace.annual.load();
    workspace.switchToFilings();
    expect(fixture.getSnapshot()).toMatchObject({
      eod: 1,
      annual: 1,
      filings: 0,
      save: 0,
    });
    await workspace.filings.load();
    const result = html();
    for (const text of [
      "101.5",
      "1000",
      "2025-01-01",
      "Newest observed filing",
      "26 loaded filings",
      "2026-06-23 to 2026-09-20",
      "0000000001-26-000001",
      "2026-09-20T00:00:01.000Z",
    ])
      expect(result).toContain(text);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(before);
    expect(fixture.getSnapshot()).toMatchObject({
      eod: 1,
      annual: 1,
      filings: 1,
      save: 0,
      token: 0,
      signOut: 0,
    });
    workspace.closeResearch();
    workspace.openWatchlistAnnual(member);
    expect(html()).toContain("No filing metadata loaded");
    expect(html()).not.toContain("Newest observed filing");
    expect(html()).not.toContain("Last raw close · USD</dt><dd");
    expect(workspace.coordinator.getSnapshot().draft).toEqual(before);
    workspace.coordinator.retire();
  });

  it("refuses early, changed, cancelled and repeated synthetic filing reads", async () => {
    const { fixture, workspace } = await setup();
    const request = {
      schemaVersion: "1.0.0" as const,
      catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
      listingId: "listing-zero",
      symbol: "ZERO",
    };
    const signal = new AbortController().signal;
    expect(() => fixture.api.recentFilings(request, signal)).toThrow(
      "Unexpected invented snapshot filings request",
    );
    workspace.switchToEod();
    await workspace.eod.load();
    workspace.switchToAnnual();
    await workspace.annual.load();
    const aborted = new AbortController();
    aborted.abort();
    expect(() => fixture.api.recentFilings(request, aborted.signal)).toThrow(
      "Unexpected invented snapshot filings request",
    );
    for (const changed of [
      { ...request, listingId: "listing-one" },
      { ...request, symbol: "ONE" },
      {
        ...request,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const,
      },
    ])
      expect(() => fixture.api.recentFilings(changed, signal)).toThrow(
        "Unexpected invented snapshot filings request",
      );
    expect(fixture.getSnapshot().filings).toBe(0);
    workspace.switchToFilings();
    await workspace.filings.load();
    expect(
      workspace.filings.getSnapshot().response?.issuer.filings,
    ).toHaveLength(26);
    expect(() => fixture.api.recentFilings(request, signal)).toThrow(
      "Unexpected invented snapshot filings request",
    );
    expect(fixture.getSnapshot()).toMatchObject({
      filings: 1,
      save: 0,
      token: 0,
      signOut: 0,
    });
    workspace.coordinator.retire();
  });
});
