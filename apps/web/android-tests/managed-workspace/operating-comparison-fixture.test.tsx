import { viewOf } from "../../src/features/research/test-canonical-annual-ui-fixture";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedWatchlistAnnualComparison } from "../../src/clerk-trial/ManagedWatchlistAnnualComparison";
import type { AnnualComparisonNoteCapture } from "../../src/clerk-trial/managed-watchlist-annual-comparison-note";
import { getAnnualComparisonNoteEvidence } from "../../src/clerk-trial/managed-watchlist-annual-comparison-note";
import { createFixture } from "./fixture";
import {
  operatingComparisonNoteDraft,
  operatingComparisonPrefix,
} from "./operating-comparison-fixture";

describe("invented operating Annual comparison", () => {
  it("keeps independently admitted operating values, exact Unicode note and explicit Save through all fixture lifetimes", async () => {
    const fixture = await createFixture("annual-operating-comparison");
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
    workspace.note("listing-zero", operatingComparisonPrefix);
    workspace.move("listing-zero", 1);
    const originalDraft = structuredClone(
      workspace.coordinator.getSnapshot().draft,
    );
    const model = workspace.annualComparison;
    const left = model
      .getSnapshot()
      .memberships.find((row) => row.listing.symbol === "ZERO")!;
    const right = model
      .getSnapshot()
      .memberships.find((row) => row.listing.symbol === "ONE")!;
    model.select("left", model.getSnapshot(), left);
    model.select("right", model.getSnapshot(), right);
    expect(fixture.getSnapshot().annual).toBe(0);
    await model.load("left", left);
    await model.load("right", right);
    const leftPacket = model.getSnapshot().left.report.response!;
    const rightPacket = model.getSnapshot().right.report.response!;
    for (const packet of [leftPacket, rightPacket]) {
      expect(
        packet.evidence.facts.observations.every(
          (row) => row.concept !== "NetIncomeLoss",
        ),
      ).toBe(true);
      expect(
        viewOf(packet).income.resolution.pairs.every(
          (pair) => pair.netIncome === null && pair.netMarginPercent === null,
        ),
      ).toBe(true);
    }
    expect(
      viewOf(leftPacket).operatingResults.resolution.operatingIncome,
    ).toMatchObject({
      status: "available",
      value: "-250.125",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    expect(
      viewOf(rightPacket).operatingResults.resolution.operatingIncome,
    ).toMatchObject({
      status: "available",
      value: "125.25",
      startDate: "2024-07-01",
      endDate: "2025-06-30",
    });
    expect(
      viewOf(leftPacket).operatingResults.resolution.margins.find(
        (row) =>
          row.concept === "RevenueFromContractWithCustomerExcludingAssessedTax",
      )?.operatingMargin,
    ).toMatchObject({ status: "available", value: "-50.03" });
    expect(
      viewOf(rightPacket).operatingResults.resolution.margins.find(
        (row) => row.concept === "SalesRevenueNet",
      )?.operatingMargin,
    ).toMatchObject({ status: "available", value: "16.7" });
    const html = () =>
      renderToStaticMarkup(
        <ManagedWatchlistAnnualComparison
          model={model}
          active={workspace.getSnapshot().view === "watchlist"}
          editable={workspace.canEdit()}
          memberships={
            workspace.coordinator.getSnapshot().draft?.memberships ?? []
          }
          onOpenReport={() => {
            throw new Error("Rendering must not open a report");
          }}
          noteActions={{
            getAction: (capture, destination) =>
              workspace.getAnnualComparisonNoteAction(capture, destination),
            append: (capture, destination) =>
              workspace.appendAnnualComparisonToNote(capture, destination),
            review: () => {
              throw new Error("Rendering must not review a note");
            },
          }}
        />,
      );
    expect(html()).toContain(
      'data-annual-comparison-operating="operatingIncome"',
    );
    expect(html()).toContain("revenue/net-income pair unavailable");
    expect(html()).toContain("-250.125");
    expect(html()).toContain("125.25");
    const capture: AnnualComparisonNoteCapture = {
      group: "operating",
      left: {
        member: left,
        response: leftPacket,
        selectedBasis: "RevenueFromContractWithCustomerExcludingAssessedTax",
        showingPrevious: false,
      },
      right: {
        member: right,
        response: rightPacket,
        selectedBasis: "SalesRevenueNet",
        showingPrevious: false,
      },
    };
    expect(
      workspace.getAnnualComparisonNoteAction(capture, left).canAppend,
    ).toBe(true);
    await model.load("left", left);
    expect(model.getSnapshot().left.report).toMatchObject({
      response: leftPacket,
      error: true,
      showingPrevious: true,
    });
    expect(
      workspace.getAnnualComparisonNoteAction(capture, left).canAppend,
    ).toBe(false);
    const held = model.load("left", left);
    expect(model.getSnapshot().pending).not.toBeNull();
    model.getSnapshot().pending!.cancel();
    fixture.settleCancelledAnnualComparison();
    await held;
    expect(model.getSnapshot().left.report.response).toBe(leftPacket);
    expect(model.getSnapshot().right.report.response).toBe(rightPacket);
    expect(html()).not.toContain("999.875");
    expect(workspace.coordinator.getSnapshot().draft).toEqual(originalDraft);
    const currentCapture = {
      ...capture,
      left: { ...capture.left, showingPrevious: true },
    };
    const excerpt = getAnnualComparisonNoteEvidence(currentCapture);
    expect(excerpt.reason).toBeNull();
    expect(`${operatingComparisonPrefix} ${excerpt.excerpt}`).toBe(
      operatingComparisonNoteDraft,
    );
    expect(
      Array.from(operatingComparisonNoteDraft.normalize("NFC")).length,
    ).toBeLessThanOrEqual(2000);
    expect(
      workspace.appendAnnualComparisonToNote(currentCapture, left).appended,
    ).toBe(true);
    const finalDraft = workspace.coordinator.getSnapshot().draft!;
    expect(finalDraft.memberships.map((row) => row.symbol)).toEqual([
      "ONE",
      "ZERO",
    ]);
    expect(finalDraft.memberships[0]!.note).toBe("Invented second note");
    expect(finalDraft.memberships[1]!.note).toBe(operatingComparisonNoteDraft);
    expect(
      workspace.appendAnnualComparisonToNote(currentCapture, left).appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(finalDraft);
    expect(fixture.getSnapshot().save).toBe(0);
    await workspace.coordinator.save();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      saved: { version: 2, payload: finalDraft },
      dirty: false,
    });
    await workspace.coordinator.load();
    expect(workspace.coordinator.getSnapshot().draft).toEqual(finalDraft);
    expect(model.getSnapshot().left.report.response).toBe(leftPacket);
    const retiring = model.load("right", model.getSnapshot().right.selected!);
    await workspace.refreshCatalog();
    fixture.settleCancelledAnnualComparison();
    await retiring;
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
    expect(model.getSnapshot()).toMatchObject({
      left: { selected: null, report: { response: null } },
      right: { selected: null, report: { response: null } },
      pending: null,
    });
    expect(html()).not.toContain("-250.125");
    expect(fixture.getSnapshot()).toMatchObject({
      annual: 5,
      aborted: 2,
      lateResolved: 2,
      save: 1,
      load: 2,
      status: 2,
      eod: 0,
      marketsEod: 0,
      filings: 0,
      calendar: 0,
      fed: 0,
      token: 0,
      signOut: 0,
    });
  });
});
