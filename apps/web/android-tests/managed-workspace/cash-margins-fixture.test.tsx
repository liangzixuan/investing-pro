import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";
import { cashMarginsResponse } from "../../src/features/research/sec-annual-cash-margins-fixture";
import { cashRow } from "../../src/features/research/sec-annual-cash-fixture";
import { SecAnnualEvidenceResult } from "../../src/features/research/SecAnnualEvidenceResult";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { TrialApiError } from "../../src/clerk-trial/api";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import {
  prepareCompanyReport,
  companyReportIsCurrent,
} from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";

function heldRead() {
  let finish!: (response: PersonalSecAnnualEvidenceResponseDto) => void;
  const promise = new Promise<PersonalSecAnnualEvidenceResponseDto>(
    (resolve) => {
      finish = resolve;
    },
  );
  return { promise, finish };
}

describe("strictly admitted cash margins in the managed workspace", () => {
  it("loads explicitly, retains failed and cancelled evidence, replaces the packet, and fences company/session late replies with both drafts intact", async () => {
    const fixture = await createFixture("research-followups");
    const first = await cashMarginsResponse();
    const replacement = await cashMarginsResponse({
      cutoffAt: "2026-09-21T00:00:00.000Z",
      cashRows: [
        cashRow("operating_cash_flow", "100"),
        cashRow("ppe_purchases", "200"),
      ],
    });
    const cancelled = heldRead();
    const changedCompany = heldRead();
    const retired = heldRead();
    const annual = vi
      .fn<ManagedApi["annualReport"]>()
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new TrialApiError("unavailable"))
      .mockReturnValueOnce(cancelled.promise)
      .mockResolvedValueOnce(replacement)
      .mockReturnValueOnce(changedCompany.promise)
      .mockReturnValueOnce(retired.promise);
    const workspace = new ManagedWorkspace(
      { ...fixture.api, annualReport: annual },
      fixture.session,
      undefined,
      {
        priceCoverage: fixture.priceCoverage,
        marketsCohort: fixture.marketsCohort,
      },
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    await workspace.followups.coordinator.load();
    workspace.setView("watchlist");
    workspace.note("listing-zero", "Cash review · Café 東京  ");
    const watchlist = workspace.coordinator.getSnapshot().draft!;
    workspace.followups.add(watchlist.memberships[0]!, "2026-10-30");
    const entryId = workspace.followups.getSnapshot().selectedId!;
    workspace.followups.edit(
      workspace.followups.currentEntry(entryId)!,
      "check",
      "Keep independent cash check  ",
    );
    const followups = workspace.followups.coordinator.getSnapshot().draft;
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
    expect(workspace.followups.coordinator.getSnapshot().dirty).toBe(true);
    workspace.openWatchlistAnnual(watchlist.memberships[0]!);
    const selection = workspace.getSnapshot().research!.selection;
    const html = () => {
      const response = workspace.annual.getSnapshot().response;
      return response
        ? renderToStaticMarkup(
            <SecAnnualEvidenceResult
              response={response}
              appearance="financial"
            />,
          )
        : "";
    };
    const evidence = () =>
      companySnapshotEvidence(
        selection,
        workspace.eod.getSnapshot(),
        workspace.annual.getSnapshot(),
        workspace.filings.getSnapshot(),
      );
    expect(annual).not.toHaveBeenCalled();
    expect(html()).toBe("");
    await workspace.annual.load();
    const initialHtml = html();
    expect(initialHtml).toContain(">10.01%<");
    expect(initialHtml).toContain(">20.02%<");
    expect(initialHtml).toContain(">12.51%<");
    expect(annual).toHaveBeenCalledTimes(1);
    expect(annual.mock.calls[0]![0]).toEqual({
      schemaVersion: "5.0.0",
      catalogSnapshotSha256: first.catalogSnapshotSha256,
      listingId: "listing-zero",
      symbol: "ZERO",
    });
    const captured = prepareCompanyReport(
      selection,
      evidence(),
      workspace.getResearchWatchlist(selection),
    );
    if (!captured) throw new Error("Expected a current captured report");
    const document = formatCompanyReportDocument(captured);
    if (!document) throw new Error("Expected canonical report document");
    expect(JSON.parse(document.text) as unknown).toMatchObject({
      sources: { annual: { response: first } },
    });
    expect(document.text).not.toContain('"cashMargins"');
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: first,
      showingPrevious: true,
      error: true,
    });
    expect(html()).toBe(initialHtml);
    expect(
      companyReportIsCurrent(
        captured,
        selection,
        evidence(),
        workspace.getResearchWatchlist(selection),
      ),
    ).toBe(false);
    const pendingCancel = workspace.annual.load();
    workspace.annual.cancel();
    expect(annual.mock.calls[2]![1].aborted).toBe(true);
    cancelled.finish(replacement);
    await pendingCancel;
    expect(workspace.annual.getSnapshot().response).toBe(first);
    expect(html()).toBe(initialHtml);
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot().response).toBe(replacement);
    for (const percentage of ["-10.00", "-20.00", "-12.50"])
      expect(html()).toContain(`>${percentage}%<`);
    expect(html()).toContain("Completed 2026-09-21T00:00:02.000Z");
    expect(JSON.parse(document.text) as unknown).toMatchObject({
      sources: { annual: { response: first } },
    });
    const pendingCompany = workspace.annual.load();
    workspace.closeResearch();
    workspace.openWatchlistAnnual(watchlist.memberships[1]!);
    expect(annual.mock.calls[4]![1].aborted).toBe(true);
    changedCompany.finish(first);
    await pendingCompany;
    expect(workspace.annual.getSnapshot().selection?.listing.listingId).toBe(
      "listing-one",
    );
    expect(html()).toBe("");
    expect(workspace.coordinator.getSnapshot().draft).toBe(watchlist);
    expect(workspace.followups.coordinator.getSnapshot().draft).toBe(followups);
    workspace.closeResearch();
    workspace.openWatchlistAnnual(watchlist.memberships[0]!);
    const pendingRetire = workspace.annual.load();
    workspace.sessionOwner.retire("Invented session ended");
    expect(annual.mock.calls[5]![1].aborted).toBe(true);
    retired.finish(replacement);
    await pendingRetire;
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: null,
      selection: null,
    });
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
    expect(workspace.followups.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
    expect(html()).toBe("");
    expect(annual).toHaveBeenCalledTimes(6);
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      save: 0,
      annual: 0,
      eod: 0,
      filings: 0,
      calendar: 0,
      fed: 0,
      token: 0,
      signOut: 0,
    });
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
  });
});
