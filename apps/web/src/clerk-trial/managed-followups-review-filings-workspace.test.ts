import { heldDueFixture } from "./test-portfolio-held-due-fixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { prepareFilingsAssessment } from "./managed-filings-assessment";
const cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
});
afterEach(() => {
  cleanups.splice(0).forEach((off) => off());
  vi.useRealTimers();
});
async function fixture() {
  const f = await createFollowupsReviewFixture();
  cleanups.push(f.dispose);
  f.model.enter();
  f.model.choose(f.model.getSnapshot(), f.model.getSnapshot().rows[0]!.handle);
  f.model.start(f.model.getSnapshot());
  const evidence = f.workspace.reviewFilings;
  vi.mocked(f.api.recentFilings).mockResolvedValueOnce(
    filingsResponse(
      2,
      "available",
      evidence.getSnapshot().selected!.filings.selection!,
    ),
  );
  await evidence.load(evidence.getSnapshot());
  expect(evidence.getSnapshot().selected!.filings.response).not.toBeNull();
  return { ...f, evidence };
}
it("Inspect seeds the exact Follow-ups visit without another read, cites, returns, completes and separately saves/reloads", async () => {
  const f = await fixture();
  const packet = f.evidence.getSnapshot().selected!.filings.response!;
  const watchlist = f.workspace.coordinator.getSnapshot();
  const capture = await f.workspace.prepareReviewFilingsResearch(
    f.evidence.getSnapshot(),
  );
  expect(capture).not.toBeNull();
  f.workspace.openFollowupResearch(capture!);
  const visit = f.workspace.getSnapshot().research!;
  expect(visit.section).toBe("filings");
  expect(visit.selection.origin).toBe("followups");
  expect(f.workspace.filings.getSnapshot()).toMatchObject({
    response: packet,
    responseOrigin: "followups-review",
  });
  expect(f.workspace.filings.getSnapshot().response).not.toBe(packet);
  f.workspace
    .researchFollowupContext(visit.selection)!
    .editAssessment("  Café 東京 😀 original assessment  ");
  const port = f.workspace.captureFilingsAssessment(
    visit.selection,
    f.workspace.filings.getSnapshot().response!,
  ).port!;
  expect(port).not.toBeNull();
  const prepared = prepareFilingsAssessment(
    port,
    f.workspace.filings.getSnapshot().response!.issuer.filings[0]!,
    () => true,
  ).preview!;
  expect(prepared).not.toBeNull();
  expect(prepared.apply()).toBe(true);
  expect(prepared.apply()).toBe(false);
  f.workspace.closeResearch();
  expect(f.evidence.getSnapshot().selected!.filings.response).toBe(packet);
  expect(f.model.getSnapshot().selected!.entry.result).toBe(prepared.result);
  f.workspace.followups.complete(
    f.model.getSnapshot().selected!.entry,
    new Date(),
  );
  expect(f.evidence.getSnapshot().selected!.filings.response).toBe(packet);
  f.model.finish(f.model.getSnapshot());
  expect(f.evidence.getSnapshot().rows).toEqual([]);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  await f.workspace.followups.coordinator.save();
  const fresh = f.make();
  await fresh.refreshCatalog();
  await fresh.followups.coordinator.load();
  expect(fresh.followups.currentEntry(capture!.entry.id)).toMatchObject({
    status: "completed",
    result: prepared.result.normalize("NFC").trim(),
  });
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
  expect(f.api.resolve).toHaveBeenCalledTimes(2); // Inspect plus fresh Markets resolution.
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
});
it("refuses an inspected capture after review retirement and an equal-looking new review", async () => {
  const f = await fixture();
  const capture = await f.workspace.prepareReviewFilingsResearch(
    f.evidence.getSnapshot(),
  );
  f.model.finish(f.model.getSnapshot());
  f.model.enter();
  f.model.choose(f.model.getSnapshot(), f.model.getSnapshot().rows[0]!.handle);
  f.model.start(f.model.getSnapshot());
  f.workspace.openFollowupResearch(capture!);
  expect(f.workspace.getSnapshot().research).toBeNull();
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
});

