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
  useRef: () => (view.refs[view.refIndex++] ??= { current: null }),
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
  const save = vi.fn<SavePort<Draft>["save"]>();
  const load = vi
    .fn<SavePort<Draft>["load"]>()
    .mockResolvedValue({ version: 1, payload: original });
  const signOut = vi.fn<() => Promise<void>>().mockResolvedValue();
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
      signOut,
    },
    { newKey: () => "invented-original-command" },
  );
  await coordinator.load();
  return { coordinator, save, load, signOut };
}
function render(coordinator: SaveCoordinator<Draft>) {
  view.refIndex = 0;
  view.effects = [];
  const element = ManagedSignOut({ coordinator });
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
    render(f.coordinator).click("managed-signout-open");
    const opened = render(f.coordinator);
    expect(opened.html).toContain("Sign out with unsaved changes?");
    const focus = vi.fn();
    view.refs[1]!.current = { focus };
    opened.effects();
    expect(focus).toHaveBeenCalledOnce();
    const returnFocus = vi.fn();
    view.refs[0]!.current = { focus: returnFocus };
    opened.click("managed-signout-stay");
    expect(returnFocus).toHaveBeenCalledOnce();
    expect(render(f.coordinator).html).not.toContain(
      'id="managed-signout-review"',
    );
    expect(f.coordinator.getSnapshot()).toBe(before);
    expect(before.draft).toEqual(changed);
    expect(before.saved?.payload).toEqual(original);
    expect(f.save).not.toHaveBeenCalled();
    expect(f.signOut).not.toHaveBeenCalled();
    expect(f.load).toHaveBeenCalledOnce();
  });
  it("checks the current draft when an earlier clean button is activated", async () => {
    const f = await fixture();
    const clean = render(f.coordinator);
    f.coordinator.replaceDraft(changed);
    clean.click("managed-signout-open");
    expect(render(f.coordinator).html).toContain("unsaved changes");
    expect(f.signOut).not.toHaveBeenCalled();
  });
  it("updates a mounted review after save success and keeps clean sign-out direct", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    const pending = deferred<SavedPayload<Draft>>();
    f.save.mockReturnValueOnce(pending.promise);
    const saving = f.coordinator.save();
    render(f.coordinator).click("managed-signout-open");
    expect(render(f.coordinator).html).toContain(
      "The save is still in progress.",
    );
    pending.resolve({ version: 2, payload: changed, replayed: false });
    await saving;
    const completed = render(f.coordinator);
    expect(completed.html).toContain("There are no unconfirmed local changes.");
    expect(completed.html).not.toContain("server may already");
    completed.click("managed-signout-stay");
    render(f.coordinator).click("managed-signout-open");
    expect(f.signOut).toHaveBeenCalledOnce();
    expect(f.coordinator.getSnapshot().draft).toBeNull();
    expect(view.open).toBe(false);
  });
  it("preserves an uncertain command on cancellation, then fences its late reconciliation after confirmed sign-out", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    f.save.mockRejectedValueOnce(new TrialApiError("commit_unknown"));
    await f.coordinator.save();
    render(f.coordinator).click("managed-signout-open");
    const warning = render(f.coordinator);
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
    render(f.coordinator).click("managed-signout-open");
    render(f.coordinator).click("managed-signout-confirm");
    expect(f.save.mock.calls[1]?.[1].aborted).toBe(true);
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
    expect(render(f.coordinator).html).not.toContain(
      'id="managed-signout-review"',
    );
  });
  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "clears a review immediately after %s and ignores its old confirmation",
    async (code) => {
      const f = await fixture();
      f.coordinator.replaceDraft(changed);
      render(f.coordinator).click("managed-signout-open");
      const old = render(f.coordinator);
      f.coordinator.readError(new TrialApiError(code));
      expect(render(f.coordinator).html).not.toContain(
        'id="managed-signout-review"',
      );
      old.click("managed-signout-confirm");
      expect(f.coordinator.getSnapshot().draft).toBeNull();
      expect(f.signOut).not.toHaveBeenCalled();
      render(f.coordinator).click("managed-signout-open");
      expect(f.signOut).toHaveBeenCalledOnce();
    },
  );
  it("keeps failed sign-out retry direct and ignores a stale confirmation after session replacement", async () => {
    const f = await fixture();
    f.coordinator.replaceDraft(changed);
    render(f.coordinator).click("managed-signout-open");
    const old = render(f.coordinator);
    f.coordinator.retire("Session replaced.");
    old.click("managed-signout-confirm");
    expect(f.signOut).not.toHaveBeenCalled();
    f.signOut.mockRejectedValueOnce(new Error("Invented sign-out failure"));
    render(f.coordinator).click("managed-signout-open");
    await Promise.resolve();
    const retry = render(f.coordinator);
    expect(retry.html).toContain("Try signing out again");
    retry.click("managed-signout-open");
    expect(f.signOut).toHaveBeenCalledTimes(2);
    expect(retry.html).not.toContain('id="managed-signout-review"');
  });
});
