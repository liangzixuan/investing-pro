import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  ManagedWatchlistDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { eodSelection } from "./eod-history-fixture";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import {
  createManagedWatchlistDraftAccountScope,
  ManagedWatchlistDraftRecovery,
} from "./managed-watchlist-draft-recovery";
import {
  formatManagedWatchlistDraftFile,
  MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES,
  type ManagedWatchlistDraftFileDocument,
} from "./managed-watchlist-draft-file";
import type {
  ManagedWatchlistDraftFileDeliveryAdapter,
  ManagedWatchlistDraftFileDeliveryResult,
} from "./managed-watchlist-draft-file-delivery";
import type { TrialSession } from "./session";

const ORIGIN = "https://api.example.test";
const TIME = "2026-10-18T23:01:02.345Z";
const encoder = new TextEncoder();
const SNAPSHOT: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: eodSelection.catalogSnapshotSha256,
  catalogId: "invented-draft-catalog",
  catalogVersion: "invented-v1",
  acquiredAt: TIME,
  generatedAt: TIME,
  asOf: "2026-10-18",
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
    providerMappings: 1,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};
function payload(note = "Original saved note"): MainWatchlistPayload {
  return {
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: SNAPSHOT.snapshotSha256,
    memberships: [{ ...eodSelection.listing, note }],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function server() {
  const store = {
    saved: { version: 3, payload: payload() } as ManagedWatchlistDto,
  };
  const unexpected = vi.fn(() =>
    Promise.reject(new Error("Unexpected unrelated request")),
  );
  const save = vi.fn<ManagedApi["save"]>().mockImplementation((command) => {
    if (command.expectedVersion !== store.saved.version)
      return Promise.reject(new TrialApiError("conflict"));
    store.saved = {
      version: store.saved.version + 1,
      payload: structuredClone(command.payload),
    };
    return Promise.resolve({
      ...structuredClone(store.saved),
      replayed: false,
    });
  });
  const api: ManagedApi = {
    loadPortfolio: unexpected,
    savePortfolio: unexpected,
    loadFollowups: unexpected,
    saveFollowups: unexpected,
    recentFilings: unexpected,
    monetaryAnnouncements: unexpected,
    economicCalendar: unexpected,
    eodHistory: unexpected,
    annualReport: unexpected,
    search: unexpected,
    status: vi
      .fn<ManagedApi["status"]>()
      .mockResolvedValue({ snapshot: SNAPSHOT }),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            listingId === eodSelection.listing.listingId
              ? { ...eodSelection.listing }
              : null,
        })),
      }),
    ),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockImplementation(() => Promise.resolve(structuredClone(store.saved))),
    save,
  };
  return { store, api, save, unexpected };
}
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0).reverse()) close();
});
type FixtureOptions = {
  server?: ReturnType<typeof server>;
  accountScope?: Promise<string>;
  sessionId?: string;
  load?: boolean;
};
async function fixture(options: FixtureOptions = {}) {
  const source = options.server ?? server();
  const session: TrialSession = {
    userId: "invented-draft-user",
    sessionId: options.sessionId ?? "invented-session-one",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  const workspace = new ManagedWorkspace(source.api, session);
  workspace.setView("watchlist");
  if (options.load !== false) await workspace.coordinator.load();
  await workspace.refreshCatalog();
  let activeRoute = true;
  const deliver = vi
    .fn<ManagedWatchlistDraftFileDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const recovery = new ManagedWatchlistDraftRecovery({
    workspace,
    delivery: { deliver },
    accountScope:
      options.accountScope ??
      createManagedWatchlistDraftAccountScope(ORIGIN, session.userId),
    routeActive: () => activeRoute,
    now: () => TIME,
  });
  cleanup.push(
    () => workspace.sessionOwner.dispose(),
    () => recovery.dispose(),
  );
  await Promise.resolve();
  return {
    ...source,
    workspace,
    session,
    recovery,
    deliver,
    setRoute(value: boolean) {
      activeRoute = value;
      recovery.reconcile();
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function ready(f: Fixture) {
  await vi.waitFor(() => expect(f.recovery.getSnapshot().canImport).toBe(true));
}
function bytesFile(bytes: Uint8Array<ArrayBuffer>, size = bytes.byteLength) {
  return {
    size,
    arrayBuffer: vi.fn(() =>
      Promise.resolve(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      ),
    ),
  };
}
function file(text: string) {
  return bytesFile(encoder.encode(text));
}
async function document(
  f: Fixture,
  note = "Recovered unconfirmed note",
  baseVersion = 1,
) {
  const accountScope = await createManagedWatchlistDraftAccountScope(
    ORIGIN,
    f.session.userId,
  );
  return formatManagedWatchlistDraftFile({
    accountScope,
    capturedAt: TIME,
    baseVersion,
    draft: payload(note),
  })!;
}
function draft(f: Fixture) {
  return f.workspace.coordinator.getSnapshot().draft;
}
async function inspect(f: Fixture, value?: ManagedWatchlistDraftFileDocument) {
  await ready(f);
  await f.recovery.readFile(file((value ?? (await document(f))).text));
  expect(f.recovery.getSnapshot().phase).toBe("review");
}
async function explicitCatalogSave(f: Fixture) {
  expect(f.workspace.canSavePayload()).toBe(false);
  await f.workspace.coordinator.save();
  expect(f.save).not.toHaveBeenCalled();
  await f.workspace.reviewCatalog();
  f.workspace.applyReview();
  expect(f.workspace.canSavePayload()).toBe(true);
  await f.workspace.coordinator.save();
}

describe("explicit draft file through a reopened workspace", () => {
  it("exports, previews and restores locally, then saves only after independent catalog review", async () => {
    const first = await fixture();
    await ready(first);
    first.workspace.note(
      eodSelection.listing.listingId,
      "Recovered unconfirmed note",
    );
    await first.recovery.exportDraft();
    const exported = first.deliver.mock.calls[0]![0];
    expect(exported.baseVersion).toBe(3);
    expect(first.save).not.toHaveBeenCalled();
    expect(first.recovery.getSnapshot().message).toContain("Draft file saved");
    first.recovery.dispose();
    first.workspace.sessionOwner.dispose();
    first.store.saved = { version: 9, payload: payload("Newer online note") };
    const reopened = await fixture({
      server: first,
      sessionId: "invented-session-two",
    });
    await inspect(reopened, exported);
    expect(reopened.recovery.getSnapshot()).toMatchObject({
      preview: { baseVersion: 3 },
      currentSavedVersion: 9,
    });
    expect(draft(reopened)?.memberships[0]!.note).toBe("Newer online note");
    expect(reopened.recovery.restoreDraft()).toBe(true);
    expect(reopened.workspace.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 9,
      dirty: true,
      saved: { version: 9 },
    });
    expect(reopened.store.saved.payload.memberships[0]!.note).toBe(
      "Newer online note",
    );
    expect(draft(reopened)?.memberships[0]!.note).toBe(
      "Recovered unconfirmed note",
    );
    expect(reopened.save).not.toHaveBeenCalled();
    expect(reopened.api.load).toHaveBeenCalledTimes(2);
    expect(reopened.api.resolve).not.toHaveBeenCalled();
    await explicitCatalogSave(reopened);
    expect(reopened.save).toHaveBeenCalledOnce();
    expect(reopened.save.mock.calls[0]![0]).toMatchObject({
      expectedVersion: 9,
      payload: payload("Recovered unconfirmed note"),
    });
    expect(reopened.store.saved.version).toBe(10);
    expect(reopened.session.getToken).not.toHaveBeenCalled();
    expect(reopened.unexpected).not.toHaveBeenCalled();
  });
});

describe("raw invalid drafts stay editable", () => {
  it("preserves the complete invalid note and refuses an explicit Save", async () => {
    const f = await fixture(),
      raw = "  Cafe\u0301\n" + "x".repeat(2001) + "\u0001\ud800  ";
    await inspect(f, await document(f, raw));
    expect(f.recovery.getSnapshot().preview?.draft.memberships[0]!.note).toBe(
      raw,
    );
    expect(f.recovery.restoreDraft()).toBe(true);
    await f.workspace.reviewCatalog();
    f.workspace.applyReview();
    expect(draft(f)?.memberships[0]!.note).toBe(raw);
    expect(f.workspace.canSavePayload()).toBe(false);
    await f.workspace.coordinator.save();
    expect(f.save).not.toHaveBeenCalled();
    expect(draft(f)?.memberships[0]!.note).toBe(raw);
    expect(f.store.saved.payload).toEqual(payload());
  });
});

describe("refused file reads retain the current draft", () => {
  it.each([
    "malformed",
    "foreign",
    "advertised_oversize",
    "actual_size_mismatch",
    "invalid_utf8",
    "actual_oversize",
  ] as const)(
    "refuses %s without restoring or calling provider ports",
    async (kind) => {
      const f = await fixture();
      await ready(f);
      f.workspace.note(eodSelection.listing.listingId, "Keep this draft");
      const before = draft(f),
        value = await document(f);
      const selected = refusalFile(kind, value);
      await f.recovery.readFile(selected);
      expect(draft(f)).toBe(before);
      expect(f.recovery.getSnapshot()).toMatchObject({
        phase: "idle",
        preview: null,
      });
      expect(f.recovery.getSnapshot().message).toContain("invalid, too large");
      expect(f.recovery.restoreDraft()).toBe(false);
      expect(f.save).not.toHaveBeenCalled();
      expect(f.api.load).toHaveBeenCalledOnce();
      expect(f.api.resolve).not.toHaveBeenCalled();
      if (kind === "advertised_oversize")
        expect(selected.arrayBuffer).not.toHaveBeenCalled();
    },
  );
});
type Refusal =
  | "malformed"
  | "foreign"
  | "advertised_oversize"
  | "actual_size_mismatch"
  | "invalid_utf8"
  | "actual_oversize";
function refusalFile(kind: Refusal, value: ManagedWatchlistDraftFileDocument) {
  switch (kind) {
    case "malformed":
      return file("{}");
    case "foreign":
      return file(
        value.text.replace(value.accountScope, `sha256:${"f".repeat(64)}`),
      );
    case "advertised_oversize":
      return bytesFile(
        new Uint8Array([1]),
        MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES + 1,
      );
    case "actual_size_mismatch":
      return bytesFile(encoder.encode(value.text), 1);
    case "invalid_utf8":
      return bytesFile(new Uint8Array([0xc3, 0x28]));
    case "actual_oversize":
      return bytesFile(
        new Uint8Array(MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES + 1),
        1,
      );
  }
}

type Change = "draft" | "route" | "session" | "dispose";
const CHANGES = ["draft", "route", "session", "dispose"] as const;
function change(f: Fixture, kind: Change) {
  switch (kind) {
    case "draft":
      f.workspace.note(eodSelection.listing.listingId, "A newer edit");
      break;
    case "route":
      f.setRoute(false);
      break;
    case "session":
      f.workspace.sessionOwner.retire();
      break;
    case "dispose":
      f.recovery.dispose();
      break;
  }
}
describe("late reads cannot replace a changed lifetime", () => {
  it.each(CHANGES)(
    "withdraws a pending file after %s changes",
    async (kind) => {
      const f = await fixture();
      await ready(f);
      const value = await document(f),
        read = deferred<ArrayBuffer>();
      const source = file(value.text);
      source.arrayBuffer.mockReturnValue(read.promise);
      const pending = f.recovery.readFile(source);
      expect(f.recovery.getSnapshot().phase).toBe("reading");
      change(f, kind);
      const afterChange = draft(f);
      read.resolve(encoder.encode(value.text).buffer);
      await pending;
      expect(draft(f)).toBe(afterChange);
      expect(f.recovery.getSnapshot().preview).toBeNull();
      expect(f.recovery.restoreDraft()).toBe(false);
      expect(f.save).not.toHaveBeenCalled();
    },
  );
  it.each(CHANGES)(
    "withdraws a completed preview after %s changes",
    async (kind) => {
      const f = await fixture();
      await inspect(f);
      change(f, kind);
      const afterChange = draft(f);
      expect(f.recovery.restoreDraft()).toBe(false);
      expect(draft(f)).toBe(afterChange);
      expect(f.recovery.getSnapshot().preview).toBeNull();
      expect(f.save).not.toHaveBeenCalled();
    },
  );
});

describe("late exports retain the current draft", () => {
  it.each(CHANGES)(
    "cancels delivery after %s changes without reporting a later success",
    async (kind) => {
      const f = await fixture();
      await ready(f);
      f.workspace.note(
        eodSelection.listing.listingId,
        "Captured before delivery",
      );
      const delivery = deferred<ManagedWatchlistDraftFileDeliveryResult>();
      f.deliver.mockReturnValue(delivery.promise);
      const pending = f.recovery.exportDraft(),
        context = f.deliver.mock.calls[0]![1];
      expect(context.isCurrent()).toBe(true);
      change(f, kind);
      const afterChange = draft(f);
      expect(context.isCurrent()).toBe(false);
      expect(context.signal.aborted).toBe(true);
      delivery.resolve("written");
      await pending;
      expect(draft(f)).toBe(afterChange);
      expect(f.recovery.getSnapshot().message).not.toContain(
        "Draft file saved",
      );
      expect(f.save).not.toHaveBeenCalled();
    },
  );
});

describe("cancel and file reselection", () => {
  it("keeps the current draft when cancelling a completed preview", async () => {
    const f = await fixture(),
      before = draft(f);
    await inspect(f);
    f.recovery.cancel();
    expect(draft(f)).toBe(before);
    expect(f.recovery.getSnapshot()).toMatchObject({
      phase: "idle",
      preview: null,
      canImport: true,
    });
    expect(f.recovery.restoreDraft()).toBe(false);
  });
  it("allows a new file after cancellation and ignores the earlier pending read", async () => {
    const f = await fixture();
    await ready(f);
    const first = await document(f, "First discarded note"),
      late = deferred<ArrayBuffer>();
    const oldFile = file(first.text);
    oldFile.arrayBuffer.mockReturnValue(late.promise);
    const pending = f.recovery.readFile(oldFile);
    f.recovery.cancel();
    await inspect(f, await document(f, "Second selected note"));
    late.resolve(encoder.encode(first.text).buffer);
    await pending;
    expect(f.recovery.getSnapshot().preview?.draft.memberships[0]!.note).toBe(
      "Second selected note",
    );
    expect(f.recovery.restoreDraft()).toBe(true);
    expect(draft(f)?.memberships[0]!.note).toBe("Second selected note");
    expect(f.save).not.toHaveBeenCalled();
  });
  it("replaces a preview only after explicitly selecting another valid file", async () => {
    const f = await fixture();
    await inspect(f);
    await f.recovery.readFile(
      file((await document(f, "Reselected note")).text),
    );
    expect(f.recovery.getSnapshot().preview?.draft.memberships[0]!.note).toBe(
      "Reselected note",
    );
    expect(draft(f)?.memberships[0]!.note).toBe("Original saved note");
  });
});

describe("synchronous review-clear observers", () => {
  it.each(["cancel", "read_then_cancel"] as const)(
    "does not restore after a newer %s during the idle notification",
    async (action) => {
      const f = await fixture();
      await inspect(f);
      const before = draft(f),
        selected = file((await document(f, "Cancelled newer file")).text);
      let cancelled = false;
      const pending: Promise<void>[] = [];
      cleanup.push(
        f.recovery.subscribe(() => {
          const state = f.recovery.getSnapshot();
          if (cancelled) return;
          if (state.phase !== "idle") return;
          if (state.preview !== null) return;
          cancelled = true;
          if (action === "read_then_cancel")
            pending.push(f.recovery.readFile(selected));
          f.recovery.cancel();
        }),
      );
      expect(f.recovery.restoreDraft()).toBe(false);
      expect(cancelled).toBe(true);
      await Promise.all(pending);
      expect(draft(f)).toBe(before);
      expect(f.recovery.getSnapshot()).toMatchObject({
        phase: "idle",
        preview: null,
      });
      expect(f.store.saved.payload).toEqual(payload());
      expect(f.save).not.toHaveBeenCalled();
      expect(f.api.load).toHaveBeenCalledOnce();
      expect(f.api.resolve).not.toHaveBeenCalled();
    },
  );
  it("refuses restoration when an idle notification authors a newer draft", async () => {
    const f = await fixture();
    await inspect(f);
    let edited = false,
      newer: MainWatchlistPayload | null = null;
    cleanup.push(
      f.recovery.subscribe(() => {
        const state = f.recovery.getSnapshot();
        if (edited) return;
        if (state.phase !== "idle") return;
        if (state.preview !== null) return;
        edited = true;
        f.workspace.note(
          eodSelection.listing.listingId,
          "Synchronous newer edit",
        );
        newer = draft(f);
      }),
    );
    expect(f.recovery.restoreDraft()).toBe(false);
    expect(edited).toBe(true);
    expect(draft(f)).toBe(newer);
    expect(draft(f)?.memberships[0]!.note).toBe("Synchronous newer edit");
    expect(f.recovery.getSnapshot().preview).toBeNull();
    expect(f.store.saved.payload).toEqual(payload());
    expect(f.save).not.toHaveBeenCalled();
  });
  it("does not overtake a new read started by the idle notification", async () => {
    const f = await fixture();
    await inspect(f);
    const selected = file((await document(f, "Newly selected file")).text),
      before = draft(f);
    let started = false;
    const pending: Promise<void>[] = [];
    cleanup.push(
      f.recovery.subscribe(() => {
        const state = f.recovery.getSnapshot();
        if (started) return;
        if (state.phase !== "idle") return;
        if (state.preview !== null) return;
        started = true;
        pending.push(f.recovery.readFile(selected));
      }),
    );
    expect(f.recovery.restoreDraft()).toBe(false);
    expect(started).toBe(true);
    expect(selected.arrayBuffer).toHaveBeenCalledOnce();
    expect(pending).toHaveLength(1);
    await pending[0]!;
    expect(draft(f)).toBe(before);
    expect(f.recovery.getSnapshot()).toMatchObject({
      phase: "review",
      preview: { draft: payload("Newly selected file") },
    });
    expect(f.store.saved.payload).toEqual(payload());
    expect(f.save).not.toHaveBeenCalled();
  });
});

describe("deferred account scope and coordinator gates", () => {
  it.each(["route", "session", "dispose"] as const)(
    "cannot enable a retired or departed %s after scope completion",
    async (kind) => {
      const scope = deferred<string>(),
        f = await fixture({ accountScope: scope.promise });
      expect(f.recovery.getSnapshot().canImport).toBe(false);
      change(f, kind);
      scope.resolve(
        await createManagedWatchlistDraftAccountScope(ORIGIN, f.session.userId),
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(f.recovery.getSnapshot().canImport).toBe(false);
      expect(f.recovery.getSnapshot().canExport).toBe(false);
      expect(f.recovery.getSnapshot().preview).toBeNull();
    },
  );
  it("exports the current draft after delayed scope resolution, never an earlier draft", async () => {
    const scope = deferred<string>(),
      f = await fixture({ accountScope: scope.promise });
    f.workspace.note(eodSelection.listing.listingId, "A newer edit");
    scope.resolve(
      await createManagedWatchlistDraftAccountScope(ORIGIN, f.session.userId),
    );
    await ready(f);
    await f.recovery.exportDraft();
    expect(f.deliver.mock.calls[0]![0].text).toContain("A newer edit");
    expect(f.save).not.toHaveBeenCalled();
  });
  it("refuses reading before any fresh saved version has loaded", async () => {
    const f = await fixture({ load: false });
    const selected = file((await document(f)).text);
    await f.recovery.readFile(selected);
    expect(selected.arrayBuffer).not.toHaveBeenCalled();
    expect(f.recovery.getSnapshot().canImport).toBe(false);
    expect(draft(f)).toBeNull();
  });
});

describe("backend and account scope identity", () => {
  it("reuses account scope across sessions but separates another account or backend", async () => {
    const scope = await createManagedWatchlistDraftAccountScope(
      ORIGIN,
      "invented-user",
    );
    expect(scope).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(
      await createManagedWatchlistDraftAccountScope(ORIGIN, "invented-user"),
    ).toBe(scope);
    expect(
      await createManagedWatchlistDraftAccountScope(ORIGIN, "another-user"),
    ).not.toBe(scope);
    expect(
      await createManagedWatchlistDraftAccountScope(
        "https://other.example.test",
        "invented-user",
      ),
    ).not.toBe(scope);
  });
  it.each([
    "http://api.example.test",
    "https://api.example.test/",
    "https://name:invented@api.example.test",
  ])("refuses noncanonical or unsafe backend origin %s", async (origin) => {
    await expect(
      createManagedWatchlistDraftAccountScope(origin, "invented-user"),
    ).rejects.toThrow();
  });
});

describe("pending and unresolved coordinator commands", () => {
  it("refuses a file and export while the real save port is pending", async () => {
    const f = await fixture();
    await ready(f);
    const selected = file((await document(f)).text);
    f.workspace.note(eodSelection.listing.listingId, "Pending authored save");
    const receipt = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
    f.save.mockReturnValueOnce(receipt.promise);
    const pending = f.workspace.coordinator.save(),
      before = draft(f);
    expect(f.workspace.coordinator.getSnapshot().phase).toBe("saving");
    await f.recovery.readFile(selected);
    await f.recovery.exportDraft();
    expect(selected.arrayBuffer).not.toHaveBeenCalled();
    expect(f.deliver).not.toHaveBeenCalled();
    expect(draft(f)).toBe(before);
    expect(f.recovery.getSnapshot()).toMatchObject({
      canImport: false,
      canExport: false,
      preview: null,
    });
    receipt.resolve({
      version: 4,
      payload: payload("Pending authored save"),
      replayed: false,
    });
    await pending;
  });
  it.each(["uncertain", "conflict", "replay_pending"] as const)(
    "refuses file operations for a real %s result",
    async (kind) => {
      const f = await fixture();
      await ready(f);
      const selected = file((await document(f)).text);
      f.workspace.note(
        eodSelection.listing.listingId,
        "Keep unresolved command",
      );
      if (kind === "replay_pending")
        f.save.mockResolvedValueOnce({
          version: 4,
          payload: payload("Keep unresolved command"),
          replayed: true,
        });
      else
        f.save.mockRejectedValueOnce(
          new TrialApiError(kind === "uncertain" ? "unavailable" : "conflict"),
        );
      await f.workspace.coordinator.save();
      const state = f.workspace.coordinator.getSnapshot(),
        before = draft(f);
      expect(state[kind === "replay_pending" ? "replayPending" : kind]).toBe(
        true,
      );
      await f.recovery.readFile(selected);
      await f.recovery.exportDraft();
      expect(selected.arrayBuffer).not.toHaveBeenCalled();
      expect(f.deliver).not.toHaveBeenCalled();
      expect(draft(f)).toBe(before);
      expect(f.recovery.getSnapshot()).toMatchObject({
        canImport: false,
        canExport: false,
        preview: null,
      });
      expect(f.save).toHaveBeenCalledOnce();
    },
  );
});
