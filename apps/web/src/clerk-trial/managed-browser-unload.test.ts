import { normalizeWatchlistNote } from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import { bindManagedBrowserUnload } from "./managed-browser-unload";
import {
  MANAGED_FOLLOWUPS_SAVE_COPY,
  MANAGED_WATCHLIST_SAVE_COPY,
} from "./save-coordinator-copy";
import { ManagedSessionOwner } from "./managed-session-owner";
import {
  SaveCoordinator,
  type SavePort,
  type SavedPayload,
} from "./save-coordinator";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function fixture() {
  const signOut = vi.fn<() => Promise<void>>().mockResolvedValue();
  const resourceSignOut = vi
    .fn<() => Promise<void>>()
    .mockRejectedValue(new Error("Only the aggregate owner may sign out"));
  const resource = (name: string, copy: typeof MANAGED_WATCHLIST_SAVE_COPY) => {
    const load = vi.fn<SavePort<string>["load"]>().mockResolvedValue({
      version: 1,
      payload: "Invented saved note",
    });
    const save = vi.fn<SavePort<string>["save"]>().mockResolvedValue({
      version: 2,
      payload: "Invented confirmed note",
      replayed: false,
    });
    const coordinator = new SaveCoordinator<string>(
      {
        mode: "managed",
        empty: () => null,
        copy: (payload) => payload,
        capture: normalizeWatchlistNote,
        load,
        save,
      },
      {
        userId: "invented-browser-user",
        sessionId: "invented-browser-session",
        getToken: vi.fn(),
        signOut: resourceSignOut,
      },
      copy,
      { newKey: () => `invented-${name}-command` },
    );
    return { coordinator, load, save };
  };
  const { coordinator, load, save } = resource(
    "watchlist",
    MANAGED_WATCHLIST_SAVE_COPY,
  );
  const followups = resource("followups", MANAGED_FOLLOWUPS_SAVE_COPY);
  const owner = new ManagedSessionOwner(
    { watchlist: coordinator, followups: followups.coordinator },
    { signOut },
    vi.fn(),
  );
  const target = new EventTarget();
  const add = vi.spyOn(target, "addEventListener");
  const remove = vi.spyOn(target, "removeEventListener");
  const dispose = bindManagedBrowserUnload(owner, target);
  cleanups.push(dispose);
  const leave = () => {
    const event = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  return {
    owner,
    followups,
    resourceSignOut,
    coordinator,
    load,
    save,
    signOut,
    target,
    add,
    remove,
    dispose,
    leave,
  };
}

describe("managed browser leave warning", () => {
  it("leaves clean reads alone and warns for invalid raw notes without saving", async () => {
    const f = fixture();
    expect(f.leave().defaultPrevented).toBe(false);
    await f.coordinator.load();
    expect(f.add).not.toHaveBeenCalled();
    f.coordinator.replaceDraft("Invented\ninvalid raw note");
    await f.coordinator.save();
    const before = f.coordinator.getSnapshot();
    expect(f.leave().defaultPrevented).toBe(true);
    expect(f.coordinator.getSnapshot()).toBe(before);
    expect(before.draft).toBe("Invented\ninvalid raw note");
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.save).not.toHaveBeenCalled();
    expect(f.signOut).not.toHaveBeenCalled();
    expect(f.add).toHaveBeenCalledTimes(1);
  });

  it("keeps an active save intact and removes the warning after confirmation", async () => {
    const f = fixture();
    await f.coordinator.load();
    f.coordinator.replaceDraft("Invented pending note");
    const retained = f.add.mock.calls[0]![1] as EventListener;
    const pending = deferred<SavedPayload<string>>();
    f.save.mockReturnValueOnce(pending.promise);
    const saving = f.coordinator.save();
    expect(f.coordinator.getSnapshot().phase).toBe("saving");
    expect(f.leave().defaultPrevented).toBe(true);
    expect(f.save).toHaveBeenCalledTimes(1);
    pending.resolve({
      version: 2,
      payload: "Invented pending note",
      replayed: false,
    });
    await saving;
    expect(f.remove).toHaveBeenCalledExactlyOnceWith("beforeunload", retained);
    expect(f.leave().defaultPrevented).toBe(false);
    const stale = new Event("beforeunload", { cancelable: true });
    retained(stale);
    expect(stale.defaultPrevented).toBe(false);
    f.coordinator.replaceDraft("Invented next edit");
    expect(f.add).toHaveBeenCalledTimes(2);
    expect(f.leave().defaultPrevented).toBe(true);
    expect(f.save).toHaveBeenCalledTimes(1);
  });

  it.each(["conflict", "invalid_request"] as const)(
    "retains the warning and draft after a %s rejection",
    async (code) => {
      const f = fixture();
      await f.coordinator.load();
      f.coordinator.replaceDraft("Invented retained draft");
      f.save.mockRejectedValueOnce(new TrialApiError(code));
      await f.coordinator.save();
      expect(f.leave().defaultPrevented).toBe(true);
      expect(f.coordinator.getSnapshot().draft).toBe("Invented retained draft");
      expect(f.save).toHaveBeenCalledTimes(1);
      expect(f.remove).not.toHaveBeenCalled();
    },
  );

  it("preserves the uncertain original command through explicit reconciliation", async () => {
    const f = fixture();
    await f.coordinator.load();
    f.coordinator.replaceDraft("Invented uncertain note");
    f.save.mockRejectedValueOnce(new TrialApiError("commit_unknown"));
    await f.coordinator.save();
    const command = structuredClone(f.save.mock.calls[0]![0]);
    expect(f.leave().defaultPrevented).toBe(true);
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.coordinator.getSnapshot().uncertain).toBe(true);
    const pending = deferred<SavedPayload<string>>();
    f.save.mockReturnValueOnce(pending.promise);
    const reconciling = f.coordinator.reconcile();
    expect(f.coordinator.getSnapshot().phase).toBe("reconciling");
    expect(f.leave().defaultPrevented).toBe(true);
    expect(f.save.mock.calls[1]![0]).toEqual(command);
    pending.resolve({ version: 2, payload: command.payload, replayed: true });
    await reconciling;
    expect(f.leave().defaultPrevented).toBe(true);
    expect(f.coordinator.getSnapshot().replayPending).toBe(true);
    expect(f.coordinator.canEdit()).toBe(false);
    expect(f.save).toHaveBeenCalledTimes(2);
    expect(f.signOut).not.toHaveBeenCalled();
  });

  it("clears the warning only after the saved version is explicitly chosen", async () => {
    const f = fixture();
    await f.coordinator.load();
    f.coordinator.replaceDraft("Invented retained draft");
    f.save.mockRejectedValueOnce(new TrialApiError("conflict"));
    await f.coordinator.save();
    f.coordinator.useSaved();
    expect(f.leave().defaultPrevented).toBe(true);
    await f.coordinator.load();
    f.coordinator.keepDraft();
    expect(f.leave().defaultPrevented).toBe(true);
    f.coordinator.useSaved();
    expect(f.leave().defaultPrevented).toBe(false);
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.coordinator.getSnapshot().draft).toBe("Invented saved note");
  });

  it.each(["expiry", "failed-signout", "retire"] as const)(
    "removes the listener synchronously on %s and fences late responses",
    async (reason) => {
      const f = fixture();
      await f.coordinator.load();
      f.coordinator.replaceDraft("Invented pending note");
      const retained = f.add.mock.calls[0]![1] as EventListener;
      const pending = deferred<SavedPayload<string>>();
      f.save.mockReturnValueOnce(pending.promise);
      const saving = f.coordinator.save();
      if (reason === "expiry") {
        f.coordinator.readError(new TrialApiError("unauthenticated"));
      } else if (reason === "failed-signout") {
        f.signOut.mockRejectedValueOnce(new Error("Invented sign-out failure"));
        const signingOut = f.owner.signOut();
        expect(f.remove).toHaveBeenCalledTimes(1);
        expect(f.leave().defaultPrevented).toBe(false);
        await signingOut;
      } else f.coordinator.retire();
      expect(f.remove).toHaveBeenCalledExactlyOnceWith(
        "beforeunload",
        retained,
      );
      pending.resolve({
        version: 2,
        payload: "Invented late response",
        replayed: false,
      });
      await saving;
      const stale = new Event("beforeunload", { cancelable: true });
      retained(stale);
      expect(stale.defaultPrevented).toBe(false);
      expect(f.leave().defaultPrevented).toBe(false);
      expect(f.coordinator.getSnapshot()).toMatchObject({
        phase: "retired",
        draft: null,
      });
    },
  );

  it("disposes an old binding before a replacement session becomes dirty", async () => {
    const f = fixture();
    await f.coordinator.load();
    f.coordinator.replaceDraft("Invented old draft");
    const oldListener = f.add.mock.calls[0]![1] as EventListener;
    f.dispose();
    f.dispose();
    expect(f.remove).toHaveBeenCalledTimes(1);
    f.coordinator.replaceDraft("Invented edit after disposal");
    expect(f.add).toHaveBeenCalledTimes(1);
    const next = fixture();
    await next.coordinator.load();
    next.coordinator.replaceDraft("Invented new session draft");
    const stale = new Event("beforeunload", { cancelable: true });
    oldListener(stale);
    expect(stale.defaultPrevented).toBe(false);
    expect(f.leave().defaultPrevented).toBe(false);
    expect(next.leave().defaultPrevented).toBe(true);
    expect(f.save).not.toHaveBeenCalled();
    expect(next.save).not.toHaveBeenCalled();
  });

  it("keeps one warning for both drafts until each resource is confirmed clean", async () => {
    const f = fixture();
    await Promise.all([f.coordinator.load(), f.followups.coordinator.load()]);
    f.coordinator.replaceDraft("Watchlist draft");
    const retained = f.add.mock.calls[0]![1] as EventListener;
    f.followups.coordinator.replaceDraft("Follow-up draft");
    expect(f.add).toHaveBeenCalledOnce();
    expect(f.leave().defaultPrevented).toBe(true);
    f.save.mockResolvedValueOnce({
      version: 2,
      payload: "Watchlist draft",
      replayed: false,
    });
    await f.coordinator.save();
    expect(f.remove).not.toHaveBeenCalled();
    expect(f.leave().defaultPrevented).toBe(true);
    expect(f.followups.coordinator.getSnapshot().draft).toBe("Follow-up draft");
    expect(f.followups.save).not.toHaveBeenCalled();
    f.followups.save.mockResolvedValueOnce({
      version: 2,
      payload: "Follow-up draft",
      replayed: false,
    });
    await f.followups.coordinator.save();
    expect(f.remove).toHaveBeenCalledExactlyOnceWith("beforeunload", retained);
    expect(f.leave().defaultPrevented).toBe(false);
    f.followups.coordinator.replaceDraft("Another follow-up edit");
    const staleEvent = new Event("beforeunload", { cancelable: true });
    retained(staleEvent);
    expect(staleEvent.defaultPrevented).toBe(true);
    expect(f.save).toHaveBeenCalledOnce();
    expect(f.followups.save).toHaveBeenCalledOnce();
    expect(f.signOut).not.toHaveBeenCalled();
    expect(f.resourceSignOut).not.toHaveBeenCalled();
  });

  it("warns for follow-up uncertainty, reconciliation and replay until latest-version review is complete", async () => {
    const f = fixture();
    await Promise.all([f.coordinator.load(), f.followups.coordinator.load()]);
    const unchangedWatchlist = f.coordinator.getSnapshot();
    f.followups.coordinator.replaceDraft("Uncertain follow-up");
    f.followups.save.mockRejectedValueOnce(new TrialApiError("commit_unknown"));
    await f.followups.coordinator.save();
    const original = f.followups.save.mock.calls[0]![0];
    expect(f.leave().defaultPrevented).toBe(true);
    const held = deferred<SavedPayload<string>>();
    f.followups.save.mockReturnValueOnce(held.promise);
    const reconciling = f.followups.coordinator.reconcile();
    expect(f.leave().defaultPrevented).toBe(true);
    expect(f.followups.save.mock.calls[1]![0]).toEqual(original);
    held.resolve({ version: 2, payload: original.payload, replayed: true });
    await reconciling;
    expect(f.followups.coordinator.getSnapshot()).toMatchObject({
      dirty: false,
      replayPending: true,
      conflict: true,
    });
    expect(f.leave().defaultPrevented).toBe(true);
    f.followups.coordinator.useSaved();
    expect(f.leave().defaultPrevented).toBe(true);
    f.followups.load.mockResolvedValueOnce({
      version: 3,
      payload: "Latest follow-up",
    });
    await f.followups.coordinator.load();
    expect(f.leave().defaultPrevented).toBe(true);
    f.followups.coordinator.useSaved();
    expect(f.leave().defaultPrevented).toBe(false);
    expect(f.followups.coordinator.getSnapshot().draft).toBe(
      "Latest follow-up",
    );
    expect(f.coordinator.getSnapshot()).toBe(unchangedWatchlist);
    expect(f.save).not.toHaveBeenCalled();
    expect(f.followups.save).toHaveBeenCalledTimes(2);
    expect(f.signOut).not.toHaveBeenCalled();
  });

  it("removes the warning and fences both pending saves on aggregate sign-out", async () => {
    const f = fixture();
    await Promise.all([f.coordinator.load(), f.followups.coordinator.load()]);
    f.coordinator.replaceDraft("Watchlist saving");
    f.followups.coordinator.replaceDraft("Follow-ups saving");
    const one = deferred<SavedPayload<string>>(),
      two = deferred<SavedPayload<string>>();
    f.save.mockReturnValueOnce(one.promise);
    f.followups.save.mockReturnValueOnce(two.promise);
    const saving = f.coordinator.save(),
      followupsSaving = f.followups.coordinator.save();
    expect(f.owner.getSnapshot()).toMatchObject({
      watchlist: { phase: "saving" },
      followups: { phase: "saving" },
    });
    expect(f.leave().defaultPrevented).toBe(true);
    const before = f.owner.getSnapshot();
    expect(f.leave().defaultPrevented).toBe(true);
    expect(f.owner.getSnapshot()).toBe(before);
    const signingOut = f.owner.signOut();
    expect(f.leave().defaultPrevented).toBe(false);
    expect(f.save.mock.calls[0]![1].aborted).toBe(true);
    expect(f.followups.save.mock.calls[0]![1].aborted).toBe(true);
    await signingOut;
    const retired = f.owner.getSnapshot();
    one.resolve({ version: 2, payload: "Watchlist late", replayed: false });
    two.resolve({ version: 2, payload: "Follow-ups late", replayed: false });
    await Promise.all([saving, followupsSaving]);
    expect(f.owner.getSnapshot()).toBe(retired);
    expect(f.coordinator.getSnapshot().draft).toBeNull();
    expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.remove).toHaveBeenCalledOnce();
    expect(f.signOut).toHaveBeenCalledOnce();
    expect(f.resourceSignOut).not.toHaveBeenCalled();
  });
});
