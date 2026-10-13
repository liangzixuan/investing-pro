import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { membershipMatchesResult } from "@research-cockpit/contracts";
import { ManagedResearchCompanyNavigation } from "./ManagedResearchCompanyNavigation";
import { annualComparisonMemberships as members } from "./annual-comparison-fixture";
import { eodSelection } from "./eod-history-fixture";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  stateIndex: 0,
  memos: [] as Array<{ deps: unknown[]; value: unknown }>,
  memoIndex: 0,
  ref: { current: null },
  changed: false,
  effect: undefined as undefined | (() => () => void),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useId: () => "company-navigation-help",
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
  useMemo: (create: () => unknown, deps: unknown[]) => {
    const index = hooks.memoIndex++;
    const previous = hooks.memos[index];
    if (!previous || deps.some((dep, i) => dep !== previous.deps[i]))
      hooks.memos[index] = { deps, value: create() };
    return hooks.memos[index]!.value;
  },
  useRef: () => hooks.ref,
  useLayoutEffect: (effect: () => () => void) => {
    hooks.effect = effect;
  },
}));
afterEach(() => {
  hooks.states = [];
  hooks.memos = [];
  hooks.ref.current = null;
  hooks.effect = undefined;
  vi.unstubAllGlobals();
});

type Props = React.ComponentProps<typeof ManagedResearchCompanyNavigation>;
type Control = React.ReactElement<
  React.ComponentProps<"select"> & { onClick?: () => void }
>;
function controls(node: React.ReactNode): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [node as Control, ...controls(node.props.children)];
}
function harness(initial: Partial<Props> = {}) {
  const canOpen = vi.fn<Props["canOpen"]>(
    (visit, member) =>
      !membershipMatchesResult(member, visit.selection.listing),
  );
  const onOpen = vi.fn<Props["onOpen"]>();
  let props: Props = {
    research: { selection: eodSelection, section: "annual" },
    state: { members: [members.left, members.right], reason: "" },
    canOpen,
    onOpen,
    ...initial,
  };
  let cleanup: (() => void) | undefined;
  const render = (changes: Partial<Props> = {}, commit = true) => {
    props = { ...props, ...changes };
    let node: ReturnType<typeof ManagedResearchCompanyNavigation>;
    for (let i = 0; i < 3; i++) {
      hooks.stateIndex = 0;
      hooks.memoIndex = 0;
      hooks.changed = false;
      node = ManagedResearchCompanyNavigation(props);
      if (!hooks.changed) break;
    }
    if (commit) {
      cleanup?.();
      cleanup = hooks.effect?.();
    }
    return node!;
  };
  const select = (node = render()) =>
    controls(node).find((item) => item.type === "select")!;
  const button = (node = render()) =>
    controls(node).find((item) => item.type === "button")!;
  const change = (value: string, node = render()) =>
    select(node).props.onChange!({
      currentTarget: { value },
    } as React.ChangeEvent<HTMLSelectElement>);
  return {
    render,
    select,
    button,
    change,
    canOpen,
    onOpen,
    get props() {
      return props;
    },
    unmount: () => cleanup?.(),
    html: (node = render()) => renderToStaticMarkup(node),
  };
}

