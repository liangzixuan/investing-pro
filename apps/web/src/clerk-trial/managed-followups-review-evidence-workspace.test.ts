import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sourceConnectedFixture } from "./test-source-connected-workspace-fixture";
import { prepareFilingsAssessment } from "./managed-filings-assessment";
import {
  ManagedAnnualReportError,
  ManagedEodHistoryError,
} from "./managed-api";

const fixtures: Awaited<ReturnType<typeof sourceConnectedFixture>>[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
});
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.useRealTimers();
});
async function setup() {
  const f = await sourceConnectedFixture();
  fixtures.push(f);
  return f;
}
function reads(f: Awaited<ReturnType<typeof setup>>) {
  return [
    f.api.eodHistory,
    f.api.annualReport,
    f.api.recentFilings,
    f.api.interimReport,
  ].map((fn) => vi.mocked(fn).mock.calls.length);
}

it("admits only the settled exact company route and rejects stale capture across section publication", async () => {
  const f = await setup(),
    w = f.workspace;
  f.start();
  const opened = await f.open();
  const beforeRoute = w.reviewEvidence.getSnapshot();
  w.setNavigationBlocked(true);
  expect(w.captureFollowupEvidence(beforeRoute)).toBeNull();
  expect(w.reviewEvidence.getSnapshot().canCapture).toBe(false);
  await w.setCompanyRoute({
    kind: "company",
    listingId: opened.selection.listing.listingId,
    section: opened.section,
  });
  await f.run();
  const reading = f.capture();
  const beforeSection = w.reviewEvidence.getSnapshot();
  w.switchToAnnual();
  expect(w.getSnapshot().companyRoute!.section).not.toBe(
    w.getSnapshot().research!.section,
  );
  expect(w.reviewEvidence.getSnapshot().canCapture).toBe(false);
  expect(w.captureFollowupEvidence(beforeSection)).toBeNull();
  const duringSection = w.reviewEvidence.getSnapshot();
  await w.setCompanyRoute({
    kind: "company",
    listingId: opened.selection.listing.listingId,
    section: "annual",
  });
  expect(w.reviewEvidence.getSnapshot().canCapture).toBe(true);
  expect(w.captureFollowupEvidence(duringSection)).toBeNull();
  expect(w.reviewEvidence.getSnapshot().selected!.reading).toBe(reading);
  expect(f.capture().evidence).toEqual(reading.evidence);
  expect(reads(f)).toEqual([1, 1, 1, 1]);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it.each(["foreign loading", "closed", "catalog"] as const)(
  "refuses routed capture after %s and cannot revive the old handler",
  async (boundary) => {
    const f = await setup(),
      w = f.workspace;
    f.start();
    const opened = await f.open();
    w.setNavigationBlocked(true);
    await w.setCompanyRoute({
      kind: "company",
      listingId: opened.selection.listing.listingId,
      section: opened.section,
    });
    await f.run();
    f.capture();
    const captured = w.reviewEvidence.getSnapshot();
    if (boundary === "foreign loading") {
      const originalResolve = f.api.resolve;
      let finish!: () => void;
      f.api.resolve = vi.fn<typeof originalResolve>(
        (request, signal) =>
          new Promise<Awaited<ReturnType<typeof originalResolve>>>(
            (resolve, reject) => {
              finish = () => {
                void originalResolve(request, signal).then(resolve, reject);
              };
            },
          ),
      );
      const pending = w.setCompanyRoute({
        kind: "company",
        listingId: f.listings[0]!.listingId,
        section: "eod",
      });
      expect(w.getSnapshot().companyRoute!.status).toBe("resolving");
      expect(w.reviewEvidence.getSnapshot().canCapture).toBe(false);
      expect(w.captureFollowupEvidence(captured)).toBeNull();
      finish();
      await pending;
      expect(w.getSnapshot().research!.selection.listing.listingId).not.toBe(
        opened.selection.listing.listingId,
      );
    } else if (boundary === "closed") {
      await w.setCompanyRoute(null);
    } else {
      vi.mocked(f.api.status).mockResolvedValueOnce({
        snapshot: structuredClone(w.getSnapshot().snapshot!),
      });
      await w.refreshCatalog();
    }
    expect(w.captureFollowupEvidence(captured)).toBeNull();
    expect(w.reviewEvidence.getSnapshot().canCapture).toBe(false);
    expect(
      w.reviewEvidence.getSnapshot().rows.every((row) => row.reading === null),
    ).toBe(true);
    expect(reads(f)).toEqual([1, 1, 1, 1]);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  },
);

it("retains all four full sources for exact share classes through owned Back, Continue and Finish, then separately saves and freshly loads authored checks", async () => {
  const f = await setup();
  const w = f.workspace;
  const watchlist = w.coordinator.getSnapshot(),
    portfolio = w.portfolio.coordinator.getSnapshot(),
    valuations = w.valuationAssumptions.coordinator.getSnapshot();
  f.start();
  expect(reads(f)).toEqual([0, 0, 0, 0]);
  const first = await f.open();
  await f.run();
  expect(reads(f)).toEqual([1, 1, 1, 1]);
  const reading = f.capture();
  expect(reading.selection.listing).toEqual(f.listings[1]);
  expect(reading.evidence.annual!.response).toEqual(f.annual[1]);
  expect(reading.evidence.interim!.response).toEqual(f.interim[1]);
  expect(reading.evidence.price!.response!.rows).toEqual(
    w.eod.getSnapshot().response!.rows,
  );
  expect(reading.sourcePass).toEqual(w.companySourcePass.getSnapshot());
  expect(reading.capturedAt).toBe("2026-11-04T12:00:00.000Z");
  expect(reading.evidence.price!.response!.completedAt).toBe(
    "2026-09-20T00:00:01.000Z",
  );
  w.researchFollowupContext(first.selection)!.editAssessment(
    "Full authored result · Café 東京",
  );
  w.returnFromResearch();
  expect(w.reviewEvidence.getSnapshot().selected!.reading).toBe(reading);
  w.followups.complete(f.review.getSnapshot().selected!.entry, new Date());
  expect(w.reviewEvidence.getSnapshot().selected!.reading).toBe(reading);
  f.review.continue(f.review.getSnapshot());
  await f.open();
  await f.run();
  const second = f.capture();
  expect(second.selection.listing).toEqual(f.listings[0]);
  expect(second.evidence.annual!.response).toEqual(f.annual[0]);
  expect(second.selection.listing.issuerId).toBe(
    reading.selection.listing.issuerId,
  );
  expect(second.selection.listing.shareClassId).not.toBe(
    reading.selection.listing.shareClassId,
  );
  w.returnFromResearch();
  f.review.continue(f.review.getSnapshot());
  await f.open();
  await f.run();
  const unsupported = f.capture();
  expect(
    unsupported.sourcePass.rows.every((r) => r.disposition === "unsupported"),
  ).toBe(true);
  expect(reads(f)).toEqual([2, 2, 2, 2]);
  w.returnFromResearch();
  f.review.finish(f.review.getSnapshot());
  expect(w.reviewEvidence.getSnapshot().rows.map((row) => row.reading)).toEqual(
    [reading, second, unsupported],
  );
  expect(w.reviewEvidence.getSnapshot().phase).toBe("finished");
  expect(vi.mocked(f.api.saveFollowups)).not.toHaveBeenCalled();
  expect(f.api.load).not.toHaveBeenCalled();
  expect(w.coordinator.getSnapshot()).toBe(watchlist);
  expect(w.portfolio.coordinator.getSnapshot()).toBe(portfolio);
  expect(w.valuationAssumptions.coordinator.getSnapshot()).toBe(valuations);
  expect(w.followups.currentEntry(f.untouched.id)).toEqual(f.untouched);
  await w.followups.coordinator.save();
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  const fresh = f.make();
  await fresh.refreshCatalog();
  fresh.setView("followups");
  await fresh.followups.coordinator.load();
  expect(fresh.followups.currentEntry(reading.check.id)).toMatchObject({
    result: "Full authored result · Café 東京",
    status: "completed",
  });
  expect(fresh.reviewEvidence.getSnapshot().phase).toBe("inactive");
  expect(fresh.followups.currentEntry(f.untouched.id)).toEqual(f.untouched);
  expect(reads(f)).toEqual([2, 2, 2, 2]);
});

it("keeps captured clocks after failed refresh, refuses busy and stale capture, and retains a partial cancelled pass without accepting late data", async () => {
  const f = await setup();
  const w = f.workspace;
  f.start();
  const visit = await f.open();
  await f.run();
  const original = f.capture();
  vi.setSystemTime(new Date("2026-11-04T13:00:00Z"));
  vi.mocked(f.api.eodHistory).mockRejectedValueOnce(
    new ManagedEodHistoryError("request_timeout"),
  );
  await w.requestResearchSource(visit, "eod");
  const retained = f.capture();
  expect(retained.evidence.price!.showingPrevious).toBe(true);
  expect(retained.evidence.price!.response).toEqual(
    original.evidence.price!.response,
  );
  expect(retained.capturedAt).not.toBe(original.capturedAt);
  w.returnFromResearch();
  f.review.continue(f.review.getSnapshot());
  const next = await f.open();
  let resolve!: (v: Awaited<ReturnType<typeof f.api.eodHistory>>) => void;
  const packet = {
    ...original.evidence.price!.response!,
    security: next.selection.listing,
  };
  vi.mocked(f.api.eodHistory).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const preview = w.prepareCompanySourcePass(next, [
    "eod",
    "annual",
    "filings",
    "interim",
  ])!;
  const pending = w.runCompanySourcePass(next, preview);
  const busy = w.reviewEvidence.getSnapshot();
  expect(busy.canCapture).toBe(false);
  expect(w.captureFollowupEvidence(busy)).toBeNull();
  w.cancelCompanySourcePass(next);
  const cancelled = f.capture();
  expect(cancelled.evidence.price!.response).toBeNull();
  resolve(packet);
  await pending;
  expect(w.reviewEvidence.getSnapshot().selected!.reading).toBe(cancelled);
  expect(w.eod.getSnapshot().response).toBeNull();
  expect(w.captureFollowupEvidence(busy)).toBeNull();
  expect(reads(f)).toEqual([3, 1, 1, 1]);
});

it("retires readings across foreign close and route replacement without changing unrelated drafts", async () => {
  const f = await setup();
  const w = f.workspace;
  f.start();
  await f.open();
  await f.run();
  f.capture();
  const old = w.reviewEvidence.getSnapshot();
  w.closeResearch();
  expect(w.captureFollowupEvidence(old)).toBeNull();
  expect(
    w.reviewEvidence.getSnapshot().rows.every((r) => r.reading === null),
  ).toBe(true);
  await f.open();
  f.capture();
  w.returnFromResearch();
  w.setView("markets");
  w.setView("followups");
  expect(w.reviewEvidence.getSnapshot().phase).toBe("inactive");
  expect(reads(f)).toEqual([1, 1, 1, 1]);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("extends an owned Filings Inspect visit without rereading its packet and keeps the explicit full citation assessment", async () => {
  const f = await setup(),
    w = f.workspace;
  f.start();
  await w.reviewFilings.load(w.reviewFilings.getSnapshot());
  const packet = w.reviewFilings.getSnapshot().selected!.filings.response!;
  const prepared = await w.prepareReviewFilingsResearch(
    w.reviewFilings.getSnapshot(),
  );
  expect(prepared).not.toBeNull();
  w.openFollowupResearch(prepared!);
  const visit = w.getSnapshot().research!;
  expect(visit.section).toBe("filings");
  await f.run();
  const reading = f.capture();
  expect(reading.evidence.filings!.response).toEqual(packet);
  expect(reading.evidence.filings!.responseOrigin).toBe("followups-review");
  expect(
    reading.sourcePass.rows.find((r) => r.name === "filings")!.disposition,
  ).toBe("retained");
  w.researchFollowupContext(visit.selection)!.editAssessment(
    "Original source-qualified assessment · 東京",
  );
  const port = w.captureFilingsAssessment(
    visit.selection,
    w.filings.getSnapshot().response!,
  ).port!;
  const citation = prepareFilingsAssessment(
    port,
    w.filings.getSnapshot().response!.issuer.filings[0]!,
    () => true,
  ).preview!;
  expect(citation.apply()).toBe(true);
  expect(citation.apply()).toBe(false);
  w.returnFromResearch();
  expect(w.reviewEvidence.getSnapshot().selected!.reading).toBe(reading);
  expect(f.review.getSnapshot().selected!.entry.result).toBe(citation.result);
  expect(reads(f)).toEqual([1, 1, 1, 1]);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.load).not.toHaveBeenCalled();
});

it("retains a partial pass with the exact Annual refusal and unattempted sources through owned navigation", async () => {
  const f = await setup();
  const w = f.workspace;
  f.start();
  await f.open();
  vi.mocked(f.api.annualReport).mockRejectedValueOnce(
    new ManagedAnnualReportError("request_timeout"),
  );
  await f.run();
  const reading = f.capture();
  expect(reading.evidence.annual).toMatchObject({
    response: null,
    error: true,
    running: false,
  });
  expect(reading.sourcePass.rows.map((r) => [r.name, r.disposition])).toEqual([
    ["eod", "loaded"],
    ["annual", "failed"],
    ["filings", "not_attempted"],
    ["interim", "not_attempted"],
  ]);
  expect(reading.evidence.price!.response).not.toBeNull();
  expect(reading.evidence.filings?.response ?? null).toBeNull();
  expect(reading.evidence.interim?.response ?? null).toBeNull();
  w.setNavigationBlocked(true);
  expect(w.captureFollowupEvidence(w.reviewEvidence.getSnapshot())).toBeNull();
  w.setNavigationBlocked(false);
  w.returnFromResearch();
  expect(w.reviewEvidence.getSnapshot().selected!.reading).toBe(reading);
  expect(reads(f)).toEqual([1, 1, 0, 0]);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it.each([
  "question",
  "due date",
  "Follow-ups file",
  "Watchlist file",
  "catalog",
  "session",
] as const)(
  "retires an old captured action after %s changes, including equal-value return",
  async (kind) => {
    const f = await setup();
    const w = f.workspace;
    f.start();
    await f.open();
    await f.run();
    f.capture();
    const old = w.reviewEvidence.getSnapshot();
    const entry = f.review.getSnapshot().selected!.entry;
    if (kind === "question" || kind === "due date") {
      const field = kind === "question" ? "check" : "dueOn";
      w.followups.edit(
        entry,
        field,
        kind === "question" ? "Different exact question" : "2026-10-28",
      );
      w.followups.edit(
        w.followups.currentEntry(entry.id)!,
        field,
        entry[field],
      );
    } else if (kind === "Follow-ups file") {
      const owner = {};
      w.followups.beginDraftFileActivity(owner);
      w.followups.endDraftFileActivity(owner);
    } else if (kind === "Watchlist file") {
      const owner = {};
      w.beginWatchlistDraftFileActivity(owner);
      w.endWatchlistDraftFileActivity(owner);
    } else if (kind === "catalog") {
      vi.mocked(f.api.status).mockResolvedValueOnce({
        snapshot: structuredClone(w.getSnapshot().snapshot!),
      });
      await w.refreshCatalog();
    } else w.sessionOwner.dispose();
    expect(w.captureFollowupEvidence(old)).toBeNull();
    expect(
      w.reviewEvidence.getSnapshot().rows.every((row) => row.reading === null),
    ).toBe(true);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(reads(f)).toEqual([1, 1, 1, 1]);
  },
);
