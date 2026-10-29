import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedFollowupsReviewSession as Panel } from "./ManagedFollowupsReviewSession";
import { TrialApiError } from "./api";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";

// Controlled commits exercise real callbacks and model state. This is not a
// browser layout, React mounting or physical keyboard acceptance test.
const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<() => void | (() => void)>,
  cleanups: [] as Array<() => void>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "followups-review-test" : actual.useId()),
    useRef: (initial: unknown) =>
      hooks.direct
        ? (hooks.refs[hooks.index++] ??= { current: initial })
        : actual.useRef(initial),
    useLayoutEffect: (
      effect: () => void | (() => void),
      dependencies?: React.DependencyList,
    ) => {
      if (hooks.direct) hooks.effects.push(effect);
      else actual.useLayoutEffect(effect, dependencies);
    },
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      get: () => unknown,
      server: () => unknown,
    ) =>
      hooks.direct
        ? get()
        : actual.useSyncExternalStore(subscribe, get, server),
  };
});
type Button = React.ReactElement<{
  id: string;
  disabled?: boolean;
  onClick: (event: { currentTarget: HTMLButtonElement }) => void;
}>;
function buttons(node: React.ReactNode): Button[] {
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [
    ...(node.type === "button" ? [node as Button] : []),
    ...React.Children.toArray(node.props.children).flatMap(buttons),
  ];
}
const fixtures: Awaited<ReturnType<typeof createFollowupsReviewFixture>>[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T12:00:00.000Z"));
});
afterEach(() => {
  hooks.cleanups.forEach((cleanup) => cleanup());
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  hooks.direct = false;
  hooks.refs = [];
  hooks.effects = [];
  hooks.cleanups = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function fixture() {
  const f = await createFollowupsReviewFixture();
  fixtures.push(f);
  const onResearch = vi.fn<React.ComponentProps<typeof Panel>["onResearch"]>();
  const routeActive = vi.fn(() => true);
  const documentMock = { body: {}, activeElement: {} };
  documentMock.activeElement = documentMock.body;
  vi.stubGlobal("document", documentMock);
  const focus = vi.fn();
  const target = {
    isConnected: true,
    getClientRects: () => [{}],
    closest: () => null,
    focus,
  };
  const render = (active = true) => {
    hooks.direct = true;
    hooks.index = 0;
    hooks.effects = [];
    const node = Panel({
      workspace: f.workspace,
      active,
      routeActive,
      onResearch,
    });
    hooks.direct = false;
    hooks.refs[1]!.current = target;
    return {
      html: renderToStaticMarkup(node),
      has: (id: string) =>
        buttons(node).some(
          (item) => item.props.id === `managed-followups-review-${id}`,
        ),
      button: (id: string) => {
        const found = buttons(node).find(
          (item) => item.props.id === `managed-followups-review-${id}`,
        );
        if (!found) throw new Error(`Missing actual review button ${id}`);
        return found;
      },
    };
  };
  const commit = () => {
    hooks.cleanups.forEach((cleanup) => cleanup());
    hooks.cleanups = hooks.effects.flatMap((effect) => {
      const cleanup = effect();
      return cleanup ? [cleanup] : [];
    });
  };
  const click = (button: Button, control = {} as HTMLButtonElement) => {
    expect(button.props.disabled).not.toBe(true);
    button.props.onClick({ currentTarget: control });
  };
  const start = (indexes = [1, 0]) => {
    let page = render();
    commit();
    click(page.button("enter"));
    page = render();
    commit();
    for (const index of indexes) {
      click(page.button(`choose-${f.entries[index]!.id}`));
      page = render();
      commit();
    }
    click(page.button("start"));
    page = render();
    commit();
    return page;
  };
  return {
    ...f,
    onResearch,
    routeActive,
    documentMock,
    target,
    focus,
    render,
    commit,
    click,
    start,
  };
}

it("renders full questions and identities, chosen order, complete final draft and separate Save guidance", async () => {
  const f = await fixture();
  let page = f.render();
  f.commit();
  expect(page.html).not.toContain(
    '<details class="managed-followups-review" open',
  );
  f.click(page.button("enter"));
  page = f.render();
  f.commit();
  expect(page.has("finish")).toBe(false);
  expect(page.button("start").props.disabled).toBe(true);
  for (const entry of f.entries) {
    expect(page.html).toContain(entry.check);
    expect(page.html).toContain(entry.catalogSnapshotSha256);
    for (const value of Object.values(entry.listing))
      expect(page.html).toContain(value);
  }
  f.click(page.button(`choose-${f.entries[1]!.id}`));
  page = f.render();
  f.commit();
  f.click(page.button(`choose-${f.entries[0]!.id}`));
  page = f.render();
  f.commit();
  f.click(page.button("start"));
  page = f.render();
  f.commit();
  expect(page.html).toContain("Check 1 of 2");
  f.click(page.button("research"));
  expect(f.onResearch).toHaveBeenCalledWith(
    f.model.getSnapshot().selected!.entry,
    expect.anything(),
  );
  expect(f.api.resolve).not.toHaveBeenCalled();
  f.click(page.button("next"));
  page = f.render();
  f.commit();
  expect(page.html).toContain("Check 2 of 2");
  expect(page.button("next").props.disabled).toBe(true);
  f.click(page.button("finish"));
  page = f.render();
  f.commit();
  for (const entry of f.entries) expect(page.html).toContain(entry.check);
  expect(page.html).toContain("Unchosen result stays");
  expect(page.html).toContain("Save follow-ups separately");
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  for (const read of [
    f.api.eodHistory,
    f.api.annualReport,
    f.api.recentFilings,
  ])
    expect(read).not.toHaveBeenCalled();
});

it.each(["uncommitted", "inactive", "route", "state", "unmounted"] as const)(
  "keeps an old research callback inert after %s",
  async (boundary) => {
    const f = await fixture();
    const page = f.start();
    let button = page.button("research");
    if (boundary === "uncommitted") button = f.render().button("research");
    if (boundary === "inactive") {
      f.render(false);
      f.commit();
    }
    if (boundary === "route") f.routeActive.mockReturnValue(false);
    if (boundary === "state") f.model.continue(f.model.getSnapshot());
    if (boundary === "unmounted")
      hooks.cleanups.forEach((cleanup) => cleanup());
    f.click(button);
    expect(f.onResearch).not.toHaveBeenCalled();
    expect(f.api.resolve).not.toHaveBeenCalled();
  },
);

it.each([true, false])(
  "moves Start/Continue/Finish focus only while the initiating control retains it (%s)",
  async (ownsFocus) => {
    const f = await fixture();
    let page = f.render();
    f.commit();
    f.click(page.button("enter"));
    page = f.render();
    f.commit();
    f.click(page.button(`choose-${f.entries[0]!.id}`));
    page = f.render();
    f.commit();
    f.click(page.button(`choose-${f.entries[1]!.id}`));
    page = f.render();
    f.commit();
    for (const id of ["start", "next", "finish"]) {
      const control = {} as HTMLButtonElement;
      f.documentMock.activeElement = control;
      f.click(page.button(id), control);
      if (!ownsFocus) f.documentMock.activeElement = {};
      page = f.render();
      f.commit();
    }
    expect(f.focus).toHaveBeenCalledTimes(ownsFocus ? 3 : 0);
  },
);

it("does not focus a hidden or disconnected heading or act through paused navigation", async () => {
  const f = await fixture();
  let page = f.start();
  const control = {} as HTMLButtonElement;
  f.documentMock.activeElement = control;
  f.click(page.button("next"), control);
  f.target.isConnected = false;
  page = f.render();
  f.commit();
  expect(f.focus).not.toHaveBeenCalled();
  f.workspace.setNavigationBlocked(true);
  f.click(page.button("research"));
  expect(f.onResearch).not.toHaveBeenCalled();
});

it("completes and reopens the exact chosen check through Research/Back, explicit Continue, Finish and separate Save/fresh Load", async () => {
  const f = await fixture();
  const watchlist = f.workspace.coordinator.getSnapshot().draft;
  const original = f.workspace.followups.coordinator.getSnapshot().draft!;
  const unchosen = {
    ...original.entries[2]!,
    id: "00000000-0000-4000-8000-000000000004",
    listing: {
      ...original.entries[2]!.listing,
      listingId: "invented-unchosen-listing",
    },
    check: "Unchosen full question",
    result: "Unchosen full result stays",
  };
  f.workspace.followups.coordinator.replaceDraft({
    ...original,
    entries: [...original.entries, unchosen],
  });
  let page = f.start([1, 0, 2]);
  const chosenIds = f.model.getSnapshot().chosen.map((row) => row.entry.id);
  f.click(page.button("research"));
  const research = await f.open();
  research.editAssessment(
    "  Complete raw assessment \u6771\u4eac second phrase \ud83d\udcc8  ",
  );
  f.workspace.closeResearch();
  page = f.render();
  f.commit();
  expect(page.html).toContain("Assessed on 2026-10-24 UTC");
  const first = f.model.getSnapshot().selected!.entry;
  const before = f.workspace.followups.coordinator.getSnapshot().draft!;
  // A later wall clock must not replace the visible captured assessment day.
  vi.setSystemTime(new Date("2026-11-02T18:00:00Z"));
  f.click(page.button("complete"));
  const completed = f.model.getSnapshot().selected!.entry;
  expect(completed).toEqual({
    ...first,
    status: "completed",
    completedOn: "2026-10-24",
  });
  expect(f.model.getSnapshot().position).toBe(0);
  expect(f.model.getSnapshot().chosen.map((row) => row.entry.id)).toEqual(
    chosenIds,
  );
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toEqual(
    before.entries.map((entry) => (entry.id === first.id ? completed : entry)),
  );
  page = f.render();
  f.commit();
  expect(page.has("complete")).toBe(false);
  expect(page.html).toContain("Completed 2026-10-24 UTC.");
  f.click(page.button("reopen"));
  expect(f.model.getSnapshot().selected!.entry).toEqual(first);
  page = f.render();
  f.commit();
  f.click(page.button("complete"));
  page = f.render();
  f.commit();
  f.click(page.button("next"));
  page = f.render();
  f.commit();
  // Empty assessments retain the normal editor's completion contract.
  expect(f.model.getSnapshot().selected!.entry.result).toBe("");
  f.click(page.button("complete"));
  page = f.render();
  f.commit();
  f.click(page.button("next"));
  page = f.render();
  f.commit();
  expect(f.model.getSnapshot().selected!.entry.status).toBe("open");
  expect(f.model.getSnapshot().position).toBe(2);
  f.click(page.button("finish"));
  page = f.render();
  f.commit();
  const fullDraft = f.workspace.followups.coordinator.getSnapshot().draft!;
  expect(fullDraft.entries[3]).toEqual(unchosen);
  expect(page.html).toContain(unchosen.check);
  expect(page.html).toContain(unchosen.result);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(watchlist);
  for (const source of [
    f.api.eodHistory,
    f.api.annualReport,
    f.api.recentFilings,
  ])
    expect(source).not.toHaveBeenCalled();
  expect(f.api.resolve).toHaveBeenCalledOnce();
  await f.workspace.followups.coordinator.save();
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  const fresh = f.make();
  await fresh.refreshCatalog();
  fresh.setView("followups");
  await fresh.followups.coordinator.load();
  // Save uses the established normalization; completion preserves raw text.
  expect(fresh.followups.coordinator.getSnapshot().draft).toEqual(
    f.workspace.followups.coordinator.getSnapshot().saved!.payload,
  );
  expect(
    fresh.followups.coordinator
      .getSnapshot()
      .draft!.entries.map((entry) => [entry.status, entry.completedOn]),
  ).toEqual([
    ["completed", "2026-10-24"],
    ["completed", "2026-10-24"],
    ["open", null],
    ["open", null],
  ]);
  expect(fresh.followupsReview.getSnapshot().entered).toBe(false);
});

it.each(["complete", "reopen"] as const)(
  "does not revive an old %s callback through a complete/reopen ABA",
  async (action) => {
    const f = await fixture();
    let page = f.start();
    if (action === "reopen") {
      f.click(page.button("complete"));
      page = f.render();
      f.commit();
    }
    const stale = page.button(action);
    f.click(stale);
    page = f.render();
    f.commit();
    f.click(page.button(action === "complete" ? "reopen" : "complete"));
    f.render();
    f.commit();
    const draft = f.workspace.followups.coordinator.getSnapshot().draft;
    f.click(stale);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
  },
);

it.each(["complete", "reopen"] as const)(
  "fences captured %s actions across review lifetime boundaries",
  async (action) => {
    for (const boundary of [
      "uncommitted",
      "inactive",
      "route",
      "continue",
      "unmounted",
      "result",
      "entry",
      "draft",
      "question",
      "date",
      "listing",
      "catalog",
      "session",
      "day",
      "same-day",
      "invalid-day",
      "resolution",
      "save",
      "conflict",
      "uncertain",
      "navigation",
    ] as const) {
      const f = await fixture();
      let page = f.start();
      if (action === "reopen") {
        f.click(page.button("complete"));
        page = f.render();
        f.commit();
      }
      let stale = page.button(action);
      const entry = f.model.getSnapshot().selected!.entry;
      const store = f.workspace.followups;
      const coordinator = store.coordinator;
      if (boundary === "uncommitted") stale = f.render().button(action);
      if (boundary === "inactive") {
        f.render(false);
        f.commit();
      }
      if (boundary === "route") f.routeActive.mockReturnValue(false);
      if (boundary === "continue") f.model.continue(f.model.getSnapshot());
      if (boundary === "unmounted")
        hooks.cleanups.forEach((cleanup) => cleanup());
      if (boundary === "result")
        store.edit(entry, "result", "A replacement result");
      if (boundary === "entry") store.remove(entry);
      if (boundary === "draft")
        coordinator.replaceDraft(coordinator.getSnapshot().draft!);
      if (boundary === "question")
        store.edit(entry, "check", "A replacement question");
      if (boundary === "date") store.edit(entry, "dueOn", "2026-10-23");
      if (boundary === "listing") {
        const draft = coordinator.getSnapshot().draft!;
        coordinator.replaceDraft({
          ...draft,
          entries: draft.entries.map((item) =>
            item === entry
              ? {
                  ...item,
                  listing: {
                    ...item.listing,
                    shareClassId: "replacement-class",
                  },
                }
              : item,
          ),
        });
      }
      if (boundary === "catalog") store.syncCatalog(`sha256:${"f".repeat(64)}`);
      if (boundary === "session") f.workspace.sessionOwner.dispose();
      if (boundary === "day")
        store.reassessDueDate(new Date("2026-10-25T00:00:00Z"));
      if (boundary === "same-day")
        store.reassessDueDate(new Date("2026-10-24T23:00:00Z"));
      if (boundary === "invalid-day") store.reassessDueDate(new Date(NaN));
      if (boundary === "resolution") {
        vi.mocked(f.api.resolve).mockReturnValueOnce(new Promise(() => {}));
        void f.workspace.prepareFollowupResearch(entry);
      }
      if (boundary === "navigation") f.workspace.setNavigationBlocked(true);
      if (["save", "conflict", "uncertain"].includes(boundary)) {
        if (!coordinator.getSnapshot().dirty)
          store.edit(entry, "result", "Make draft dirty");
        page = f.render();
        f.commit();
        stale = page.button(action);
        if (boundary === "save") {
          vi.mocked(f.api.saveFollowups).mockReturnValueOnce(
            new Promise(() => {}),
          );
          void coordinator.save();
        } else {
          vi.mocked(f.api.saveFollowups).mockRejectedValueOnce(
            new TrialApiError(
              boundary === "conflict" ? "conflict" : "commit_unknown",
            ),
          );
          await coordinator.save();
        }
      }
      const draft = coordinator.getSnapshot().draft;
      f.click(stale);
      expect(coordinator.getSnapshot().draft, `${action}: ${boundary}`).toBe(
        draft,
      );
      expect(f.focus).not.toHaveBeenCalled();
      hooks.cleanups.forEach((cleanup) => cleanup());
      hooks.refs = [];
      hooks.effects = [];
      hooks.cleanups = [];
    }
  },
);

it.each(["complete", "reopen"] as const)(
  "moves focus after %s only for the exact committed status transition",
  async (action) => {
    for (const boundary of [
      "owned",
      "body",
      "other-focus",
      "hidden",
      "disconnected",
      "later-edit",
      "reentrant",
      "reentrant-aba",
      "route",
    ] as const) {
      const f = await fixture();
      let page = f.start();
      if (action === "reopen") {
        f.click(page.button("complete"));
        page = f.render();
        f.commit();
      }
      const control = {} as HTMLButtonElement;
      f.documentMock.activeElement = control;
      let reentered = false;
      const unsubscribe = f.model.subscribe(() => {
        if (!["reentrant", "reentrant-aba"].includes(boundary) || reentered)
          return;
        reentered = true;
        const entry = f.model.getSnapshot().selected!.entry;
        if (entry.status === "completed") f.workspace.followups.reopen(entry);
        else
          f.workspace.followups.complete(
            entry,
            new Date("2026-10-24T12:00:00Z"),
          );
        if (boundary === "reentrant-aba") {
          const replacement = f.model.getSnapshot().selected!.entry;
          if (action === "complete")
            f.workspace.followups.complete(
              replacement,
              new Date("2026-10-24T12:00:00Z"),
            );
          else f.workspace.followups.reopen(replacement);
        }
      });
      f.click(page.button(action), control);
      unsubscribe();
      if (boundary === "body")
        f.documentMock.activeElement = f.documentMock.body;
      if (boundary === "other-focus") f.documentMock.activeElement = {};
      if (boundary === "hidden") f.target.closest = () => ({}) as never;
      if (boundary === "disconnected") f.target.isConnected = false;
      if (boundary === "later-edit")
        f.workspace.followups.edit(
          f.model.getSnapshot().selected!.entry,
          "result",
          "Edited before commit",
        );
      if (boundary === "route") f.routeActive.mockReturnValue(false);
      f.render();
      f.commit();
      expect(f.focus, `${action}: ${boundary}`).toHaveBeenCalledTimes(
        ["owned", "body"].includes(boundary) ? 1 : 0,
      );
      hooks.cleanups.forEach((cleanup) => cleanup());
      hooks.refs = [];
      hooks.effects = [];
      hooks.cleanups = [];
    }
  },
);

it.each(["Invalid\nraw result", "x".repeat(2001)])(
  "keeps invalid raw assessment unchanged through completion and retains Save refusal",
  async (raw) => {
    const f = await fixture();
    f.start();
    f.workspace.followups.edit(
      f.model.getSnapshot().selected!.entry,
      "result",
      raw,
    );
    const page = f.render();
    f.commit();
    f.click(page.button("complete"));
    expect(f.model.getSnapshot().selected!.entry).toMatchObject({
      result: raw,
      status: "completed",
      completedOn: "2026-10-24",
    });
    await f.workspace.followups.coordinator.save();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(
      f.workspace.followups.coordinator
        .getSnapshot()
        .draft!.entries.find((entry) => entry.id === f.entries[1]!.id)!.result,
    ).toBe(raw);
  },
);

it.each(["complete", "reopen"] as const)(
  "consumes %s before reentrant notifications can invoke it again",
  async (action) => {
    const f = await fixture();
    let page = f.start();
    if (action === "reopen") {
      f.click(page.button("complete"));
      page = f.render();
      f.commit();
    }
    const captured = page.button(action);
    const write = vi.spyOn(f.workspace.followups, action);
    const unsubscribe = f.model.subscribe(() => f.click(captured));
    f.click(captured);
    unsubscribe();
    expect(write).toHaveBeenCalledOnce();
    expect(f.model.getSnapshot().selected!.entry.status).toBe(
      action === "complete" ? "completed" : "open",
    );
  },
);