describe("Company selection within research", () => {
  it("labels the native selector and full choice, keeps draft order and does not open the current company", () => {
    const h = harness({
      state: { members: [members.right, members.left], reason: "" },
    });
    const html = h.html();
    expect(html).toContain(
      '<label for="managed-research-company-select">Company in My Watchlist</label>',
    );
    expect(html.indexOf('value="listing-one"')).toBeLessThan(
      html.indexOf('value="listing-zero"'),
    );
    expect(html).toContain(
      "ZERO · Zero Company · Zero Class A · Class A · XNAS",
    );
    expect(h.select().props.value).toBe(members.left.listingId);
    expect(h.select().props["aria-describedby"]).toBe(
      "company-navigation-help-identity company-navigation-help",
    );
    expect(h.button().props["aria-describedby"]).toBe(
      "company-navigation-help",
    );
    expect(h.button().props["aria-disabled"]).toBe(true);
    expect(html).not.toMatch(/\sdisabled=/u);
    h.button().props.onClick!();
    expect(h.onOpen).not.toHaveBeenCalled();
    expect(h.canOpen).not.toHaveBeenCalled();
  });

  it("starts empty when the current identity is absent and never chooses the first company", () => {
    const h = harness({ state: { members: [members.right], reason: "" } });
    expect(h.select().props.value).toBe("");
    expect(h.html()).toContain("Choose company");
    expect(h.html()).toContain("No company chosen.");
    h.button().props.onClick!();
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it("changes only local choice until Open, which receives the exact visit and member", () => {
    const h = harness();
    const visit = h.props.research;
    h.change(members.right.listingId);
    expect(h.onOpen).not.toHaveBeenCalled();
    expect(h.select().props.value).toBe(members.right.listingId);
    expect(h.button().props["aria-disabled"]).toBe(false);
    expect(h.html()).toContain("Open this company in the current section");
    h.button().props.onClick!();
    expect(h.onOpen).toHaveBeenCalledExactlyOnceWith(visit, members.right);
    expect(h.onOpen.mock.calls[0]![1]).toBe(members.right);
  });

  it("distinguishes another listing and share class of the same issuer and symbol", () => {
    const otherClass = {
      ...members.left,
      listingId: "listing-b",
      securityId: "security-b",
      securityName: "Zero Class B",
      shareClassId: "class-b",
      shareClassName: "Class B",
    };
    const h = harness({
      state: { members: [members.left, otherClass], reason: "" },
    });
    h.change(otherClass.listingId);
    expect(h.html()).toContain(
      "ZERO · Zero Company · Zero Class B · Class B · XNAS",
    );
    h.button().props.onClick!();
    expect(h.onOpen).toHaveBeenCalledExactlyOnceWith(
      h.props.research,
      otherClass,
    );
  });

  it("keeps the choice across note edits and reorder, refreshing the handle and refusing the old callback", () => {
    const h = harness();
    h.change(members.right.listingId);
    const oldClick = h.button().props.onClick!;
    const edited = { ...members.right, note: "Latest raw draft\nCafé 😀" };
    h.render({
      state: {
        members: [edited, { ...members.left, note: "Changed too" }],
        reason: "",
      },
    });
    expect(h.select().props.value).toBe(edited.listingId);
    oldClick();
    expect(h.onOpen).not.toHaveBeenCalled();
    h.button().props.onClick!();
    expect(h.onOpen.mock.calls[0]![1]).toBe(edited);
    expect(edited.note).toBe("Latest raw draft\nCafé 😀");
  });

  it("keeps the choice and current draft order across a save-style clone without moving focus", () => {
    const h = harness();
    const focused = { focus: vi.fn(), scrollIntoView: vi.fn() };
    vi.stubGlobal("document", { activeElement: focused });
    h.change(members.right.listingId);
    const saved = [{ ...members.right }, { ...members.left }];
    h.render({ state: { members: saved, reason: "" } });
    expect(h.select().props.value).toBe(saved[0]!.listingId);
    expect(h.html().indexOf('value="listing-one"')).toBeLessThan(
      h.html().indexOf('value="listing-zero"'),
    );
    expect(document.activeElement).toBe(focused);
    expect(focused.focus).not.toHaveBeenCalled();
    expect(focused.scrollIntoView).not.toHaveBeenCalled();
    h.button().props.onClick!();
    expect(h.onOpen.mock.calls[0]![1]).toBe(saved[0]);
  });

  it.each(["removed", "replaced"] as const)(
    "clears a %s identity and does not resurrect it when the original returns",
    (kind) => {
      const h = harness();
      h.change(members.right.listingId);
      const oldClick = h.button().props.onClick!;
      const replacements =
        kind === "removed"
          ? []
          : [{ ...members.right, shareClassId: "replacement-class" }];
      h.render({
        state: { members: [members.left, ...replacements], reason: "" },
      });
      expect(h.select().props.value).toBe("");
      h.render({
        state: { members: [members.left, members.right], reason: "" },
      });
      expect(h.select().props.value).toBe("");
      oldClick();
      h.button().props.onClick!();
      expect(h.onOpen).not.toHaveBeenCalled();
    },
  );

  it("rejects same listing ID with a different full current identity as a default", () => {
    const replacement = { ...members.left, exchangeMic: "XNYS" };
    const h = harness({
      state: { members: [replacement, members.right], reason: "" },
    });
    expect(h.select().props.value).toBe("");
    expect(h.html()).toContain(
      "Choose a company from the current watchlist draft.",
    );
  });

  it("retains a choice on section change but fences the old visit callback", () => {
    const h = harness();
    h.change(members.right.listingId);
    const oldClick = h.button().props.onClick!;
    const next = { ...h.props.research, section: "filings" as const };
    h.render({ research: next });
    expect(h.select().props.value).toBe(members.right.listingId);
    oldClick();
    expect(h.onOpen).not.toHaveBeenCalled();
    h.button().props.onClick!();
    expect(h.onOpen.mock.calls[0]![0]).toBe(next);
  });

  it("resets to the new visit's current identity and fences prior change and Open callbacks", () => {
    const h = harness();
    h.change(members.right.listingId);
    const oldNode = h.render();
    h.render({
      research: {
        selection: { ...eodSelection, listing: members.right },
        section: "annual",
      },
    });
    expect(h.select().props.value).toBe(members.right.listingId);
    expect(h.button().props["aria-disabled"]).toBe(true);
    h.change(members.left.listingId, oldNode);
    h.button(oldNode).props.onClick!();
    expect(h.select().props.value).toBe(members.right.listingId);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it("fences choice changes even when the choice returns to the earlier member", () => {
    const h = harness();
    h.change(members.right.listingId);
    const oldClick = h.button().props.onClick!;
    h.change(members.left.listingId);
    h.render();
    h.change(members.right.listingId);
    h.render();
    oldClick();
    expect(h.onOpen).not.toHaveBeenCalled();
    h.button().props.onClick!();
    expect(h.onOpen).toHaveBeenCalledOnce();
  });

  it("refuses unknown values and permits clearing without opening anything", () => {
    const h = harness();
    h.change("forged-listing");
    expect(h.select().props.value).toBe(members.left.listingId);
    h.change("");
    expect(h.select().props.value).toBe("");
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it("shows the model refusal and blocks both stale and fresh actions without removing controls", () => {
    const h = harness();
    h.change(members.right.listingId);
    const oldNode = h.render();
    h.render({
      state: {
        members: h.props.state.members,
        reason: "Review the changed catalog first.",
      },
    });
    expect(h.html()).toContain("Review the changed catalog first.");
    expect(h.select().props["aria-disabled"]).toBe(true);
    expect(h.button().props["aria-disabled"]).toBe(true);
    h.change(members.left.listingId, oldNode);
    h.change(members.left.listingId);
    h.button(oldNode).props.onClick!();
    h.button().props.onClick!();
    expect(h.select().props.value).toBe(members.right.listingId);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it("defers readonly and invalid-note eligibility to the model", () => {
    const raw = { ...members.right, note: "\u0000" + "😀".repeat(2001) };
    const h = harness({ state: { members: [members.left, raw], reason: "" } });
    h.change(raw.listingId);
    h.button().props.onClick!();
    expect(h.onOpen.mock.calls[0]![1]).toBe(raw);
    expect(h.html()).not.toContain(raw.note);
  });

  it("checks live admission again at activation and uses the latest action ports", () => {
    const h = harness();
    h.change(members.right.listingId);
    const click = h.button().props.onClick!;
    const guard = vi.fn<Props["canOpen"]>(() => false);
    const open = vi.fn<Props["onOpen"]>();
    h.render({ canOpen: guard, onOpen: open });
    click();
    expect(open).not.toHaveBeenCalled();
    guard.mockReturnValue(true);
    click();
    expect(open).toHaveBeenCalledExactlyOnceWith(
      h.props.research,
      members.right,
    );
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it("does not activate an uncommitted render or a handler after unmount", () => {
    const h = harness();
    h.change(members.right.listingId);
    const node = h.render();
    const uncommitted = h.render(
      { research: { ...h.props.research, section: "filings" } },
      false,
    );
    h.button(uncommitted).props.onClick!();
    expect(h.onOpen).not.toHaveBeenCalled();
    h.unmount();
    h.button(node).props.onClick!();
    h.change(members.left.listingId, node);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it("does not call Open when admission itself retires the committed control", () => {
    const h = harness();
    h.change(members.right.listingId);
    const click = h.button().props.onClick!;
    h.canOpen.mockImplementation(() => {
      h.unmount();
      return true;
    });
    click();
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it("keeps an empty draft explicit and does not infer a choice when a member later appears", () => {
    const h = harness({
      state: { members: [], reason: "Add a company to My Watchlist first." },
    });
    expect(h.select().props.value).toBe("");
    expect(h.select().props["aria-disabled"]).toBe(true);
    expect(h.html()).toContain("Add a company to My Watchlist first.");
    h.render({ state: { members: [members.right], reason: "" } });
    expect(h.select().props.value).toBe("");
    expect(h.onOpen).not.toHaveBeenCalled();
  });
});
