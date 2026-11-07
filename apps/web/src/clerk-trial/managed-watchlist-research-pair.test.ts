import { afterEach, describe, expect, it, vi } from "vitest";
import { createWatchlistResearchPairFixture } from "./test-watchlist-research-pair-fixture";
import { captureValuationCalculationGuard } from "./managed-valuation-workbench";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { filingsResponse } from "./sec-filings-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { ManagedEodHistory } from "./managed-eod-history";
import { isPreparedWatchlistResearchReport } from "./managed-watchlist-research-pair";
afterEach(() => vi.useRealTimers());

describe("direct Watchlist research pair", () => {
  it("settles disabled and retired states without recursive publications and returns an installed End state", async () => {
    const f = await createWatchlistResearchPairFixture();
    const listener = vi.fn(() => f.model.reconcile());
    const stop = f.model.subscribe(listener);
    f.setContext({ retire: true, canStart: false });
    expect(listener).toHaveBeenCalledTimes(1);
    f.model.reconcile();
    expect(listener).toHaveBeenCalledTimes(1);
    f.setContext({ retire: false, canStart: true });
    f.choose();
    expect(f.model.end(f.model.getSnapshot())).toBe(f.model.getSnapshot());
    expect(f.model.getSnapshot().reading).toBeNull();
    stop();
    const closeAgain = vi.fn(() => f.model.foreignClose());
    const stopClose = f.model.subscribe(closeAgain);
    f.model.foreignClose();
    expect(closeAgain).not.toHaveBeenCalled();
    stopClose();
  });

  it("can select the last of 10,000 identities and never selects the same exact member twice", async () => {
    const f = await createWatchlistResearchPairFixture();
    const context = f.getContext();
    f.setContext({
      draft: {
        ...context.draft!,
        memberships: Array.from({ length: 10_000 }, (_, i) => ({
          ...context.draft!.memberships[0]!,
          listingId: `listing-${i}`,
          securityId: `security-${i}`,
          shareClassId: `class-${i}`,
          symbol: `S${i}`,
        })),
      },
    });
    const members = f.model.getSnapshot().memberships;
    expect(members).toHaveLength(10_000);
    f.model.select(f.model.getSnapshot(), members[9999]!);
    f.model.select(f.model.getSnapshot(), members[9999]!);
    expect(f.model.getSnapshot().selected).toHaveLength(0);
    f.model.select(f.model.getSnapshot(), members[0]!);
    f.model.select(f.model.getSnapshot(), members[9999]!);
    f.model.preview(f.model.getSnapshot());
    expect(f.model.start(f.model.getSnapshot())?.reading?.members[1]).toBe(
      members[9999],
    );
    expect(f.annualRead).not.toHaveBeenCalled();
  });

  it("keeps full Filings refresh history and raw calculation refusals in a detached reading", async () => {
    const f = await createWatchlistResearchPairFixture();
    f.choose();
    const visit = f.open("left");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    const first = filingsResponse(1, "available", visit.selection);
    const second = filingsResponse(2, "available", visit.selection);
    const unavailable = filingsResponse(
      0,
      "upstream_unavailable",
      visit.selection,
    );
    const read = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockResolvedValueOnce(unavailable);
    const filings = new ManagedCompanyFilings(read, f.unexpected, undefined, {
      compareRefresh: true,
      coverage: createManagedResearchCoverageFixture([
        { listing: visit.selection.listing, cik: "0000000001" },
      ]),
    });
    filings.open(visit.selection);
    await filings.load();
    await vi.advanceTimersByTimeAsync(30_000);
    await filings.load();
    await vi.advanceTimersByTimeAsync(30_000);
    await filings.load();
    f.setEvidence({ ...f.getEvidence(), filings: filings.getSnapshot() });
    f.valuation.setDcfField("startingUnleveredCashFlowUsd", "0.000001");
    f.valuation.calculate();
    f.model.reconcile();
    const calculation = f.valuation.getSnapshot().calculation;
    const retained = f.model.capture(f.model.getSnapshot(), visit)!.reading!
      .left!;
    expect(retained.evidence.filings).toEqual(filings.getSnapshot());
    expect(retained.evidence.filings?.lastCheck).toEqual(unavailable);
    expect(retained.evidence.filings?.refreshComparison?.previous).toEqual(
      first,
    );
    expect(retained.evidence.filings?.response).toEqual(second);
    expect(retained.valuation).toEqual(calculation);
    expect(retained.valuation).not.toBe(calculation);
    expect(read).toHaveBeenCalledTimes(3);
    expect(f.annualRead).not.toHaveBeenCalled();
  });

  it("admits owned section transition before publication and blocks stale source/availability ABA captures", async () => {
    const f = await createWatchlistResearchPairFixture();
    f.choose();
    const visit = f.open("left");
    await f.loadAnnual();
    const next = { ...visit, section: "eod" as const };
    expect(f.model.continueVisit(visit, next)).toBe(true);
    f.setVisit(next);
    const before = f.model.getSnapshot();
    const evidence = f.getEvidence();
    f.setEvidence({
      ...evidence,
      annual: { ...evidence.annual!, running: true },
    });
    expect(f.model.capture(f.model.getSnapshot(), next)).toBeNull();
    f.setEvidence(evidence);
    expect(f.model.capture(before, next)).toBeNull();
    const refreshed = f.model.getSnapshot();
    f.setContext({ available: false });
    f.setContext({ available: true });
    expect(f.model.capture(refreshed, next)).toBeNull();
    expect(f.model.capture(f.model.getSnapshot(), next)).not.toBeNull();
  });

  it("refuses reentrant Start/open/Back actions and stale callbacks after an ended pair is replaced", async () => {
    const f = await createWatchlistResearchPairFixture();
    f.model.select(
      f.model.getSnapshot(),
      f.model.getSnapshot().memberships[0]!,
    );
    f.model.select(
      f.model.getSnapshot(),
      f.model.getSnapshot().memberships[1]!,
    );
    f.model.preview(f.model.getSnapshot());
    const stop = f.model.subscribe(() => {
      if (f.model.getSnapshot().reading) f.model.foreignClose();
    });
    expect(f.model.start(f.model.getSnapshot())).toBeNull();
    stop();
    f.choose();
    const stopOpen = f.model.subscribe(() => {
      if (f.model.getSnapshot().reason?.startsWith("Opening"))
        f.model.foreignClose();
    });
    expect(f.model.prepareOpen(f.model.getSnapshot(), "left")).toBeNull();
    stopOpen();
    f.choose();
    const visit = f.open("left");
    const stopBack = f.model.subscribe(() => {
      if (f.model.getSnapshot().activeSide === null) f.model.retire();
    });
    expect(f.model.ownedBack(visit)).toBe(false);
    stopBack();
    expect(f.model.getSnapshot().reading).toBeNull();
  });

  it("previews exact listings without requests and retains both complete readings through owned Back", async () => {
    const f = await createWatchlistResearchPairFixture();
    f.choose();
    expect(f.annualRead).not.toHaveBeenCalled();
    expect(f.unexpected).not.toHaveBeenCalled();
    const first = f.open("left");
    expect(f.model.capture(f.model.getSnapshot(), first)).toBeNull();
    await f.loadAnnual();
    f.valuation.calculate();
    f.model.reconcile();
    const calculation = f.valuation.getSnapshot().calculation!;
    const left = f.model.capture(f.model.getSnapshot(), first)!.reading!.left!;
    expect(left.evidence.annual?.response).toEqual(f.packet);
    expect(left.valuation).toEqual(calculation);
    expect(left.valuation).not.toBe(calculation);
    expect(captureValuationCalculationGuard(left.valuation!)).toBeNull();
    expect(left.note).toBe("Thesis 東京 Ω 2.000001");
    expect(Object.isFrozen(left.evidence.annual?.response)).toBe(true);
    f.back();
    const second = f.open("right");
    const price = new ManagedEodHistory(
      f.unexpected,
      f.unexpected,
      undefined,
      [],
    );
    price.open(second.selection);
    f.setEvidence({ ...f.getEvidence(), price: price.getSnapshot() });
    expect(price.getSnapshot().available).toBe(false);
    expect(f.model.getSnapshot().canCapture).toBe(false);
    f.valuation.discardAndUse(second.selection);
    f.valuation.calculate();
    f.model.reconcile();
    const reading = f.model.capture(f.model.getSnapshot(), second)!.reading!;
    expect(reading.left).toBe(left);
    expect(reading.right?.evidence.annual).toBeNull();
    expect(reading.right?.evidence.price).toEqual(price.getSnapshot());
    expect(reading.right?.valuationPrice?.reason).toBe("price_invalid");
    expect(reading.right?.valuationPrice?.reference).toBeNull();
    f.back();
    expect(f.model.getSnapshot().reading).toBe(reading);
    expect(f.annualRead).toHaveBeenCalledTimes(1);
    expect(f.unexpected).not.toHaveBeenCalled();
  });

  it("admits different classes of one issuer, bounds selection, and requires a fresh exact preview", async () => {
    const f = await createWatchlistResearchPairFixture();
    const initial = f.model.getSnapshot();
    expect(f.model.start(initial)).toBeNull();
    const [first, second, third] = initial.memberships;
    f.model.select(initial, first!);
    expect(f.model.select(initial, second!)).toBeNull();
    expect(f.model.preview(f.model.getSnapshot())).toBeNull();
    f.model.select(f.model.getSnapshot(), second!);
    expect(f.model.select(f.model.getSnapshot(), third!)).toBeNull();
    f.model.preview(f.model.getSnapshot());
    const preview = f.model.getSnapshot();
    expect(preview.preview?.[0].listing.issuerId).toBe(
      preview.preview?.[1].listing.issuerId,
    );
    f.note("new note");
    expect(f.model.start(preview)).toBeNull();
    expect(f.model.start(f.model.getSnapshot())).not.toBeNull();
    expect(f.annualRead).not.toHaveBeenCalled();
  });

  it("preserves readings through note changes and normal Save copies, while refusing old or pending actions", async () => {
    const f = await createWatchlistResearchPairFixture();
    f.choose();
    const visit = f.open("left");
    await f.loadAnnual();
    const before = f.model.capture(f.model.getSnapshot(), visit)!;
    const reading = before.reading;
    f.note("Changed thesis");
    expect(f.model.getSnapshot().reading).toBe(reading);
    expect(f.model.capture(before, visit)).toBeNull();
    const settled = f.model.getSnapshot();
    f.setContext({ available: false, canStart: false, revision: Symbol() });
    expect(f.model.capture(f.model.getSnapshot(), visit)).toBeNull();
    f.setContext({
      available: true,
      draft: structuredClone(f.getContext().draft),
      revision: Symbol(),
    });
    expect(f.model.getSnapshot().reading).toBe(reading);
    expect(f.model.capture(settled, visit)).toBeNull();
    expect(
      f.model.capture(f.model.getSnapshot(), visit)?.reading?.left?.note,
    ).toBe("Changed thesis");
  });

  it.each([
    "load",
    "catalog",
    "session",
    "file",
    "membership",
    "order",
    "identity",
  ])("retires on %s and cannot revive an equal-value pair", async (kind) => {
    const f = await createWatchlistResearchPairFixture();
    f.choose();
    const old = f.model.getSnapshot();
    const context = f.getContext();
    if (kind === "load") f.setContext({ retire: true });
    if (kind === "catalog") f.setContext({ catalog: { ...context.catalog! } });
    if (kind === "session") f.setContext({ session: {} });
    if (kind === "file") f.setContext({ fileEpochs: [1, 0, 0] });
    if (kind === "membership")
      f.setContext({
        draft: {
          ...context.draft!,
          memberships: context.draft!.memberships.slice(0, 2),
        },
      });
    if (kind === "order")
      f.setContext({
        draft: {
          ...context.draft!,
          memberships: [...context.draft!.memberships].reverse(),
        },
      });
    if (kind === "identity")
      f.setContext({
        draft: {
          ...context.draft!,
          memberships: context.draft!.memberships.map((member, i) =>
            i === 2 ? { ...member, securityName: "Changed" } : member,
          ),
        },
      });
    f.setContext(context);
    expect(f.model.getSnapshot().reading).toBeNull();
    expect(f.model.prepareOpen(old, "left")).toBeNull();
  });

  it("requires exact visit ownership, explicitly admits a section switch and rejects a foreign identical visit", async () => {
    const f = await createWatchlistResearchPairFixture();
    f.choose();
    const original = f.open("left");
    await f.loadAnnual();
    const section = { ...original, section: "eod" as const };
    f.setVisit(section, false);
    expect(f.model.continueVisit(original, section)).toBe(true);
    expect(f.model.capture(f.model.getSnapshot(), section)).not.toBeNull();
    f.setVisit({ ...section });
    expect(f.model.getSnapshot().reading).toBeNull();
    expect(f.model.ownedBack(section)).toBe(false);
  });

  it("refuses late open, stale clear and reentrant capture publication without false success", async () => {
    const f = await createWatchlistResearchPairFixture();
    f.choose();
    const pending = f.model.prepareOpen(f.model.getSnapshot(), "left")!;
    f.model.foreignClose();
    expect(f.model.commitOpen(pending, undefined)).toBe(false);
    f.choose();
    const visit = f.open("left");
    await f.loadAnnual();
    const stale = f.model.getSnapshot();
    f.note("revision");
    expect(f.model.clearSide(stale, "left")).toBeNull();
    const stop = f.model.subscribe(() => {
      if (f.model.getSnapshot().reading?.left) f.model.foreignClose();
    });
    expect(f.model.capture(f.model.getSnapshot(), visit)).toBeNull();
    stop();
    expect(f.model.getSnapshot().reading).toBeNull();
  });

  it("does not install a capture when clock callbacks retire ownership, or replace a good reading with oversized text", async () => {
    const f = await createWatchlistResearchPairFixture();
    f.choose();
    const visit = f.open("left");
    await f.loadAnnual();
    const left = f.model.capture(f.model.getSnapshot(), visit)!.reading!.left;
    f.setWatchlist({
      member: { ...visit.selection.listing, note: "x".repeat(20_000) },
      revision: Symbol(),
    });
    expect(f.model.capture(f.model.getSnapshot(), visit)).toBeNull();
    expect(f.model.getSnapshot().reading!.left).toBe(left);
    f.setWatchlist({});
    f.setClock(() => {
      f.model.retire();
      return new Date();
    });
    expect(f.model.capture(f.model.getSnapshot(), visit)).toBeNull();
    f.model.reconcile();
    expect(f.model.getSnapshot().reading).toBeNull();
  });
});

