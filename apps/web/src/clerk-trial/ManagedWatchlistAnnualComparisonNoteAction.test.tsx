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
  effect: undefined as undefined | (() => () => void),
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
    append: vi.fn(() => ({
      appended: true,
      message: "Added to the chosen draft. Review and Save.",
    })),
  };
  let props: Props = {
    state,
    bases: { left: "Revenues", right: "SalesRevenueNet" },
    active: true,
    editable: true,
    actions,
  };
  let cleanup: (() => void) | undefined;
  const render = (changes: Partial<Props> = {}) => {
    props = { ...props, ...changes };
    let node: ReturnType<typeof ManagedWatchlistAnnualComparisonNoteAction>;
    for (let i = 0; i < 3; i++) {
      hooks.stateIndex = 0;
      hooks.memoIndex = 0;
      hooks.changed = false;
      node = ManagedWatchlistAnnualComparisonNoteAction(props);
      if (!hooks.changed) break;
    }
    cleanup?.();
    cleanup = hooks.effect?.();
    return node!;
  };
  const select = (kind: "group" | "destination", node = render()) =>
    controls(node).find(
      (item) => item.props.id === `managed-annual-comparison-note-${kind}`,
    )!;
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
    change,
    unmount: () => cleanup?.(),
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
});
