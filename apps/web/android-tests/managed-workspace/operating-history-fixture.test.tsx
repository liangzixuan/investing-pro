import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { SecAnnualEvidenceResult } from "../../src/features/research/SecAnnualEvidenceResult";
import {
  comparePersonalSecAnnualCanonicalOperatingEvidence,
  resolvePersonalSecAnnualCanonicalOperatingHistory,
} from "@research-cockpit/personal-financial-analytics";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import {
  prepareCompanyReport,
  companyReportIsCurrent,
} from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";

describe("invented operating history lifetime", () => {
  it("retains, cancels, replaces, serializes and retires the actual loaded graph without incidental reads or writes", async () => {
    const fixture = await createFixture("annual-operating-history");
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
    workspace.note("listing-zero", "Operating history draft");
    const draft = structuredClone(workspace.coordinator.getSnapshot().draft);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const selection = workspace.getSnapshot().research!.selection;
    const evidence = () =>
      companySnapshotEvidence(
        selection,
        workspace.eod.getSnapshot(),
        workspace.annual.getSnapshot(),
        workspace.filings.getSnapshot(),
        workspace.interim.getSnapshot(),
      );
    const history = () =>
      resolvePersonalSecAnnualCanonicalOperatingHistory(
        workspace.annual.getSnapshot().response!.evidence,
        "Revenues",
      );
    const comparison = () =>
      comparePersonalSecAnnualCanonicalOperatingEvidence(
        workspace.annual.getSnapshot().response!.evidence,
        "Revenues",
      );
    const html = () =>
      renderToStaticMarkup(
        <SecAnnualEvidenceResult
          response={workspace.annual.getSnapshot().response!}
          view={workspace.annual.getSnapshot().view!}
          appearance="financial"
        />,
      );
    expect(fixture.getSnapshot().annual).toBe(0);
    await workspace.annual.load();
    const initial = workspace.annual.getSnapshot().response!;
    expect(history()).toMatchObject({
      status: "available",
      periods: [
        {
          operatingIncome: "-250.125",
          revenue: "1000",
          operatingMarginPercent: "-25.01",
        },
        { operatingIncome: "0", revenue: "800", operatingMarginPercent: "0" },
        {
          operatingIncome: "80.125",
          revenue: "640",
          operatingMarginPercent: "12.52",
        },
      ],
    });
    const initialComparison = comparison();
    expect(initialComparison).toMatchObject({
      status: "available",
      operatingIncomeDifference: "-250.125",
      operatingMarginChange: {
        prior: "0",
        current: "-25.01",
        difference: "-25.01",
        direction: "lower",
      },
    });
    expect(html()).toContain("Revenue · 3 periods");
    const prepared = prepareCompanyReport(
      selection,
      evidence(),
      workspace.getResearchWatchlist(selection),
    )!;
    const document = formatCompanyReportDocument(prepared)!;
    const captured = (
      JSON.parse(document.text) as {
        sources: { annual: { response: typeof initial } };
      }
    ).sources.annual.response;
    expect(captured).toEqual(initial);
    expect(
      resolvePersonalSecAnnualCanonicalOperatingHistory(
        captured.evidence,
        "Revenues",
      ),
    ).toEqual(history());
    expect(
      comparePersonalSecAnnualCanonicalOperatingEvidence(
        captured.evidence,
        "Revenues",
      ),
    ).toEqual(initialComparison);
    await workspace.annual.load();
    expect(comparison()).toEqual(initialComparison);
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: initial,
      showingPrevious: true,
    });
    const cancelled = workspace.annual.load();
    workspace.annual.cancel();
    fixture.settleCancelledRead();
    await cancelled;
    expect(workspace.annual.getSnapshot().response).toBe(initial);
    expect(comparison()).toEqual(initialComparison);
    expect(html()).toContain("Revenue · 3 periods");
    expect(
      companyReportIsCurrent(
        prepared,
        selection,
        evidence(),
        workspace.getResearchWatchlist(selection),
      ),
    ).toBe(false);
    const retained = prepareCompanyReport(
      selection,
      evidence(),
      workspace.getResearchWatchlist(selection),
    )!;
    expect(
      JSON.parse(formatCompanyReportDocument(retained)!.text) as unknown,
    ).toMatchObject({ sources: { annual: { response: initial } } });
    await workspace.annual.load();
    expect(history()).toMatchObject({
      status: "available",
      periods: [
        {
          operatingIncome: "125.25",
          revenue: "750",
          operatingMarginPercent: "16.7",
        },
        { operatingIncome: "0", revenue: "600", operatingMarginPercent: "0" },
      ],
      stoppedReason: "no_report_period",
    });
    expect(comparison()).toMatchObject({
      status: "available",
      operatingIncomeDifference: "125.25",
      operatingMarginChange: {
        prior: "0",
        current: "16.7",
        difference: "16.7",
        direction: "higher",
      },
    });
    expect(
      comparePersonalSecAnnualCanonicalOperatingEvidence(
        captured.evidence,
        "Revenues",
      ),
    ).toEqual(initialComparison);
    expect(html()).toContain("Revenue · 2 periods");
    expect(
      companyReportIsCurrent(
        prepared,
        selection,
        evidence(),
        workspace.getResearchWatchlist(selection),
      ),
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(draft);
    const retirement = workspace.annual.load();
    await workspace.refreshCatalog();
    fixture.settleCancelledRead();
    await retirement;
    expect(workspace.annual.getSnapshot()).toMatchObject({
      selection: null,
      response: null,
    });
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      annual: 5,
      aborted: 2,
      lateResolved: 2,
      refreshFailed: 1,
      load: 1,
      save: 0,
      status: 2,
      eod: 0,
      filings: 0,
      calendar: 0,
      fed: 0,
      token: 0,
      signOut: 0,
    });
  });
});
