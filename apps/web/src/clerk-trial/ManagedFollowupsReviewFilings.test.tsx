import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load as html } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedFollowupsReviewFilings as Panel } from "./ManagedFollowupsReviewFilings";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";

// Controlled hook commits exercise actual workspace/model callbacks. No browser
// mounting, layout or native input acceptance is claimed by this harness.
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
    useRef: (value: unknown) =>
      hooks.direct
        ? (hooks.refs[hooks.index++] ??= { current: value })
        : actual.useRef(value),
    useLayoutEffect: (
      effect: () => void | (() => void),
      deps?: React.DependencyList,
    ) => {
      if (hooks.direct) hooks.effects.push(effect);
      else actual.useLayoutEffect(effect, deps);
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
  vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
});
afterEach(() => {
  hooks.cleanups.forEach((off) => off());
  fixtures.splice(0).forEach((f) => f.dispose());
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
  f.model.enter();
  const choices = f.model.getSnapshot().rows;
  f.model.choose(f.model.getSnapshot(), choices[0]!.handle);
  f.model.choose(f.model.getSnapshot(), choices[1]!.handle);
  f.model.start(f.model.getSnapshot());
  const model = f.workspace.reviewFilings;
  const routeActive = vi.fn(() => true);
  const onInspect = vi.fn();
  const documentMock = { body: {}, activeElement: {} as unknown };
  vi.stubGlobal("document", documentMock);
  const focus = vi.fn();
  const target = {
    isConnected: true,
    closest: (): unknown => null,
    getClientRects: () => [{}],
    focus,
  };
  const packet = filingsResponse(26, "available", {
    ...filingsSelection,
    listing: f.entries[0]!.listing,
    catalogSnapshotSha256: f.entries[0]!.catalogSnapshotSha256,
  });
  vi.mocked(f.api.recentFilings).mockResolvedValue(packet);
  const render = (active = true) => {
    hooks.direct = true;
    hooks.index = 0;
    hooks.effects = [];
    const node = Panel({
      workspace: f.workspace,
      active,
      routeActive,
      onInspect,
    });
    hooks.direct = false;
    hooks.refs[0]!.current = target;
    return {
      node,
      html: renderToStaticMarkup(node),
      button: (name: string) => {
        const b = buttons(node).find(
          (v) => v.props.id === `managed-followups-review-filings-${name}`,
        );
        if (!b) throw new Error(name);
        return b;
      },
    };
  };
  const commit = () => {
    hooks.cleanups.forEach((off) => off());
    hooks.cleanups = hooks.effects.flatMap((effect) => {
      const off = effect();
      return off ? [off] : [];
    });
  };
  const click = (b: Button, control = {} as HTMLButtonElement) => {
    b.props.onClick({ currentTarget: control });
  };
  return {
    ...f,
    model,
    routeActive,
    onInspect,
    documentMock,
    target,
    focus,
    packet,
    render,
    commit,
    click,
  };
}
it("renders explicit unloaded actions without requesting a source or saving a draft", async () => {
  const f = await fixture();
  const page = f.render();
  f.commit();
  expect(page.button("load").props.disabled).toBe(false);
  expect(page.button("inspect").props.disabled).toBe(true);
  expect(page.button("cancel").props.disabled).toBe(true);
  expect(page.html).toContain("Load review filings");
  expect(page.html).toContain("0 of 2 chosen checks");
  for (const api of [
    f.api.recentFilings,
    f.api.eodHistory,
    f.api.annualReport,
    f.api.saveFollowups,
  ])
    expect(api).not.toHaveBeenCalled();
  expect(f.focus).not.toHaveBeenCalled();
});
it("renders every original filing, raw identity, source clock and qualification with unique IDs", async () => {
  const f = await fixture();
  await f.model.load(f.model.getSnapshot());
  const page = f.render();
  f.commit();
  const view = html(page.html);
  expect(view(".managed-followups-review-filings-list > li")).toHaveLength(26);
  for (const filing of f.packet.issuer.filings) {
    expect(view.text()).toContain(filing.accessionNumber);
    expect(view.text()).toContain(filing.filingDate);
    expect(
      view("a")
        .map((_, e) => view(e).attr("href"))
        .get(),
    ).toContain(filing.sourceUrl);
  }
  for (const value of [
    f.packet.requestStartedAt,
    f.packet.completedAt,
    f.packet.issuer.fetchedAt,
    f.packet.window.fromDate,
    f.packet.window.throughDate,
    ...Object.values(f.packet.security),
  ])
    expect(view.text()).toContain(value);
  expect(view.text()).toContain(
    "Older continuation files and filing bodies were not loaded",
  );
  expect(view.text()).toContain("does not establish complete coverage");
  const ids = view("[id]")
    .map((_, e) => view(e).attr("id"))
    .get();
  expect(new Set(ids).size).toBe(ids.length);
  expect(page.button("inspect").props.disabled).toBe(false);
  expect(f.focus).not.toHaveBeenCalled();
});
it.each(["uncommitted", "inactive", "route", "state", "unmounted"] as const)(
  "rejects stale UI actions after %s",
  async (boundary) => {
    const f = await fixture();
    await f.model.load(f.model.getSnapshot());
    let page = f.render();
    f.commit();
    if (boundary === "uncommitted") page = f.render();
    if (boundary === "inactive") {
      f.render(false);
      f.commit();
    }
    if (boundary === "route") f.routeActive.mockReturnValue(false);
    if (boundary === "state") f.model.reconcile();
    if (boundary === "unmounted") hooks.cleanups.forEach((off) => off());
    const reads = vi.mocked(f.api.recentFilings).mock.calls.length;
    f.click(page.button("load"));
    f.click(page.button("inspect"));
    f.click(page.button("cancel"));
    expect(f.api.recentFilings).toHaveBeenCalledTimes(reads);
    expect(f.onInspect).not.toHaveBeenCalled();
    expect(f.focus).not.toHaveBeenCalled();
  },
);
it("sends the exact committed state and opener to Inspect once, without another source request", async () => {
  const f = await fixture();
  await f.model.load(f.model.getSnapshot());
  const page = f.render();
  f.commit();
  const captured = f.model.getSnapshot();
  const opener = {} as HTMLButtonElement;
  f.click(page.button("inspect"), opener);
  f.click(page.button("inspect"), opener);
  expect(f.onInspect).toHaveBeenCalledExactlyOnceWith(captured, opener);
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
  expect(f.api.resolve).not.toHaveBeenCalled();
});
it("keeps cancelled previous evidence and its original clocks, then ignores the late response", async () => {
  const f = await fixture();
  await f.model.load(f.model.getSnapshot());
  const previous = f.model.getSnapshot().selected!.filings.response;
  let resolve!: (value: typeof f.packet) => void;
  vi.mocked(f.api.recentFilings).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  let page = f.render();
  f.commit();
  f.click(page.button("load"));
  page = f.render();
  f.commit();
  expect(page.button("cancel").props.disabled).toBe(false);
  f.click(page.button("cancel"));
  resolve(
    filingsResponse(0, "available", {
      ...filingsSelection,
      listing: f.entries[0]!.listing,
      catalogSnapshotSha256: f.entries[0]!.catalogSnapshotSha256,
    }),
  );
  await Promise.resolve();
  await Promise.resolve();
  page = f.render();
  f.commit();
  expect(f.model.getSnapshot().selected!.filings.response).toBe(previous);
  expect(page.html).toContain("Showing the previous response completed");
  expect(page.html).toContain(f.packet.completedAt);
});
it.each([
  "owned",
  "body",
  "moved",
  "hidden",
  "disconnected",
  "reentrant",
] as const)("focuses only the exact action commit (%s)", async (boundary) => {
  const f = await fixture();
  vi.mocked(f.api.recentFilings).mockReturnValueOnce(new Promise(() => {}));
  const page = f.render();
  f.commit();
  const button = {} as HTMLButtonElement;
  f.documentMock.activeElement = button;
  let changed = false;
  const off = f.model.subscribe(() => {
    if (boundary === "reentrant" && !changed) {
      changed = true;
      f.workspace.followups.edit(
        f.model.getSnapshot().selected!.entry,
        "result",
        "Changed during publication",
      );
    }
  });
  f.click(page.button("load"), button);
  off();
  if (boundary === "body") f.documentMock.activeElement = f.documentMock.body;
  if (boundary === "moved") f.documentMock.activeElement = {};
  if (boundary === "hidden") f.target.closest = () => ({});
  if (boundary === "disconnected") f.target.isConnected = false;
  f.render();
  f.commit();
  expect(f.focus).toHaveBeenCalledTimes(
    ["owned", "body"].includes(boundary) ? 1 : 0,
  );
});
it("keeps unsupported and verified-empty evidence distinct", async () => {
  const f = await fixture();
  vi.mocked(f.api.recentFilings).mockResolvedValueOnce({
    ...f.packet,
    issuer: { ...f.packet.issuer, filings: [], matchingFilings: 0 },
  });
  await f.model.load(f.model.getSnapshot());
  let page = f.render();
  f.commit();
  expect(page.html).toContain("No matching filings were observed");
  f.workspace.followupsReview.continue(
    f.workspace.followupsReview.getSnapshot(),
  );
  page = f.render();
  f.commit();
  expect(page.html).not.toContain("No matching filings were observed");
  expect(page.html).toContain(
    "Filings are not available for this listing in this workspace.",
  );
});

it("escapes complete source display text without interpreting HTML", async () => {
  const f = await fixture();
  const state = f.model.getSnapshot();
  const row = state.selected!;
  const raw = "<script>invented & unexecuted</script>";
  const displayed = {
    ...row,
    entry: { ...row.entry, listing: { ...row.entry.listing, issuerName: raw } },
  };
  const read = vi.spyOn(f.model, "getSnapshot").mockReturnValue({
    ...state,
    selected: displayed,
    rows: [displayed, ...state.rows.slice(1)],
  });
  const page = f.render();
  const view = html(page.html);
  expect(view.text()).toContain(raw);
  expect(view("script")).toHaveLength(0);
  expect(page.html).toContain("&lt;script&gt;");
  read.mockRestore();
});
