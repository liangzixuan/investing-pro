import { ManagedCompanyFilings } from "./managed-company-filings";
import { filingsResponse } from "./sec-filings-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import type { ManagedResearchVisit } from "./managed-workspace";
import { captureValuationCalculationGuard } from "./managed-valuation-workbench";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
import { createScreenResearchReviewFixture } from "./test-screen-research-review-fixture";
let packets: PersonalSecAnnualCanonicalResponseDto[];
beforeAll(async () => {
  packets = await Promise.all([
    annualComparisonResponse("left"),
    annualComparisonResponse("right"),
  ]);
});
afterEach(() => vi.useRealTimers());
describe("owned two-company passive research readings", () => {
  it("retains both complete readings through owned Back and a second calculation without reads or passive authority", async () => {
    const f = await createScreenResearchReviewFixture();
    const first = await f.open(0);
    f.valuation.calculate();
    f.model.reconcile();
    const original = f.valuation.getSnapshot().calculation!;
    const evaluatedAt =
      f.valuation.captureCalculationMetadata(original)!.evaluatedAt;
    vi.setSystemTime(new Date("2026-11-02T11:00:00Z"));
    const installed = f.model.capture(f.model.getSnapshot(), first)!;
    expect(installed).toBe(f.model.getSnapshot());
    const left = installed.reading!.left!;
    expect(left.valuation).toEqual(original);
    expect(left.valuation).not.toBe(original);
    expect(captureValuationCalculationGuard(left.valuation!)).toBeNull();
    expect(left.evaluatedAt).toBe(evaluatedAt);
    expect(left.capturedAt).not.toBe(evaluatedAt);
    expect(left.evidence.annual!.response).toEqual(packets[0]);
    expect(left.evidence.annual!.response).not.toBe(packets[0]);
    expect(Object.isFrozen(left.evidence.annual!.response)).toBe(true);
    expect(left).not.toHaveProperty("watchlistRevision");
    f.back();
    const second = await f.open(1);
    f.valuation.calculate();
    f.model.reconcile();
    expect(
      f.model.capture(f.model.getSnapshot(), second)?.reading?.right?.valuation,
    ).toEqual(f.valuation.getSnapshot().calculation);
    expect(f.model.getSnapshot().reading!.left).toBe(left);
    f.back();
    expect(f.model.getSnapshot().reading!.left).toBe(left);
    expect(f.annualReport).toHaveBeenCalledTimes(2);
    expect(f.resolve).toHaveBeenCalledTimes(1);
  });
  it("retains original failed-refresh qualifications and complete raw note without silently replacing captured data", async () => {
    const f = await createScreenResearchReviewFixture();
    const visit = await f.open(0);
    f.setWatchlist({
      member: { ...visit.selection.listing, note: "  Entire\n理由 <raw>  " },
      canEdit: true,
    });
    const annual = f.getEvidence().annual!;
    f.setEvidence({
      ...f.getEvidence(),
      annual: {
        ...annual,
        showingPrevious: true,
        error: true,
        message: "Refresh failed; original source retained.",
      },
    });
    expect(f.model.getSnapshot().reason).toBeNull();
    const capture = f.model.capture(f.model.getSnapshot(), visit)!.reading!
      .left!;
    expect(capture.note).toBe("  Entire\n理由 <raw>  ");
    expect(capture.evidence.annual).toEqual({
      ...annual,
      showingPrevious: true,
      error: true,
      message: "Refresh failed; original source retained.",
    });
    f.setEvidence({ ...f.getEvidence(), annual });
    f.setWatchlist({
      revision: Symbol(),
      member: { ...visit.selection.listing, note: "new draft" },
    });
    expect(f.model.getSnapshot().reading!.left).toBe(capture);
    expect(JSON.parse(capture.document.text) as unknown).toMatchObject({
      authoredResearch: { note: capture.note },
    });
  });
  it("refreshes stale action snapshots for source/Watchlist/availability ABA without recursive idle publications", async () => {
    const f = await createScreenResearchReviewFixture();
    const visit = await f.open(0);
    const before = f.model.getSnapshot();
    const listener = vi.fn(() => f.model.reconcile());
    const unsubscribe = f.model.subscribe(listener);
    f.setAvailable(false);
    f.setAvailable(true);
    expect(f.model.capture(before, visit)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    const fresh = f.model.getSnapshot();
    f.setWatchlist({ revision: Symbol() });
    expect(f.model.capture(fresh, visit)).toBeNull();
    unsubscribe();
  });
  it("rejects stale preparation when the capture clock reenters and replaces ownership", async () => {
    const f = await createScreenResearchReviewFixture();
    const visit = await f.open(0);
    const before = f.model.getSnapshot();
    f.setClock(() => {
      f.model.invalidate();
      return new Date();
    });
    expect(f.model.capture(before, visit)).toBeNull();
    expect(f.model.getSnapshot().reading).toBeNull();
  });
  it("returns no installed capture after synchronous retirement and cannot resurrect through foreign close or pair ABA", async () => {
    const f = await createScreenResearchReviewFixture();
    const visit = await f.open(0);
    const stop = f.model.subscribe(() => {
      if (f.model.getSnapshot().reading?.left) f.model.foreignClose();
    });
    expect(f.model.capture(f.model.getSnapshot(), visit)).toBeNull();
    stop();
    expect(f.model.getSnapshot().reading).toBeNull();
    f.setVisit(null);
    f.screen.reconcile(packets[0]!.catalogSnapshotSha256, true, true);
    await f.open(0);
    f.model.capture(f.model.getSnapshot(), f.getVisit());
    f.back();
    f.screen.selectComparison(f.screen.getSnapshot(), "left", null);
    f.screen.selectComparison(f.screen.getSnapshot(), "left", f.rows[0]!);
    expect(f.model.getSnapshot().reading).toBeNull();
  });
  it("does not let an older failed opening erase a newer pending opening", async () => {
    const f = await createScreenResearchReviewFixture();
    const old = f.model.prepareOpen(f.reportCapture(0))!;
    const newer = f.model.prepareOpen(f.reportCapture(1))!;
    expect(f.model.commitOpen(old, undefined)).toBe(false);
    const handoff = f.screen.admitReport(f.reportCapture(1))!;
    f.screen.reconcile(packets[0]!.catalogSnapshotSha256, false, false);
    const visit: ManagedResearchVisit = {
      selection: handoff.selection,
      section: "annual",
    };
    f.setVisit(visit);
    f.valuation.activate(visit.selection);
    f.setEvidence({
      price: null,
      annual: f.rows[1]!.report!,
      interim: null,
      filings: null,
    });
    expect(f.model.commitOpen(newer, visit)).toBe(true);
    expect(f.model.getSnapshot().activeSide).toBe("right");
  });
  it("preserves section changes but refuses a foreign same-issuer share class and dirty editor ownership", async () => {
    const f = await createScreenResearchReviewFixture();
    const visit = await f.open(0);
    const section: ManagedResearchVisit = {
      selection: visit.selection,
      section: "eod",
    };
    f.setVisit(section);
    f.model.reconcile();
    expect(f.model.capture(f.model.getSnapshot(), section)).not.toBeNull();
    f.setVisit({
      selection: {
        ...visit.selection,
        listing: { ...visit.selection.listing, shareClassId: "foreign" },
      },
      section: "eod",
    });
    f.model.reconcile();
    expect(f.model.getSnapshot().reading).toBeNull();
  });
  it("blocks capture during source work, unavailable draft and over-limit input without source or editor effects", async () => {
    const f = await createScreenResearchReviewFixture();
    const visit = await f.open(0);
    f.setWatchlist({
      canAdd: false,
      canEdit: false,
      reason: "Review saved version.",
    });
    expect(f.model.getSnapshot().canCapture).toBe(false);
    f.setWatchlist({ canAdd: true, reason: null });
    const annual = f.getEvidence().annual!;
    f.setEvidence({ ...f.getEvidence(), annual: { ...annual, running: true } });
    expect(f.model.capture(f.model.getSnapshot(), visit)).toBeNull();
    f.setEvidence({ ...f.getEvidence(), annual });
    f.valuation.setDcfField("waccPercent", "9".repeat(513));
    f.model.reconcile();
    expect(f.model.capture(f.model.getSnapshot(), visit)).toBeNull();
    expect(f.annualReport).toHaveBeenCalledTimes(2);
  });
});

it("retains the complete Filings last check and prior refresh comparison independently from the displayed packet", async () => {
  const f = await createScreenResearchReviewFixture();
  const visit = await f.open(0);
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
  const filings = new ManagedCompanyFilings(read, vi.fn(), undefined, {
    compareRefresh: true,
    coverage: createManagedResearchCoverageFixture([
      { listing: visit.selection.listing, cik: visit.selection.cik! },
    ]),
  });
  filings.open(visit.selection);
  await filings.load();
  await vi.advanceTimersByTimeAsync(30_000);
  await filings.load();
  await vi.advanceTimersByTimeAsync(30_000);
  await filings.load();
  const source = filings.getSnapshot();
  expect(source.response).toEqual(second);
  expect(source.lastCheck).toEqual(unavailable);
  expect(source.refreshComparison?.previous).toEqual(first);
  f.setEvidence({ ...f.getEvidence(), filings: source });
  const capture = f.model.capture(f.model.getSnapshot(), visit)!.reading!.left!;
  expect(capture.evidence.filings).toEqual(source);
  expect(capture.evidence.filings).not.toBe(source);
  expect(capture.evidence.filings?.lastCheck).toEqual(unavailable);
  expect(capture.evidence.filings?.refreshComparison?.current).toEqual(second);
  expect(read).toHaveBeenCalledTimes(3);
});

it("refuses unavailable opening and an oversized complete note without replacing the retained reading", async () => {
  const f = await createScreenResearchReviewFixture();
  f.setAvailable(false);
  expect(f.model.prepareOpen(f.reportCapture(0))).toBeNull();
  f.setAvailable(true);
  const visit = await f.open(0);
  const retained = f.model.capture(f.model.getSnapshot(), visit)!.reading!.left;
  f.setWatchlist({
    member: { ...visit.selection.listing, note: "x".repeat(20_000) },
    canEdit: true,
    revision: Symbol(),
  });
  expect(f.model.capture(f.model.getSnapshot(), visit)).toBeNull();
  expect(f.model.getSnapshot().reading!.left).toBe(retained);
});
