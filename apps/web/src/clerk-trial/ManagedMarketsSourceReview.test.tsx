import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ManagedMarketsSourceReview,
  type ManagedMarketsSourceReviewModel,
  type ManagedMarketsSourceReviewProps,
} from "./ManagedMarketsSourceReview";
import type {
  ManagedMarketsSourceReviewState,
  MarketsSourceOutcome,
  MarketsSourceReviewRow,
} from "./managed-markets-source-review-types";
import { filingsSelection } from "./sec-filings-fixture";
import { ManagedMarketsSourceReview as SourceReviewController } from "./managed-markets-source-review";
import type {
  MarketsSourceReviewPort,
  MarketsSourceView,
} from "./managed-markets-source-review-types";

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
interface ElementProps {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  checked?: boolean;
  onClick?: () => void;
  onChange?: (event: { currentTarget: { checked: boolean } }) => void;
  onToggle?: (event: { currentTarget: { open: boolean } }) => void;
}
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(node)) return [];
  if (typeof node.type === "function") {
    return elements(
      (node.type as (props: ElementProps) => React.ReactNode)(node.props),
    );
  }
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
function control(node: React.ReactNode, id: string) {
  const result = elements(node).find((element) => element.props.id === id);
  if (!result) throw new Error(`Missing control ${id}`);
  return result.props;
}
function render(props: ManagedMarketsSourceReviewProps) {
  hooks.index = 0;
  const node = ManagedMarketsSourceReview(props);
  for (const effect of hooks.effects.splice(0)) effect();
  return node;
}
function toggle(node: React.ReactNode, open: boolean) {
  control(node, "managed-markets-source-review").onToggle?.({
    currentTarget: { open },
  });
}
function open(props: ManagedMarketsSourceReviewProps) {
  toggle(render(props), true);
  return render(props);
}
function click(node: React.ReactNode, suffix: string) {
  control(node, `markets-source-review-${suffix}`).onClick?.();
}
function hasCleanup(slot: unknown): slot is { cleanup: () => void } {
  return Boolean(
    slot &&
    typeof slot === "object" &&
    "cleanup" in slot &&
    typeof slot.cleanup === "function",
  );
}
function unmount() {
  for (const slot of hooks.slots) if (hasCleanup(slot)) slot.cleanup();
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
afterEach(unmount);
const priceEvidence =
  "Daily source period: 2026-10-20 to 2026-10-23.\nRetrieved 2026-10-24T02:03:04.000Z. Raw close; not adjusted for splits or dividends.";
function row(id: string, label: string): MarketsSourceReviewRow {
  return {
    id,
    label,
    identity: null,
    eligible: true,
    busy: false,
    loaded: false,
    evidence: "Not checked.",
    selected: true,
    mode: "load",
    outcome: "not_attempted",
  };
}
function initialRows() {
  return [
    {
      ...row("price-one", "First board close history"),
      identity: filingsSelection.listing,
      evidence: priceEvidence,
    },
    {
      ...row("price-two", "Second board close history"),
      identity: {
        ...filingsSelection.listing,
        listingId: "listing-two",
        symbol: "TWO",
        shareClassId: "class-b",
        shareClassName: "Class B",
      },
      loaded: true,
      selected: false,
      mode: "refresh" as const,
      outcome: "retained" as const,
      evidence:
        "Original close source date 2026-10-22; retrieved 2026-10-23T01:00:00.000Z.",
    },
    {
      ...row("price-unresolved", "Unresolved board listing"),
      eligible: false,
      selected: false,
      evidence: "The exact board listing is not admitted.",
    },
    {
      ...row("bls", "BLS release calendar"),
      evidence:
        "Scheduled releases; no released values. Retrieved 2026-10-23T04:00:00.000Z.",
    },
    {
      ...row("bea", "BEA release agenda"),
      evidence:
        "Schedule as published 2026-10-21; retrieved 2026-10-24T05:06:07.000Z.",
    },
    {
      ...row("fed", "Federal Reserve announcements"),
      loaded: true,
      selected: false,
      mode: "refresh" as const,
      outcome: "checked_empty" as const,
      evidence:
        "Checked 2026-10-24T06:00:00.000Z; no announcements in the retained source window.",
    },
  ];
}
function fixture() {
  let state: ManagedMarketsSourceReviewState = {
    phase: "draft",
    rows: initialRows(),
    plan: [],
    message: "Preview the selected source reads.",
    canPreview: true,
    canStart: false,
  };
  const choose = vi.fn((id: string, selected: boolean) => {
    state = {
      ...state,
      phase: "draft",
      plan: [],
      canStart: false,
      rows: state.rows.map((item) =>
        item.id === id ? { ...item, selected } : item,
      ),
    };
  });
  const preview = vi.fn(() => {
    state = {
      ...state,
      phase: "preview",
      plan: state.rows.filter((item) => item.selected),
      canStart: true,
    };
  });
  const start = vi.fn(() => {
    state = {
      ...state,
      phase: "running",
      canStart: false,
      canPreview: false,
      message: "Reading the first selected source.",
    };
    return Promise.resolve();
  });
  const cancel = vi.fn(() => {
    state = {
      ...state,
      phase: "cancelled",
      canStart: false,
      message: "Completed packets remain; remaining reads were not attempted.",
    };
  });
  const model = {
    getSnapshot: () => state,
    subscribe: vi.fn(() => () => false),
    choose,
    preview,
    start,
    cancel,
  } satisfies ManagedMarketsSourceReviewModel;
  return {
    model,
    props: {
      model,
      isCurrent: () => true,
    } satisfies ManagedMarketsSourceReviewProps,
    publish: (next: Partial<ManagedMarketsSourceReviewState>) => {
      state = { ...state, ...next };
    },
  };
}
it("starts closed and shows six full source rows with original evidence and exact identity", () => {
  const f = fixture();
  const $ = load(renderToStaticMarkup(render(f.props)));
  expect($("#managed-markets-source-review").attr("open")).toBeUndefined();
  expect($("summary").text()).toBe("Markets source review");
  expect($(".managed-markets-source-review-rows > li")).toHaveLength(6);
  expect($("input[type=checkbox]")).toHaveLength(6);
  for (const value of Object.values(filingsSelection.listing))
    expect($.text()).toContain(value);
  expect($.text()).toContain(priceEvidence);
  expect($.text()).toContain("Refresh Second board close history");
  expect($.text()).toContain("Load BLS release calendar");
  expect($.text()).toContain("Unavailable for this plan");
  expect($.text()).not.toContain("all current");
});
it("chooses only an eligible idle source and makes no source start during preview", () => {
  const f = fixture();
  let node = open(f.props);
  control(node, "markets-source-review-choice-price-two").onChange?.({
    currentTarget: { checked: true },
  });
  expect(f.model.choose).toHaveBeenCalledExactlyOnceWith("price-two", true);
  node = render(f.props);
  control(node, "markets-source-review-choice-price-unresolved").onChange?.({
    currentTarget: { checked: true },
  });
  expect(f.model.choose).toHaveBeenCalledTimes(1);
  click(node, "preview");
  expect(f.model.preview).toHaveBeenCalledOnce();
  expect(f.model.start).not.toHaveBeenCalled();
  expect(
    load(renderToStaticMarkup(render(f.props)))(
      "#markets-source-review-plan li",
    ),
  ).toHaveLength(4);
});
it("preserves the complete original Load plan when the live result becomes Refresh", () => {
  const f = fixture();
  click(open(f.props), "preview");
  const originalPlan = f.model.getSnapshot().plan;
  f.publish({
    phase: "complete",
    rows: f.model.getSnapshot().rows.map((item) =>
      item.id === "price-one"
        ? {
            ...item,
            mode: "refresh",
            loaded: true,
            selected: false,
            outcome: "checked",
            evidence: "Newly retrieved 2026-10-25T07:00:00.000Z.",
          }
        : item,
    ),
  });
  const $ = load(renderToStaticMarkup(render(f.props)));
  expect($("#markets-source-review-plan h4").first().text()).toBe(
    "Load First board close history",
  );
  expect($("#markets-source-review-plan").text()).toContain(priceEvidence);
  expect($("#markets-source-review-plan").text()).toContain(
    "This plan records the selected actions and evidence before Start. Current results are shown above.",
  );
  expect($("[data-source-id=price-one]").text()).toContain(
    "Newly retrieved 2026-10-25T07:00:00.000Z.",
  );
  expect(f.model.getSnapshot().plan).toBe(originalPlan);
});
it("starts the current preview once and refuses a retained duplicate Start", () => {
  const f = fixture();
  click(open(f.props), "start");
  expect(f.model.start).not.toHaveBeenCalled();
  click(render(f.props), "preview");
  const startAction = control(
    render(f.props),
    "markets-source-review-start",
  ).onClick;
  startAction?.();
  startAction?.();
  expect(f.model.start).toHaveBeenCalledOnce();
  expect(
    control(render(f.props), "markets-source-review-choice-bls").disabled,
  ).toBe(true);
  const $ = load(renderToStaticMarkup(render(f.props)));
  expect($("progress").attr("aria-label")).toBe(
    "Selected source reads in progress",
  );
  expect($("[role=status]").text()).toContain(
    "Reading the first selected source.",
  );
});
it.each(["preview", "running"] as const)(
  "closing %s cancels and a reopened disclosure cannot revive old Start",
  (phase) => {
    const f = fixture();
    click(open(f.props), "preview");
    if (phase === "running") click(render(f.props), "start");
    const node = render(f.props);
    const oldStart = control(node, "markets-source-review-start").onClick;
    toggle(node, false);
    expect(f.model.cancel).toHaveBeenCalledOnce();
    oldStart?.();
    let reopened = render(f.props);
    toggle(reopened, true);
    reopened = render(f.props);
    oldStart?.();
    click(reopened, "start");
    expect(f.model.start).toHaveBeenCalledTimes(phase === "running" ? 1 : 0);
  },
);
it("closing cancels the current running pass even before a progress render commits", () => {
  const f = fixture();
  click(open(f.props), "preview");
  click(render(f.props), "start");
  const node = render(f.props);
  f.publish({ message: "The next source is reading." });
  toggle(node, false);
  expect(f.model.cancel).toHaveBeenCalledOnce();
});
it("keeps all source actions inert while the disclosure is hidden", () => {
  const f = fixture();
  const hidden = render(f.props);
  click(hidden, "preview");
  click(hidden, "start");
  control(hidden, "markets-source-review-choice-bls").onChange?.({
    currentTarget: { checked: false },
  });
  expect(f.model.preview).not.toHaveBeenCalled();
  expect(f.model.start).not.toHaveBeenCalled();
  expect(f.model.choose).not.toHaveBeenCalled();
});
it("refuses old callbacks after a different controller commits", () => {
  const first = fixture();
  click(open(first.props), "preview");
  const old = render(first.props);
  const second = fixture();
  render(second.props);
  click(old, "start");
  click(old, "cancel");
  toggle(old, false);
  control(old, "markets-source-review-choice-bls").onChange?.({
    currentTarget: { checked: false },
  });
  expect(first.model.start).not.toHaveBeenCalled();
  expect(first.model.cancel).toHaveBeenCalledOnce();
  expect(first.model.choose).not.toHaveBeenCalled();
  expect(second.model.start).not.toHaveBeenCalled();
});
it.each(["disabled", "not current"])(
  "refuses both retained and fresh callbacks when %s",
  (reason) => {
    const f = fixture();
    click(open(f.props), "preview");
    const old = render(f.props);
    const props =
      reason === "disabled"
        ? { ...f.props, disabled: true }
        : { ...f.props, isCurrent: () => false };
    const next = render(props);
    for (const node of [old, next]) {
      click(node, "start");
      click(node, "cancel");
      control(node, "markets-source-review-choice-bls").onChange?.({
        currentTarget: { checked: false },
      });
    }
    expect(f.model.start).not.toHaveBeenCalled();
    expect(f.model.cancel).not.toHaveBeenCalled();
    expect(f.model.choose).not.toHaveBeenCalled();
  },
);
it("rechecks current lifetime and snapshot at dispatch, before another render", () => {
  const f = fixture();
  let current = true;
  const props = { ...f.props, isCurrent: () => current };
  click(open(props), "preview");
  const node = render(props);
  current = false;
  click(node, "start");
  current = true;
  f.publish({ message: "Another source changed." });
  click(node, "start");
  expect(f.model.start).not.toHaveBeenCalled();
});
it("blocks synchronous reentry even before the controller publishes a new snapshot", () => {
  const f = fixture();
  click(open(f.props), "preview");
  const startAction = control(
    render(f.props),
    "markets-source-review-start",
  ).onClick;
  f.model.start.mockImplementation(() => {
    startAction?.();
    return Promise.resolve();
  });
  startAction?.();
  expect(f.model.start).toHaveBeenCalledOnce();
});
it("cancels a running pass explicitly and refuses callbacks after unmount", () => {
  const f = fixture();
  click(open(f.props), "preview");
  click(render(f.props), "start");
  const node = render(f.props);
  click(node, "cancel");
  expect(f.model.cancel).toHaveBeenCalledOnce();
  const next = render(f.props);
  unmount();
  click(next, "preview");
  expect(f.model.preview).toHaveBeenCalledTimes(1);
});
it.each([
  ["not_attempted", "Not attempted"],
  ["retained", "Retained previous evidence"],
  ["running", "Reading source"],
  ["checked", "Checked"],
  ["checked_empty", "Checked empty"],
  ["failed", "Failed"],
  ["cancelled", "Cancelled"],
] satisfies [MarketsSourceOutcome, string][])(
  "shows %s with its original evidence in text",
  (outcome, label) => {
    const f = fixture();
    f.publish({
      rows: f.model
        .getSnapshot()
        .rows.map((item) =>
          item.id === "price-one" ? { ...item, outcome } : item,
        ),
    });
    const $ = load(renderToStaticMarkup(render(f.props)));
    expect($("[data-source-id=price-one] [data-source-outcome]").text()).toBe(
      label,
    );
    expect($("[data-source-id=price-one]").text()).toContain(priceEvidence);
  },
);
it("keeps busy choices inert and permits a new explicit preview after context retirement", () => {
  const f = fixture();
  f.publish({
    phase: "retired",
    rows: f.model
      .getSnapshot()
      .rows.map((item) => (item.id === "bls" ? { ...item, busy: true } : item)),
  });
  const node = open(f.props);
  control(node, "markets-source-review-choice-bls").onChange?.({
    currentTarget: { checked: false },
  });
  expect(f.model.choose).not.toHaveBeenCalled();
  expect(control(node, "markets-source-review-choice-bls").disabled).toBe(true);
  click(node, "preview");
  expect(f.model.preview).toHaveBeenCalledOnce();
});

function acceptedSource(original: MarketsSourceReviewRow) {
  let view: MarketsSourceView = {
    token: {},
    label: original.label,
    identity: original.identity,
    eligible: original.eligible,
    busy: false,
    loaded: original.loaded,
    empty: false,
    evidence: original.evidence,
  };
  const load = vi.fn(() => {
    view = {
      ...view,
      token: {},
      loaded: true,
      empty: original.id === "bls",
      evidence: `Original ${original.label} packet retrieved 2026-10-25T08:00:00.000Z.`,
    };
    return Promise.resolve("accepted" as const);
  });
  const port: MarketsSourceReviewPort = {
    id: original.id,
    read: () => view,
    load,
    cancel: vi.fn(),
    subscribe: () => () => undefined,
  };
  return { port, load };
}
it("connects Preview and Start to the real controller and retains the original plan after checked-empty", async () => {
  const sources = initialRows().map(acceptedSource);
  const model = new SourceReviewController(
    sources.map(({ port }) => port),
    () => true,
  );
  const startSpy = vi.spyOn(model, "start");
  const props = { model, isCurrent: () => true };
  click(open(props), "preview");
  expect(sources.every(({ load }) => load.mock.calls.length === 0)).toBe(true);
  click(render(props), "start");
  const result = startSpy.mock.results[0];
  if (!result || result.type !== "return")
    throw new Error("Start did not return its completion.");
  await result.value;
  const $ = load(renderToStaticMarkup(render(props)));
  expect(model.getSnapshot().phase).toBe("complete");
  expect($("#markets-source-review-plan h4").first().text()).toBe(
    "Load First board close history",
  );
  expect($("[data-source-id=bls] [data-source-outcome]").text()).toBe(
    "Checked empty",
  );
  expect(
    sources
      .filter(({ load }) => load.mock.calls.length === 1)
      .map(({ port }) => port.id),
  ).toEqual(["price-one", "bls", "bea"]);
  expect($("[data-source-id=bls]").text()).toContain(
    "Original BLS release calendar packet retrieved 2026-10-25T08:00:00.000Z.",
  );
  model.retire();
});

it("cancels only the old model on replacement and keeps normal running renders active", () => {
  const first = fixture();
  click(open(first.props), "preview");
  click(render(first.props), "start");
  render(first.props);
  first.publish({ message: "The next source is reading." });
  render(first.props);
  expect(first.model.cancel).not.toHaveBeenCalled();
  const next = fixture();
  render(next.props);
  expect(first.model.cancel).toHaveBeenCalledOnce();
  expect(next.model.cancel).not.toHaveBeenCalled();
});
it("unmount ends the real controller's preview and retained Start cannot revive it", () => {
  const sources = initialRows().map(acceptedSource);
  const model = new SourceReviewController(
    sources.map(({ port }) => port),
    () => true,
  );
  const props = { model, isCurrent: () => true };
  click(open(props), "preview");
  const node = render(props);
  expect(model.getSnapshot().phase).toBe("preview");
  unmount();
  expect(model.getSnapshot().phase).toBe("cancelled");
  click(node, "start");
  expect(sources.every(({ load }) => load.mock.calls.length === 0)).toBe(true);
  model.retire();
});
it("unmount cancels a running pass on the same still-current workspace model", () => {
  const f = fixture();
  click(open(f.props), "preview");
  click(render(f.props), "start");
  render(f.props);
  unmount();
  expect(f.model.cancel).toHaveBeenCalledOnce();
});
