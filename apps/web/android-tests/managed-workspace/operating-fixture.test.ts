import { viewOf } from "../../src/features/research/test-canonical-annual-ui-fixture";
import { describe, expect, it } from "vitest";
import { createFixture } from "./fixture";
import { parseSecAnnualCanonicalResponse } from "../../src/lib/sec-annual-canonical-response";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import {
  prepareCompanyReport,
  companyReportIsCurrent,
} from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";

const request = {
  schemaVersion: "6.0.0" as const,
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
  listingId: "listing-zero",
  symbol: "ZERO",
};

describe("invented operating-results acceptance", () => {
  it("decodes exact negative operating income and all three revenue margins independently of absent net income", async () => {
    const fixture = await createFixture("annual-operating-results");
    const signal = new AbortController().signal;
    await fixture.api.status(signal);
    const packet = await fixture.api.annualReport(request, signal);
    const decoded = await parseSecAnnualCanonicalResponse(
      packet,
      request,
      signal,
    );
    expect(decoded).toEqual(packet);
    if (!decoded) throw new Error("Expected admitted operating packet");
    expect(
      decoded.evidence.facts.observations.every(
        (row) => row.concept !== "NetIncomeLoss",
      ),
    ).toBe(true);
    expect(viewOf(decoded).income.resolution.pairs).toHaveLength(3);
    expect(
      viewOf(decoded).income.resolution.pairs.every(
        (pair) =>
          pair.status !== "eligible" &&
          pair.netIncome === null &&
          pair.netMarginPercent === null,
      ),
    ).toBe(true);
    const operating = viewOf(decoded).operatingResults;
    expect(operating.resolution.operatingIncome).toMatchObject({
      status: "available",
      value: "-250.125",
      unit: "USD",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      currentUseEligible: true,
    });
    expect(
      Object.fromEntries(
        operating.resolution.margins.map((basis) => [
          basis.concept,
          {
            revenue:
              basis.revenue.status === "available" ? basis.revenue.value : null,
            margin:
              basis.operatingMargin.status === "available"
                ? basis.operatingMargin.value
                : null,
          },
        ]),
      ),
    ).toEqual({
      Revenues: { revenue: "1000", margin: "-25.01" },
      SalesRevenueNet: { revenue: "800", margin: "-31.27" },
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        revenue: "500",
        margin: "-50.03",
      },
    });
    for (const basis of operating.resolution.margins) {
      expect(basis.operatingMargin.observationIds).toEqual(
        expect.arrayContaining([
          decoded.evidence.facts.observations.find(
            (row) => row.concept === "OperatingIncomeLoss",
          )!.id,
          decoded.evidence.facts.observations.find(
            (row) => row.concept === basis.concept,
          )!.id,
        ]),
      );
      expect(basis.operatingMargin.observationIds).toHaveLength(2);
    }
    expect(fixture.getSnapshot()).toMatchObject({
      annual: 1,
      status: 1,
      eod: 0,
      filings: 0,
      save: 0,
      token: 0,
      signOut: 0,
    });
    await expect(fixture.api.save({} as never, signal)).rejects.toThrow(
      "Unexpected fixture operation: save",
    );
    expect(fixture.getSnapshot().save).toBe(1);
  });

  it("keeps complete operating packets and exact unsaved notes through failure, Cancel, late replies and session retirement", async () => {
    const fixture = await createFixture("annual-operating-results");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      { priceCoverage: fixture.priceCoverage },
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    workspace.note("listing-zero", "Draft survives native Back");
    workspace.move("listing-zero", 1);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!,
    );
    const selection = workspace.getSnapshot().research!.selection;
    const evidence = () =>
      companySnapshotEvidence(
        selection,
        workspace.eod.getSnapshot(),
        workspace.annual.getSnapshot(),
        workspace.filings.getSnapshot(),
      );
    const noteState = () => workspace.getResearchWatchlist(selection);
    expect(prepareCompanyReport(selection, evidence(), noteState())).toBeNull();
    expect(fixture.getSnapshot().annual).toBe(0);
    await workspace.annual.load();
    const initial = workspace.annual.getSnapshot().response!;
    const prepared = prepareCompanyReport(selection, evidence(), noteState())!;
    const document = formatCompanyReportDocument(prepared)!;
    expect(JSON.parse(document.text)).toMatchObject({
      sources: {
        annual: { response: initial },
        price: { status: "not_loaded" },
        filings: { status: "not_loaded" },
      },
    });
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: initial,
      showingPrevious: true,
      error: true,
    });
    expect(
      companyReportIsCurrent(prepared, selection, evidence(), noteState()),
    ).toBe(false);
    const held = workspace.annual.load();
    workspace.annual.cancel();
    fixture.settleCancelledRead();
    await held;
    await Promise.resolve();
    expect(workspace.annual.getSnapshot().response).toBe(initial);
    const basis = viewOf(initial).operatingResults.resolution.margins.find(
      (basis) => basis.concept === "Revenues",
    )!;
    expect(
      workspace.getAnnualOperatingNoteAction(selection, initial, basis)
        .canAppend,
    ).toBe(true);
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, initial, basis)
        .appended,
    ).toBe(true);
    const note =
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note;
    expect(note).toContain(
      "Draft survives native Back Observed Annual operating results: ZERO (XNAS); CIK 0000000001; 10-K, 2025-01-01 to 2025-12-31.",
    );
    expect(note).toContain(
      "Reported operating income (OperatingIncomeLoss) USD -250.125; reported revenue (Revenues) USD 1000.",
    );
    expect(note).toContain("operating margin -25.01%");
    expect(note).toContain(
      "Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z",
    );
    expect(note).toContain("Retained previous report.");
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("Invented second note");
    const retained = prepareCompanyReport(selection, evidence(), noteState())!;
    expect(
      JSON.parse(formatCompanyReportDocument(retained)!.text),
    ).toMatchObject({
      authoredResearch: { note },
      sources: { annual: { response: initial } },
    });
    const retiring = workspace.annual.load();
    await workspace.refreshCatalog();
    expect(workspace.coordinator.getSnapshot().phase).toBe("retired");
    fixture.settleCancelledRead();
    await retiring;
    await Promise.resolve();
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(prepareCompanyReport(selection, evidence(), noteState())).toBeNull();
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 2,
      annual: 4,
      refreshFailed: 1,
      aborted: 2,
      lateResolved: 2,
      save: 0,
      eod: 0,
      filings: 0,
      marketsEod: 0,
      calendar: 0,
      fed: 0,
      token: 0,
      signOut: 0,
    });
  });
});
