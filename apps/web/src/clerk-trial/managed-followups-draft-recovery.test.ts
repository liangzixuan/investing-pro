import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type {
  ManagedResearchFollowupsDto,
  ResearchFollowupsPayload,
  ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";
import { TrialApiError } from "./api";
import { eodSelection } from "./eod-history-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { ManagedFollowupsDraftRecovery } from "./managed-followups-draft-recovery";
import {
  formatManagedFollowupsDraftFile,
  parseManagedFollowupsDraftFile,
} from "./managed-followups-draft-file";
import { FollowupsDraftDetails } from "./ManagedFollowupsDraftDetails";
import type { ManagedFollowupsDraftFileDeliveryAdapter } from "./followups-draft-file-delivery";

const scope = `sha256:${"c".repeat(64)}`;
const time = "2026-10-21T10:00:00.000Z";
const identity = eodSelection.listing;
const digest = eodSelection.catalogSnapshotSha256;
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented",
  catalogVersion: "one",
  asOf: time,
  acquiredAt: time,
  generatedAt: time,
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 1,
    activeListings: 1,
    admittedSourceRecords: 1,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};
function payload(check = "Review the next filing"): ResearchFollowupsPayload {
  return {
    schemaVersion: 1,
    entries: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        catalogSnapshotSha256: digest,
        listing: identity,
        check,
        dueOn: "2026-10-23",
        status: "open",
        completedOn: null,
        result: "Authored result 😀",
      },
    ],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const disposals: (() => void)[] = [];
