import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedFollowupReviewNote } from "./ManagedFollowupReviewNote";
import type { FollowupReviewNoteContext } from "./managed-followup-review-note-context";
import { eodSelection } from "./eod-history-fixture";

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
  onClick?: () => void;
  onToggle?: (event: { currentTarget: { open: boolean } }) => void;
}
function elements(node: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
function render(context: FollowupReviewNoteContext, commit = true) {
  hooks.index = 0;
  hooks.effects = [];
  const tree = ManagedFollowupReviewNote({ context });
  if (commit) for (const effect of hooks.effects) effect();
  return {
    tree,
    html: load(renderToStaticMarkup(tree)),
    byId: (id: string) => elements(tree).find((node) => node.props.id === id)!,
  };
}
function fixture() {
  let current = true;
  const note =
    "  Cafe\u0301 source 2026-09-20  Complete question and authored assessment 東京 😀";
  const preview = {
    note,
    excerpt: "Complete question and authored assessment 東京 😀",
    recordedAt: "2026-10-26T02:00:00.123Z",
    isCurrent: () => current,
    append: vi.fn(() => {
      if (!current) return false;
      current = false;
      return true;
    }),
    cancel: vi.fn(() => {
      current = false;
    }),
  };
  const context: FollowupReviewNoteContext = {
    entry: {
      id: "check-one",
      catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
      listing: eodSelection.listing,
      check: "Complete question",
      dueOn: "2026-10-20",
      status: "open",
      completedOn: null,
      result: "Authored assessment",
    },
    reason: null,
    prepare: vi.fn(() => ({ preview, reason: null })),
  };
  return {
    context,
    preview,
    retire: () => {
      current = false;
    },
  };
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
function hasCleanup(slot: unknown): slot is { cleanup: () => void } {
  return (
    slot !== null &&
    typeof slot === "object" &&
    "cleanup" in slot &&
    typeof slot.cleanup === "function"
  );
}
afterEach(() => {
  for (const slot of hooks.slots) if (hasCleanup(slot)) slot.cleanup();
});

it("starts closed, shows exact identity and separate-date/save guidance, and previews the entire raw note", () => {
  const f = fixture();
  let view = render(f.context);
  expect(view.html("details").attr("open")).toBeUndefined();
  expect(view.html("summary").text()).toBe("Keep assessment in company note");
  expect(view.html.root().text()).toContain(
    "Source dates, due dates and completion dates stay unchanged",
  );
  expect(view.html.root().text()).toContain("ZERO · Class A · XNAS");
  expect(view.html("textarea")).toHaveLength(0);
  view.byId("managed-followup-note-preview-action").props.onClick!();
  view = render(f.context);
  expect(view.html("label").attr("for")).toBe("managed-followup-note-preview");
  expect(view.html("textarea").text()).toBe(f.preview.note);
  expect(view.html("textarea").attr("readonly")).toBeDefined();
  expect(f.preview.append).not.toHaveBeenCalled();
});
it("appends once and fences the old click after local state is cleared", () => {
  const f = fixture();
  let view = render(f.context);
  view.byId("managed-followup-note-preview-action").props.onClick!();
  view = render(f.context);
  const click = view.byId("managed-followup-note-append").props.onClick!;
  click();
  click();
  view = render(f.context);
  expect(f.preview.append).toHaveBeenCalledOnce();
  expect(view.html("textarea")).toHaveLength(0);
  expect(view.html.root().text()).toContain(
    "save My Watchlist and Follow-ups separately",
  );
});
it("Cancel and closing the disclosure consume the private preview without append", () => {
  for (const close of [false, true]) {
    hooks.index = 0;
    hooks.slots = [];
    hooks.effects = [];
    const f = fixture();
    let view = render(f.context);
    view.byId("managed-followup-note-preview-action").props.onClick!();
    view = render(f.context);
    const old = view.byId("managed-followup-note-append").props.onClick!;
    if (close)
      (view.tree.props as Props).onToggle!({ currentTarget: { open: false } });
    else
      elements(view.tree).find(
        (node) =>
          node.type === "button" && node.props.children === "Keep current note",
      )!.props.onClick!();
    old();
    expect(f.preview.cancel).toHaveBeenCalledOnce();
    expect(f.preview.append).not.toHaveBeenCalled();
    expect(render(f.context).html("textarea")).toHaveLength(0);
  }
});
it("hides retired content, keeps refusals visible and ignores abandoned-render controls", () => {
  const f = fixture();
  let view = render(f.context);
  view.byId("managed-followup-note-preview-action").props.onClick!();
  f.retire();
  view = render(f.context);
  expect(view.html("textarea")).toHaveLength(0);
  expect(view.html.root().text()).toContain("no longer matches");
  const other = fixture();
  const abandoned = render(other.context, false);
  abandoned.byId("managed-followup-note-preview-action").props.onClick!();
  expect(other.context.prepare).not.toHaveBeenCalled();
  const blocked = {
    ...f.context,
    reason: "Resolve the pending My Watchlist save.",
  };
  view = render(blocked);
  expect(
    view.html("#managed-followup-note-preview-action").attr("disabled"),
  ).toBeDefined();
  expect(view.html.root().text()).toContain(
    "Resolve the pending My Watchlist save.",
  );
});
