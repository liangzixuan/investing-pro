import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, expect, it, vi } from "vitest";
import {
  ManagedWatchlistResearchCapture,
  ManagedWatchlistResearchPair,
} from "./ManagedWatchlistResearchPair";
import type { ManagedWatchlistResearchPairState } from "./managed-watchlist-research-pair";
import { eodSelection } from "./eod-history-fixture";
import { createScreenResearchReviewFixture } from "./test-screen-research-review-fixture";
import { createWatchlistResearchPairFixture } from "./test-watchlist-research-pair-fixture";

const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  const direct = createValuationDraftTestHooks(hooks);
  return {
    ...actual,
    useRef: (value: unknown) =>
      hooks.direct ? direct.useRef(value) : actual.useRef(value),
    useState: (value: unknown) =>
      hooks.direct ? direct.useState(value) : actual.useState(value),
    useLayoutEffect: (effect: () => void, deps?: React.DependencyList) =>
      hooks.direct
        ? direct.useLayoutEffect(effect, deps)
        : actual.useLayoutEffect(effect, deps),
    useSyncExternalStore: (
      subscribe: () => () => void,
      snapshot: () => unknown,
      server: () => unknown,
    ) =>
      hooks.direct
        ? snapshot()
        : actual.useSyncExternalStore(subscribe, snapshot, server),
  };
});
beforeEach(() => {
  hooks.direct = false;
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});

