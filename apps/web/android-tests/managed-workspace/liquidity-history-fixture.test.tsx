import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolvePersonalSecAnnualCanonicalLiquidityHistory } from "@research-cockpit/personal-financial-analytics";
import { createFixture } from "./fixture";
import { liquidityHistoryPacket } from "./liquidity-history-fixture";
import { request } from "../../src/features/research/test-canonical-annual-read-fixture";
import { parseSecAnnualCanonicalResponse } from "../../src/lib/sec-annual-canonical-response";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { SecAnnualEvidenceResult } from "../../src/features/research/SecAnnualEvidenceResult";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import {
  prepareCompanyReport,
  companyReportIsCurrent,
} from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";

describe("invented reported liquidity history", () => {
  it("admits complete comparative packets with original filing metadata and calculation-specific refusals", async () => {
    for (const replacement of [false, true]) {
      const packet = await liquidityHistoryPacket(replacement);
      const admitted = await parseSecAnnualCanonicalResponse(
        packet,
        request(),
        new AbortController().signal,
      );
      expect(admitted).not.toBeNull();
      if (!admitted) throw new Error("Comparative packet refused");
      expect(admitted).toEqual(packet);
      expect(Object.isFrozen(admitted.evidence.facts.observations)).toBe(true);
      expect(
        admitted.evidence.facts.observations.every((row) =>
          Object.isFrozen(row),
        ),
      ).toBe(true);
      expect(
        admitted.evidence.facts.observations.filter((row) =>
          [
            "Revenues",
            "SalesRevenueNet",
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "NetIncomeLoss",
          ].includes(row.concept),
        ),
      ).toEqual([]);
      expect(
        admitted.evidence.facts.observations.filter(
          (row) => row.concept === "AssetsCurrent",
        ),
      ).toHaveLength(replacement ? 4 : 3);
      expect(
        admitted.evidence.facts.observations.filter(
          (row) => row.concept === "LiabilitiesCurrent",
        ),
      ).toHaveLength(3);
      expect(
        admitted.evidence.facts.observations
          .filter((row) => row.concept === "AssetsCurrent")
          .every((row) => row.filing.reportDate === "2025-12-31"),
      ).toBe(true);
      const history = resolvePersonalSecAnnualCanonicalLiquidityHistory(
        admitted.evidence,
      );
      expect(history.status).toBe("available");
      if (history.status !== "available") throw new Error("History refused");
      expect(history.balances.map((balance) => balance.asOfDate)).toEqual(
        replacement
          ? ["2025-12-31", "2024-12-28"]
          : ["2025-12-31", "2024-12-28", "2023-12-30"],
      );
      expect(history.stopped).toEqual(
        replacement
          ? { asOfDate: "2024-06-29", reason: "no_report_date" }
          : null,
      );
      expect(
        history.balances.every(
          (balance) => balance.observationIds.length === 2,
        ),
      ).toBe(true);
      expect(admitted.evidence.generation.completedAt).toBe(
        replacement ? "2026-09-21T00:00:02.000Z" : "2026-09-20T00:00:02.000Z",
      );
    }
  });

  it("retains, cancels, replaces, captures, leaves and retires the full graph without incidental reads or writes", async () => {
    const fixture = await createFixture("annual-liquidity-history");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      { priceCoverage: fixture.priceCoverage },
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    const note = "Liquidity history thesis · Café 東京 📈";
    workspace.note("listing-zero", note);
    const draft = structuredClone(workspace.coordinator.getSnapshot().draft);
    const open = () =>
      workspace.openWatchlistAnnual(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      );
    open();
    const selection = workspace.getSnapshot().research!.selection;
    const evidence = () =>
      companySnapshotEvidence(
        selection,
        workspace.eod.getSnapshot(),
        workspace.annual.getSnapshot(),
        workspace.filings.getSnapshot(),
      );
    const history = () =>
      resolvePersonalSecAnnualCanonicalLiquidityHistory(
        workspace.annual.getSnapshot().response!.evidence,
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
    const initialHistory = history();
    expect(initialHistory).toMatchObject({
      status: "available",
      balances: [
        {
          asOfDate: "2025-12-31",
          currentAssets: "120.125",
          currentLiabilities: "180.025",
          workingCapital: { status: "available", value: "-59.9" },
          currentRatio: { status: "available", value: "0.67" },
        },
        {
          asOfDate: "2024-12-28",
          currentAssets: "-5",
          currentLiabilities: "2",
          workingCapital: { status: "unavailable", reason: "unsupported_sign" },
          currentRatio: { status: "unavailable", reason: "unsupported_sign" },
        },
        {
          asOfDate: "2023-12-30",
          currentAssets: "0",
          currentLiabilities: "0",
          workingCapital: { status: "available", value: "0" },
          currentRatio: {
            status: "unavailable",
            reason: "nonpositive_current_liabilities",
          },
        },
      ],
      stopped: null,
    });
    expect(html()).toContain("<summary>Reported liquidity history</summary>");
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
      resolvePersonalSecAnnualCanonicalLiquidityHistory(captured.evidence),
    ).toEqual(initialHistory);
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: initial,
      showingPrevious: true,
    });
    const cancelled = workspace.annual.load();
    workspace.annual.cancel();
    fixture.settleCancelledRead();
    await cancelled;
    expect(workspace.annual.getSnapshot().response).toBe(initial);
    expect(history()).toEqual(initialHistory);
    expect(html()).not.toContain("999.875");
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
      balances: [
        {
          asOfDate: "2025-12-31",
          currentAssets: "200.125",
          workingCapital: { status: "available", value: "100.125" },
          currentRatio: { status: "available", value: "2.00" },
        },
        {
          asOfDate: "2024-12-28",
          currentAssets: "60",
          workingCapital: { status: "available", value: "60" },
          currentRatio: {
            status: "unavailable",
            reason: "nonpositive_current_liabilities",
          },
        },
      ],
      stopped: { asOfDate: "2024-06-29", reason: "no_report_date" },
    });
    expect(
      resolvePersonalSecAnnualCanonicalLiquidityHistory(captured.evidence),
    ).toEqual(initialHistory);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(draft);
    workspace.closeResearch();
    expect(workspace.annual.getSnapshot().response).toBe(null);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(draft);
    open();
    expect(workspace.annual.getSnapshot().response).toBe(null);
    expect(fixture.getSnapshot().annual).toBe(4);
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
