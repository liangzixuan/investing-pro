import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedEodHistory } from "../../src/clerk-trial/ManagedEodHistory";
import { ManagedEodHistoryError } from "../../src/clerk-trial/managed-api";
import { createFixture } from "./fixture";

const digest = `sha256:${"a".repeat(64)}` as const;
const yearRequest = {
  catalogSnapshotSha256: digest,
  listingId: "listing-zero",
  range: "1y" as const,
};

function observedCloseMarkup(html: string): string {
  const summary = html.match(
    /<div class="managed-observed-close-range"[\s\S]*?<\/dl>/u,
  )?.[0];
  expect(summary).toBeDefined();
  return summary!;
}

describe("bounded company price-range fixture", () => {
  it("uses the real workspace and renderer for staged ranges, retained dates, Cancel, close and retirement", async () => {
    const fixture = await createFixture("company-price-ranges");
    const reads = vi.spyOn(fixture.api, "eodHistory");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        researchCoverage: fixture.researchCoverage,
        marketsCohort: fixture.marketsCohort,
        priceCoverage: fixture.priceCoverage,
      },
    );
    workspace.setView("watchlist");
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-zero", "Range selection preserves this draft");
    const draft = structuredClone(workspace.coordinator.getSnapshot().draft);
    const member = workspace.coordinator
      .getSnapshot()
      .draft?.memberships.find((entry) => entry.listingId === "listing-zero");
    if (!member) throw new Error("The invented ZERO draft must be loaded");
    workspace.openWatchlistEod(member);
    const html = () =>
      renderToStaticMarkup(<ManagedEodHistory model={workspace.eod} />);
    expect(workspace.eod.getSnapshot().selectedRange).toBe("1m");
    workspace.eod.selectRange("1y");
    expect(reads).not.toHaveBeenCalled();
    expect(html()).toContain("Load one-year close history");
    await workspace.eod.load();
    const year = workspace.eod.getSnapshot().response;
    expect(parseManagedEodHistoryResponse(year, yearRequest)).toEqual(year);
    expect(year?.rows).toEqual([
      { date: "2025-09-22", close: "80.125" },
      { date: "2026-03-20", close: "90.25" },
      { date: "2026-09-19", close: "101.5" },
    ]);
    expect(year?.window).toEqual({
      startDate: "2025-09-20",
      endDate: "2026-09-20",
    });
    expect(html()).toContain("Loaded request range: One year.");
    const yearSummary = observedCloseMarkup(html());
    expect(yearSummary).toContain("Highest reported close · USD");
    expect(yearSummary).toContain("Lowest reported close · USD");
    expect(yearSummary).toMatch(/<span[^>]*>101\.5<\/span>/u);
    expect(yearSummary).toMatch(/<span[^>]*>80\.125<\/span>/u);
    expect(yearSummary).toContain('dateTime="2025-09-22"');
    expect(yearSummary).toContain('dateTime="2026-09-19"');
    expect(yearSummary).not.toContain("First of ");
    workspace.eod.selectRange("1m");
    expect(reads).toHaveBeenCalledTimes(1);
    expect(workspace.eod.getSnapshot().response).toBe(year);
    expect(html()).toContain("Load one-month close history");
    expect(html()).toContain("Loaded request range: One year.");
    expect(observedCloseMarkup(html())).toBe(yearSummary);
    const monthPending = workspace.eod.load();
    expect(html()).toMatch(
      /<select[^>]*id="managed-eod-range"[^>]*disabled=""/,
    );
    workspace.eod.selectRange("1y");
    expect(workspace.eod.getSnapshot().selectedRange).toBe("1m");
    expect(html()).toContain("2025-09-20 to 2026-09-20");
    expect(observedCloseMarkup(html())).toBe(yearSummary);
    workspace.eod.cancel();
    fixture.settleCancelledEod();
    await monthPending;
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: year,
      showingPrevious: true,
      running: false,
    });
    expect(html()).toContain("2026-09-20T00:00:01.000Z");
    expect(html()).not.toContain("999.75");
    expect(observedCloseMarkup(html())).toBe(yearSummary);
    await workspace.eod.load();
    expect(workspace.eod.getSnapshot().response).toMatchObject({
      range: "1m",
      window: { startDate: "2026-08-21", endDate: "2026-09-21" },
      completedAt: "2026-09-21T00:00:02.000Z",
      rows: [
        { date: "2026-09-19", close: "102.75" },
        { date: "2026-09-20", close: "103.5" },
      ],
    });
    expect(html()).toContain("Loaded request range: One month.");
    const monthSummary = observedCloseMarkup(html());
    expect(monthSummary).toMatch(/<span[^>]*>103\.5<\/span>/u);
    expect(monthSummary).toMatch(/<span[^>]*>102\.75<\/span>/u);
    expect(monthSummary).toContain('dateTime="2026-09-19"');
    expect(monthSummary).toContain('dateTime="2026-09-20"');
    expect(monthSummary).not.toContain("80.125");
    expect(workspace.coordinator.getSnapshot().draft).toEqual(draft);
    workspace.eod.selectRange("1y");
    const closePending = workspace.eod.load();
    workspace.closeResearch();
    fixture.settleCancelledEod();
    await closePending;
    expect(workspace.eod.getSnapshot()).toMatchObject({
      selection: null,
      response: null,
    });
    expect(workspace.coordinator.getSnapshot().draft).toEqual(draft);
    workspace.openWatchlistEod(member);
    expect(workspace.eod.getSnapshot()).toMatchObject({
      selectedRange: "1m",
      response: null,
    });
    expect(reads).toHaveBeenCalledTimes(4);
    const retirementPending = workspace.eod.load();
    await workspace.refreshCatalog();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
    fixture.settleCancelledEod();
    await retirementPending;
    expect(html()).toBe("");
    expect(workspace.eod.getSnapshot()).toMatchObject({
      selection: null,
      response: null,
    });
    expect(reads.mock.calls.map(([request]) => request)).toEqual(
      ["1y", "1m", "1m", "1y", "1m"].map((range) => ({
        ...yearRequest,
        range,
      })),
    );
    expect(fixture.getSnapshot()).toMatchObject({
      eod: 5,
      eodAborted: 3,
      eodLateResolved: 3,
      load: 1,
      status: 2,
      annual: 0,
      filings: 0,
      save: 0,
      token: 0,
      signOut: 0,
      marketsEod: 0,
      calendar: 0,
      fed: 0,
    });
  });

  it("retains the original tied source lexeme and range through held transient failure and cancelled late replacement", async () => {
    const fixture = await createFixture("company-price-ranges");
    const originalRead = fixture.api.eodHistory;
    const reads = vi.spyOn(fixture.api, "eodHistory");
    reads.mockImplementationOnce(async (request, signal) => ({
      ...(await originalRead(request, signal)),
      rows: [
        { date: "2025-09-22", close: "80.125" },
        { date: "2026-03-20", close: "101.5" },
        { date: "2026-09-19", close: "101.5" },
        { date: "2026-09-20", close: "80.125" },
      ],
    }));
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        researchCoverage: fixture.researchCoverage,
        priceCoverage: fixture.priceCoverage,
      },
    );
    workspace.setView("watchlist");
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-zero", "Exact retained-close draft");
    const draft = structuredClone(workspace.coordinator.getSnapshot().draft);
    const member = workspace.coordinator
      .getSnapshot()
      .draft!.memberships.find((entry) => entry.listingId === "listing-zero")!;
    workspace.openWatchlistEod(member);
    workspace.eod.selectRange("1y");
    await workspace.eod.load();
    const tiedYear = workspace.eod.getSnapshot().response!;
    expect(tiedYear).not.toBeNull();
    expect(parseManagedEodHistoryResponse(tiedYear, yearRequest)).toEqual(
      tiedYear,
    );
    const html = () =>
      renderToStaticMarkup(<ManagedEodHistory model={workspace.eod} />);
    const assertTiedRange = () => {
      const rendered = html();
      const summary = observedCloseMarkup(rendered);
      const [highest, lowest] = summary.split(
        "<dt>Lowest reported close · USD</dt>",
      );
      expect(highest).toContain("<dt>Highest reported close · USD</dt>");
      expect(highest).toMatch(/<span[^>]*>101\.5<\/span>/u);
      expect(highest).toContain('dateTime="2026-03-20"');
      expect(highest).toContain("First of 2 reported dates at this close.");
      expect(lowest).toMatch(/<span[^>]*>80\.125<\/span>/u);
      expect(lowest).toContain('dateTime="2025-09-22"');
      expect(lowest).toContain("First of 2 reported dates at this close.");
      expect(rendered).toContain("Loaded request range: One year.");
    };
    assertTiedRange();
    workspace.eod.selectRange("1m");
    expect(reads).toHaveBeenCalledTimes(1);
    let refuse!: (reason: Error) => void;
    reads.mockImplementationOnce(
      () => new Promise((_, reject) => (refuse = reject)),
    );
    const failed = workspace.eod.load();
    expect(workspace.eod.getSnapshot().running).toBe(true);
    assertTiedRange();
    refuse(new ManagedEodHistoryError("unavailable"));
    await failed;
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: tiedYear,
      selectedRange: "1m",
      showingPrevious: true,
      running: false,
      error: true,
      message: "The close history refresh failed. Try again when ready.",
    });
    expect(workspace.eod.getSnapshot().response).toBe(tiedYear);
    assertTiedRange();
    let settle!: (packet: typeof tiedYear) => void;
    reads.mockImplementationOnce(
      () => new Promise((resolve) => (settle = resolve)),
    );
    const cancelled = workspace.eod.load();
    workspace.eod.cancel();
    const lateMonth: typeof tiedYear = {
      ...tiedYear,
      range: "1m",
      window: { startDate: "2026-08-21", endDate: "2026-09-21" },
      requestStartedAt: "2026-09-21T00:00:00.000Z",
      completedAt: "2026-09-21T00:00:02.000Z",
      rows: [{ date: "2026-09-20", close: "999.75" }],
    };
    expect(
      parseManagedEodHistoryResponse(lateMonth, {
        ...yearRequest,
        range: "1m",
      }),
    ).toEqual(lateMonth);
    settle(lateMonth);
    await cancelled;
    assertTiedRange();
    expect(html()).not.toContain("999.75");
    expect(workspace.eod.getSnapshot().response).toBe(tiedYear);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(draft);
    expect(reads.mock.calls.map(([request]) => request.range)).toEqual([
      "1y",
      "1m",
      "1m",
    ]);
    expect(reads.mock.calls[2]![1].aborted).toBe(true);
    expect(fixture.getSnapshot()).toMatchObject({
      eod: 1,
      status: 1,
      load: 1,
      save: 0,
      annual: 0,
      filings: 0,
      marketsEod: 0,
      calendar: 0,
      fed: 0,
      token: 0,
      signOut: 0,
    });
    workspace.closeResearch();
    expect(html()).toBe("");
    expect(workspace.coordinator.getSnapshot().draft).toEqual(draft);
  });

  it.each(["range", "listing", "catalog", "aborted"])(
    "refuses an inadmissible first request: %s",
    async (kind) => {
      const fixture = await createFixture("company-price-ranges");
      await fixture.api.status(new AbortController().signal);
      const controller = new AbortController();
      if (kind === "aborted") controller.abort();
      const request = {
        ...yearRequest,
        ...(kind === "range" ? { range: "1m" as const } : {}),
        ...(kind === "listing" ? { listingId: "listing-one" } : {}),
        ...(kind === "catalog"
          ? { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const }
          : {}),
      };
      expect(() => fixture.api.eodHistory(request, controller.signal)).toThrow(
        "Unexpected invented price-range request or order",
      );
      expect(fixture.getSnapshot().eod).toBe(0);
    },
  );

  it("refuses reordered or un-aborted settlements and binds a year packet to the year request", async () => {
    const fixture = await createFixture("company-price-ranges");
    const signal = new AbortController().signal;
    await fixture.api.status(signal);
    const year = await fixture.api.eodHistory(yearRequest, signal);
    expect(
      parseManagedEodHistoryResponse(year, { ...yearRequest, range: "1m" }),
    ).toBeNull();
    expect(() => fixture.api.eodHistory(yearRequest, signal)).toThrow(
      "Unexpected invented price-range request or order",
    );
    expect(() => fixture.settleCancelledEod()).toThrow();
    const controller = new AbortController();
    const pending = fixture.api.eodHistory(
      { ...yearRequest, range: "1m" },
      controller.signal,
    );
    expect(() => fixture.settleCancelledEod()).toThrow();
    expect(() =>
      fixture.api.eodHistory({ ...yearRequest, range: "1m" }, signal),
    ).toThrow();
    controller.abort();
    fixture.settleCancelledEod();
    expect((await pending).rows.at(-1)?.close).toBe("999.75");
    expect(() => fixture.settleCancelledEod()).toThrow();
  });
});
