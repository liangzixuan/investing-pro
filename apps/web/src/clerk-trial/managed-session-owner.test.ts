import { expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import {
  SaveCoordinator,
  type SavePort,
  type SavedPayload,
} from "./save-coordinator";
import {
  MANAGED_FOLLOWUPS_SAVE_COPY,
  MANAGED_WATCHLIST_SAVE_COPY,
} from "./save-coordinator-copy";
import { ManagedSessionOwner } from "./managed-session-owner";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const sdkSignOut = vi.fn<() => Promise<void>>().mockResolvedValue();
  const resourceSignOut = vi
    .fn<() => Promise<void>>()
    .mockRejectedValue(new Error("Only the session owner may sign out"));
  const make = (name: string, copy: typeof MANAGED_WATCHLIST_SAVE_COPY) => {
    const load = vi
      .fn<SavePort<string>["load"]>()
      .mockResolvedValue({ version: 1, payload: `${name} saved` });
    const save = vi.fn<SavePort<string>["save"]>();
    const coordinator = new SaveCoordinator<string>(
      {
        mode: "managed",
        empty: () => null,
        copy: (value) => value,
        capture: (value) => value,
        load,
        save,
      },
      {
        userId: "invented-user",
        sessionId: "invented-session",
        getToken: vi.fn(),
        signOut: resourceSignOut,
      },
      copy,
      { newKey: () => `${name}-original-key`, onRetire: () => owner.retire() },
    );
    return { coordinator, load, save };
  };
  const watchlist = make("watchlist", MANAGED_WATCHLIST_SAVE_COPY);
  const followups = make("followups", MANAGED_FOLLOWUPS_SAVE_COPY);
  const clearResearch = vi.fn();
  const owner = new ManagedSessionOwner(
    { watchlist: watchlist.coordinator, followups: followups.coordinator },
    { signOut: sdkSignOut },
    clearResearch,
  );
  const loadBoth = () =>
    Promise.all([watchlist.coordinator.load(), followups.coordinator.load()]);
  return {
    owner,
    watchlist,
    followups,
    sdkSignOut,
    resourceSignOut,
    clearResearch,
    loadBoth,
  };
}

it("keeps two drafts, versions and explicit saves independent", async () => {
  const f = fixture();
  await f.loadBoth();
  const stable = f.owner.getSnapshot();
  expect(f.owner.getSnapshot()).toBe(stable);
  expect(Object.isFrozen(stable)).toBe(true);
  f.watchlist.coordinator.replaceDraft("Watchlist draft 财报");
  f.followups.coordinator.replaceDraft("Follow-up draft 复查");
  const other = f.watchlist.coordinator.getSnapshot();
  f.followups.save.mockResolvedValue({
    version: 2,
    payload: "Follow-up draft 复查",
    replayed: false,
  });
  await f.followups.coordinator.save();
  expect(f.watchlist.coordinator.getSnapshot()).toBe(other);
  expect(f.watchlist.save).not.toHaveBeenCalled();
  expect(f.owner.getSnapshot()).toMatchObject({
    phase: "active",
    needsLeaveReview: true,
    watchlist: { dirty: true },
    followups: { dirty: false },
  });
  expect(f.sdkSignOut).not.toHaveBeenCalled();
});

it("tracks simultaneous operations and completion without releasing the other pending command", async () => {
  const f = fixture();
  await f.loadBoth();
  f.watchlist.coordinator.replaceDraft("Watchlist draft");
  f.followups.coordinator.replaceDraft("Follow-up draft");
  const one = deferred<SavedPayload<string>>(),
    two = deferred<SavedPayload<string>>();
  f.watchlist.save.mockReturnValue(one.promise);
  f.followups.save.mockReturnValue(two.promise);
  const first = f.watchlist.coordinator.save(),
    second = f.followups.coordinator.save();
  expect(f.owner.getSnapshot()).toMatchObject({
    watchlist: { phase: "saving" },
    followups: { phase: "saving" },
    needsLeaveReview: true,
  });
  one.resolve({ version: 2, payload: "Watchlist draft", replayed: false });
  await first;
  expect(f.owner.getSnapshot()).toMatchObject({
    watchlist: { phase: "idle", dirty: false },
    followups: { phase: "saving", dirty: true },
    needsLeaveReview: true,
  });
  two.resolve({ version: 2, payload: "Follow-up draft", replayed: false });
  await second;
  expect(f.owner.getSnapshot().needsLeaveReview).toBe(false);
});

it("keeps the original uncertain follow-up command during independent watchlist edits and exact reconciliation", async () => {
  const f = fixture();
  await f.loadBoth();
  f.followups.coordinator.replaceDraft("Follow-up draft");
  f.followups.save.mockRejectedValueOnce(new TrialApiError("commit_unknown"));
  await f.followups.coordinator.save();
  const captured = f.followups.save.mock.calls[0]![0];
  f.watchlist.coordinator.replaceDraft("Watchlist still editable");
  expect(f.followups.coordinator.canEdit()).toBe(false);
  expect(f.owner.getSnapshot()).toMatchObject({
    needsLeaveReview: true,
    followups: { uncertain: true },
    watchlist: { dirty: true },
  });
  f.followups.save.mockResolvedValueOnce({
    version: 2,
    payload: captured.payload,
    replayed: true,
  });
  await f.followups.coordinator.reconcile();
  expect(f.followups.save.mock.calls[1]![0]).toStrictEqual(captured);
  expect(f.watchlist.coordinator.getSnapshot().draft).toBe(
    "Watchlist still editable",
  );
  expect(f.watchlist.save).not.toHaveBeenCalled();
});

