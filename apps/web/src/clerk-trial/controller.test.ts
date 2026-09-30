import { describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import type { TrialApi, TrialSaved, TrialWatchlist } from "./api";
import { TrialController } from "./controller";
import type { TrialSession } from "./session";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const empty: TrialWatchlist = { version: 0, selected: [], note: "" };
function fixture() {
  const api = {
    load: vi.fn<TrialApi["load"]>().mockResolvedValue(empty),
    save: vi.fn<TrialApi["save"]>(),
  };
  const session: TrialSession = {
    userId: "user_demo",
    sessionId: "session_demo",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  let keys = 0;
  const controller = new TrialController(
    api,
    session,
    () => `trial-command-${String(++keys).padStart(8, "0")}`,
  );
  return { api, session, controller };
}

describe("isolated trial watchlist", () => {
  it("keeps the complete draft on conflict and requires an explicit latest-version choice", async () => {
    const { controller, api } = fixture();
    await controller.load();
    controller.setSelected("DEMO_A", true);
    controller.setNote("my invented note");
    api.save.mockRejectedValueOnce(new TrialApiError("conflict"));
    await controller.save();
    expect(controller.getSnapshot()).toMatchObject({
      conflict: true,
      draft: { selected: ["DEMO_A"], note: "my invented note" },
      baseVersion: 0,
    });
    controller.keepDraft();
    await controller.save();
    expect(api.save).toHaveBeenCalledTimes(1);
    api.load.mockResolvedValueOnce({
      version: 2,
      selected: ["DEMO_B"],
      note: "",
    });
    await controller.load();
    expect(controller.getSnapshot()).toMatchObject({
      latestLoaded: true,
      baseVersion: 0,
      draft: { selected: ["DEMO_A"], note: "my invented note" },
    });
    controller.keepDraft();
    api.save.mockResolvedValueOnce({
      version: 3,
      selected: ["DEMO_A"],
      note: "my invented note",
      replayed: false,
    });
    await controller.save();
    expect(api.save.mock.calls[1]?.[0]).toEqual({
      expectedVersion: 2,
      idempotencyKey: "trial-command-00000002",
      selected: ["DEMO_A"],
      note: "my invented note",
    });
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      conflict: false,
      baseVersion: 3,
    });
  });

  it.each(["commit_unknown", "unavailable", "invalid_response"] as const)(
    "keeps the exact command after %s and sends it only on explicit reconciliation",
    async (code) => {
      const { controller, api } = fixture();
      await controller.load();
      controller.setSelected("DEMO_A", true);
      controller.setNote("  Cafe\u0301  ");
      api.save.mockRejectedValueOnce(new TrialApiError(code));
      await controller.save();
      const original = api.save.mock.calls[0]?.[0];
      expect(original).toEqual({
        expectedVersion: 0,
        idempotencyKey: "trial-command-00000001",
        selected: ["DEMO_A"],
        note: "Café",
      });
      controller.setNote("must not replace uncertain command");
      controller.setSelected("DEMO_B", true);
      await controller.save();
      await controller.load();
      expect(api.load).toHaveBeenCalledTimes(1);
      expect(api.save).toHaveBeenCalledTimes(1);
      expect(controller.getSnapshot()).toMatchObject({
        uncertain: true,
        draft: { selected: ["DEMO_A"], note: "Café" },
      });
      api.save.mockResolvedValueOnce({
        version: 1,
        selected: ["DEMO_A"],
        note: "Café",
        replayed: true,
      });
      await controller.reconcile();
      expect(api.save.mock.calls[1]?.[0]).toEqual(original);
      expect(controller.getSnapshot()).toMatchObject({
        uncertain: false,
        baseVersion: 1,
        latestLoaded: false,
      });
      expect(controller.getSnapshot().message).toContain("Load again");
    },
  );

  it("ignores a late load after an identity change retires its controller", async () => {
    const { controller, api } = fixture();
    const pending = deferred<TrialWatchlist>();
    api.load.mockReturnValueOnce(pending.promise);
    const loading = controller.load();
    controller.retire();
    expect(api.load.mock.calls[0]?.[0].aborted).toBe(true);
    pending.resolve({
      version: 8,
      selected: ["DEMO_A"],
      note: "retired session note",
    });
    await loading;
    expect(controller.getSnapshot()).toMatchObject({
      phase: "retired",
      saved: null,
      draft: { selected: [], note: "" },
    });
    await controller.save();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("clears pending save and draft before awaiting current-session sign-out, even if revocation fails", async () => {
    const { controller, api, session } = fixture();
    await controller.load();
    controller.setSelected("DEMO_A", true);
    controller.setNote("retire immediately");
    const saved = deferred<TrialSaved>();
    const signOut = deferred<void>();
    api.save.mockReturnValueOnce(saved.promise);
    vi.mocked(session.signOut).mockReturnValueOnce(signOut.promise);
    const saving = controller.save();
    const signingOut = controller.signOut();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "signing_out",
      saved: null,
      draft: { selected: [], note: "" },
    });
    expect(api.save.mock.calls[0]?.[1].aborted).toBe(true);
    saved.resolve({
      version: 1,
      selected: ["DEMO_A"],
      note: "retire immediately",
      replayed: false,
    });
    signOut.reject(new Error("synthetic revocation failure"));
    await Promise.all([saving, signingOut]);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "retired",
      signOutFailed: true,
      saved: null,
      uncertain: false,
    });
    await controller.reconcile();
    expect(api.save).toHaveBeenCalledTimes(1);
    await controller.signOut();
    expect(session.signOut).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().signOutFailed).toBe(false);
  });

  it("clears local data on an authorization rejection and rejects control characters before dispatch", async () => {
    const { controller, api } = fixture();
    await controller.load();
    controller.setSelected("DEMO_A", true);
    controller.setNote("line\nbreak");
    await controller.save();
    expect(api.save).not.toHaveBeenCalled();
    controller.setNote("valid note");
    api.save.mockRejectedValueOnce(new TrialApiError("unauthenticated"));
    await controller.save();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "retired",
      saved: null,
      draft: { selected: [], note: "" },
    });
  });

  it("uses the freshly loaded version only when the draft is explicitly discarded", async () => {
    const { controller, api } = fixture();
    await controller.load();
    controller.setSelected("DEMO_A", true);
    controller.setNote("discard me");
    api.load.mockResolvedValueOnce({
      version: 4,
      selected: ["DEMO_B"],
      note: "",
    });
    await controller.load();
    expect(controller.getSnapshot().draft.note).toBe("discard me");
    controller.useSaved();
    expect(controller.getSnapshot()).toMatchObject({
      baseVersion: 4,
      dirty: false,
      conflict: false,
      draft: { selected: ["DEMO_B"], note: "" },
    });
  });
});
