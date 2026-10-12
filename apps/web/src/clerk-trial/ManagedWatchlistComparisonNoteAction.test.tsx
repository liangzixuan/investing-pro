import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ManagedWatchlistComparisonNoteAction,
  type ManagedWatchlistComparisonNoteActions,
} from "./ManagedWatchlistComparisonNoteAction";
import type { ManagedWatchlistComparisonSelection } from "./managed-watchlist-comparison";
import { eodResponse, eodSelection } from "./eod-history-fixture";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  stateIndex: 0,
  ref: { current: null },
  changed: false,
  effect: undefined as undefined | (() => () => void),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useId: () => "comparison-note-help",
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.changed ||= next !== hooks.states[index];
        hooks.states[index] = next;
      },
    ];
  },
  useRef: () => hooks.ref,
  useLayoutEffect: (effect: () => () => void) => {
    hooks.effect = effect;
  },
}));
afterEach(() => {
  hooks.states = [];
  hooks.ref.current = null;
  hooks.effect = undefined;
});

function pair(): ManagedWatchlistComparisonSelection {
  const left = {
    handle: Symbol("left"),
    listing: {
      ...eodSelection.listing,
      symbol: "SAME",
      shareClassName: "Class A",
    },
    catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
    response: eodResponse(),
  };
  const right = {
    ...left,
    handle: Symbol("right"),
    listing: {
      ...left.listing,
      listingId: "listing-class-c",
      securityId: "security-class-c",
      shareClassId: "class-c",
      shareClassName: "Class C",
    },
    response: eodResponse(),
  };
  return {
    left,
    right,
    startDate: "2026-09-17",
    endDate: "2026-09-19",
    hadHistory: true,
    resetNotice: false,
    refusal: null,
  };
}
type Props = React.ComponentProps<typeof ManagedWatchlistComparisonNoteAction>;
function harness() {
  const selection = pair();
  const actions: ManagedWatchlistComparisonNoteActions = {
    getAction: vi.fn((_, destination) => ({
      canAppend: destination !== null,
      reason: destination ? null : "Choose a note.",
    })),
    append: vi.fn(() => ({
      appended: true,
      message: "Added to the chosen draft. Review and Save.",
    })),
  };
  let props: Props = { selection, active: true, editable: true, actions };
  let cleanup: (() => void) | undefined;
  const render = (changes: Partial<Props> = {}) => {
    props = { ...props, ...changes };
    let node: ReturnType<typeof ManagedWatchlistComparisonNoteAction>;
    for (let i = 0; i < 3; i++) {
      hooks.stateIndex = 0;
      hooks.changed = false;
      node = ManagedWatchlistComparisonNoteAction(props);
      if (!hooks.changed) break;
    }
    cleanup?.();
    cleanup = hooks.effect?.();
    return node!;
  };
  const children = (
    node: React.ReactElement<{ children: React.ReactNode }> = render(),
  ) => React.Children.toArray(node.props.children);
  const select = (node = render()) =>
    children(node).find(
      (child) => React.isValidElement(child) && child.type === "select",
    ) as React.ReactElement<React.ComponentProps<"select">>;
  const button = (node = render()) =>
    children(node).find(
      (child) => React.isValidElement(child) && child.type === "button",
    ) as React.ReactElement<{ onClick: () => void }>;
  const change = (value: string, node = render()) =>
    select(node).props.onChange!({
      currentTarget: { value },
    } as React.ChangeEvent<HTMLSelectElement>);
  return {
    selection,
    actions,
    render,
    select,
    button,
    change,
    unmount: () => cleanup?.(),
    html: (node = render()) => renderToStaticMarkup(node),
  };
}

