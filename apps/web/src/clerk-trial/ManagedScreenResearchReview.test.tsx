import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createScreenResearchReviewFixture } from "./test-screen-research-review-fixture";
import {
  ManagedScreenResearchCapture,
  ManagedScreenResearchReview,
} from "./ManagedScreenResearchReview";
import {
  CapturedSourcePacket,
  ManagedScreenResearchReading,
} from "./ManagedScreenResearchReading";
import { eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";

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
    useMemo: (factory: () => unknown, deps: React.DependencyList) =>
      hooks.direct ? factory() : actual.useMemo(factory, deps),
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
afterEach(() => vi.useRealTimers());
type Fixture = Awaited<ReturnType<typeof createScreenResearchReviewFixture>>;
function workspace(f: Fixture) {
  return {
    screenResearchReview: f.model,
    captureScreenResearchReading: vi.fn(
      (state: ReturnType<typeof f.model.getSnapshot>) =>
        f.model.capture(state, f.getVisit()),
    ),
  };
}
type ElementProps = {
  children?: React.ReactNode;
  id?: string;
  disabled?: boolean;
  onToggle?: React.ToggleEventHandler<HTMLDetailsElement>;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ref?: React.RefObject<HTMLHeadingElement | null>;
};
function nodes(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
}
function byId(node: React.ReactNode, id: string) {
  return nodes(node).find((item) => item.props.id === id)!;
}
function click(node: React.ReactElement<ElementProps>) {
  node.props.onClick?.({
    currentTarget: {},
  } as React.MouseEvent<HTMLButtonElement>);
}
function renderCapture(w: ReturnType<typeof workspace>, pending = false) {
  hooks.direct = true;
  hooks.index = 0;
  return ManagedScreenResearchCapture({
    workspace: w,
    navigationPending: pending,
  });
}
function commit(node: React.ReactNode, focus = vi.fn(), connected = true) {
  const heading = byId(node, "managed-screen-research-capture-heading");
  if (heading?.props.ref)
    heading.props.ref.current = {
      isConnected: connected,
      focus,
    } as unknown as HTMLHeadingElement;
  for (const effect of hooks.effects.splice(0)) effect();
  return focus;
}

it("renders two complete real-model captures with separate documents, source dates and passive valuation refusals", async () => {
  const f = await createScreenResearchReviewFixture();
  const first = await f.open(0);
  f.setWatchlist({
    member: {
      ...first.selection.listing,
      note: "  Complete thesis\n理由 <raw>  ",
    },
    canEdit: true,
  });
  f.valuation.setDcfField("startingUnleveredCashFlowUsd", "1e8");
  f.valuation.calculate();
  f.model.reconcile();
  expect(f.model.capture(f.model.getSnapshot(), first)).not.toBeNull();
  f.back();
  f.setWatchlist({ member: null, canEdit: false, canAdd: true });
  const second = await f.open(1);
  f.valuation.discardAndUse(second.selection);
  f.valuation.calculate();
  f.model.reconcile();
  expect(f.model.capture(f.model.getSnapshot(), second)).not.toBeNull();
  f.back();
  const state = f.model.getSnapshot();
  const html = renderToStaticMarkup(
    <ManagedScreenResearchReview
      workspace={workspace(f)}
      navigationPending={false}
      onOpenSide={vi.fn()}
    />,
  );
  const $ = load(html);
  expect($("[data-research-reading-side]")).toHaveLength(2);
  for (const side of ["left", "right"] as const) {
    const capture = state.reading![side]!;
    expect($(`#managed-screen-research-document-${side}`).text()).toBe(
      capture.document.text,
    );
    expect(
      $(`#managed-screen-research-document-${side}`).attr("aria-describedby"),
    ).toBe(`managed-screen-research-document-${side}-scope`);
    expect($(`[data-research-reading-side=${side}] button`)).toHaveLength(0);
    expect($(`[data-research-reading-side=${side}] input`)).toHaveLength(0);
    expect(html).toContain(capture.capturedAt);
    expect(html).toContain(capture.evaluatedAt!);
  }
  expect($(".managed-screen-research-raw").first().text()).toBe(
    "  Complete thesis\n理由 <raw>  ",
  );
  expect(html).toContain("1e8");
  expect(html).toContain("Standardized annual statements");
  expect(html).toContain("No Price source state was captured.");
  const ids = $("[id]")
    .map((_i, element) => $(element).attr("id"))
    .get();
  expect(new Set(ids).size).toBe(ids.length);
  expect(f.annualReport).toHaveBeenCalledTimes(2);
  expect(f.resolve).toHaveBeenCalledTimes(1);
});

it("keeps failed refreshes, all raw closes, empty Filings and original source checks distinct", async () => {
  const f = await createScreenResearchReviewFixture();
  const visit = await f.open(0);
  const filings = filingsResponse(0, "available", visit.selection);
  f.setEvidence({
    ...f.getEvidence(),
    price: {
      selection: visit.selection,
      available: true,
      selectedRange: "1m",
      response: eodResponse(),
      responseOrigin: "company",
      showingPrevious: true,
      running: false,
      catalogChanged: false,
      message: "Price refresh failed, previous history retained.",
      error: true,
    },
    filings: {
      selection: visit.selection,
      supported: true,
      response: filings,
      responseOrigin: "request",
      lastCheck: filings,
      refreshComparison: null,
      showingPrevious: false,
      running: false,
      catalogChanged: false,
      message: "Source checked; no matching entries.",
      error: false,
    },
  });
  const capture = f.model.capture(f.model.getSnapshot(), visit)!.reading!.left!;
  const html = renderToStaticMarkup(
    <ManagedScreenResearchReading capture={capture} />,
  );
  const $ = load(html);
  expect(html).toContain("The last Price request failed.");
  expect(html).toContain("Showing retained previous evidence.");
  expect(html).toContain("No matching filings were observed");
  expect(html).toContain("Last Filings source check");
  expect(html).toContain("100.25");
  expect(html).toContain("101.5");
  expect(html).toContain(filings.requestStartedAt);
  expect(html).toContain(filings.completedAt);
  expect($("textarea").text()).toBe(capture.document.text);
  expect($("button")).toHaveLength(0);
});

it("focuses only the committed capture once and never on background publication", async () => {
  const f = await createScreenResearchReviewFixture();
  await f.open(0);
  const w = workspace(f);
  let node = renderCapture(w);
  const focus = commit(node);
  expect(focus).not.toHaveBeenCalled();
  click(byId(node, "managed-screen-research-capture"));
  node = renderCapture(w);
  commit(node, focus);
  expect(focus).toHaveBeenCalledTimes(1);
  expect(w.captureScreenResearchReading).toHaveBeenCalledTimes(1);
  f.setWatchlist({ revision: Symbol() });
  node = renderCapture(w);
  commit(node, focus);
  expect(focus).toHaveBeenCalledTimes(1);
  node = renderCapture(w, true);
  commit(node, focus);
  node = renderCapture(w);
  commit(node, focus);
  expect(focus).toHaveBeenCalledTimes(1);
});

it.each(["pending", "disconnected", "reentrant"] as const)(
  "does not focus a capture after %s changes",
  async (mode) => {
    const f = await createScreenResearchReviewFixture();
    await f.open(0);
    const w = workspace(f);
    const first = renderCapture(w);
    const focus = commit(first);
    const stop =
      mode === "reentrant"
        ? f.model.subscribe(() => {
            if (f.model.getSnapshot().reading?.left) f.model.foreignClose();
          })
        : () => undefined;
    click(byId(first, "managed-screen-research-capture"));
    commit(
      renderCapture(w, mode === "pending"),
      focus,
      mode !== "disconnected",
    );
    stop();
    commit(renderCapture(w), focus);
    expect(focus).not.toHaveBeenCalled();
  },
);

it("rejects retained stale capture and side navigation handlers after model replacement", async () => {
  const f = await createScreenResearchReviewFixture();
  await f.open(0);
  const w = workspace(f);
  const stale = renderCapture(w);
  commit(stale);
  f.setWatchlist({ revision: Symbol() });
  click(byId(stale, "managed-screen-research-capture"));
  expect(w.captureScreenResearchReading).not.toHaveBeenCalled();
  f.model.capture(f.model.getSnapshot(), f.getVisit());
  f.back();
  const onOpenSide = vi.fn();
  hooks.index = 0;
  const panel = ManagedScreenResearchReview({
    workspace: w,
    navigationPending: false,
    onOpenSide,
  });
  f.model.clearSide(f.model.getSnapshot(), "left");
  click(byId(panel, "managed-screen-research-open-right"));
  expect(onOpenSide).not.toHaveBeenCalled();
  hooks.index = 0;
  const fresh = ManagedScreenResearchReview({
    workspace: w,
    navigationPending: false,
    onOpenSide,
  });
  click(byId(fresh, "managed-screen-research-open-right"));
  expect(onOpenSide).toHaveBeenCalledWith(f.model.getSnapshot(), "right", {});
});

it("does not serialize closed raw packets and renders the complete value after opening", () => {
  const serialize = vi.fn(() => ({
    rows: Array.from({ length: 160 }, (_, index) => ({
      index,
      raw: `  exact ${index} <value> 理由  `,
    })),
    retained: null,
  }));
  const value = Object.freeze({ toJSON: serialize });
  const render = () => {
    hooks.direct = true;
    hooks.index = 0;
    return CapturedSourcePacket({ label: "Complete invented source", value });
  };
  const closed = render();
  expect(serialize).not.toHaveBeenCalled();
  expect(renderToStaticMarkup(closed)).not.toContain("<pre");
  nodes(closed)[0]!.props.onToggle?.({
    currentTarget: { open: true },
  } as React.ToggleEvent<HTMLDetailsElement>);
  const opened = render();
  expect(serialize).toHaveBeenCalledTimes(1);
  const $ = load(renderToStaticMarkup(opened));
  expect($("pre").text()).toBe(
    JSON.stringify(serialize.mock.results[0]!.value, null, 2),
  );
  expect($("pre").text()).toContain("exact 159 <value> 理由");
  nodes(opened)[0]!.props.onToggle?.({
    currentTarget: { open: false },
  } as React.ToggleEvent<HTMLDetailsElement>);
  expect(renderToStaticMarkup(render())).not.toContain("<pre");
  expect(serialize).toHaveBeenCalledTimes(1);
});