it("retains separate same-CIK share-class packets in the actual held review with zero automatic requests", async () => {
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
  const f = await heldDueFixture();
  cleanups.push(f.dispose);
  f.api.recentFilings = vi.fn();
  f.intake.prepare(f.intake.getSnapshot());
  for (const entry of f.intake.getSnapshot().plan.eligible)
    f.intake.choose(f.intake.getSnapshot(), entry);
  expect(f.intake.start(f.intake.getSnapshot())).not.toBeNull();
  const evidence = f.workspace.reviewFilings;
  const before = f.workspace.portfolio.coordinator.getSnapshot();
  const first = evidence.getSnapshot().selected!;
  const next = evidence.getSnapshot().rows[1]!;
  expect(first.entry.listing.issuerId).toBe(next.entry.listing.issuerId);
  expect(first.entry.listing.shareClassId).not.toBe(
    next.entry.listing.shareClassId,
  );
  expect(f.api.recentFilings).not.toHaveBeenCalled();
  const one = filingsResponse(1, "available", first.filings.selection!);
  vi.mocked(f.api.recentFilings).mockResolvedValueOnce(one);
  await evidence.load(evidence.getSnapshot());
  const packet = evidence.getSnapshot().selected!.filings.response!;
  const prepared = await f.workspace.prepareReviewFilingsResearch(
    evidence.getSnapshot(),
  );
  f.workspace.openFollowupResearch(prepared!);
  f.workspace.closeResearch();
  expect(evidence.getSnapshot().selected!.filings.response).toBe(packet);
  f.review.continue(f.review.getSnapshot());
  const two = filingsResponse(
    0,
    "available",
    evidence.getSnapshot().selected!.filings.selection!,
  );
  expect(two.security.cik).toBe(one.security.cik);
  vi.mocked(f.api.recentFilings).mockResolvedValueOnce(two);
  await evidence.load(evidence.getSnapshot());
  expect(evidence.getSnapshot().rows[0]!.filings.response).toBe(packet);
  expect(evidence.getSnapshot().selected!.filings.response!.security).toEqual(
    two.security,
  );
  expect(f.api.recentFilings).toHaveBeenCalledTimes(2);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(before);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
});
it("cannot mint Inspect from a publication subscriber after Portfolio retirement", async () => {
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
  const f = await heldDueFixture();
  cleanups.push(f.dispose);
  f.intake.prepare(f.intake.getSnapshot());
  f.intake.choose(
    f.intake.getSnapshot(),
    f.intake.getSnapshot().plan.eligible[0]!,
  );
  f.intake.start(f.intake.getSnapshot());
  const evidence = f.workspace.reviewFilings;
  f.api.recentFilings = vi
    .fn()
    .mockResolvedValue(
      filingsResponse(
        1,
        "available",
        evidence.getSnapshot().selected!.filings.selection!,
      ),
    );
  let attempted = false;
  const off = evidence.subscribe(() => {
    const state = evidence.getSnapshot();
    if (attempted || !state.selected?.filings.response) return;
    attempted = true;
    const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
    f.workspace.portfolio.setPendingEditor(draft, true);
    f.workspace.portfolio.setPendingEditor(draft, false);
    expect(evidence.capture(state)).toBeNull();
    expect(evidence.canInspect(evidence.getSnapshot())).toBe(false);
  });
  await evidence.load(evidence.getSnapshot());
  off();
  expect(attempted).toBe(true);
  expect(f.review.getSnapshot().entered).toBe(false);
  expect(evidence.getSnapshot().rows).toEqual([]);
});
it("retires prepared Inspect after navigation pause/restore while a fresh Inspect reuses the retained packet", async () => {
  const f = await fixture();
  const packet = f.evidence.getSnapshot().selected!.filings.response;
  const old = await f.workspace.prepareReviewFilingsResearch(
    f.evidence.getSnapshot(),
  );
  expect(old).not.toBeNull();
  f.workspace.setNavigationBlocked(true);
  f.workspace.setNavigationBlocked(false);
  f.workspace.openFollowupResearch(old!);
  expect(f.workspace.getSnapshot().research).toBeNull();
  expect(f.evidence.getSnapshot().selected!.filings.response).toBe(packet);
  const fresh = await f.workspace.prepareReviewFilingsResearch(
    f.evidence.getSnapshot(),
  );
  expect(fresh).not.toBeNull();
  f.workspace.openFollowupResearch(fresh!);
  expect(f.workspace.getSnapshot().research?.section).toBe("filings");
  expect(f.workspace.filings.getSnapshot().response).toEqual(packet);
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
  expect(f.api.resolve).toHaveBeenCalledTimes(2);
});
