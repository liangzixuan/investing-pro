import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import {
  SaveCoordinator,
  type SavePort,
  type SavedPayload,
} from "./save-coordinator";
import { ManagedSignOut } from "./ManagedSignOut";
import {
  MANAGED_FOLLOWUPS_SAVE_COPY,
  MANAGED_WATCHLIST_SAVE_COPY,
} from "./save-coordinator-copy";
import { ManagedSessionOwner } from "./managed-session-owner";

// Controlled callback scope only; the Android fixture verifies mounted focus and updates.
const view = vi.hoisted(() => ({
  open: false,
  effects: [] as Array<() => void>,
  refs: [] as Array<{ current: unknown }>,
  refIndex: 0,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useId: () => "invented-signout-heading",
  useState: () => [
    view.open,
    (next: boolean) => {
      view.open = next;
    },
  ],
  useRef: (initial: unknown) =>
    (view.refs[view.refIndex++] ??= { current: initial }),
  useLayoutEffect: (effect: () => void) => {
    view.effects.push(effect);
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
}));
beforeEach(() => {
  view.open = false;
  view.refs = [];
  view.effects = [];
  view.refIndex = 0;
});
type Draft = { notes: string[] };
const original: Draft = { notes: ["Saved first note", "Saved second note"] };
const changed: Draft = {
  notes: ["Saved second note", "  Changed first note  "],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function fixture() {
  const signOut = vi.fn<() => Promise<void>>().mockResolvedValue();
  const resourceSignOut = vi
    .fn<() => Promise<void>>()
    .mockRejectedValue(new Error("Only the aggregate owner may sign out"));
  const resource = (
    name: string,
    payload: Draft,
    version: number,
    copy: typeof MANAGED_WATCHLIST_SAVE_COPY,
  ) => {
    const save = vi.fn<SavePort<Draft>["save"]>();
    const load = vi
      .fn<SavePort<Draft>["load"]>()
      .mockResolvedValue({ version, payload });
    const coordinator = new SaveCoordinator<Draft>(
      {
        mode: "managed",
        empty: () => null,
        copy: structuredClone,
        capture: structuredClone,
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
      { newKey: () => `invented-${name}-command` },
    );
    return { coordinator, save, load };
  };
  const watchlist = resource(
    "watchlist",
    original,
    1,
    MANAGED_WATCHLIST_SAVE_COPY,
  );
  const followups = resource(
    "followups",
    { notes: ["Check the next filing"] },
    7,
    MANAGED_FOLLOWUPS_SAVE_COPY,
  );
  const clearResearch = vi.fn();
  const owner = new ManagedSessionOwner(
    { watchlist: watchlist.coordinator, followups: followups.coordinator },
    { signOut },
    clearResearch,
  );
  await Promise.all([
    watchlist.coordinator.load(),
    followups.coordinator.load(),
  ]);
  return {
    ...watchlist,
    followups,
    owner,
    signOut,
    resourceSignOut,
    clearResearch,
  };
}
function render(owner: ManagedSessionOwner) {
  view.refIndex = 0;
  view.effects = [];
  const element = ManagedSignOut({ owner });
  function find(
    node: React.ReactNode,
    id: string,
  ): React.ReactElement<React.ComponentProps<"button">> | undefined {
    for (const child of React.Children.toArray(node)) {
      if (
        !React.isValidElement<{ id?: string; children?: React.ReactNode }>(
          child,
        )
      )
        continue;
      if (child.props.id === id)
        return child as React.ReactElement<React.ComponentProps<"button">>;
      const found = find(child.props.children, id);
      if (found) return found;
    }
  }
  return {
    html: renderToStaticMarkup(element),
    click: (id: string) => {
      const button = find(element, id);
      expect(button).toBeDefined();
      button!.props.onClick!({} as React.MouseEvent<HTMLButtonElement>);
    },
    effects: () => view.effects.forEach((effect) => effect()),
  };
}
describe("intentional managed sign-out", () => {
  it("cancels a dirty review without changing raw notes, order, saved data or requests", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    const before = f.coordinator.getSnapshot();
    render(f.owner).click("managed-signout-open");
    const opened = render(f.owner);
    expect(opened.html).toContain("Sign out with unsaved changes?");
    const focus = vi.fn();
    view.refs[1]!.current = { focus };
    opened.effects();
    expect(focus).toHaveBeenCalledOnce();
    const returnFocus = vi.fn();
    view.refs[0]!.current = { focus: returnFocus };
    opened.click("managed-signout-stay");
    expect(returnFocus).toHaveBeenCalledOnce();
    expect(render(f.owner).html).not.toContain('id="managed-signout-review"');
    expect(f.coordinator.getSnapshot()).toBe(before);
    expect(before.draft).toEqual(changed);
    expect(before.saved?.payload).toEqual(original);
    expect(f.save).not.toHaveBeenCalled();
    expect(f.signOut).not.toHaveBeenCalled();
    expect(f.load).toHaveBeenCalledOnce();
  });
  it("checks the current draft when an earlier clean button is activated", async () => {
    const f = await fixture();
    const clean = render(f.owner);
    f.coordinator.replaceDraft(changed);
    clean.click("managed-signout-open");
    expect(render(f.owner).html).toContain("unsaved changes");
    expect(f.signOut).not.toHaveBeenCalled();
  });
  it("updates a mounted review after save success and keeps clean sign-out direct", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    const pending = deferred<SavedPayload<Draft>>();
    f.save.mockReturnValueOnce(pending.promise);
    const saving = f.coordinator.save();
    render(f.owner).click("managed-signout-open");
    expect(render(f.owner).html).toContain("The save is still in progress.");
    pending.resolve({ version: 2, payload: changed, replayed: false });
    await saving;
    const completed = render(f.owner);
    expect(completed.html).toContain("There are no unconfirmed local changes.");
    expect(completed.html).not.toContain("server may already");
    completed.click("managed-signout-stay");
    render(f.owner).click("managed-signout-open");
    await Promise.resolve();
    expect(f.signOut).toHaveBeenCalledOnce();
    expect(f.coordinator.getSnapshot().draft).toBeNull();
    expect(view.open).toBe(false);
  });
  it("preserves an uncertain command on cancellation, then fences its late reconciliation after confirmed sign-out", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    f.save.mockRejectedValueOnce(new TrialApiError("commit_unknown"));
    await f.coordinator.save();
    render(f.owner).click("managed-signout-open");
    const warning = render(f.owner);
    expect(warning.html).toContain("The save result is uncertain.");
    expect(warning.html).toContain("server may already have saved it");
    warning.click("managed-signout-stay");
    expect(f.coordinator.getSnapshot()).toMatchObject({
      dirty: true,
      uncertain: true,
      draft: changed,
    });
    expect(f.save).toHaveBeenCalledOnce();
    expect(f.signOut).not.toHaveBeenCalled();
    const pending = deferred<SavedPayload<Draft>>();
    f.save.mockReturnValueOnce(pending.promise);
    const reconciling = f.coordinator.reconcile();
    expect(f.save.mock.calls[1]?.[0]).toEqual(f.save.mock.calls[0]?.[0]);
    render(f.owner).click("managed-signout-open");
    render(f.owner).click("managed-signout-confirm");
    expect(f.save.mock.calls[1]?.[1].aborted).toBe(true);
    await Promise.resolve();
    expect(f.signOut).toHaveBeenCalledOnce();
    await Promise.resolve();
    const retired = f.coordinator.getSnapshot();
    expect(retired).toMatchObject({
      phase: "retired",
      draft: null,
      saved: null,
      uncertain: false,
    });
    pending.resolve({ version: 2, payload: changed, replayed: true });
    await reconciling;
    expect(f.coordinator.getSnapshot()).toBe(retired);
    expect(render(f.owner).html).not.toContain('id="managed-signout-review"');
  });
  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "clears a review immediately after %s and ignores its old confirmation",
    async (code) => {
      const f = await fixture();
      f.coordinator.replaceDraft(changed);
      render(f.owner).click("managed-signout-open");
      const old = render(f.owner);
      f.coordinator.readError(new TrialApiError(code));
      expect(render(f.owner).html).not.toContain('id="managed-signout-review"');
      old.click("managed-signout-confirm");
      expect(f.coordinator.getSnapshot().draft).toBeNull();
      expect(f.signOut).not.toHaveBeenCalled();
      render(f.owner).click("managed-signout-open");
      await Promise.resolve();
      expect(f.signOut).toHaveBeenCalledOnce();
    },
  );
  it("keeps failed sign-out retry direct and ignores a stale confirmation after session replacement", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    render(f.owner).click("managed-signout-open");
    const old = render(f.owner);
    f.coordinator.retire("Session replaced.");
    old.click("managed-signout-confirm");
    expect(f.signOut).not.toHaveBeenCalled();
    f.signOut.mockRejectedValueOnce(new Error("Invented sign-out failure"));
    render(f.owner).click("managed-signout-open");
    await vi.waitFor(() =>
      expect(f.owner.getSnapshot().signOutFailed).toBe(true),
    );
    const retry = render(f.owner);
    expect(retry.html).toContain("Try signing out again");
    retry.click("managed-signout-open");
    await Promise.resolve();
    expect(f.signOut).toHaveBeenCalledTimes(2);
    expect(retry.html).not.toContain('id="managed-signout-review"');
  });

  it("reviews both dirty resources and preserves each raw draft, version and requests when staying", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    f.followups.coordinator.replaceDraft({
      notes: ["  Review the filing 财报  "],
    });
    const watchlist = f.coordinator.getSnapshot();
    const followups = f.followups.coordinator.getSnapshot();
    render(f.owner).click("managed-signout-open");
    const opened = render(f.owner);
    expect(opened.html).toContain(
      "<dt>Watchlist</dt><dd>Unsaved local changes.</dd>",
    );
    expect(opened.html).toContain(
      "<dt>Follow-ups</dt><dd>Unsaved local changes.</dd>",
    );
    expect(opened.html).toContain("Signing out discards both local drafts.");
    opened.click("managed-signout-stay");
    expect(f.coordinator.getSnapshot()).toBe(watchlist);
    expect(f.followups.coordinator.getSnapshot()).toBe(followups);
    expect(watchlist.baseVersion).toBe(1);
    expect(followups.baseVersion).toBe(7);
    expect(followups.draft).toEqual({ notes: ["  Review the filing 财报  "] });
    expect(f.save).not.toHaveBeenCalled();
    expect(f.followups.save).not.toHaveBeenCalled();
    expect(f.followups.load).toHaveBeenCalledOnce();
    expect(f.signOut).not.toHaveBeenCalled();
    expect(f.resourceSignOut).not.toHaveBeenCalled();
  });

  it("reads a new follow-up draft from an earlier clean button and rejects a closed review's confirmation", async () => {
    const f = await fixture();
    const clean = render(f.owner);
    f.followups.coordinator.replaceDraft({ notes: ["Check next quarter"] });
    clean.click("managed-signout-open");
    const old = render(f.owner);
    expect(old.html).toContain(
      "<dt>Watchlist</dt><dd>No unconfirmed local changes.</dd>",
    );
    expect(old.html).toContain(
      "<dt>Follow-ups</dt><dd>Unsaved local changes.</dd>",
    );
    old.click("managed-signout-stay");
    old.click("managed-signout-confirm");
    render(f.owner).click("managed-signout-open");
    old.click("managed-signout-confirm");
    expect(f.owner.getSnapshot().phase).toBe("active");
    expect(f.signOut).not.toHaveBeenCalled();
    render(f.owner).click("managed-signout-confirm");
    old.click("managed-signout-confirm");
    await Promise.resolve();
    expect(f.signOut).toHaveBeenCalledOnce();
    expect(f.coordinator.getSnapshot().draft).toBeNull();
    expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.resourceSignOut).not.toHaveBeenCalled();
  });

  it("keeps the other dirty draft in review when a follow-up save finishes", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    const payload = { notes: ["Follow-up result"] };
    f.followups.coordinator.replaceDraft(payload);
    const pending = deferred<SavedPayload<Draft>>();
    f.followups.save.mockReturnValueOnce(pending.promise);
    const saving = f.followups.coordinator.save();
    render(f.owner).click("managed-signout-open");
    expect(render(f.owner).html).toContain(
      "<dt>Follow-ups</dt><dd>Unsaved local changes. Save in progress.</dd>",
    );
    pending.resolve({ version: 8, payload, replayed: false });
    await saving;
    const updated = render(f.owner);
    expect(updated.html).toContain("Sign out with unsaved changes?");
    expect(updated.html).toContain(
      "<dt>Follow-ups</dt><dd>No unconfirmed local changes.</dd>",
    );
    expect(updated.html).toContain(
      "<dt>Watchlist</dt><dd>Unsaved local changes.</dd>",
    );
    updated.click("managed-signout-stay");
    expect(f.coordinator.getSnapshot().draft).toEqual(changed);
    expect(f.save).not.toHaveBeenCalled();
    expect(f.followups.save).toHaveBeenCalledOnce();
    expect(f.signOut).not.toHaveBeenCalled();
  });

  it("keeps the visible confirmation valid when the opener is activated again", async () => {
    const f = await fixture();
    f.followups.coordinator.replaceDraft({ notes: ["Check the filing"] });
    const originalButton = render(f.owner);
    originalButton.click("managed-signout-open");
    const opened = render(f.owner);
    originalButton.click("managed-signout-open");
    opened.click("managed-signout-open");
    opened.click("managed-signout-confirm");
    await Promise.resolve();
    expect(f.signOut).toHaveBeenCalledOnce();
    expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.resourceSignOut).not.toHaveBeenCalled();
  });

  it("lists conflict and uncertain reconciliation independently and fences the follow-up's late result", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    f.save.mockRejectedValueOnce(new TrialApiError("conflict"));
    await f.coordinator.save();
    f.followups.coordinator.replaceDraft({ notes: ["Uncertain follow-up"] });
    f.followups.save.mockRejectedValueOnce(new TrialApiError("commit_unknown"));
    await f.followups.coordinator.save();
    render(f.owner).click("managed-signout-open");
    const opened = render(f.owner);
    expect(opened.html).toContain(
      "<dt>Watchlist</dt><dd>Unsaved local changes. Saved version needs review.</dd>",
    );
    expect(opened.html).toContain(
      "<dt>Follow-ups</dt><dd>Unsaved local changes. Save result uncertain.</dd>",
    );
    opened.click("managed-signout-stay");
    const originalCommand = f.followups.save.mock.calls[0]![0];
    const pending = deferred<SavedPayload<Draft>>();
    f.followups.save.mockReturnValueOnce(pending.promise);
    const reconciling = f.followups.coordinator.reconcile();
    expect(f.followups.save.mock.calls[1]![0]).toEqual(originalCommand);
    render(f.owner).click("managed-signout-open");
    const reconcilingReview = render(f.owner);
    expect(reconcilingReview.html).toContain(
      "<dt>Follow-ups</dt><dd>Unsaved local changes. Reconciling the original save. Save result uncertain.</dd>",
    );
    reconcilingReview.click("managed-signout-confirm");
    expect(f.followups.save.mock.calls[1]![1].aborted).toBe(true);
    await Promise.resolve();
    expect(f.signOut).toHaveBeenCalledOnce();
    const retired = f.followups.coordinator.getSnapshot();
    pending.resolve({
      version: 8,
      payload: originalCommand.payload,
      replayed: true,
    });
    await reconciling;
    expect(f.followups.coordinator.getSnapshot()).toBe(retired);
    expect(f.coordinator.getSnapshot().draft).toBeNull();
    expect(f.save).toHaveBeenCalledOnce();
    expect(f.followups.save).toHaveBeenCalledTimes(2);
    expect(f.resourceSignOut).not.toHaveBeenCalled();
  });

  it("reviews a replay awaiting the latest version even after its dirty flag clears", async () => {
    const f = await fixture();
    const payload = { notes: ["Replayed follow-up"] };
    f.followups.coordinator.replaceDraft(payload);
    f.followups.save.mockResolvedValueOnce({
      version: 8,
      payload,
      replayed: true,
    });
    await f.followups.coordinator.save();
    expect(f.followups.coordinator.getSnapshot().dirty).toBe(false);
    render(f.owner).click("managed-signout-open");
    const opened = render(f.owner);
    expect(opened.html).toContain("Review saved versions before signing out");
    expect(opened.html).toContain(
      "<dt>Follow-ups</dt><dd>Saved version needs review. Original save replayed. Load and review the latest version.</dd>",
    );
    opened.click("managed-signout-stay");
    expect(f.followups.coordinator.getSnapshot().replayPending).toBe(true);
    expect(f.followups.load).toHaveBeenCalledOnce();
    expect(f.signOut).not.toHaveBeenCalled();
  });

  it("removes both drafts and an open review when the follow-up resource expires", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    f.followups.coordinator.replaceDraft({ notes: ["Expiry follow-up"] });
    render(f.owner).click("managed-signout-open");
    const old = render(f.owner);
    f.followups.coordinator.readError(new TrialApiError("unauthenticated"));
    expect(render(f.owner).html).not.toContain('id="managed-signout-review"');
    old.click("managed-signout-confirm");
    expect(f.coordinator.getSnapshot().draft).toBeNull();
    expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.clearResearch).toHaveBeenCalledOnce();
    expect(f.signOut).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
    expect(f.followups.save).not.toHaveBeenCalled();
  });
});
