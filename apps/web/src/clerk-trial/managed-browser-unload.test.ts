import { normalizeWatchlistNote } from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import { bindManagedBrowserUnload } from "./managed-browser-unload";
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
  const load = vi.fn<SavePort<string>["load"]>().mockResolvedValue({
    version: 1,
    payload: "Invented saved note",
  });
  const save = vi.fn<SavePort<string>["save"]>().mockResolvedValue({
    version: 2,
    payload: "Invented confirmed note",
    replayed: false,
  });
  const signOut = vi.fn<() => Promise<void>>().mockResolvedValue();
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
      signOut,
    },
    { newKey: () => "invented-original-command" },
  );
  const target = new EventTarget();
  const add = vi.spyOn(target, "addEventListener");
  const remove = vi.spyOn(target, "removeEventListener");
  const dispose = bindManagedBrowserUnload(coordinator, target);
  cleanups.push(dispose);
  const leave = () => {
    const event = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  return {
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
    expect(f.leave().defaultPrevented).toBe(false);
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
        const signingOut = f.coordinator.signOut();
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
});
