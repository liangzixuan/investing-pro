import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedFollowupsReviewSession as Panel } from "./ManagedFollowupsReviewSession";
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
  const start = () => {
    let page = render();
    commit();
    click(page.button("enter"));
    page = render();
    commit();
    click(page.button(`choose-${f.entries[1]!.id}`));
    page = render();
    commit();
    click(page.button(`choose-${f.entries[0]!.id}`));
    page = render();
    commit();
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
