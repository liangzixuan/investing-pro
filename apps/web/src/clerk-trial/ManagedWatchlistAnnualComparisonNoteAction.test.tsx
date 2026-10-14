import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ManagedWatchlistAnnualComparisonNoteAction,
  type ManagedWatchlistAnnualComparisonNoteActions,
} from "./ManagedWatchlistAnnualComparisonNoteAction";
import { ManagedWatchlistAnnualComparison as Model } from "./managed-watchlist-annual-comparison";
import type { ManagedApi } from "./managed-api";
import { getAnnualComparisonNoteEvidence } from "./managed-watchlist-annual-comparison-note";
import {
  annualComparisonMemberships as members,
  annualComparisonResponse as packet,
} from "./annual-comparison-fixture";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  stateIndex: 0,
  memos: [] as Array<{ deps: unknown[]; value: unknown }>,
  memoIndex: 0,
  ref: { current: null },
  changed: false,
  effects: [] as Array<{
    run: () => void | (() => void);
    deps: readonly unknown[];
  }>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useId: () => "annual-note-help",
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
  useLayoutEffect: (
    run: () => void | (() => void),
    deps: readonly unknown[],
  ) => {
    hooks.effects.push({ run, deps });
  },
}));
afterEach(() => {
  hooks.states = [];
  hooks.memos = [];
  hooks.ref.current = null;
  hooks.effects = [];
  vi.unstubAllGlobals();
});

type Props = React.ComponentProps<
  typeof ManagedWatchlistAnnualComparisonNoteAction
>;
type Control = React.ReactElement<
  React.ComponentProps<"select"> & { onClick?: () => void }
>;
function controls(node: React.ReactNode): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [node as Control, ...controls(node.props.children)];
}
async function harness(
  left?: Awaited<ReturnType<typeof packet>>,
  right?: Awaited<ReturnType<typeof packet>>,
) {
  left ??= await packet("left");
  right ??= await packet("right");
  const read = vi
    .fn<ManagedApi["annualReport"]>()
    .mockResolvedValueOnce(left)
    .mockResolvedValueOnce(right);
  const model = new Model(read, vi.fn());
  const digest = `sha256:${"a".repeat(64)}` as const;
  const draft = {
    schemaVersion: 1 as const,
    name: "My Watchlist" as const,
    snapshotSha256: digest,
    memberships: [members.left, members.right],
  };
  model.reconcile(draft, digest, true, true);
  model.select(
    "left",
    model.getSnapshot(),
    model.getSnapshot().memberships[0]!,
  );
  model.select(
    "right",
    model.getSnapshot(),
    model.getSnapshot().memberships[1]!,
  );
  await model.load("left", model.getSnapshot().left.selected!);
  await model.load("right", model.getSnapshot().right.selected!);
  const state = model.getSnapshot();
  const actions: ManagedWatchlistAnnualComparisonNoteActions = {
    getAction: vi.fn((_, destination) => ({
      canAppend: destination !== null,
      reason: destination ? null : "Choose a note.",
    })),
    review: vi.fn(),
    append: vi.fn(() => ({
      appended: true,
      message: "Added to the chosen draft. Review and Save.",
    })),
  };
  let props: Props = {
    state,
    memberships: draft.memberships,
    bases: { left: "Revenues", right: "SalesRevenueNet" },
    active: true,
    editable: true,
    actions,
  };
  let committedEffects: Array<{
    deps: readonly unknown[];
    cleanup: void | (() => void);
  }> = [];
  const render = (changes: Partial<Props> = {}, beforeLayout?: () => void) => {
    props = { ...props, ...changes };
    let node: ReturnType<typeof ManagedWatchlistAnnualComparisonNoteAction>;
    for (let i = 0; i < 3; i++) {
      hooks.stateIndex = 0;
      hooks.memoIndex = 0;
      hooks.changed = false;
      hooks.effects = [];
      node = ManagedWatchlistAnnualComparisonNoteAction(props);
      if (!hooks.changed) break;
    }
    const changedEffects = hooks.effects.map((effect, index) => {
      const previous = committedEffects[index];
      return (
        !previous ||
        effect.deps.length !== previous.deps.length ||
        effect.deps.some((value, i) => !Object.is(value, previous.deps[i]))
      );
    });
    committedEffects.forEach((effect, index) => {
      if (changedEffects[index]) effect.cleanup?.();
    });
    // React cleans up changed effects before earlier siblings run their layout effects.
    beforeLayout?.();
    committedEffects = hooks.effects.map((effect, index) =>
      changedEffects[index]
        ? { deps: effect.deps, cleanup: effect.run() }
        : committedEffects[index]!,
    );
    return node!;
  };
  const select = (kind: "group" | "destination", node = render()) =>
    controls(node).find(
      (item) => item.props.id === `managed-annual-comparison-note-${kind}`,
    )!;
  const review = (node = render()) =>
    controls(node).find(
      (item) => item.type === "button" && item.props.children === "Review note",
    );
  const button = (node = render()) =>
    controls(node).find((item) => item.type === "button")!;
  const change = (
    kind: "group" | "destination",
    value: string,
    node = render(),
  ) =>
    select(kind, node).props.onChange!({
      currentTarget: { value },
    } as React.ChangeEvent<HTMLSelectElement>);
  return {
    state,
    model,
    draft,
    read,
    actions,
    render,
    select,
    button,
    review,
    change,
    unmount: () => {
      for (const effect of committedEffects) effect.cleanup?.();
      committedEffects = [];
    },
    html: (node = render()) => renderToStaticMarkup(node),
  };
}

