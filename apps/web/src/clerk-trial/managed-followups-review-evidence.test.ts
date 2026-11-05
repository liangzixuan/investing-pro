import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedSecFilingsError } from "./managed-api";
import { isOwnedSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import { createFollowupsEvidenceFixture } from "./test-followups-review-evidence-fixture";
import {
  detachFollowupEvidence,
  FOLLOWUP_EVIDENCE_MAX_BYTES,
} from "./managed-followups-review-evidence-reading";
import { eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import type { CompanySnapshotLoadSource } from "./managed-company-snapshot-load-sources";

type Fixture = Awaited<ReturnType<typeof createFollowupsEvidenceFixture>>;
const dispose: (() => void)[] = [];
afterEach(() => {
  dispose.splice(0).forEach((off) => off());
});
async function fixture() {
  const f = await createFollowupsEvidenceFixture();
  dispose.push(f.dispose);
  return f;
}
async function run(
  f: Fixture,
  names: readonly CompanySnapshotLoadSource[] = [
    "eod",
    "annual",
    "filings",
    "interim",
  ],
) {
  const preview = f.pass.prepare(f.visit()!.selection, () => true, names);
  expect(preview).not.toBeNull();
  await f.pass.start(preview!);
}
function capture(f: Fixture) {
  const state = f.model.getSnapshot();
  expect(state.canCapture, state.reason ?? "").toBe(true);
  const installed = f.model.capture(state, f.visit()!);
  expect(installed).toBe(f.model.getSnapshot());
  expect(installed?.selected?.reading).not.toBeNull();
  return installed!.selected!.reading!;
}
function counts(f: Fixture) {
  return [
    f.readPrice,
    f.readAnnual,
    f.readFilings,
    f.readInterim,
    f.api.saveFollowups,
    f.api.loadFollowups,
  ].map((fn) => fn.mock.calls.length);
}
describe("passive evidence in the existing chosen Follow-ups review", () => {
  it("keeps every full packet/view, pass outcome and independent clock without Watchlist or extra effects", async () => {
    const f = await fixture();
    expect(f.model.getSnapshot().rows).toHaveLength(3);
    const visit = f.open();
    await run(f);
    const evidence = f.evidence(visit.selection);
    const pass = f.pass.getSnapshot();
    const before = counts(f);
    const reading = capture(f);
    expect(reading).toEqual({
      kind: "followup_source_reading",
      capturedAt: "2026-11-04T13:30:00.000Z",
      check: f.entries[0],
      selection: visit.selection,
      evidence,
      sourcePass: pass,
    });
    expect(reading.evidence).not.toBe(evidence);
    expect(reading.evidence.annual?.response).not.toBe(
      evidence.annual?.response,
    );
    expect(
      isOwnedSecAnnualCanonicalResponse(reading.evidence.annual!.response),
    ).toBe(false);
    expect(reading.evidence.price!.response!.completedAt).not.toBe(
      reading.capturedAt,
    );
    expect(Object.isFrozen(reading.evidence.annual!.view)).toBe(true);
    f.back();
    expect(f.model.getSnapshot().rows[0]!.reading).toBe(reading);
    expect(counts(f)).toEqual(before);
    expect(f.api.resolve).not.toHaveBeenCalled();
  });
  it("preserves authored assessment, complete/reopen, order, unsupported rows and passive Finish", async () => {
    const f = await fixture();
    f.open();
    await run(f);
    const first = capture(f);
    f.followups.edit(
      f.review.getSnapshot().selected!.entry,
      "result",
      "  Full authored assessment Café 東京 📈  ",
    );
    f.followups.complete(
      f.review.getSnapshot().selected!.entry,
      new Date("2026-11-04T15:00:00Z"),
    );
    f.followups.reopen(f.review.getSnapshot().selected!.entry);
    expect(f.model.getSnapshot().rows[0]!.reading).toBe(first);
    expect(f.model.getSnapshot().rows[0]!.entry.result).toBe(
      "  Full authored assessment Café 東京 📈  ",
    );
    expect(first.check.result).toBe("Original 0");
    f.back();
    f.review.continue(f.review.getSnapshot());
    f.open();
    await run(f, ["eod", "filings"]);
    const second = capture(f);
    expect(second.selection.listing.shareClassId).not.toBe(
      first.selection.listing.shareClassId,
    );
    expect(second.evidence.filings!.response!.security.listingId).toBe(
      f.entries[1]!.listing.listingId,
    );
    f.back();
    f.review.continue(f.review.getSnapshot());
    f.open();
    const before = counts(f);
    await run(f);
    const third = capture(f);
    expect(
      third.sourcePass.rows.every((row) => row.disposition === "unsupported"),
    ).toBe(true);
    expect(counts(f)).toEqual(before);
    f.back();
    f.review.finish(f.review.getSnapshot());
    const finished = f.model.getSnapshot();
    expect(finished).toMatchObject({
      phase: "finished",
      selected: null,
      canCapture: false,
    });
    expect(finished.rows.map((row) => row.reading)).toEqual([
      first,
      second,
      third,
    ]);
    expect(
      f.model.prepareOpen(f.review.getSnapshot(), first.selection),
    ).toBeNull();
    expect(
      f.model.capture(finished, { selection: first.selection, section: "eod" }),
    ).toBeNull();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });
  it("retains partial pass and transient refresh refusal without redating earlier packets", async () => {
    const f = await fixture();
    f.open();
    f.readFilings.mockRejectedValueOnce(
      new ManagedSecFilingsError("unavailable"),
    );
    await run(f);
    const partial = capture(f);
    expect(partial.sourcePass.rows.map((r) => r.disposition)).toEqual([
      "loaded",
      "loaded",
      "failed",
      "not_attempted",
    ]);
    expect(partial.evidence.filings!.error).toBe(true);
    await run(f);
    const complete = capture(f);
    expect(complete.sourcePass.rows[0]!.disposition).toBe("retained");
    expect(complete.evidence.price).toEqual(partial.evidence.price);
    const original = complete.evidence.filings!.response;
    f.readFilings.mockRejectedValueOnce(
      new ManagedSecFilingsError("unavailable"),
    );
    await f.filings.load();
    const failedRefresh = capture(f);
    expect(failedRefresh.evidence.filings).toMatchObject({
      response: original,
      error: true,
      showingPrevious: true,
    });
    expect(failedRefresh.sourcePass.phase).toBe("invalidated");
    expect(partial.evidence.filings!.response).toBeNull();
  });
  it("captures cancellation with unattempted outcomes and fences the late response", async () => {
    const f = await fixture();
    f.open();
    let resolve!: (r: ReturnType<typeof eodResponse>) => void;
    f.readPrice.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const preview = f.pass.prepare(f.visit()!.selection, () => true, [
      "eod",
      "annual",
      "filings",
    ]);
    const pending = f.pass.start(preview!);
    expect(f.model.getSnapshot().canCapture).toBe(false);
    const running = f.model.getSnapshot();
    f.pass.cancel();
    const cancelled = capture(f);
    expect(cancelled.sourcePass.phase).toBe("cancelled");
    expect(cancelled.sourcePass.rows.map((r) => r.disposition)).toEqual([
      "cancelled",
      "not_attempted",
      "not_attempted",
      "not_attempted",
    ]);
    resolve(eodResponse());
    await pending;
    expect(f.model.getSnapshot().selected!.reading).toBe(cancelled);
    expect(f.price.getSnapshot().response).toBeNull();
    expect(f.model.capture(running, f.visit()!)).toBeNull();
    expect(f.readAnnual).not.toHaveBeenCalled();
  });
  it("accepts owned section changes but retires foreign equal-value visits", async () => {
    const f = await fixture();
    const visit = f.open();
    await run(f);
    const reading = capture(f);
    f.setVisit({ selection: visit.selection, section: "filings" });
    expect(f.model.getSnapshot().canCapture).toBe(true);
    expect(f.model.getSnapshot().selected!.reading).toBe(reading);
    const state = f.model.getSnapshot();
    f.setVisit({
      selection: structuredClone(visit.selection),
      section: "filings",
    });
    expect(f.model.getSnapshot().rows).toEqual([]);
    f.setVisit(visit);
    expect(f.model.capture(state, visit)).toBeNull();
    expect(
      f.model.getSnapshot().rows.every((row) => row.reading === null),
    ).toBe(true);
  });
  it("pauses availability without erasing reading and refuses stale handlers after ABA", async () => {
    const f = await fixture();
    f.open();
    await run(f);
    const reading = capture(f);
    const state = f.model.getSnapshot();
    f.setAvailable(false);
    expect(f.model.getSnapshot().canCapture).toBe(false);
    expect(f.model.getSnapshot().selected!.reading).toBe(reading);
    f.setAvailable(true);
    expect(f.model.capture(state, f.visit()!)).toBeNull();
    expect(f.model.getSnapshot().canCapture).toBe(true);
  });
  it.each(["question", "date", "file", "load", "catalog", "retire"] as const)(
    "retires evidence on %s replacement and cannot revive equal values",
    async (change) => {
      const f = await fixture();
      f.open();
      await f.price.load();
      capture(f);
      const state = f.model.getSnapshot();
      const visit = f.visit()!;
      const entry = f.review.getSnapshot().selected!.entry;
      if (change === "question") {
        f.followups.edit(entry, "check", "Changed");
        f.followups.edit(
          f.followups.currentEntry(entry.id)!,
          "check",
          entry.check,
        );
      }
      if (change === "date") {
        f.followups.edit(entry, "dueOn", "2026-11-02");
        f.followups.edit(
          f.followups.currentEntry(entry.id)!,
          "dueOn",
          entry.dueOn,
        );
      }
      if (change === "file") {
        const owner = {};
        f.followups.beginDraftFileActivity(owner);
        f.followups.endDraftFileActivity(owner);
      }
      if (change === "load") await f.followups.coordinator.load();
      if (change === "catalog") {
        f.followups.syncCatalog(`sha256:${"b".repeat(64)}`);
        f.followups.syncCatalog(entry.catalogSnapshotSha256);
      }
      if (change === "retire") f.model.retire();
      expect(f.model.capture(state, visit)).toBeNull();
      expect(
        f.model.getSnapshot().rows.every((row) => row.reading === null),
      ).toBe(true);
      expect(f.api.saveFollowups).not.toHaveBeenCalled();
    },
  );
  it("refuses another class, catalog, origin or CIK while admitting a new exact visit", async () => {
    const f = await fixture();
    const selected = f.review.getSnapshot().selected!.entry;
    const selection = {
      listing: selected.listing,
      catalogSnapshotSha256: selected.catalogSnapshotSha256,
      origin: "followups" as const,
      cik: "0000000001",
    };
    expect(
      f.model.prepareOpen(f.review.getSnapshot(), {
        ...selection,
        listing: f.entries[1]!.listing,
      }),
    ).toBeNull();
    expect(
      f.model.prepareOpen(f.review.getSnapshot(), {
        ...selection,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      }),
    ).toBeNull();
    expect(
      f.model.prepareOpen(f.review.getSnapshot(), {
        ...selection,
        origin: "watchlist",
      }),
    ).toBeNull();
    const token = f.model.prepareOpen(f.review.getSnapshot(), selection)!;
    const wrong = {
      selection: { ...selection, cik: "0000000002" },
      section: "eod" as const,
    };
    f.setVisit(wrong);
    expect(f.model.commitOpen(token, wrong)).toBe(false);
    expect(f.model.getSnapshot().canCapture).toBe(false);
  });
  it("rejects clock reentry and stale opening completion without clearing a newer owner", async () => {
    const f = await fixture();
    f.open();
    await f.price.load();
    const previous = f.model.getSnapshot();
    let replacement = f.visit()!;
    f.setClock(() => {
      f.model.foreignClose();
      f.review.setAvailable(true);
      replacement = f.open();
      return new Date("2026-11-04T14:00:00Z");
    });
    expect(f.model.capture(previous, f.visit()!)).toBeNull();
    expect(f.model.getSnapshot().canCapture).toBe(true);
    expect(f.visit()).toBe(replacement);
    f.setClock(() => new Date("2026-11-04T14:00:00Z"));
    expect(capture(f).capturedAt).toBe("2026-11-04T14:00:00.000Z");
  });
  it("refuses replaced source handlers and whole overlimit or action-bearing data without clipping", async () => {
    const f = await fixture();
    const visit = f.open();
    await f.price.load();
    const stale = f.model.getSnapshot();
    await f.price.load();
    expect(f.model.capture(stale, visit)).toBeNull();
    const e = f.evidence(visit.selection);
    const pass = f.pass.getSnapshot();
    expect(
      detachFollowupEvidence(
        f.entries[0]!,
        visit.selection,
        {
          ...e,
          price: {
            ...e.price!,
            message: "x".repeat(FOLLOWUP_EVIDENCE_MAX_BYTES),
          },
        },
        pass,
        "2026-11-04T12:00:00.000Z",
      ),
    ).toBeNull();
    expect(
      detachFollowupEvidence(
        f.entries[0]!,
        visit.selection,
        { ...e, price: { ...e.price!, action: vi.fn() } } as never,
        pass,
        "2026-11-04T12:00:00.000Z",
      ),
    ).toBeNull();
  });
  it("keeps the complete Filings refresh comparison and lastCheck as detached original data", async () => {
    const f = await fixture();
    const visit = f.open();
    await f.filings.load();
    f.readFilings.mockResolvedValueOnce(
      filingsResponse(3, "available", visit.selection),
    );
    await f.filings.load();
    const source = f.filings.getSnapshot();
    expect(source.refreshComparison).not.toBeNull();
    expect(source.lastCheck).not.toBeNull();
    const reading = capture(f);
    expect(reading.evidence.filings).toEqual(source);
    expect(reading.evidence.filings!.refreshComparison).not.toBe(
      source.refreshComparison,
    );
    expect(reading.evidence.filings!.lastCheck).not.toBe(source.lastCheck);
  });
  it("rejects forged canonical data and a foreign full source identity", async () => {
    const f = await fixture();
    const visit = f.open();
    await run(f);
    const e = f.evidence(visit.selection);
    const pass = f.pass.getSnapshot();
    const at = "2026-11-04T12:00:00.000Z";
    expect(
      detachFollowupEvidence(
        f.entries[0]!,
        visit.selection,
        { ...e, annual: structuredClone(e.annual) },
        pass,
        at,
      ),
    ).toBeNull();
    expect(
      detachFollowupEvidence(
        f.entries[0]!,
        visit.selection,
        {
          ...e,
          price: {
            ...e.price!,
            selection: { ...visit.selection, listing: f.entries[1]!.listing },
          },
        },
        pass,
        at,
      ),
    ).toBeNull();
    expect(
      detachFollowupEvidence(
        f.entries[0]!,
        visit.selection,
        e,
        pass,
        "invalid",
      ),
    ).toBeNull();
  });
  it("does not let a failed older opening retire the committed replacement visit", async () => {
    const f = await fixture();
    const selected = f.review.getSnapshot().selected!.entry;
    const pending = f.model.prepareOpen(f.review.getSnapshot(), {
      listing: selected.listing,
      catalogSnapshotSha256: selected.catalogSnapshotSha256,
      origin: "followups",
      cik: "0000000001",
    });
    expect(pending).not.toBeNull();
    const replacement = f.open();
    await f.price.load();
    const before = f.model.getSnapshot();
    expect(f.model.commitOpen(pending!, undefined)).toBe(false);
    expect(f.model.getSnapshot()).toBe(before);
    expect(
      f.model.capture(before, replacement)?.selected?.reading,
    ).not.toBeNull();
  });
  it("does not report a committed capture after a subscriber replaces the owner", async () => {
    const f = await fixture();
    f.open();
    await f.price.load();
    const state = f.model.getSnapshot();
    const oldVisit = f.visit()!;
    let changed = false;
    const off = f.model.subscribe(() => {
      if (changed || !f.model.getSnapshot().selected?.reading) return;
      changed = true;
      f.model.foreignClose();
      f.review.setAvailable(true);
      f.open();
    });
    expect(f.model.capture(state, oldVisit)).toBeNull();
    off();
    expect(changed).toBe(true);
    expect(f.model.getSnapshot().selected?.reading).toBeNull();
    expect(f.model.getSnapshot().canCapture).toBe(true);
    expect(capture(f)).not.toBeNull();
  });
});
