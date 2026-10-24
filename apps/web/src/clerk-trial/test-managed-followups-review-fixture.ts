import { expect, vi } from "vitest";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";

export async function createFollowupsReviewFixture() {
  const workspaces: ManagedWorkspace[] = [];
  const base = await createFixture("research-followups");
  const storage = base.followups!;
  const signal = new AbortController().signal;
  const catalog = await base.api.status(signal);
  const watchlist = await base.api.load(signal);
  const { note, ...first } = watchlist.payload.memberships[0]!;
  void note;
  const listings = [first, ...base.marketsCohort.slice(0, 2)];
  const entries: ResearchFollowup[] = listings.map((listing, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    listing,
    catalogSnapshotSha256: catalog.snapshot.snapshotSha256,
    check: `Inspect the original question ${index + 1} · Café 東京 📈`,
    dueOn: "2026-10-20",
    status: "open",
    completedOn: null,
    result: index === 2 ? "Unchosen result stays" : "",
  }));
  // Invented RAM setup predates the review; no owner record or network exists.
  await storage.api.saveFollowups(
    {
      expectedVersion: 0,
      idempotencyKey: "invented-review-seed",
      payload: { schemaVersion: 1, entries },
    },
    signal,
  );
  const api: ManagedApi = {
    ...base.api,
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue(catalog),
    load: vi.fn<ManagedApi["load"]>().mockResolvedValue(watchlist),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            listings.find((entry) => entry.listingId === listingId) ?? null,
        })),
      }),
    ),
    loadFollowups: vi.fn(storage.api.loadFollowups),
    saveFollowups: vi.fn(storage.api.saveFollowups),
    eodHistory: vi.fn(base.api.eodHistory),
    annualReport: vi.fn(base.api.annualReport),
    recentFilings: vi.fn(base.api.recentFilings),
  };
  const make = () => {
    const workspace = new ManagedWorkspace(
      api,
      storage.nextSession(),
      undefined,
      {
        researchCoverage: base.researchCoverage,
        priceCoverage: base.priceCoverage,
        marketsCohort: base.marketsCohort,
      },
    );
    workspaces.push(workspace);
    return workspace;
  };
  const workspace = make();
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  workspace.setView("followups");
  await workspace.followups.coordinator.load();
  // The initial Markets board resolves its own three catalog identities.
  // Keep this request visible and separate from the explicit review actions.
  expect(api.resolve).toHaveBeenCalledOnce();
  expect(vi.mocked(api.resolve).mock.calls[0]![0].listingIds).toEqual(
    base.marketsCohort.map((listing) => listing.listingId),
  );
  vi.mocked(api.resolve).mockClear();
  const model = workspace.followupsReview;
  const start = () => {
    expect(model.enter()).toBe(true);
    const rows = model.getSnapshot().rows;
    expect(rows).toHaveLength(3);
    model.choose(model.getSnapshot(), rows[1]!.handle);
    model.choose(model.getSnapshot(), rows[0]!.handle);
    model.start(model.getSnapshot());
  };
  const open = async () => {
    const entry = model.captureCurrent(model.getSnapshot())!;
    const prepared = await workspace.prepareFollowupResearch(entry);
    expect(prepared).not.toBeNull();
    workspace.openFollowupResearch(prepared!);
    const visit = workspace.getSnapshot().research!;
    expect(visit).not.toBeNull();
    return workspace.researchFollowupContext(visit.selection)!;
  };
  return {
    workspace,
    model,
    api,
    storage,
    entries,
    start,
    open,
    make,
    dispose: () => workspaces.forEach((item) => item.sessionOwner.dispose()),
  };
}