describe("Annual comparison note action", () => {
  it("starts with income and no destination, exposes both full identities and associated reasons without disabling focus", async () => {
    const h = await harness();
    expect(h.select("group").props.value).toBe("income");
    expect(h.select("destination").props.value).toBe("");
    const html = h.html();
    expect(html).toContain("ZERO · Zero Company · Class A · XNAS");
    expect(html).toContain("ONE · One Company · Class A · XNAS");
    expect(html.match(/aria-describedby="annual-note-help"/gu)).toHaveLength(3);
    expect(html).toContain("Cash generation");
    expect(html).toContain('<option value="liquidity">Liquidity</option>');
    expect(html).not.toMatch(/\sdisabled=/u);
    expect(h.button().props["aria-disabled"]).toBe(true);
    expect(h.actions.append).not.toHaveBeenCalled();
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it("uses the latest port with exact response/member objects and preserves focus and the selected editor", async () => {
    const h = await harness();
    h.change("destination", members.right.listingId);
    const click = h.button().props.onClick!;
    const focused = { focus: vi.fn() };
    vi.stubGlobal("document", { activeElement: focused });
    const fresh = {
      ...h.actions,
      append: vi.fn<ManagedWatchlistAnnualComparisonNoteActions["append"]>(
        () => ({
          appended: true,
          message: "Latest note preserved.",
        }),
      ),
    };
    h.render({ actions: fresh });
    click();
    const [capture, destination] = fresh.append.mock.calls[0]!;
    expect(capture.left.response).toBe(h.state.left.report.response);
    expect(capture.right.response).toBe(h.state.right.report.response);
    expect(capture.left.member).toBe(h.state.left.selected);
    expect(destination).toBe(h.state.right.selected);
    expect(capture.group).toBe("income");
    expect(capture.left.selectedBasis).toBe("Revenues");
    expect(document.activeElement).toBe(focused);
    expect(focused.focus).not.toHaveBeenCalled();
    expect(h.actions.append).not.toHaveBeenCalled();
    expect(h.html()).toContain("Latest note preserved.");
  });

  it.each(["basis", "group", "destination"] as const)(
    "fences an old %s callback including A to B to A and clears feedback",
    async (kind) => {
      const h = await harness();
      h.change("destination", members.right.listingId);
      const click = h.button().props.onClick!;
      click();
      expect(h.html()).toContain("Added to the chosen draft.");
      if (kind === "basis") {
        h.render({
          bases: { left: "SalesRevenueNet", right: "SalesRevenueNet" },
        });
        h.render({ bases: { left: "Revenues", right: "SalesRevenueNet" } });
      } else {
        h.change(kind, kind === "group" ? "cash" : members.left.listingId);
        h.render();
        h.change(kind, kind === "group" ? "income" : members.right.listingId);
        h.render();
      }
      click();
      expect(h.actions.append).toHaveBeenCalledTimes(1);
      expect(h.html()).not.toContain("Added to the chosen draft.");
      expect(h.select("destination").props.value).toBe(members.right.listingId);
    },
  );

  it.each(["left", "right"] as const)(
    "clears destination after an equal-value %s response replacement",
    async (side) => {
      const h = await harness();
      h.change("destination", members.right.listingId);
      const old = h.render();
      const next = {
        ...h.state,
        [side]: {
          ...h.state[side],
          report: {
            ...h.state[side].report,
            response: structuredClone(h.state[side].report.response),
          },
        },
      };
      h.render({ state: next });
      h.button(old).props.onClick!();
      h.change("destination", members.left.listingId, old);
      expect(h.select("destination").props.value).toBe("");
      expect(h.actions.append).not.toHaveBeenCalled();
    },
  );

  it.each(["handle", "identity", "remove-readd"] as const)(
    "clears destination for %s replacement even with the same listing ID",
    async (kind) => {
      const h = await harness();
      h.change("destination", members.right.listingId);
      const click = h.button().props.onClick!;
      if (kind === "remove-readd")
        h.render({
          state: { ...h.state, left: { ...h.state.left, selected: null } },
        });
      const selected =
        kind === "identity"
          ? {
              ...h.state.left.selected!,
              listing: {
                ...h.state.left.selected!.listing,
                shareClassName: "Class C",
              },
            }
          : { ...h.state.left.selected!, handle: Symbol("new") };
      h.render({ state: { ...h.state, left: { ...h.state.left, selected } } });
      click();
      expect(h.select("destination").props.value).toBe("");
      expect(h.actions.append).not.toHaveBeenCalled();
    },
  );

  it("keeps destination through note edits, ordering and Save state but blocks pending reads using a fresh predicate", async () => {
    const h = await harness();
    h.change("destination", members.right.listingId);
    const click = h.button().props.onClick!;
    const getAction = vi.mocked(h.actions.getAction);
    getAction.mockReturnValue({
      canAppend: false,
      reason: "Wait for the current report.",
    });
    h.render({
      state: {
        ...h.state,
        canRead: false,
        memberships: [...h.state.memberships].reverse(),
      },
    });
    click();
    expect(h.actions.append).not.toHaveBeenCalled();
    expect(h.select("destination").props.value).toBe(members.right.listingId);
    expect(h.html()).toContain("Wait for the current report.");
    getAction.mockReturnValue({ canAppend: true, reason: null });
    h.render({ state: { ...h.state } });
    expect(h.html()).not.toContain("Wait for the current report.");
    h.button().props.onClick!();
    expect(h.actions.append).toHaveBeenCalledOnce();
  });

  it("preserves retained response clocks and qualifiers after failure and Cancel", async () => {
    const h = await harness();
    h.change("destination", members.left.listingId);
    const stale = h.button().props.onClick!;
    h.render({
      state: {
        ...h.state,
        left: {
          ...h.state.left,
          report: {
            ...h.state.left.report,
            showingPrevious: true,
            error: true,
            message: "Refresh failed.",
          },
        },
      },
    });
    stale();
    expect(h.actions.append).not.toHaveBeenCalled();
    h.button().props.onClick!();
    const capture = vi.mocked(h.actions.append).mock.calls[0]![0];
    expect(capture.left.showingPrevious).toBe(true);
    expect(capture.right.showingPrevious).toBe(false);
    expect(capture.left.response).toBe(h.state.left.report.response);
    expect(capture.left.response.evidence.generation.completedAt).toBe(
      h.state.left.report.response!.evidence.generation.completedAt,
    );
    expect(h.select("destination").props.value).toBe(members.left.listingId);
  });

  it.each(["active", "editable"] as const)(
    "fences callbacks across %s retirement and return",
    async (key) => {
      const h = await harness();
      h.change("destination", members.left.listingId);
      const old = h.render();
      h.render({ [key]: false });
      h.button(old).props.onClick!();
      h.render({ [key]: true });
      h.button(old).props.onClick!();
      h.change("group", "cash", old);
      expect(h.actions.append).not.toHaveBeenCalled();
      expect(h.select("group").props.value).toBe("income");
    },
  );

  it("rejects unknown choices and unmounted callbacks; keeps all controls for unloaded or retired pairs", async () => {
    const h = await harness();
    h.change("destination", "other-listing");
    h.change("group", "unknown");
    expect(h.select("destination").props.value).toBe("");
    expect(h.select("group").props.value).toBe("income");
    h.change("destination", members.left.listingId);
    const old = h.render();
    h.unmount();
    h.button(old).props.onClick!();
    expect(h.actions.append).not.toHaveBeenCalled();
    h.render({
      state: {
        ...h.state,
        left: {
          ...h.state.left,
          report: { ...h.state.left.report, response: null },
        },
      },
    });
    expect(h.html()).toContain(
      "Choose two companies and load both Annual reports.",
    );
    expect(
      controls(h.render()).filter((item) => item.type === "select"),
    ).toHaveLength(2);
    expect(h.select("destination").props.value).toBe("");
  });

  it("keeps success visible when the latest port reports duplicate, but clears refusal when corrected", async () => {
    const h = await harness();
    h.change("destination", members.left.listingId);
    h.button().props.onClick!();
    vi.mocked(h.actions.getAction).mockReturnValue({
      canAppend: false,
      reason: "Already added.",
    });
    expect(h.html()).toContain("Added to the chosen draft.");
    h.button().props.onClick!();
    expect(h.html()).toContain("Already added.");
    vi.mocked(h.actions.getAction).mockReturnValue({
      canAppend: true,
      reason: null,
    });
    expect(h.html()).not.toContain("Already added.");
    vi.mocked(h.actions.append).mockReturnValue({
      appended: false,
      message: "Latest note is too long.",
    });
    h.button().props.onClick!();
    expect(h.html()).toContain("Latest note is too long.");
  });

  it("asks the real evidence formatter about the selected group, allowing cash when income is refused", async () => {
    const h = await harness(await packet("left", { mode: "income-invalid" }));
    h.change("destination", members.right.listingId);
    vi.mocked(h.actions.getAction).mockImplementation(
      (capture, destination) => {
        const evidence = getAnnualComparisonNoteEvidence(capture);
        return {
          canAppend: destination !== null && evidence.excerpt !== null,
          reason: evidence.reason,
        };
      },
    );
    expect(h.button().props["aria-disabled"]).toBe(true);
    h.change("group", "cash");
    expect(h.button().props["aria-disabled"]).toBe(false);
    h.button().props.onClick!();
    expect(vi.mocked(h.actions.append).mock.calls[0]![0].group).toBe("cash");
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.draft.memberships).toEqual([members.left, members.right]);
  });
  it("allows income with missing cash and refuses cash without silently changing basis or destination", async () => {
    const h = await harness(await packet("left", { cashRows: [] }));
    h.change("destination", members.left.listingId);
    vi.mocked(h.actions.getAction).mockImplementation(
      (capture, destination) => {
        const evidence = getAnnualComparisonNoteEvidence(capture);
        return {
          canAppend: destination !== null && evidence.excerpt !== null,
          reason: evidence.reason,
        };
      },
    );
    expect(h.button().props["aria-disabled"]).toBe(false);
    h.change("group", "cash");
    expect(h.button().props["aria-disabled"]).toBe(true);
    h.button().props.onClick!();
    expect(h.actions.append).not.toHaveBeenCalled();
    expect(h.select("destination").props.value).toBe(members.left.listingId);
    h.change("group", "income");
    h.button().props.onClick!();
    expect(
      vi.mocked(h.actions.append).mock.calls[0]![0].left.selectedBasis,
    ).toBe("Revenues");
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it("offers liquidity when income and cash are unavailable without requiring a revenue basis or another read", async () => {
    const h = await harness(
      await packet("left", { mode: "income-invalid", cashRows: [] }),
    );
    h.change("destination", members.right.listingId);
    vi.mocked(h.actions.getAction).mockImplementation(
      (capture, destination) => {
        const evidence = getAnnualComparisonNoteEvidence(capture);
        return {
          canAppend: destination !== null && evidence.excerpt !== null,
          reason: evidence.reason,
        };
      },
    );
    expect(h.button().props["aria-disabled"]).toBe(true);
    h.change("group", "cash");
    expect(h.button().props["aria-disabled"]).toBe(true);
    h.change("group", "liquidity");
    h.render({ bases: { left: null, right: null } });
    expect(h.button().props["aria-disabled"]).toBe(false);
    h.button().props.onClick!();
    const [capture, destination] = vi.mocked(h.actions.append).mock.calls[0]!;
    expect(capture.group).toBe("liquidity");
    expect(destination).toBe(h.state.right.selected);
    expect(capture.left.selectedBasis).toBeNull();
    expect(getAnnualComparisonNoteEvidence(capture).excerpt).toContain(
      "working capital USD -300",
    );
    expect(h.select("destination").props.value).toBe(members.right.listingId);
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.draft.memberships).toEqual([members.left, members.right]);
  });

  it("explains a refused liquidity column and recovers when the user chooses available income", async () => {
    const h = await harness(
      undefined,
      await packet("right", { liquidityRows: [] }),
    );
    h.change("destination", members.left.listingId);
    vi.mocked(h.actions.getAction).mockImplementation(
      (capture, destination) => {
        const evidence = getAnnualComparisonNoteEvidence(capture);
        return {
          canAppend: destination !== null && evidence.excerpt !== null,
          reason: evidence.reason,
        };
      },
    );
    h.change("group", "liquidity");
    expect(h.button().props["aria-disabled"]).toBe(true);
    expect(h.html()).toContain("Second company: Liquidity comparison needs");
    expect(h.html()).not.toMatch(/\sdisabled=/u);
    h.button().props.onClick!();
    expect(h.actions.append).not.toHaveBeenCalled();
    h.change("group", "income");
    expect(h.button().props["aria-disabled"]).toBe(false);
    expect(h.html()).not.toContain(
      "Second company: Liquidity comparison needs",
    );
    h.button().props.onClick!();
    expect(vi.mocked(h.actions.append).mock.calls[0]![0].group).toBe("income");
    expect(h.select("destination").props.value).toBe(members.left.listingId);
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it("retires a liquidity callback across a group round trip while preserving destination and focus", async () => {
    const h = await harness();
    h.change("destination", members.right.listingId);
    h.change("group", "liquidity");
    const click = h.button().props.onClick!;
    const focused = { focus: vi.fn() };
    vi.stubGlobal("document", { activeElement: focused });
    click();
    expect(h.html()).toContain("Added to the chosen draft.");
    h.change("group", "cash");
    h.render();
    h.change("group", "liquidity");
    h.render();
    click();
    expect(h.actions.append).toHaveBeenCalledTimes(1);
    expect(h.html()).not.toContain("Added to the chosen draft.");
    expect(h.select("group").props.value).toBe("liquidity");
    expect(h.select("destination").props.value).toBe(members.right.listingId);
    expect(document.activeElement).toBe(focused);
    expect(focused.focus).not.toHaveBeenCalled();
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it("labels equal symbols by company, share class and MIC while retaining the exact selected membership", async () => {
    const h = await harness();
    const left = {
      ...h.state.left.selected!,
      listing: {
        ...h.state.left.selected!.listing,
        symbol: "SAME",
        shareClassName: "Class A",
      },
    };
    const right = {
      ...h.state.right.selected!,
      listing: {
        ...h.state.right.selected!.listing,
        symbol: "SAME",
        shareClassName: "Class C",
        exchangeMic: "XNYS",
      },
    };
    h.render({
      state: {
        ...h.state,
        left: { ...h.state.left, selected: left },
        right: { ...h.state.right, selected: right },
      },
    });
    h.change("destination", right.listing.listingId);
    expect(h.html()).toContain("SAME · Zero Company · Class A · XNAS");
    expect(h.html()).toContain("SAME · One Company · Class C · XNYS");
    h.button().props.onClick!();
    expect(vi.mocked(h.actions.append).mock.calls[0]![1]).toBe(right);
  });

  it("does not offer Review before success or after a refused append alone", async () => {
    const h = await harness();
    expect(h.review()).toBeUndefined();
    h.change("destination", members.left.listingId);
    vi.mocked(h.actions.append).mockReturnValue({
      appended: false,
      message: "The note is too long.",
    });
    h.button().props.onClick!();
    expect(h.review()).toBeUndefined();
    expect(h.html()).toContain("The note is too long.");
    expect(h.actions.review).not.toHaveBeenCalled();
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["income", "left"],
    ["income", "right"],
    ["cash", "left"],
    ["cash", "right"],
    ["liquidity", "left"],
    ["liquidity", "right"],
  ] as const)(
    "reviews the exact current %s destination on the %s side without another append or read",
    async (group, side) => {
      const h = await harness();
      h.change("group", group);
      h.change("destination", members[side].listingId);
      h.button().props.onClick!();
      const focused = { focus: vi.fn() };
      vi.stubGlobal("document", { activeElement: focused });
      h.review()!.props.onClick!();
      const [capture, member, isCurrentChoice] = vi.mocked(h.actions.review)
        .mock.calls[0]!;
      expect(capture).toBe(vi.mocked(h.actions.append).mock.calls[0]![0]);
      expect(capture.group).toBe(group);
      expect(member).toBe(h.draft.memberships[side === "left" ? 0 : 1]);
      expect(isCurrentChoice()).toBe(true);
      h.render({ actions: { ...h.actions } });
      expect(isCurrentChoice()).toBe(true);
      expect(h.actions.append).toHaveBeenCalledOnce();
      expect(h.read).toHaveBeenCalledTimes(2);
      expect(document.activeElement).toBe(focused);
      expect(focused.focus).not.toHaveBeenCalled();
    },
  );

  it("keeps success through synchronous append publication, reordered raw notes and read-only Save state", async () => {
    const h = await harness();
    h.change("destination", members.right.listingId);
    const changedMembers = [
      { ...members.right, note: "  raw invalid \u0001 draft  " },
      { ...members.left, note: "Fresh café 東京 📈" },
    ];
    vi.mocked(h.actions.append).mockImplementation(() => {
      h.render({
        memberships: changedMembers,
        editable: false,
        state: { ...h.state, canRead: false },
      });
      return { appended: true, message: "Added before Save." };
    });
    h.button().props.onClick!();
    const node = h.render();
    expect(h.select("group", node).props["aria-disabled"]).toBe(true);
    expect(h.select("destination", node).props["aria-disabled"]).toBe(true);
    expect(h.button(node).props["aria-disabled"]).toBe(true);
    expect(h.review(node)!.props["aria-disabled"]).toBe(false);
    h.review(node)!.props.onClick!();
    expect(vi.mocked(h.actions.review).mock.calls[0]![1]).toBe(
      changedMembers[0],
    );
    h.change("group", "cash", node);
    h.button(node).props.onClick!();
    expect(h.select("group").props.value).toBe("income");
    expect(h.actions.append).toHaveBeenCalledOnce();
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it("preserves Review after duplicate refusal and refreshes the exact member and latest review port", async () => {
    const h = await harness();
    h.change("destination", members.left.listingId);
    h.button().props.onClick!();
    const oldReview = h.review()!.props.onClick!;
    vi.mocked(h.actions.getAction).mockReturnValue({
      canAppend: false,
      reason: "Already added.",
    });
    h.button().props.onClick!();
    expect(h.html()).toContain("Already added.");
    const currentMember = { ...members.left, note: "Latest raw note" };
    const latestActions = {
      ...h.actions,
      review: vi.fn<ManagedWatchlistAnnualComparisonNoteActions["review"]>(),
    };
    h.render({
      memberships: [members.right, currentMember],
      actions: latestActions,
    });
    oldReview();
    expect(latestActions.review.mock.calls[0]![1]).toBe(currentMember);
    expect(latestActions.review.mock.calls[0]![2]()).toBe(true);
    expect(h.actions.review).not.toHaveBeenCalled();
    expect(h.actions.append).toHaveBeenCalledOnce();
  });

  it.each(["pending", "left", "right"] as const)(
    "pauses Review for %s reads and restores it only for the same evidence context",
    async (kind) => {
      const h = await harness();
      h.change("destination", members.right.listingId);
      h.button().props.onClick!();
      const review = h.review()!.props.onClick!;
      review();
      const isCurrentChoice = vi.mocked(h.actions.review).mock.calls[0]![2];
      const next =
        kind === "pending"
          ? { ...h.state, pending: { side: "left" as const, cancel: vi.fn() } }
          : {
              ...h.state,
              [kind]: {
                ...h.state[kind],
                report: { ...h.state[kind].report, running: true },
              },
            };
      h.render({ state: next });
      expect(h.review()!.props["aria-disabled"]).toBe(true);
      expect(isCurrentChoice()).toBe(false);
      review();
      expect(h.actions.review).toHaveBeenCalledOnce();
      h.render({ state: h.state });
      expect(h.review()!.props["aria-disabled"]).toBe(false);
      review();
      expect(h.actions.review).toHaveBeenCalledTimes(2);
      expect(h.actions.append).toHaveBeenCalledOnce();
    },
  );

  it.each([
    "basis",
    "group",
    "destination",
    "retained",
    "response",
    "member",
    "catalog",
    "active",
  ] as const)(
    "withdraws success and queued Review after %s changes, without reviving an old choice",
    async (kind) => {
      const h = await harness();
      h.change("destination", members.right.listingId);
      h.button().props.onClick!();
      const review = h.review()!.props.onClick!;
      review();
      const isCurrentChoice = vi.mocked(h.actions.review).mock.calls[0]![2];
      if (kind === "basis")
        h.render({
          bases: { left: "SalesRevenueNet", right: "SalesRevenueNet" },
        });
      else if (kind === "group") {
        h.change("group", "cash");
        h.render();
      } else if (kind === "destination") {
        h.change("destination", members.left.listingId);
        h.render();
      } else if (kind === "active") h.render({ active: false });
      else if (kind === "catalog")
        h.render({ state: { ...h.state, catalogChanged: true } });
      else if (kind === "member")
        h.render({
          state: {
            ...h.state,
            right: {
              ...h.state.right,
              selected: {
                ...h.state.right.selected!,
                handle: Symbol("replacement"),
              },
            },
          },
        });
      else
        h.render({
          state: {
            ...h.state,
            right: {
              ...h.state.right,
              report: {
                ...h.state.right.report,
                ...(kind === "retained"
                  ? { showingPrevious: true }
                  : {
                      response: structuredClone(h.state.right.report.response),
                    }),
              },
            },
          },
        });
      expect(h.review()).toBeUndefined();
      expect(isCurrentChoice()).toBe(false);
      review();
      h.render({
        state: h.state,
        active: true,
        bases: { left: "Revenues", right: "SalesRevenueNet" },
      });
      h.change("group", "income");
      h.change("destination", members.right.listingId);
      expect(h.review()).toBeUndefined();
      review();
      expect(isCurrentChoice()).toBe(false);
      expect(h.actions.review).toHaveBeenCalledOnce();
      expect(h.actions.append).toHaveBeenCalledOnce();
    },
  );

  it.each(["missing", "identity"] as const)(
    "clears success for an observed %s destination and never falls back by listing ID",
    async (kind) => {
      const h = await harness();
      h.change("destination", members.right.listingId);
      h.button().props.onClick!();
      const review = h.review()!.props.onClick!;
      h.render({
        memberships:
          kind === "missing"
            ? [members.left]
            : [
                members.left,
                { ...members.right, shareClassId: "replacement-class" },
              ],
      });
      expect(h.review()).toBeUndefined();
      review();
      h.render({ memberships: h.draft.memberships });
      expect(h.review()).toBeUndefined();
      expect(h.actions.review).not.toHaveBeenCalled();
    },
  );

  it("rejects an unmounted Review callback and its already queued current-choice predicate", async () => {
    const h = await harness();
    h.change("destination", members.left.listingId);
    h.button().props.onClick!();
    const review = h.review()!.props.onClick!;
    review();
    const isCurrentChoice = vi.mocked(h.actions.review).mock.calls[0]![2];
    h.unmount();
    expect(isCurrentChoice()).toBe(false);
    review();
    expect(h.actions.review).toHaveBeenCalledOnce();
  });

  it("does not create success if append synchronously replaces the admitted source", async () => {
    const h = await harness();
    h.change("destination", members.left.listingId);
    vi.mocked(h.actions.append).mockImplementation(() => {
      h.render({
        state: {
          ...h.state,
          left: {
            ...h.state.left,
            report: {
              ...h.state.left.report,
              response: structuredClone(h.state.left.report.response),
            },
          },
        },
      });
      return { appended: true, message: "Added to an earlier context." };
    });
    h.button().props.onClick!();
    expect(h.review()).toBeUndefined();
    expect(h.actions.review).not.toHaveBeenCalled();
  });
  it.each(["parent", "read-only"] as const)(
    "keeps queued Review live for an earlier sibling during an unchanged %s commit",
    async (kind) => {
      const h = await harness();
      h.change("destination", members.left.listingId);
      h.button().props.onClick!();
      const node = h.render();
      const append = h.button(node).props.onClick!;
      h.review(node)!.props.onClick!();
      const isCurrentChoice = vi.mocked(h.actions.review).mock.calls[0]![2];
      expect(isCurrentChoice()).toBe(true);
      h.render(
        kind === "read-only"
          ? { editable: false, state: { ...h.state, canRead: false } }
          : {},
        () => {
          expect(isCurrentChoice()).toBe(true);
          append();
          expect(h.actions.append).toHaveBeenCalledOnce();
        },
      );
      expect(isCurrentChoice()).toBe(true);
      expect(h.read).toHaveBeenCalledTimes(2);
      h.unmount();
      expect(isCurrentChoice()).toBe(false);
    },
  );

  it.each([
    "group",
    "basis",
    "destination",
    "member",
    "pending",
    "left-running",
    "right-running",
    "source",
    "retained",
    "inactive",
    "catalog",
  ] as const)(
    "fences queued Review before earlier sibling effects when %s changes",
    async (kind) => {
      const h = await harness();
      h.change("destination", members.left.listingId);
      h.button().props.onClick!();
      h.review()!.props.onClick!();
      const isCurrentChoice = vi.mocked(h.actions.review).mock.calls[0]![2];
      const changes: Partial<Props> = {};
      if (kind === "group") h.change("group", "cash");
      else if (kind === "destination")
        h.change("destination", members.right.listingId);
      else if (kind === "basis")
        changes.bases = { left: "SalesRevenueNet", right: "SalesRevenueNet" };
      else if (kind === "member")
        changes.memberships = [
          { ...members.left, note: "Changed draft" },
          members.right,
        ];
      else if (kind === "inactive") changes.active = false;
      else if (kind === "catalog")
        changes.state = { ...h.state, catalogChanged: true };
      else if (kind === "pending")
        changes.state = {
          ...h.state,
          pending: { side: "left", cancel: vi.fn() },
        };
      else {
        const side = kind === "right-running" ? "right" : "left";
        const report = h.state[side].report;
        changes.state = {
          ...h.state,
          [side]: {
            ...h.state[side],
            report: {
              ...report,
              ...(kind === "source"
                ? { response: structuredClone(report.response) }
                : kind === "retained"
                  ? { showingPrevious: true }
                  : { running: true }),
            },
          },
        };
      }
      h.render(changes, () => expect(isCurrentChoice()).toBe(false));
      // Fresh member publication permits a new Review; Screen separately fences
      // the original request's exact draft and member.
      expect(isCurrentChoice()).toBe(kind === "member");
      expect(h.actions.append).toHaveBeenCalledOnce();
      expect(h.actions.review).toHaveBeenCalledOnce();
      expect(h.read).toHaveBeenCalledTimes(2);
    },
  );
});