describe("watchlist comparison note destination", () => {
  it("starts empty and offers only the two full exact pair identities, including equal-symbol share classes", () => {
    const h = harness();
    expect(h.select().props.value).toBe("");
    const html = h.html();
    expect(html).toContain(
      'for="managed-watchlist-comparison-note-destination"',
    );
    expect(html.match(/<option /gu)).toHaveLength(3);
    expect(html).toContain("Class A");
    expect(html).toContain("Class C");
    expect(html).toContain("XNAS");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/\sdisabled=/u);
    expect(h.actions.append).not.toHaveBeenCalled();
  });

  it("appends only to the explicitly chosen second member, using the captured interval and latest port", () => {
    const h = harness();
    h.change(h.selection.right!.listing.listingId);
    const oldClick = h.button().props.onClick;
    const fresh = {
      ...h.actions,
      append: vi.fn(() => ({
        appended: true,
        message: "Latest raw note preserved.",
      })),
    };
    h.render({ actions: fresh });
    oldClick();
    expect(fresh.append).toHaveBeenCalledExactlyOnceWith(
      h.selection,
      h.selection.right!.listing,
    );
    expect(h.actions.append).not.toHaveBeenCalled();
    expect(h.html()).toContain("Latest raw note preserved.");
  });

  it("retains destination for date edits but fences the old date callback and clears old feedback", () => {
    const h = harness();
    h.change(h.selection.right!.listing.listingId);
    const old = h.render();
    h.button(old).props.onClick();
    const changed = { ...h.selection, endDate: "2026-09-18" };
    const fresh = h.render({ selection: changed });
    expect(h.select(fresh).props.value).toBe(
      h.selection.right!.listing.listingId,
    );
    h.button(old).props.onClick();
    h.change(h.selection.left!.listing.listingId, old);
    expect(h.actions.append).toHaveBeenCalledTimes(1);
    expect(h.html(fresh)).not.toContain("Added to the chosen draft.");
    h.button(fresh).props.onClick();
    expect(h.actions.append).toHaveBeenLastCalledWith(
      changed,
      h.selection.right!.listing,
    );
  });

  it.each(["pair", "response", "catalog", "handle", "retirement"])(
    "clears destination on %s replacement and rejects its old handlers",
    (kind) => {
      const h = harness();
      h.change(h.selection.right!.listing.listingId);
      const old = h.render();
      const right = h.selection.right!;
      const next = { ...h.selection, right: { ...right } };
      if (kind === "pair") next.right = { ...h.selection.left! };
      if (kind === "response")
        next.right.response = structuredClone(right.response);
      if (kind === "catalog")
        next.right.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      if (kind === "handle") next.right.handle = Symbol("readded");
      const changed =
        kind === "retirement" ? { ...next, left: null, right: null } : next;
      const fresh = h.render({ selection: changed });
      expect(h.select(fresh).props.value).toBe("");
      h.button(old).props.onClick();
      h.change(right.listing.listingId, old);
      expect(h.select().props.value).toBe("");
      expect(h.actions.append).not.toHaveBeenCalled();
    },
  );

  it("fences destination changes, arbitrary choices and explicit clearing without selecting an editor", () => {
    const h = harness();
    h.change("not-in-pair");
    expect(h.select().props.value).toBe("");
    h.change(h.selection.left!.listing.listingId);
    const old = h.render();
    h.change(h.selection.right!.listing.listingId);
    h.render();
    h.button(old).props.onClick();
    h.change("", old);
    expect(h.select().props.value).toBe(h.selection.right!.listing.listingId);
    h.change("");
    expect(h.select().props.value).toBe("");
    expect(h.actions.append).not.toHaveBeenCalled();
  });

  it.each([{ active: false }, { editable: false }])(
    "refuses old controls under a current view/edit lock: %j",
    (lock) => {
      const h = harness();
      h.change(h.selection.left!.listing.listingId);
      const old = h.render();
      const current = h.render(lock);
      h.button(old).props.onClick();
      h.change("", old);
      expect(h.select(current).props.value).toBe(
        h.selection.left!.listing.listingId,
      );
      expect(h.html(current)).toContain("Return to an editable watchlist");
      expect(h.actions.append).not.toHaveBeenCalled();
    },
  );

  it("rejects handlers after unmount", () => {
    const h = harness();
    h.change(h.selection.left!.listing.listingId);
    const old = h.render();
    h.unmount();
    h.button(old).props.onClick();
    h.change("", old);
    expect(h.actions.append).not.toHaveBeenCalled();
  });

  it.each([
    "Wait for the selected request.",
    "The complete note exceeds 2,000 characters.",
    "Correct the existing note first.",
  ])(
    "uses fresh refusal and removes obsolete feedback after correction: %s",
    (reason) => {
      const h = harness();
      h.change(h.selection.right!.listing.listingId);
      const old = h.render();
      vi.mocked(h.actions.getAction).mockReturnValue({
        canAppend: false,
        reason,
      });
      h.button(old).props.onClick();
      expect(h.html()).toContain(reason);
      expect(h.actions.append).not.toHaveBeenCalled();
      vi.mocked(h.actions.getAction).mockReturnValue({
        canAppend: true,
        reason: null,
      });
      expect(h.html()).not.toContain(reason);
      expect(h.select().props.value).toBe(h.selection.right!.listing.listingId);
      h.button().props.onClick();
      expect(h.actions.append).toHaveBeenCalledTimes(1);
    },
  );

  it("announces a final append refusal without claiming a Save or changing the destination", () => {
    const h = harness();
    h.change(h.selection.right!.listing.listingId);
    vi.mocked(h.actions.append).mockReturnValue({
      appended: false,
      message: "The destination membership changed.",
    });
    h.button().props.onClick();
    expect(h.html()).toContain("The destination membership changed.");
    expect(h.select().props.value).toBe(h.selection.right!.listing.listingId);
  });
});