type State = ManagedWatchlistResearchPairState;
type Member = State["memberships"][number];
type Props = React.ComponentProps<typeof ManagedWatchlistResearchPair>;
function fixture(count = 3) {
  const memberships: Member[] = Array.from({ length: count }, (_, index) => ({
    handle: Symbol(`member-${index}`),
    listing: {
      ...eodSelection.listing,
      listingId: `listing-${index}`,
      shareClassId: `class-${index}`,
      shareClassName: `Class ${index}`,
      symbol: `PAIR${index}`,
    },
  }));
  let state: State = {
    memberships,
    selected: [],
    preview: null,
    reading: null,
    activeSide: null,
    canStart: false,
    canCapture: false,
    reason: null,
  };
  const install = (patch: Partial<State>) => (state = { ...state, ...patch });
  const model = {
    subscribe: () => () => undefined,
    getSnapshot: () => state,
    select: vi.fn((expected: State, member: Member) => {
      if (expected !== state) return null;
      return install({
        selected: state.selected.includes(member)
          ? state.selected.filter((item) => item !== member)
          : [...state.selected, member],
      });
    }),
    preview: vi.fn((expected: State) =>
      expected === state
        ? install({
            preview: [state.selected[0]!, state.selected[1]!],
            canStart: true,
          })
        : null,
    ),
    start: vi.fn((expected: State) =>
      expected === state && state.preview
        ? install({
            reading: {
              kind: "watchlist_research_reading",
              members: state.preview,
              left: null,
              right: null,
            },
            preview: null,
          })
        : null,
    ),
    cancelPreview: vi.fn((expected: State) =>
      expected === state ? install({ preview: null, canStart: false }) : null,
    ),
    clearSide: vi.fn((expected: State, side: "left" | "right") =>
      expected === state && state.reading
        ? install({ reading: { ...state.reading, [side]: null } })
        : null,
    ),
    end: vi.fn((expected: State) =>
      expected === state
        ? install({ reading: null, selected: [], activeSide: null })
        : null,
    ),
  };
  const capture = vi.fn((expected: State) =>
    expected === state ? install({}) : null,
  );
  const workspace = {
    watchlistResearchPair: model,
    captureWatchlistResearchReading: capture,
  } as unknown as Props["workspace"];
  const open = vi.fn();
  return { model, workspace, open, install, capture, memberships };
}
type Fixture = ReturnType<typeof fixture>;
type ElementProps = {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  value?: number;
  "data-watchlist-pair-member"?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  ref?: React.RefObject<HTMLHeadingElement | null>;
};
function nodes(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
}
function byId(node: React.ReactNode, id: string) {
  const found = nodes(node).find((item) => item.props.id === id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
}
function render(
  f: Pick<Fixture, "workspace" | "open">,
  pending = false,
  capture = false,
) {
  hooks.direct = true;
  hooks.index = 0;
  return capture
    ? ManagedWatchlistResearchCapture({
        workspace: f.workspace,
        navigationPending: pending,
      })
    : ManagedWatchlistResearchPair({
        workspace: f.workspace,
        navigationPending: pending,
        onOpenSide: f.open,
      });
}
function click(
  node: React.ReactElement<ElementProps>,
  owner = {} as HTMLButtonElement,
) {
  node.props.onClick?.({
    currentTarget: owner,
  } as React.MouseEvent<HTMLButtonElement>);
}
function activate(f: Fixture) {
  f.install({ selected: f.memberships.slice(0, 2) });
  f.model.preview(f.model.getSnapshot());
  f.model.start(f.model.getSnapshot());
}
function focusContext() {
  const document = { activeElement: null as unknown, body: {} };
  const owner = { ownerDocument: document, isConnected: true };
  document.activeElement = owner;
  const focus = vi.fn();
  const target = {
    ownerDocument: document,
    isConnected: true,
    closest: () => null,
    getClientRects: () => [{}],
    focus,
  };
  return {
    document,
    owner: owner as unknown as HTMLButtonElement,
    target,
    focus,
  };
}
function commit(
  node: React.ReactNode,
  target?: ReturnType<typeof focusContext>["target"],
) {
  for (const item of nodes(node)) {
    if (item.props.ref && target)
      item.props.ref.current = target as unknown as HTMLHeadingElement;
  }
  for (const effect of hooks.effects.splice(0)) effect();
}

it("makes all 10,000 members reachable in 25-row pages without choosing an issuer for the user", () => {
  const f = fixture(10_000);
  let tree = render(f);
  expect(
    nodes(tree).filter((item) => item.props["data-watchlist-pair-member"]),
  ).toHaveLength(25);
  byId(tree, "managed-watchlist-pair-page").props.onChange?.({
    currentTarget: { value: "399" },
  } as React.ChangeEvent<HTMLSelectElement>);
  tree = render(f);
  expect(byId(tree, "managed-watchlist-pair-select-9999")).toBeDefined();
  click(byId(tree, "managed-watchlist-pair-select-9999"));
  expect(f.model.select).toHaveBeenCalledWith(
    expect.anything(),
    f.memberships[9999],
  );
  tree = render(f);
  expect(byId(tree, "managed-watchlist-pair-page").props.value).toBe(399);
  expect(f.open).not.toHaveBeenCalled();
  expect(f.capture).not.toHaveBeenCalled();
});

it("requires a full identity preview before Start and labels same-issuer share classes separately", () => {
  const f = fixture();
  let tree = render(f);
  click(byId(tree, "managed-watchlist-pair-select-0"));
  tree = render(f);
  click(byId(tree, "managed-watchlist-pair-select-1"));
  tree = render(f);
  expect(byId(tree, "managed-watchlist-pair-select-2").props.disabled).toBe(
    true,
  );
  click(byId(tree, "managed-watchlist-pair-preview"));
  expect(f.model.start).not.toHaveBeenCalled();
  hooks.direct = false;
  const $ = load(
    renderToStaticMarkup(
      <ManagedWatchlistResearchPair
        workspace={f.workspace}
        navigationPending={false}
        onOpenSide={f.open}
      />,
    ),
  );
  expect($("[data-watchlist-pair-identity]")).toHaveLength(2);
  expect($("[data-watchlist-pair-identity] dt")).toHaveLength(22);
  expect($.text()).toContain("Class 0");
  expect($.text()).toContain("Class 1");
  expect($.text()).not.toMatch(/eligible annual|screened company|rank score/i);
  tree = render(f);
  click(byId(tree, "managed-watchlist-pair-start"));
  expect(f.model.getSnapshot().reading?.members).toEqual(
    f.memberships.slice(0, 2),
  );
  expect(f.open).not.toHaveBeenCalled();
});

it("rejects stale selection, preview, open, clear and end handlers, and pending navigation", () => {
  const f = fixture();
  const selection = render(f);
  f.install({});
  click(byId(selection, "managed-watchlist-pair-select-0"));
  expect(f.model.select).not.toHaveBeenCalled();
  f.install({ selected: f.memberships.slice(0, 2) });
  const preview = render(f);
  f.install({});
  click(byId(preview, "managed-watchlist-pair-preview"));
  expect(f.model.preview).not.toHaveBeenCalled();
  activate(f);
  const tree = render(f);
  f.install({});
  click(byId(tree, "managed-watchlist-pair-open-left"));
  click(byId(tree, "managed-watchlist-pair-clear-left"));
  click(byId(tree, "managed-watchlist-pair-end"));
  expect(f.open).not.toHaveBeenCalled();
  expect(f.model.clearSide).not.toHaveBeenCalled();
  expect(f.model.end).not.toHaveBeenCalled();
  const pending = render(f, true);
  click(byId(pending, "managed-watchlist-pair-open-right"));
  click(byId(pending, "managed-watchlist-pair-end"));
  expect(f.open).not.toHaveBeenCalled();
  expect(f.model.end).not.toHaveBeenCalled();
  const beforeNavigation = render(f);
  render(f, true);
  click(byId(beforeNavigation, "managed-watchlist-pair-open-left"));
  expect(f.open).not.toHaveBeenCalled();
});

it("keeps a stable roster page across action updates but resets when membership authority changes", () => {
  const f = fixture(100);
  let tree = render(f);
  const page = byId(tree, "managed-watchlist-pair-page");
  page.props.onChange?.({
    currentTarget: { value: "3" },
  } as React.ChangeEvent<HTMLSelectElement>);
  f.install({ reason: "Save is in progress." });
  tree = render(f);
  expect(byId(tree, "managed-watchlist-pair-page").props.value).toBe(3);
  // This old handler cannot change the page under the new action fence.
  page.props.onChange?.({
    currentTarget: { value: "1" },
  } as React.ChangeEvent<HTMLSelectElement>);
  expect(byId(render(f), "managed-watchlist-pair-page").props.value).toBe(3);
  for (const value of ["-1", "4", "0.5", "invalid"]) {
    byId(tree, "managed-watchlist-pair-page").props.onChange?.({
      currentTarget: { value },
    } as React.ChangeEvent<HTMLSelectElement>);
    expect(byId(render(f), "managed-watchlist-pair-page").props.value).toBe(3);
  }
  f.install({ memberships: [...f.memberships] });
  expect(byId(render(f), "managed-watchlist-pair-page").props.value).toBe(0);
});

it("can change a preview without starting and blocks Start when the model loses readiness", () => {
  const f = fixture();
  f.install({ selected: f.memberships.slice(0, 2) });
  f.model.preview(f.model.getSnapshot());
  f.install({
    canStart: false,
    reason: "Load the saved Watchlist before starting.",
  });
  let tree = render(f);
  expect(byId(tree, "managed-watchlist-pair-start").props.disabled).toBe(true);
  click(byId(tree, "managed-watchlist-pair-start"));
  expect(f.model.start).not.toHaveBeenCalled();
  click(byId(tree, "managed-watchlist-pair-change"));
  tree = render(f);
  expect(byId(tree, "managed-watchlist-pair-preview")).toBeDefined();
  expect(f.model.getSnapshot().selected).toHaveLength(2);
  click(byId(tree, "managed-watchlist-pair-select-1"));
  expect(f.model.getSnapshot().selected).toEqual([f.memberships[0]]);
});

it("renders complete passive readings and opens the current side with its actual opener", async () => {
  const source = await createScreenResearchReviewFixture();
  const visit = await source.open(0);
  source.model.capture(source.model.getSnapshot(), visit);
  const captured = source.model.getSnapshot().reading!.left!;
  const f = fixture();
  activate(f);
  f.install({ reading: { ...f.model.getSnapshot().reading!, left: captured } });
  const $ = load(
    renderToStaticMarkup(
      <ManagedWatchlistResearchPair
        workspace={f.workspace}
        navigationPending={false}
        onOpenSide={f.open}
      />,
    ),
  );
  expect($("[data-research-reading-side=left]")).toHaveLength(1);
  expect($("#managed-screen-research-document-left").text()).toBe(
    captured.document.text,
  );
  expect(
    $(
      "[data-research-reading-side] button, [data-research-reading-side] input",
    ),
  ).toHaveLength(0);
  const state = f.model.getSnapshot();
  const owner = focusContext().owner;
  click(byId(render(f), "managed-watchlist-pair-open-right"), owner);
  expect(f.open).toHaveBeenCalledWith(state, "right", owner);
  click(byId(render(f), "managed-watchlist-pair-clear-left"));
  expect(f.model.getSnapshot().reading?.left).toBeNull();
  click(byId(render(f), "managed-watchlist-pair-end"));
  expect(f.model.getSnapshot().reading).toBeNull();
});

it("focuses a committed preview once only while the initiating control still owns focus", () => {
  const f = fixture();
  f.install({ selected: f.memberships.slice(0, 2) });
  const focus = focusContext();
  let tree = render(f);
  commit(tree, focus.target);
  click(byId(tree, "managed-watchlist-pair-preview"), focus.owner);
  tree = render(f);
  commit(tree, focus.target);
  expect(focus.focus).toHaveBeenCalledTimes(1);
  f.install({});
  commit(render(f), focus.target);
  expect(focus.focus).toHaveBeenCalledTimes(1);
  click(byId(render(f), "managed-watchlist-pair-start"), focus.owner);
  focus.document.activeElement = {};
  commit(render(f), focus.target);
  expect(focus.focus).toHaveBeenCalledTimes(1);
});

it("shows capture only for an owned active side and never captures from stale or pending controls", () => {
  const f = fixture();
  expect(render(f, false, true)).toBeNull();
  activate(f);
  f.install({ activeSide: "left", canCapture: true });
  const stale = render(f, false, true);
  f.install({});
  click(byId(stale, "managed-watchlist-pair-capture"));
  click(byId(render(f, true, true), "managed-watchlist-pair-capture"));
  expect(f.capture).not.toHaveBeenCalled();
  const focus = focusContext();
  const current = render(f, false, true);
  commit(current, focus.target);
  click(byId(current, "managed-watchlist-pair-capture"), focus.owner);
  expect(f.capture).toHaveBeenCalledWith(expect.anything());
  focus.document.activeElement = {};
  commit(render(f, false, true), focus.target);
  expect(focus.focus).not.toHaveBeenCalled();
});

it("completes the rendered selection and capture flow with the real Watchlist pair model", async () => {
  const f = await createWatchlistResearchPairFixture();
  const workspace: Props["workspace"] = {
    watchlistResearchPair: f.model,
    captureWatchlistResearchReading: (state) =>
      f.model.capture(state, f.getVisit()),
  };
  const context = {
    workspace,
    open: vi.fn((_state: State, side: "left" | "right") => f.open(side)),
  };
  click(byId(render(context), "managed-watchlist-pair-select-0"));
  click(byId(render(context), "managed-watchlist-pair-select-2"));
  click(byId(render(context), "managed-watchlist-pair-preview"));
  expect(f.model.getSnapshot().reading).toBeNull();
  click(byId(render(context), "managed-watchlist-pair-start"));
  expect(f.annualRead).not.toHaveBeenCalled();

  // Main and Research capture are separate mounted slots with separate hook state.
  const resetMount = () => {
    hooks.slots = [];
    hooks.effects = [];
  };
  click(byId(render(context), "managed-watchlist-pair-open-left"));
  resetMount();
  expect(
    byId(render(context, false, true), "managed-watchlist-pair-capture").props
      .disabled,
  ).toBe(true);
  await f.loadAnnual();
  click(byId(render(context, false, true), "managed-watchlist-pair-capture"));
  const first = f.model.getSnapshot().reading!.left!;
  expect(first.evidence.annual?.response).toEqual(f.packet);
  f.back();
  f.note("A changed current thesis does not replace the retained reading.");
  expect(f.model.getSnapshot().reading!.left).toBe(first);
  resetMount();
  click(byId(render(context), "managed-watchlist-pair-open-right"));
  f.valuation.discardAndUse(f.getVisit().selection);
  f.valuation.calculate();
  f.model.reconcile();
  resetMount();
  click(byId(render(context, false, true), "managed-watchlist-pair-capture"));
  f.back();
  hooks.direct = false;
  const $ = load(
    renderToStaticMarkup(
      <ManagedWatchlistResearchPair
        workspace={workspace}
        navigationPending={false}
        onOpenSide={context.open}
      />,
    ),
  );
  expect($("[data-research-reading-side]")).toHaveLength(2);
  expect($("#managed-screen-research-document-left").text()).toBe(
    first.document.text,
  );
  expect($.text()).toContain(
    "A changed current thesis does not replace the retained reading.",
  );
  expect(f.annualRead).toHaveBeenCalledTimes(1);
  expect(f.unexpected).not.toHaveBeenCalled();
});

it.each([
  "unchanged",
  "newer-state",
  "hidden",
  "disconnected",
  "navigation",
] as const)(
  "capture focus respects its committed action and %s context",
  (condition) => {
    const f = fixture();
    activate(f);
    f.install({ activeSide: "right", canCapture: true });
    const focus = focusContext();
    const tree = render(f, false, true);
    commit(tree, focus.target);
    click(byId(tree, "managed-watchlist-pair-capture"), focus.owner);
    if (condition === "newer-state") f.install({});
    if (condition === "hidden") focus.target.getClientRects = () => [];
    if (condition === "disconnected") focus.target.isConnected = false;
    commit(render(f, condition === "navigation", true), focus.target);
    expect(focus.focus).toHaveBeenCalledTimes(
      condition === "unchanged" ? 1 : 0,
    );
    commit(render(f, false, true), focus.target);
    expect(focus.focus).toHaveBeenCalledTimes(
      condition === "unchanged" ? 1 : 0,
    );
  },
);
