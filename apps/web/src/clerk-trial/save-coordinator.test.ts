import { describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import { SaveCoordinator } from "./save-coordinator";
import type {
  SavePort,
  SavedPayload,
  VersionedPayload,
} from "./save-coordinator";
import type { TrialSession } from "./session";

type Draft = { entries: { id: string; note: string }[] };
const draft = (note: string): Draft => ({
  entries: [{ id: "invented-a", note }],
});
const version = (number: number, note: string): VersionedPayload<Draft> => ({
  version: number,
  payload: draft(note),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(mode: "demo" | "managed" = "managed") {
  const load = vi
    .fn<SavePort<Draft>["load"]>()
    .mockResolvedValue(version(1, "saved"));
  const save = vi.fn<SavePort<Draft>["save"]>();
  const port: SavePort<Draft> = {
    mode,
    empty: () => null,
    copy: structuredClone,
    capture: (payload) =>
      payload.entries.some((entry) => entry.note.includes("\n"))
        ? null
        : {
            entries: payload.entries.map((entry) => ({
              ...entry,
              note: entry.note.trim().normalize("NFC"),
            })),
          },
    load,
    save,
  };
  const session: TrialSession = {
    userId: "user_invented",
    sessionId: "sess_invented",
    getToken: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  const onRetire = vi.fn();
  let key = 0;
  const controller = new SaveCoordinator(port, session, {
    newKey: () => `invented-command-${++key}`,
    onRetire,
  });
  return { controller, load, save, session, onRetire };
}

describe("shared save coordinator", () => {
  it("owns the immutable command across an uncertain save and explicit replay", async () => {
    const { controller, load, save } = fixture();
    await controller.load();
    const input = draft("  Cafe\u0301  ");
    controller.replaceDraft(input);
    input.entries[0]!.note = "external mutation";
    save.mockImplementationOnce((command) => {
      command.payload.entries[0]!.note = "adapter mutation";
      return Promise.reject(new TrialApiError("commit_unknown"));
    });
    await controller.save();
    controller.replaceDraft(draft("replacement"));
    await controller.save();
    await controller.load();
    expect(save).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().draft).toEqual(draft("Café"));
    save.mockResolvedValueOnce({ ...version(2, "Café"), replayed: true });
    await controller.reconcile();
    expect(save.mock.calls[1]?.[0]).toEqual({
      expectedVersion: 1,
      idempotencyKey: "invented-command-1",
      payload: draft("Café"),
    });
    expect(controller.getSnapshot()).toMatchObject({
      uncertain: false,
      replayPending: true,
      conflict: true,
      latestLoaded: false,
    });
    expect(controller.canEdit()).toBe(false);
    controller.useSaved();
    controller.keepDraft();
    expect(controller.getSnapshot().replayPending).toBe(true);
    load.mockResolvedValueOnce(version(4, "later saved value"));
    await controller.load();
    expect(controller.getSnapshot().draft).toEqual(draft("Café"));
    expect(controller.canEdit()).toBe(false);
    controller.keepDraft();
    save.mockResolvedValueOnce({ ...version(5, "Café"), replayed: false });
    await controller.save();
    expect(save.mock.calls[2]?.[0]).toEqual({
      expectedVersion: 4,
      idempotencyKey: "invented-command-2",
      payload: draft("Café"),
    });
  });

  it("requires a latest read before choosing the saved version after a managed conflict", async () => {
    const { controller, load, save } = fixture();
    await controller.load();
    controller.replaceDraft(draft("keep this draft"));
    save.mockRejectedValueOnce(new TrialApiError("conflict"));
    await controller.save();
    controller.useSaved();
    expect(controller.getSnapshot()).toMatchObject({
      conflict: true,
      draft: draft("keep this draft"),
    });
    load.mockResolvedValueOnce(version(3, "other device"));
    await controller.load();
    controller.useSaved();
    expect(controller.getSnapshot()).toMatchObject({
      conflict: false,
      dirty: false,
      baseVersion: 3,
      draft: draft("other device"),
    });
  });

  it.each(["conflict", "replay"] as const)(
    "revokes previous choice eligibility during and after a failed repeat read following %s",
    async (recovery) => {
      const { controller, load, save } = fixture();
      await controller.load();
      controller.replaceDraft(draft("Retained draft"));
      if (recovery === "conflict") {
        save.mockRejectedValueOnce(new TrialApiError("conflict"));
        await controller.save();
      } else {
        save.mockRejectedValueOnce(new TrialApiError("commit_unknown"));
        await controller.save();
        save.mockResolvedValueOnce({
          ...version(2, "Retained draft"),
          replayed: true,
        });
        await controller.reconcile();
        expect(save.mock.calls[1]?.[0]).toEqual(save.mock.calls[0]?.[0]);
      }
      load.mockResolvedValueOnce(version(3, "Saved version three"));
      await controller.load();
      expect(controller.getSnapshot().latestLoaded).toBe(true);
      const repeat = deferred<VersionedPayload<Draft>>();
      load.mockReturnValueOnce(repeat.promise);
      const loading = controller.load();
      expect(controller.getSnapshot()).toMatchObject({
        phase: "loading",
        latestLoaded: false,
        saved: version(3, "Saved version three"),
        draft: draft("Retained draft"),
      });
      controller.useSaved();
      controller.keepDraft();
      repeat.reject(new TrialApiError("unavailable"));
      await loading;
      const failed = controller.getSnapshot();
      expect(failed).toMatchObject({
        phase: "idle",
        latestLoaded: false,
        conflict: true,
        baseVersion: recovery === "conflict" ? 1 : 2,
        draft: draft("Retained draft"),
        saved: version(3, "Saved version three"),
      });
      controller.useSaved();
      controller.keepDraft();
      await controller.save();
      expect(controller.getSnapshot()).toBe(failed);
      expect(save).toHaveBeenCalledTimes(recovery === "conflict" ? 1 : 2);
      load.mockResolvedValueOnce(version(4, "Saved version four"));
      await controller.load();
      controller.keepDraft();
      save.mockResolvedValueOnce({
        ...version(5, "Retained draft"),
        replayed: false,
      });
      await controller.save();
      expect(save.mock.lastCall?.[0]).toEqual({
        expectedVersion: 4,
        idempotencyKey: "invented-command-2",
        payload: draft("Retained draft"),
      });
    },
  );

  it.each([
    "invalid_request",
    "payload_too_large",
    "unsupported_media_type",
  ] as const)(
    "permits a new command after definite rejection %s",
    async (code) => {
      const { controller, save } = fixture();
      await controller.load();
      controller.replaceDraft(draft("edited"));
      save.mockRejectedValueOnce(new TrialApiError(code));
      await controller.save();
      expect(controller.getSnapshot()).toMatchObject({
        uncertain: false,
        dirty: true,
      });
      controller.replaceDraft(draft("corrected"));
      save.mockResolvedValueOnce({
        ...version(2, "corrected"),
        replayed: false,
      });
      await controller.save();
      expect(save.mock.calls[1]?.[0].idempotencyKey).toBe("invented-command-2");
    },
  );

  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "retires every operation synchronously after %s",
    async (code) => {
      const { controller, load, onRetire } = fixture();
      const pending = deferred<VersionedPayload<Draft>>();
      load.mockReturnValueOnce(pending.promise);
      const loading = controller.load();
      controller.readError(new TrialApiError(code));
      expect(onRetire).toHaveBeenCalledTimes(1);
      expect(load.mock.calls[0]?.[0].aborted).toBe(true);
      expect(controller.getSnapshot()).toMatchObject({
        phase: "retired",
        draft: null,
        saved: null,
      });
      const retired = controller.getSnapshot();
      pending.resolve(version(6, "late private data"));
      await loading;
      controller.readError(new TrialApiError("unavailable"));
      expect(controller.getSnapshot()).toBe(retired);
    },
  );

  it.each(["demo", "managed"] as const)(
    "ignores late sign-out failure after another %s retirement",
    async (mode) => {
      const { controller, session } = fixture(mode);
      const pending = deferred<void>();
      vi.mocked(session.signOut).mockReturnValueOnce(pending.promise);
      const signingOut = controller.signOut();
      controller.retire("Session replaced.");
      const retired = controller.getSnapshot();
      pending.reject(new Error("late failure"));
      await signingOut;
      expect(controller.getSnapshot()).toBe(retired);
      expect(retired).toMatchObject({
        signOutFailed: false,
        message: "Session replaced.",
      });
    },
  );

  it("blocks concurrent work and discards a late save after retirement", async () => {
    const { controller, save } = fixture();
    await controller.load();
    controller.replaceDraft(draft("edited"));
    const pending = deferred<SavedPayload<Draft>>();
    save.mockReturnValueOnce(pending.promise);
    const saving = controller.save();
    await controller.save();
    expect(save).toHaveBeenCalledTimes(1);
    controller.retire();
    expect(save.mock.calls[0]?.[1].aborted).toBe(true);
    pending.resolve({ ...version(2, "late save"), replayed: false });
    await saving;
    expect(controller.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
      saved: null,
      uncertain: false,
    });
  });

  it("does not dispatch an invalid draft", async () => {
    const { controller, save } = fixture();
    await controller.load();
    controller.replaceDraft(draft("line\nbreak"));
    await controller.save();
    expect(save).not.toHaveBeenCalled();
    expect(controller.getSnapshot().dirty).toBe(true);
  });
});
