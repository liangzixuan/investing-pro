import { encodeMainWatchlistPayload } from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixture } from "./fixture";
import { snapshotLoadingNote } from "./company-snapshot-loading-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";

afterEach(() => vi.useRealTimers());
async function openInventedCompany() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-20T12:00:00.000Z"));
  const fixture = await createFixture("company-snapshot-loading");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
    },
  );
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-zero", snapshotLoadingNote);
  workspace.openWatchlistAnnual(
    workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  return { fixture, workspace, visit: workspace.getSnapshot().research! };
}
type Opened = Awaited<ReturnType<typeof openInventedCompany>>;
function observeSources(opened: Opened) {
  return {
    price: opened.workspace.eod.getSnapshot().response,
    annual: opened.workspace.annual.getSnapshot().response,
    draft: opened.workspace.coordinator.getSnapshot().draft,
  };
}
async function cancelFirstFilings(opened: Opened) {
  const reading = opened.workspace.loadCompanySnapshot(opened.visit);
  await vi.waitFor(() => expect(opened.fixture.getSnapshot().filings).toBe(1));
  const evidence = observeSources(opened);
  expect(evidence.price).not.toBeNull();
  expect(evidence.annual).not.toBeNull();
  opened.workspace.cancelCompanySnapshot(opened.visit);
  expect(opened.fixture.getSnapshot().filingsAborted).toBe(1);
  opened.fixture.companySnapshotLoading!.settleCancelledFilings();
  await reading;
  expect(opened.workspace.filings.getSnapshot().response).toBeNull();
  expect(observeSources(opened)).toEqual(evidence);
  return evidence;
}
function requireOnlyMissingFilings(opened: Opened) {
  expect(opened.fixture.getSnapshot()).toMatchObject({
    eod: 1,
    annual: 1,
    filings: 2,
    filingsAborted: 1,
    filingsLateResolved: 1,
    save: 0,
    token: 0,
    signOut: 0,
  });
  expect(opened.workspace.filings.getSnapshot().response?.issuer.status).toBe(
    "available",
  );
  expect(opened.workspace.getSnapshot().research?.section).toBe("annual");
}
function requireSavedAuthoredDraft(
  opened: Opened,
  before: NonNullable<ReturnType<typeof observeSources>["draft"]>,
) {
  const saved = opened.workspace.coordinator.getSnapshot().draft!;
  expect(saved).toStrictEqual(before);
  expect(JSON.stringify(saved)).not.toBe(JSON.stringify(before));
  expect(encodeMainWatchlistPayload(saved)).toBe(
    encodeMainWatchlistPayload(before),
  );
  expect(
    encodeMainWatchlistPayload({
      ...saved,
      memberships: [...saved.memberships].reverse(),
    }),
  ).not.toBe(encodeMainWatchlistPayload(before));
}
describe("invented coordinated company snapshot native fixture", () => {
  it("cancels the owned read, discards its late packet and loads only missing Filings on a later explicit action", async () => {
    const opened = await openInventedCompany();
    try {
      const evidence = await cancelFirstFilings(opened);
      await opened.workspace.loadCompanySnapshot(opened.visit);
      requireOnlyMissingFilings(opened);
      expect(observeSources(opened)).toEqual(evidence);
      await opened.workspace.loadCompanySnapshot(opened.visit);
      requireOnlyMissingFilings(opened);
      opened.workspace.closeResearch();
      expect(opened.workspace.coordinator.getSnapshot().draft).toEqual(
        evidence.draft,
      );
      await opened.workspace.coordinator.save();
      expect(opened.fixture.getSnapshot().save).toBe(1);
      expect(opened.workspace.coordinator.getSnapshot()).toMatchObject({
        baseVersion: 2,
        dirty: false,
      });
      requireSavedAuthoredDraft(opened, evidence.draft!);
    } finally {
      opened.workspace.sessionOwner.dispose();
    }
  });
  it("refuses settlement before cancellation and a full-list save with any different note", async () => {
    const opened = await openInventedCompany();
    try {
      expect(() =>
        opened.fixture.companySnapshotLoading!.settleCancelledFilings(),
      ).toThrow();
      await cancelFirstFilings(opened);
      await opened.workspace.loadCompanySnapshot(opened.visit);
      const draft = opened.workspace.coordinator.getSnapshot().draft!;
      expect(() =>
        opened.fixture.api.save(
          {
            expectedVersion: 1,
            idempotencyKey: "00000000-0000-4000-8000-000000000001",
            payload: {
              ...draft,
              memberships: draft.memberships.map((member) => ({
                ...member,
                note: "Changed another complete note",
              })),
            },
          },
          new AbortController().signal,
        ),
      ).toThrow();
      expect(opened.fixture.getSnapshot().save).toBe(0);
    } finally {
      opened.workspace.sessionOwner.dispose();
    }
  });
});