it.each(["watchlist", "followups"] as const)(
  "retires both resources on a fatal %s result and fences the other late save",
  async (resource) => {
    const f = fixture();
    await f.loadBoth();
    f.watchlist.coordinator.replaceDraft("Watchlist draft");
    f.followups.coordinator.replaceDraft("Follow-up draft");
    const other = resource === "watchlist" ? f.followups : f.watchlist;
    const held = deferred<SavedPayload<string>>();
    other.save.mockReturnValue(held.promise);
    const saving = other.coordinator.save();
    const signal = other.save.mock.calls[0]![1];
    f[resource].coordinator.readError(new TrialApiError("unauthenticated"));
    expect(signal.aborted).toBe(true);
    expect(f.owner.getSnapshot()).toMatchObject({
      phase: "retired",
      needsLeaveReview: false,
      watchlist: { phase: "retired", dirty: false },
      followups: { phase: "retired", dirty: false },
    });
    expect(f.watchlist.coordinator.getSnapshot().draft).toBeNull();
    expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
    const retired = f.owner.getSnapshot();
    held.resolve({
      version: 2,
      payload: "Late discarded value",
      replayed: false,
    });
    await saving;
    expect(f.owner.getSnapshot()).toBe(retired);
    expect(f.clearResearch).toHaveBeenCalledOnce();
    expect(f.sdkSignOut).not.toHaveBeenCalled();
  },
);

it("reserves one SDK sign-out before reentrant listeners and clears both drafts before awaiting it", async () => {
  const f = fixture();
  await f.loadBoth();
  f.watchlist.coordinator.replaceDraft("Watchlist draft");
  f.followups.coordinator.replaceDraft("Follow-up draft");
  const held = deferred<void>();
  f.sdkSignOut.mockReturnValue(held.promise);
  let reentered: Promise<void> | undefined;
  f.owner.subscribe(() => {
    if (f.owner.getSnapshot().phase === "signing_out")
      reentered = f.owner.signOut();
  });
  const first = f.owner.signOut(),
    second = f.owner.signOut();
  expect(second).toBe(first);
  expect(reentered).toBe(first);
  expect(f.owner.getSnapshot()).toMatchObject({
    phase: "signing_out",
    needsLeaveReview: false,
  });
  expect(f.watchlist.coordinator.getSnapshot().draft).toBeNull();
  expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
  await Promise.resolve();
  expect(f.sdkSignOut).toHaveBeenCalledOnce();
  held.resolve();
  await first;
  expect(f.owner.getSnapshot()).toMatchObject({
    phase: "retired",
    signOutFailed: false,
  });
  expect(f.resourceSignOut).not.toHaveBeenCalled();
});

it("keeps cleared resources retired after sign-out failure and permits one explicit retry", async () => {
  const f = fixture();
  await f.loadBoth();
  f.followups.coordinator.replaceDraft("Follow-up draft");
  f.sdkSignOut.mockRejectedValueOnce(new Error("Invented SDK failure"));
  await f.owner.signOut();
  expect(f.owner.getSnapshot()).toMatchObject({
    phase: "retired",
    signOutFailed: true,
  });
  expect(f.watchlist.coordinator.canEdit()).toBe(false);
  expect(f.followups.coordinator.canEdit()).toBe(false);
  await f.owner.signOut();
  expect(f.sdkSignOut).toHaveBeenCalledTimes(2);
  expect(f.owner.getSnapshot().signOutFailed).toBe(false);
});

it("disposes a replaced session and ignores its late SDK completion", async () => {
  const f = fixture();
  await f.loadBoth();
  const held = deferred<void>();
  f.sdkSignOut.mockReturnValue(held.promise);
  const signingOut = f.owner.signOut();
  await Promise.resolve();
  f.owner.dispose();
  const disposed = f.owner.getSnapshot();
  held.reject(new Error("Late old-session failure"));
  await signingOut;
  expect(f.owner.getSnapshot()).toBe(disposed);
  expect(disposed.phase).toBe("retired");
  await f.owner.signOut();
  expect(f.sdkSignOut).toHaveBeenCalledOnce();
});

it("finishes both resource retirements and the SDK attempt when a retirement callback throws", async () => {
  const f = fixture();
  await f.loadBoth();
  f.watchlist.coordinator.replaceDraft("Watchlist draft");
  f.followups.coordinator.replaceDraft("Follow-up draft");
  f.watchlist.coordinator.subscribe(() => {
    throw new Error("Invented observer failure");
  });
  await f.owner.signOut();
  expect(f.watchlist.coordinator.getSnapshot().draft).toBeNull();
  expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.followups.coordinator.canEdit()).toBe(false);
  expect(f.clearResearch).toHaveBeenCalledOnce();
  expect(f.sdkSignOut).toHaveBeenCalledOnce();
  expect(f.owner.getSnapshot().phase).toBe("retired");
});

it("closes disposal before retirement callbacks can reenter disposal or SDK sign-out", async () => {
  const f = fixture();
  await f.loadBoth();
  f.followups.coordinator.replaceDraft("Follow-up draft");
  const reentry = vi.fn(() => {
    f.owner.dispose();
    void f.owner.signOut();
  });
  f.watchlist.coordinator.subscribe(reentry);
  f.owner.dispose();
  await Promise.resolve();
  expect(reentry).toHaveBeenCalledOnce();
  expect(f.clearResearch).toHaveBeenCalledOnce();
  expect(f.watchlist.coordinator.getSnapshot().draft).toBeNull();
  expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.sdkSignOut).not.toHaveBeenCalled();
});