afterEach(() => {
  for (const close of disposals.splice(0).reverse()) close();
});
function followupsApi(empty: boolean) {
  let stored: ManagedResearchFollowupsDto = {
    version: empty ? 0 : 3,
    payload: empty ? { schemaVersion: 1, entries: [] } : payload(),
  };
  const unexpected = vi.fn(() =>
    Promise.reject(new Error("Unexpected unrelated request")),
  );
  const api: ManagedApi = {
    interimReport: vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("Unexpected interim read")),
    load: unexpected,
    save: unexpected,
    loadPortfolio: unexpected,
    savePortfolio: unexpected,
    loadValuationAssumptions: unexpected,
    saveValuationAssumptions: unexpected,
    search: unexpected,
    eodHistory: unexpected,
    annualReport: unexpected,
    recentFilings: unexpected,
    monetaryAnnouncements: unexpected,
    blsCalendar: unexpected,
    economicCalendar: unexpected,
    status: vi.fn(() => Promise.resolve({ snapshot })),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: identity,
        })),
      }),
    ),
    loadFollowups: vi.fn(() => Promise.resolve(structuredClone(stored))),
    saveFollowups: vi.fn<ManagedApi["saveFollowups"]>((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: command.payload,
      };
      return Promise.resolve({ ...stored, replayed: false });
    }),
  };
  return { api, unexpected };
}
async function fixture(empty = false) {
  const { api, unexpected } = followupsApi(empty);
  const workspace = new ManagedWorkspace(
    api,
    {
      userId: "invented-file-user",
      sessionId: "invented-file-session",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    undefined,
    { researchCoverage: inventedManagedResearchCoverage },
  );
  await workspace.refreshCatalog();
  workspace.setView("followups");
  await workspace.followups.coordinator.load();
  let active = true;
  const deliver = vi.fn<ManagedFollowupsDraftFileDeliveryAdapter["deliver"]>(
    () => Promise.resolve("written"),
  );
  const recovery = new ManagedFollowupsDraftRecovery({
    workspace,
    accountScope: Promise.resolve(scope),
    delivery: { deliver },
    routeActive: () => active,
    now: () => time,
  });
  await Promise.resolve();
  disposals.push(
    () => workspace.sessionOwner.dispose(),
    () => recovery.dispose(),
  );
  return {
    workspace,
    recovery,
    api,
    deliver,
    unexpected,
    leave: () => {
      active = false;
      recovery.reconcile();
    },
  };
}
function file(value = payload("Restored complete check 😀"), baseVersion = 42) {
  const document = formatManagedFollowupsDraftFile({
    accountScope: scope,
    capturedAt: time,
    baseVersion,
    draft: value,
  })!;
  const bytes = new TextEncoder().encode(document.text).buffer;
  return {
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
}
it("reviews and cancels locally, restores the whole file against the actual base, and saves only explicitly", async () => {
  const f = await fixture();
  const m = f.workspace.followups;
  const before = m.coordinator.getSnapshot();
  const resolves = vi.mocked(f.api.resolve).mock.calls.length;
  await f.recovery.readFile(file());
  expect(f.recovery.getSnapshot().phase).toBe("review");
  expect(m.coordinator.getSnapshot().draft).toBe(before.draft);
  f.recovery.cancel();
  expect(m.coordinator.getSnapshot().draft).toBe(before.draft);
  await f.recovery.readFile(file());
  expect(f.recovery.restoreDraft()).toBe(true);
  const after = m.coordinator.getSnapshot();
  expect(after.saved).toBe(before.saved);
  expect(after.baseVersion).toBe(3);
  expect(after.draft).toEqual(payload("Restored complete check 😀"));
  expect(after.dirty).toBe(true);
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.api.resolve).toHaveBeenCalledTimes(resolves);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
  await m.coordinator.save();
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  expect(vi.mocked(f.api.saveFollowups).mock.calls[0]![0].expectedVersion).toBe(
    3,
  );
});
it("restores into an explicitly loaded empty resource without importing the file version", async () => {
  const f = await fixture(true);
  await f.recovery.readFile(file());
  expect(f.recovery.restoreDraft()).toBe(true);
  expect(f.workspace.followups.coordinator.getSnapshot().baseVersion).toBe(0);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it.each([
  "draft",
  "load",
  "catalog",
  "route",
  "identity review",
  "retirement",
] as const)("withdraws file review after %s changes", async (change) => {
  const f = await fixture();
  await f.recovery.readFile(file());
  const m = f.workspace.followups;
  expect(f.recovery.getSnapshot().phase).toBe("review");
  if (change === "draft")
    m.edit(
      m.currentEntry(payload().entries[0]!.id)!,
      "check",
      "Newer local check",
    );
  if (change === "load") await m.coordinator.load();
  if (change === "catalog") await f.workspace.refreshCatalog();
  if (change === "route") f.leave();
  if (change === "identity review") await m.reviewCatalog();
  if (change === "retirement") f.workspace.sessionOwner.dispose();
  expect(f.recovery.getSnapshot().preview).toBeNull();
  expect(f.recovery.restoreDraft()).toBe(false);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("fences cancelled late reads and checks size before reading bytes", async () => {
  const f = await fixture();
  const bytes = deferred<ArrayBuffer>();
  const selected = file();
  const pending = f.recovery.readFile({
    ...selected,
    arrayBuffer: () => bytes.promise,
  });
  f.recovery.cancel();
  bytes.resolve(await selected.arrayBuffer());
  await pending;
  expect(f.recovery.getSnapshot().preview).toBeNull();
  const arrayBuffer = vi.fn();
  await f.recovery.readFile({ size: 266241, arrayBuffer });
  expect(arrayBuffer).not.toHaveBeenCalled();
  expect(f.recovery.getSnapshot().message).toContain("invalid");
});
it("captures complete valid edits and aborts a delivery after another edit", async () => {
  const f = await fixture();
  const m = f.workspace.followups;
  m.edit(
    m.currentEntry(payload().entries[0]!.id)!,
    "check",
    "Changed check 😀",
  );
  const done = deferred<"written">();
  let context:
    | Parameters<ManagedFollowupsDraftFileDeliveryAdapter["deliver"]>[1]
    | undefined;
  f.deliver.mockImplementationOnce(async (_doc, ctx) => {
    context = ctx;
    return done.promise;
  });
  const operation = f.recovery.exportDraft();
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(
    parseManagedFollowupsDraftFile(f.deliver.mock.calls[0]![0].text, scope)
      ?.draft.entries[0]?.check,
  ).toBe("Changed check 😀");
  m.edit(m.currentEntry(payload().entries[0]!.id)!, "check", "Newer check");
  expect(context?.signal.aborted).toBe(true);
  done.resolve("written");
  await operation;
  expect(f.recovery.getSnapshot().message).not.toContain("file saved");
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("retains invalid raw authored text without normalizing, clipping or exporting it", async () => {
  const f = await fixture();
  const m = f.workspace.followups;
  m.edit(
    m.currentEntry(payload().entries[0]!.id)!,
    "check",
    "  Keep surrounding spaces  ",
  );
  const before = m.coordinator.getSnapshot().draft;
  expect(f.recovery.getSnapshot().canExport).toBe(false);
  await f.recovery.exportDraft();
  expect(f.deliver).not.toHaveBeenCalled();
  expect(m.coordinator.getSnapshot().draft).toBe(before);
  expect(before?.entries[0]?.check).toBe("  Keep surrounding spaces  ");
});
it("rejects restoration if a subscriber edits while the preview is clearing", async () => {
  const f = await fixture();
  await f.recovery.readFile(file());
  let changed = false;
  const unsubscribe = f.recovery.subscribe(() => {
    if (!changed && f.recovery.getSnapshot().phase === "idle") {
      changed = true;
      const m = f.workspace.followups;
      m.edit(
        m.currentEntry(payload().entries[0]!.id)!,
        "check",
        "Keep newest edit",
      );
    }
  });
  expect(f.recovery.restoreDraft()).toBe(false);
  unsubscribe();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft?.entries[0]?.check,
  ).toBe("Keep newest edit");
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("renders every question, result, completion and full listing identity in order", () => {
  const value = payload();
  const first = value.entries[0]!;
  const draft: ResearchFollowupsPayload = {
    schemaVersion: 1,
    entries: [
      first,
      {
        ...first,
        id: "00000000-0000-4000-8000-000000000002",
        listing: { ...identity, listingId: "second-listing" },
        check: "Second check",
        status: "completed",
        completedOn: "2026-10-20",
        result: "Full second result",
      },
    ],
  };
  const markup = renderToStaticMarkup(
    createElement(FollowupsDraftDetails, { draft }),
  );
  for (const text of [
    first.check,
    first.result,
    first.id,
    first.dueOn,
    identity.issuerId,
    identity.securityId,
    identity.shareClassId,
    digest,
    "Full second result",
    "Completed 2026-10-20 UTC.",
  ])
    expect(markup).toContain(text);
  expect(markup.indexOf(first.check)).toBeLessThan(
    markup.indexOf("Second check"),
  );
});

it.each(["conflict", "commit_unknown"] as const)(
  "refuses file IO during %s save recovery",
  async (code) => {
    const f = await fixture();
    const m = f.workspace.followups;
    m.edit(
      m.currentEntry(payload().entries[0]!.id)!,
      "check",
      "Changed before save",
    );
    vi.mocked(f.api.saveFollowups).mockRejectedValueOnce(
      new TrialApiError(code),
    );
    await m.coordinator.save();
    expect(
      m.coordinator.getSnapshot().conflict ||
        m.coordinator.getSnapshot().uncertain,
    ).toBe(true);
    expect(f.recovery.getSnapshot().canImport).toBe(false);
    expect(f.recovery.getSnapshot().canExport).toBe(false);
    const selected = file();
    await f.recovery.readFile(selected);
    await f.recovery.exportDraft();
    expect(selected.arrayBuffer).not.toHaveBeenCalled();
    expect(f.deliver).not.toHaveBeenCalled();
  },
);

it("refuses a foreign file without changing the current draft or calling the API", async () => {
  const f = await fixture();
  const before = f.workspace.followups.coordinator.getSnapshot();
  const resolves = vi.mocked(f.api.resolve).mock.calls.length;
  const document = formatManagedFollowupsDraftFile({
    accountScope: `sha256:${"d".repeat(64)}`,
    capturedAt: time,
    baseVersion: 99,
    draft: payload(),
  })!;
  const bytes = new TextEncoder().encode(document.text).buffer;
  await f.recovery.readFile({
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes),
  });
  expect(f.recovery.getSnapshot().preview).toBeNull();
  expect(f.recovery.getSnapshot().message).toContain(
    "another account or backend",
  );
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(before);
  expect(f.api.resolve).toHaveBeenCalledTimes(resolves);
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("does not start file IO if a subscriber retires the session when reading begins", async () => {
  const f = await fixture();
  const unsubscribe = f.recovery.subscribe(() => {
    if (f.recovery.getSnapshot().phase === "reading")
      f.workspace.sessionOwner.dispose();
  });
  const selected = file();
  await f.recovery.readFile(selected);
  unsubscribe();
  expect(selected.arrayBuffer).not.toHaveBeenCalled();
  expect(f.recovery.getSnapshot().phase).toBe("retired");
});

it("does not deliver a file if a subscriber retires the session when export begins", async () => {
  const f = await fixture();
  const m = f.workspace.followups;
  m.edit(m.currentEntry(payload().entries[0]!.id)!, "result", "New result");
  const unsubscribe = f.recovery.subscribe(() => {
    if (f.recovery.getSnapshot().phase === "exporting")
      f.workspace.sessionOwner.dispose();
  });
  await f.recovery.exportDraft();
  unsubscribe();
  expect(f.deliver).not.toHaveBeenCalled();
  expect(f.recovery.getSnapshot().preview).toBeNull();
});