async function completeWatchlistReportPair() {
  const f = await createWatchlistResearchPairFixture();
  f.choose(1);
  for (const side of ["left", "right"] as const) {
    const visit = f.open(side);
    if (side === "left") await f.loadAnnual();
    else {
      f.valuation.setDcfField("startingUnleveredCashFlowUsd", "0.000001");
      f.valuation.calculate();
      f.model.reconcile();
    }
    expect(f.model.capture(f.model.getSnapshot(), visit)).not.toBeNull();
    f.back();
  }
  return f;
}

describe("prepared Watchlist research report", () => {
  it.each([0, 1, 2, 3])(
    "retires on resource %s revision ABA while retaining both readings",
    async (index) => {
      const f = await completeWatchlistReportPair();
      const state = f.model.getSnapshot();
      const captured = f.model.captureReport(state)!;
      const original = f.getContext().reportRevisions;
      f.setContext({ reportRevisions: [...original] });
      expect(f.model.getSnapshot()).toBe(state);
      expect(captured.current()).toBe(true);
      const changed = [...original];
      changed[index] = {};
      f.setContext({ reportRevisions: changed });
      f.setContext({ reportRevisions: original });
      expect(captured.current()).toBe(false);
      expect(f.model.getSnapshot().reading).toBe(state.reading);
      expect(f.model.captureReport(f.model.getSnapshot())?.current()).toBe(
        true,
      );
    },
  );

  it("prepares a branded immutable complete reading without exporting member or draft authority", async () => {
    const f = await completeWatchlistReportPair();
    const state = f.model.getSnapshot();
    const beforeRequests = f.annualRead.mock.calls.length;
    const listener = vi.fn();
    const stop = f.model.subscribe(listener);
    expect(typeof f.model.captureReport).toBe("function");
    const captured = f.model.captureReport(state)!;
    expect(captured).not.toBeNull();
    expect(captured.current()).toBe(true);
    expect(captured.report.kind).toBe("watchlist_company_research");
    expect(captured.report.preparedAt).toBe("2026-11-07T12:00:00.000Z");
    expect(isPreparedWatchlistResearchReport(captured.report)).toBe(true);
    for (const foreign of [
      null,
      {},
      { ...captured.report },
      structuredClone(captured.report),
      JSON.parse(JSON.stringify(captured.report)),
    ])
      expect(isPreparedWatchlistResearchReport(foreign)).toBe(false);
    expect(Object.keys(captured.report)).toEqual([
      "kind",
      "preparedAt",
      "reading",
    ]);
    expect(Object.keys(captured.report.reading)).toEqual([
      "kind",
      "listings",
      "left",
      "right",
    ]);
    expect(captured.report.reading.listings).toEqual(
      state.reading!.members.map((member) => member.listing),
    );
    expect(captured.report.reading.listings[0]).not.toBe(
      state.reading!.members[0].listing,
    );
    expect(captured.report.reading.left).toBe(state.reading!.left);
    expect(captured.report.reading.right).toBe(state.reading!.right);
    expect(captured.report.reading.left.note).toBe("Thesis 東京 Ω 2.000001");
    for (const value of [
      captured,
      captured.report,
      captured.report.reading,
      captured.report.reading.listings,
      ...captured.report.reading.listings,
      captured.report.reading.left,
      captured.report.reading.right,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(f.model.getSnapshot()).toBe(state);
    expect(listener).not.toHaveBeenCalled();
    expect(f.annualRead).toHaveBeenCalledTimes(beforeRequests);
    expect(f.unexpected).not.toHaveBeenCalled();
    stop();
  });

  it("requires both readings, exact state and an idle owned return", async () => {
    const f = await createWatchlistResearchPairFixture();
    expect(f.model.captureReport(f.model.getSnapshot())).toBeNull();
    f.choose();
    const visit = f.open("left");
    await f.loadAnnual();
    f.model.capture(f.model.getSnapshot(), visit);
    expect(f.model.captureReport(f.model.getSnapshot())).toBeNull();
    f.back();
    expect(f.model.captureReport(f.model.getSnapshot())).toBeNull();
    const full = await completeWatchlistReportPair();
    const stale = full.model.getSnapshot();
    full.note("new authored note");
    expect(full.model.captureReport(stale)).toBeNull();
    const current = full.model.getSnapshot();
    expect(full.model.prepareOpen(current, "left")).not.toBeNull();
    expect(full.model.captureReport(full.model.getSnapshot())).toBeNull();
  });

  it("retires report authority across note and Save ABA while preserving the original readings", async () => {
    const f = await completeWatchlistReportPair();
    const before = f.model.getSnapshot();
    const original = f.getContext();
    const captured = f.model.captureReport(before)!;
    f.note("updated note");
    f.setContext(original);
    expect(captured.current()).toBe(false);
    expect(captured.current()).toBe(false);
    expect(f.model.getSnapshot().reading).toBe(before.reading);
    const fresh = f.model.captureReport(f.model.getSnapshot())!;
    expect(fresh.current()).toBe(true);
    f.setContext({ available: false, canStart: false, revision: Symbol() });
    f.setContext({
      ...original,
      draft: structuredClone(original.draft),
      revision: Symbol(),
    });
    expect(fresh.current()).toBe(false);
    expect(f.model.getSnapshot().reading).toBe(before.reading);
    expect(
      f.model.captureReport(f.model.getSnapshot())?.report.reading.left.note,
    ).toBe("Thesis 東京 Ω 2.000001");
  });

  it.each([
    "available",
    "canStart",
    "load",
    "session",
    "catalog",
    "file",
    "order",
    "revision",
  ] as const)(
    "permanently retires a prepared report on %s even when restored before polling",
    async (kind) => {
      const f = await completeWatchlistReportPair();
      const captured = f.model.captureReport(f.model.getSnapshot())!;
      const original = f.getContext();
      if (kind === "available") f.setContext({ available: false });
      if (kind === "canStart") f.setContext({ canStart: false });
      if (kind === "load") f.setContext({ retire: true });
      if (kind === "session") f.setContext({ session: {} });
      if (kind === "catalog")
        f.setContext({ catalog: { ...original.catalog! } });
      if (kind === "file") f.setContext({ fileEpochs: [1, 0, 0] });
      if (kind === "order")
        f.setContext({
          draft: {
            ...original.draft!,
            memberships: [...original.draft!.memberships].reverse(),
          },
        });
      if (kind === "revision") f.setContext({ revision: Symbol() });
      f.setContext(original);
      expect(captured.current()).toBe(false);
    },
  );

  it("rechecks an unobserved current context and never revives a rejected lease", async () => {
    const f = await completeWatchlistReportPair();
    const captured = f.model.captureReport(f.model.getSnapshot())!;
    const original = f.getContext();
    f.setContext({ available: false }, false);
    expect(captured.current()).toBe(false);
    f.setContext(original);
    expect(captured.current()).toBe(false);
  });

  it.each(["open-back", "clear", "end", "retire"] as const)(
    "withdraws report ownership on %s",
    async (kind) => {
      const f = await completeWatchlistReportPair();
      const captured = f.model.captureReport(f.model.getSnapshot())!;
      if (kind === "open-back") {
        f.open("left");
        f.back();
      }
      if (kind === "clear") f.model.clearSide(f.model.getSnapshot(), "right");
      if (kind === "end") f.model.end(f.model.getSnapshot());
      if (kind === "retire") f.model.retire();
      expect(captured.current()).toBe(false);
    },
  );

  it("refuses a reentrant preparation clock and invalid dates", async () => {
    const f = await completeWatchlistReportPair();
    f.setClock(() => {
      f.note("clock reentered");
      return new Date("2026-11-08T00:00:00Z");
    });
    expect(f.model.captureReport(f.model.getSnapshot())).toBeNull();
    f.setClock(() => new Date(Number.NaN));
    expect(f.model.captureReport(f.model.getSnapshot())).toBeNull();
    f.setClock(() => new Date("2026-11-08T00:00:00Z"));
    expect(
      f.model.captureReport(f.model.getSnapshot())?.report.preparedAt,
    ).toBe("2026-11-08T00:00:00.000Z");
  });
});
