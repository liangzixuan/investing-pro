import * as React from "react";
import { cpiHeadlinesFixture } from "./cpi-headlines-fixture";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { ManagedCpiFollowupForm } from "./ManagedCpiFollowupForm";
import type { CalendarFormProps } from "./ManagedCalendarFollowupFormState";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
  subscriptions: [] as unknown[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return {
    ...actual,
    ...createValuationDraftTestHooks(hooks),
    useSyncExternalStore: (subscribe: unknown, snapshot: () => unknown) => {
      hooks.subscriptions.push(subscribe);
      return snapshot();
    },
  };
});
interface Props {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  value?: string;
  open?: boolean;
  onClick?: () => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  onToggle?: (event: { currentTarget: { open: boolean } }) => void;
}
function elements(node: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(node)) return [];
  if (typeof node.type === "function")
    return elements(
      (node.type as (props: Props) => React.ReactNode)(node.props),
    );
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
function unmount() {
  for (const slot of hooks.slots) {
    if (!slot || typeof slot !== "object") continue;
    if (!("cleanup" in slot)) continue;
    if (typeof slot.cleanup !== "function") continue;
    (slot.cleanup as () => void)();
  }
}
const workspaces: ManagedWorkspace[] = [];
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  hooks.subscriptions = [];
});
afterEach(() => {
  unmount();
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
  vi.unstubAllGlobals();
});
function renderer(props: CalendarFormProps) {
  return (override: Partial<CalendarFormProps> = {}, commit = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedCpiFollowupForm({ ...props, ...override });
    if (commit) for (const effect of hooks.effects) effect();
    const all = elements(tree);
    const byId = (suffix: string) => {
      const node = all.find(
        (item) => item.props.id === `cpi-followup-${suffix}`,
      );
      if (!node) throw new Error(`Missing CPI control ${suffix}`);
      return node;
    };
    return {
      tree,
      all,
      html: load(renderToStaticMarkup(tree)),
      byId,
      change: (suffix: string, value: string) =>
        byId(suffix).props.onChange!({ currentTarget: { value } }),
      click: (suffix: string) => {
        const node = byId(suffix);
        expect(node.props.disabled).not.toBe(true);
        node.props.onClick!();
      },
    };
  };
}
async function fixture(kind: "known" | "unknown" = "known") {
  const original = await createFixture("research-followups");
  const feed = cpiHeadlinesFixture();
  const loadFollowups = vi.fn(original.api.loadFollowups);
  const workspace = new ManagedWorkspace(
    {
      ...original.api,
      cpiHeadlines: vi.fn().mockResolvedValue(feed),
      loadFollowups,
    },
    original.session,
    undefined,
    {
      researchCoverage: inventedManagedResearchCoverage,
      priceCoverage: original.priceCoverage,
      marketsCohort: original.marketsCohort,
    },
  );
  workspaces.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("markets");
  await workspace.cpiHeadlines.load();
  let visible = true;
  const result = workspace.captureCpiHeadlineSource(
    feed.items[kind === "known" ? 0 : 1]!.url,
    () => visible,
  );
  if (!result.capture) throw new Error(result.reason ?? "Missing CPI capture");
  const props: CalendarFormProps = {
    workspace,
    capture: result.capture,
    isCurrent: () => visible,
    navigationPending: false,
    onReview: vi.fn(),
    onManageWatchlist: vi.fn(),
    onClose: vi.fn(),
  };
  return {
    original,
    loadFollowups,
    workspace,
    props,
    render: renderer(props),
    hide: () => {
      visible = false;
    },
    show: () => {
      visible = true;
    },
    member: workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  };
}
function author(
  f: Awaited<ReturnType<typeof fixture>>,
  question = "Does café 📈 change the demand case?",
) {
  f.render().change("company", f.member.listingId);
  f.render().change("question", question);
  f.render().change("due", "2026-12-01");
}
async function ready(f: Awaited<ReturnType<typeof fixture>>) {
  author(f);
  f.render().click("load");
  await vi.waitFor(() =>
    expect(
      f.workspace.followups.coordinator.getSnapshot().draft,
    ).not.toBeNull(),
  );
}
it("starts closed without a source and never chooses or loads a company implicitly", async () => {
  const f = await fixture();
  const empty = f.render({ capture: null });
  expect(empty.html("#managed-cpi-followup")).toHaveLength(0);
  expect(empty.html("#cpi-followup-company")).toHaveLength(0);
  expect(f.original.followups!.getSnapshot().load).toBe(0);
});
it("opens the chosen source with distinct clocks and no default company, preserving raw fields through explicit initial Load", async () => {
  const f = await fixture();
  const first = f.render();
  expect(first.html("details").first().attr("open")).toBeDefined();
  expect(first.byId("company").props.value).toBe("");
  expect(first.html.text()).toContain(
    "Feed published time2026-10-01T07:15:22.123456-04:00",
  );
  expect(first.html.text()).toContain(
    "Retrieved (UTC)2026-10-28T19:00:00.000Z",
  );
  expect(first.byId("load").props.disabled).toBe(true);
  author(f);
  const before = f.render();
  before.click("load");
  await vi.waitFor(() =>
    expect(
      f.workspace.followups.coordinator.getSnapshot().draft,
    ).not.toBeNull(),
  );
  const loaded = f.render();
  expect(loaded.byId("company").props.value).toBe(f.member.listingId);
  expect(loaded.byId("question").props.value).toBe(
    "Does café 📈 change the demand case?",
  );
  expect(loaded.byId("due").props.value).toBe("2026-12-01");
  expect(f.original.followups!.getSnapshot().load).toBe(1);
});
it("previews the whole independently cited question and creates once without saving or changing My Watchlist", async () => {
  const f = await fixture();
  await ready(f);
  const watchlist = f.workspace.coordinator.getSnapshot().draft;
  f.render().click("preview");
  const preview = f.render();
  const check =
    "Question: Does café 📈 change the demand case? | U.S. Bureau of Labor Statistics CPI headline: Invented CPI headline: prices and household plans. Feed published: 2026-10-01T07:15:22.123456-04:00; feed updated: 2026-10-02T09:45:10.1200+05:30. https://www.bls.gov/news.release/archives/cpi_10012026.htm";
  expect(preview.byId("check").props.value).toBe(check);
  expect(preview.html.text()).toContain(f.member.securityId);
  const create = preview.byId("create").props.onClick!;
  create();
  create();
  const entries =
    f.workspace.followups.coordinator.getSnapshot().draft!.entries;
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    check,
    dueOn: "2026-12-01",
    listing: { listingId: f.member.listingId },
    status: "open",
    result: "",
  });
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(watchlist);
  f.render().click("review");
  expect(f.props.onReview).toHaveBeenCalledExactlyOnceWith(entries[0]);
  expect(f.original.getSnapshot().save).toBe(0);
  expect(f.original.followups!.getSnapshot().save).toBe(0);
});
it("retains an unknown publication clock and the exact complete source URL", async () => {
  const f = await fixture("unknown");
  await ready(f);
  f.render().click("preview");
  const result = f.render();
  expect(result.html.text()).toContain("Feed published timeUnknown");
  expect(result.byId("check").props.value).toBe(
    "Question: Does café 📈 change the demand case? | U.S. Bureau of Labor Statistics CPI headline: Invented CPI headline without source clocks. Feed published: unknown; feed updated: unknown. https://www.bls.gov/news.release/archives/cpi_09012026.htm",
  );
});
it.each(["📈".repeat(500), "Question\nwith newline", "Question\u0000control"])(
  "keeps invalid or oversized raw text without clipping or a create action",
  async (question) => {
    const f = await fixture();
    await ready(f);
    f.render().change("question", question);
    f.render().click("preview");
    const result = f.render();
    expect(result.byId("question").props.value).toBe(question);
    expect(result.html("#cpi-followup-check")).toHaveLength(0);
    expect(result.html.text()).toContain("Nothing was clipped or changed");
    expect(
      f.workspace.followups.coordinator.getSnapshot().draft!.entries,
    ).toHaveLength(0);
  },
);
it("retires a retained Create on question edit, cancel/close and reopen", async () => {
  const f = await fixture();
  await ready(f);
  f.render().click("preview");
  const create = f.render().byId("create").props.onClick!;
  f.render().change("question", "A different exact question");
  create();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
  f.render().click("preview");
  const second = f.render().byId("create").props.onClick!;
  f.render().click("cancel");
  second();
  const closed = f.render();
  expect(closed.html("details").first().attr("open")).toBeUndefined();
  closed.all.find((node) => node.type === "details")!.props.onToggle!({
    currentTarget: { open: true },
  });
  second();
  expect(f.render().html("#cpi-followup-create")).toHaveLength(0);
});
it("refuses old callbacks after hidden navigation, pending navigation, source retirement and unmount", async () => {
  const f = await fixture();
  await ready(f);
  f.render().click("preview");
  const create = f.render().byId("create").props.onClick!;
  f.hide();
  create();
  f.render();
  f.show();
  create();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
  const pending = f.render({ navigationPending: true });
  expect(pending.byId("preview").props.disabled).toBe(true);
  create();
  unmount();
  create();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
});
it("does not retarget a chosen member when an exact Watchlist draft object is replaced", async () => {
  const f = await fixture();
  await ready(f);
  f.render().click("preview");
  const oldCreate = f.render().byId("create").props.onClick!;
  const saved = f.workspace.coordinator.getSnapshot().draft!;
  f.workspace.coordinator.replaceDraft({
    ...saved,
    memberships: saved.memberships.map((member) => ({ ...member })),
  });
  oldCreate();
  const result = f.render();
  expect(result.byId("question").props.value).toBe(
    "Does café 📈 change the demand case?",
  );
  expect(result.byId("preview").props.disabled).toBe(true);
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
});
it("ignores handlers from an uncommitted render and cancels an owned preview on replacement", async () => {
  const f = await fixture();
  await ready(f);
  const abandoned = f.render({}, false);
  abandoned.byId("preview").props.onClick!();
  expect(f.render().html("#cpi-followup-check")).toHaveLength(0);
  f.render().click("preview");
  const create = f.render().byId("create").props.onClick!;
  f.render({ capture: null });
  create();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
});
it("preserves the raw form after an explicit failed Follow-ups load", async () => {
  const f = await fixture();
  author(f);
  f.loadFollowups.mockRejectedValueOnce(
    new Error("Invented unavailable resource"),
  );
  f.render().click("load");
  await vi.waitFor(() =>
    expect(f.workspace.followups.coordinator.getSnapshot().phase).not.toBe(
      "loading",
    ),
  );
  const result = f.render();
  expect(result.byId("question").props.value).toBe(
    "Does café 📈 change the demand case?",
  );
  expect(result.byId("due").props.value).toBe("2026-12-01");
  expect(result.byId("company").props.value).toBe(f.member.listingId);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(result.html("#cpi-followup-create")).toHaveLength(0);
});
