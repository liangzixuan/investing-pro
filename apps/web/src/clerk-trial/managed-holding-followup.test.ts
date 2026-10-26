import { describe, expect, it, vi } from "vitest";
import type { ManagedApi } from "./managed-api";
import type {
  ResearchFollowup,
  ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { ManagedResearchFollowups } from "./managed-research-followups";
import {
  prepareHoldingFollowup,
  type HoldingFollowupPosition,
  type HoldingFollowupPort,
} from "./managed-holding-followup";
import { eodSelection } from "./eod-history-fixture";

const digest = eodSelection.catalogSnapshotSha256;
const position: HoldingFollowupPosition = {
  listing: eodSelection.listing,
  shares: "2.000000",
  totalCostBasisUsd: null,
  confirmedOn: "2026-10-02",
};
const payload = (...entries: ResearchFollowup[]): ResearchFollowupsPayload => ({
  schemaVersion: 1,
  entries,
});
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const entry = (n: number, listing = position.listing): ResearchFollowup => ({
  id: id(n),
  listing,
  catalogSnapshotSha256: digest,
  check: "Keep the complete existing question",
  dueOn: "2026-11-02",
  status: "completed",
  completedOn: "2026-10-23",
  result: "Keep original authored assessment",
});
async function fixture(initial = payload(), generate?: () => string) {
  let active = true,
    form = true,
    next = 100;
  const sourcePosition = structuredClone(position);
  const service = {
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockResolvedValue({ version: 1, payload: initial }),
    saveFollowups: vi.fn<ManagedApi["saveFollowups"]>(),
    resolve: vi.fn<ManagedApi["resolve"]>(),
  };
  const model = new ManagedResearchFollowups(
    service,
    {
      userId: "invented-user",
      sessionId: "invented-session",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    {
      getCreationContext: () => ({
        draft: null,
        catalogSnapshotSha256: digest,
      }),
      getHoldingCreationContext: () => ({
        position: sourcePosition,
        catalogSnapshotSha256: digest,
        isCurrent: () => active,
      }),
      onRetire: vi.fn(),
      newEntryId: generate ?? (() => id(next++)),
    },
  );
  await model.coordinator.load();
  const port: HoldingFollowupPort = {
    model,
    position: sourcePosition,
    isCurrent: () => active,
  };
  const prepare = (
    check = "  Cafe\u0301 東京 😀 next check  ",
    dueOn = "2026-11-02",
  ) => prepareHoldingFollowup(port, check, dueOn, () => form);
  return {
    model,
    service,
    port,
    sourcePosition,
    prepare,
    active: (value: boolean) => {
      active = value;
    },
    form: (value: boolean) => {
      form = value;
    },
  };
}
describe("owned holding Follow-up preview", () => {
  it("creates only the complete normalized authored question outside My Watchlist and consumes before subscribers reenter", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    expect(preview.position).toEqual(position);
    expect(preview.position.totalCostBasisUsd).toBeNull();
    expect(preview.check).toBe("Café 東京 😀 next check");
    let reentered: ResearchFollowup | null | undefined;
    const stop = f.model.coordinator.subscribe(() => {
      reentered = preview.create();
    });
    const result = preview.create();
    stop();
    expect(result).toEqual({
      id: id(100),
      listing: position.listing,
      catalogSnapshotSha256: digest,
      check: preview.check,
      dueOn: "2026-11-02",
      status: "open",
      completedOn: null,
      result: "",
    });
    expect(reentered).toBeNull();
    expect(preview.create()).toBeNull();
    expect(f.service.saveFollowups).not.toHaveBeenCalled();
    expect(f.service.resolve).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("shares");
    expect(result!.check).not.toContain(position.confirmedOn);
  });
  it("admits exactly500 complete Unicode codepoints and refuses501/control characters/invalid UTC dates", async () => {
    const f = await fixture();
    expect(f.prepare("😀".repeat(500)).preview!.check).toBe("😀".repeat(500));
    for (const [question, date] of [
      ["😀".repeat(501), "2026-11-02"],
      ["bad\nquestion", "2026-11-02"],
      ["bad\u200bquestion", "2026-11-02"],
      ["Question", "2026-02-30"],
      ["Question", "2026-11-2"],
    ])
      expect(f.prepare(question, date).preview).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });
  it("refuses copied previews, canceled previews and a second earlier preview after creation", async () => {
    const f = await fixture();
    const first = f.prepare().preview!,
      second = f.prepare().preview!;
    expect({ ...first }.isCurrent()).toBe(false);
    expect({ ...first }.create()).toBeNull();
    second.cancel();
    expect(second.create()).toBeNull();
    expect(first.create()).not.toBeNull();
    const other = await fixture();
    const a = other.prepare().preview!,
      b = other.prepare().preview!;
    expect(a.create()).not.toBeNull();
    expect(b.create()).toBeNull();
  });
  it.each(["host", "form", "file", "filter", "draft"] as const)(
    "permanently retires preview across %s",
    async (boundary) => {
      const f = await fixture();
      const p = f.prepare().preview!;
      if (boundary === "host") {
        f.active(false);
        expect(p.isCurrent()).toBe(false);
        f.active(true);
      }
      if (boundary === "form") {
        f.form(false);
        expect(p.isCurrent()).toBe(false);
        f.form(true);
      }
      if (boundary === "file") {
        const activity = {};
        f.model.beginDraftFileActivity(activity);
        f.model.endDraftFileActivity(activity);
      }
      if (boundary === "filter") {
        f.model.setFilter("all");
        f.model.setFilter("open");
      }
      if (boundary === "draft") f.model.coordinator.replaceDraft(payload());
      expect(p.create()).toBeNull();
      expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    },
  );
  it("keeps all existing entries and refuses duplicates across completed/filtered rows or the21st entry", async () => {
    const existing = entry(1);
    const duplicate = await fixture(payload(existing));
    duplicate.model.setFilter("open");
    expect(duplicate.prepare().preview).toBeNull();
    expect(duplicate.model.coordinator.getSnapshot().draft!.entries).toEqual([
      existing,
    ]);
    const rows = Array.from({ length: 20 }, (_, i) =>
      entry(i + 1, { ...position.listing, listingId: `other-${i}` }),
    );
    const full = await fixture(payload(...rows));
    expect(full.prepare().preview).toBeNull();
    expect(full.model.coordinator.getSnapshot().draft!.entries).toEqual(rows);
  });
  it("rechecks source identity and basis after injected UUID generation, consumes before ID callback reentry", async () => {
    let nested: ResearchFollowup | null = null;
    const f = await fixture(payload(), () => {
      nested = p!.create();
      (
        f.sourcePosition as { totalCostBasisUsd: string | null }
      ).totalCostBasisUsd = "0.00";
      return id(100);
    });
    const p = f.prepare().preview;
    expect(p!.create()).toBeNull();
    expect(nested).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });
  it("refuses duplicate/malformed UUIDs and foreign model captures", async () => {
    const duplicate = await fixture(
      payload(entry(100, { ...position.listing, listingId: "other" })),
      () => id(100),
    );
    expect(duplicate.prepare().preview!.create()).toBeNull();
    const malformed = await fixture(payload(), () => "bad-id");
    expect(malformed.prepare().preview!.create()).toBeNull();
    const a = await fixture(),
      b = await fixture();
    const capture = a.model.prepareHoldingCheck(
      a.port.position,
      "Question",
      "2026-11-02",
    ).capture!;
    expect(b.model.createHoldingCheck(capture, () => true)).toBeNull();
    expect(a.model.createHoldingCheck({ ...capture }, () => true)).toBeNull();
  });
});
