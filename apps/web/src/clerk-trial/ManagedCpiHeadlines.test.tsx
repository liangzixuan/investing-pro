import * as React from "react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import {
  ManagedCpiHeadlines,
  type ManagedCpiHeadlinesProps,
} from "./ManagedCpiHeadlines";
import { ManagedCpiHeadlineList } from "./ManagedCpiHeadlineList";
import { ManagedCpiFollowupForm } from "./ManagedCpiFollowupForm";
import { cpiHeadlinesFixture } from "./cpi-headlines-fixture";
const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return { ...actual, ...createValuationDraftTestHooks(hooks) };
});
interface Props {
  id?: string;
  children?: React.ReactNode;
  onClick?: (e: { currentTarget: HTMLElement }) => void;
  onChange?: (e: { currentTarget: { value: string } }) => void;
  disabled?: boolean;
}
function elements(node: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(node)) return [];
  if (node.type === ManagedCpiHeadlineList)
    return elements(
      ManagedCpiHeadlineList(
        node.props as React.ComponentProps<typeof ManagedCpiHeadlineList>,
      ),
    );
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
const workspaces: ManagedWorkspace[] = [];
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
afterEach(() => {
  for (const w of workspaces.splice(0)) w.sessionOwner.dispose();
});
async function fixture() {
  const base = await createFixture("research-followups");
  const read = vi.fn().mockResolvedValue(cpiHeadlinesFixture());
  const workspace = new ManagedWorkspace(
    { ...base.api, cpiHeadlines: read },
    base.session,
  );
  workspaces.push(workspace);
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  const props: ManagedCpiHeadlinesProps = {
    workspace,
    isCurrent: () => true,
    navigationPending: false,
    onReview: vi.fn(),
    onManageWatchlist: vi.fn(),
  };
  const render = (
    override: Partial<ManagedCpiHeadlinesProps> = {},
    commit = true,
  ) => {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedCpiHeadlines({ ...props, ...override });
    if (commit) hooks.effects.forEach((effect) => effect());
    const all = elements(tree);
    const byId = (id: string) => {
      const node = all.find((n) => n.props.id === id);
      if (!node) throw new Error(id);
      return node;
    };
    return { tree, all, byId };
  };
  return { base, read, workspace, render };
}
it("does not read on opening or filtering; only explicit Load and Refresh use the source", async () => {
  const f = await fixture();
  const initial = f.render();
  initial.byId("cpi-headlines-filter").props.onChange!({
    currentTarget: { value: "prices" },
  });
  expect(f.read).not.toHaveBeenCalled();
  expect(renderToStaticMarkup(f.render().tree)).toContain("not been loaded");
  f.render().byId("cpi-headlines-load").props.onClick!({
    currentTarget: {} as HTMLElement,
  });
  await vi.waitFor(() =>
    expect(f.workspace.cpiHeadlines.getSnapshot().busy).toBe(false),
  );
  expect(f.read).toHaveBeenCalledOnce();
  const shown = f.render();
  expect(renderToStaticMarkup(shown.tree)).toContain("Feed updated time");
  expect(renderToStaticMarkup(shown.tree)).toContain(
    "2026-10-02T09:45:10.1200+05:30",
  );
  expect(f.base.followups!.getSnapshot().load).toBe(0);
  shown.byId("cpi-headlines-load").props.onClick!({
    currentTarget: {} as HTMLElement,
  });
  await vi.waitFor(() => expect(f.read).toHaveBeenCalledTimes(2));
});
it("captures only the explicit current headline, never a request or default company, and filter ABA retires it", async () => {
  const f = await fixture();
  await f.workspace.cpiHeadlines.load();
  const tree = f.render();
  const keep = tree.all.find(
    (n) => n.type === "button" && n.props.children === "Keep a dated check",
  )!;
  keep.props.onClick!({ currentTarget: {} as HTMLElement });
  const next = f.render();
  const child = next.all.find((n) => n.type === ManagedCpiFollowupForm)!;
  const capture = (
    child.props as React.ComponentProps<typeof ManagedCpiFollowupForm>
  ).capture!;
  expect(capture.source.kind).toBe("cpi");
  expect(capture.isCurrent()).toBe(true);
  expect(f.read).toHaveBeenCalledOnce();
  next.byId("cpi-headlines-filter").props.onChange!({
    currentTarget: { value: "missing" },
  });
  f.render().byId("cpi-headlines-filter").props.onChange!({
    currentTarget: { value: "" },
  });
  expect(capture.isCurrent()).toBe(false);
  expect(f.read).toHaveBeenCalledOnce();
});
it("distinguishes checked-empty from filter-no-match and refuses uncommitted/pending read callbacks", async () => {
  const f = await fixture();
  f.read.mockResolvedValueOnce({
    ...cpiHeadlinesFixture(),
    availableItemCount: 0,
    items: [],
  });
  const abandoned = f.render({}, false);
  abandoned.byId("cpi-headlines-load").props.onClick!({
    currentTarget: {} as HTMLElement,
  });
  expect(f.read).not.toHaveBeenCalled();
  f.render({ navigationPending: true }).byId("cpi-headlines-load").props
    .onClick!({ currentTarget: {} as HTMLElement });
  expect(f.read).not.toHaveBeenCalled();
  await f.workspace.cpiHeadlines.load();
  expect(renderToStaticMarkup(f.render().tree)).toContain(
    "Checked: no CPI headlines",
  );
  await f.workspace.cpiHeadlines.load();
  f.render().byId("cpi-headlines-filter").props.onChange!({
    currentTarget: { value: "no matching term" },
  });
  const rendered = f.render();
  const list = rendered.all.find((n) => n.type === ManagedCpiHeadlineList);
  expect(list).toBeUndefined();
  expect(renderToStaticMarkup(rendered.tree)).toContain(
    "No loaded CPI headlines match this filter",
  );
});
