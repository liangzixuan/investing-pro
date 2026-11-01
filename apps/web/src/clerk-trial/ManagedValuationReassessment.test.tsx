import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { collectionFixture } from "./test-valuation-collection-fixture";
import { ManagedValuationReassessment } from "./managed-valuation-reassessment";
import { ManagedValuationAssumptions } from "./ManagedValuationAssumptions";
import { ManagedValuationWorkbench } from "./ManagedValuationWorkbench";
import { ManagedValuationReassessmentReading } from "./ManagedValuationReassessmentReading";
import type { ManagedValuationWorkbench as WorkbenchModel } from "./managed-valuation-workbench";
import { captureValuationCalculationGuard } from "./managed-valuation-workbench";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";

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
    useId: () => (hooks.direct ? "reassessment-ui" : actual.useId()),
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
const closes: (() => void)[] = [];
beforeEach(() => {
  hooks.direct = false;
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
afterEach(() => {
  for (const close of closes.splice(0)) close();
  vi.unstubAllGlobals();
});
type Props = {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  id?: string;
  ref?: React.RefObject<HTMLHeadingElement | null>;
  "data-valuation-listing-id"?: string;
};
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
function label(node: React.ReactElement<Props>) {
  return React.Children.toArray(node.props.children)
    .filter((item) => typeof item === "string")
    .join("");
}
function fill(model: WorkbenchModel) {
  model.setDcfField("startingUnleveredCashFlowUsd", "100.125");
  model.setDcfField("enterpriseToEquityBridgeUsd", "-50");
  model.setDcfField("dilutedShares", "10");
  model.setDcfField("waccPercent", "10");
  model.setDcfField("terminalGrowthPercent", "2");
  model.setExitField("baseRevenue", "1000");
  model.setExitField("cash", "50");
  model.setExitField("debt", "20");
  model.setExitField("dilutedShares", "10");
  model.setExitField("discountRatePercent", "10");
  for (const [scenario, growth] of [
    ["conservative", "0"],
    ["base", "5"],
    ["expansion", "10"],
  ] as const) {
    model.setDcfScenario(scenario, growth);
    model.setExitScenario(scenario, "annualRevenueGrowthPercent", growth);
    model.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    model.setExitScenario(scenario, "exitMultiple", "10");
  }
}
async function fixture(savedInvalid = false) {
  const f = await collectionFixture();
  f.recovery.dispose();
  const editor = f.workspace.valuation;
  fill(editor);
  if (savedInvalid)
    editor.setDcfField("startingUnleveredCashFlowUsd", "<img invalid>");
  const entry = editor.captureInputs()!.entry;
  f.setStored(7, { ...f.payload, entries: [entry, f.payload.entries[1]!] });
  await f.workspace.valuationAssumptions.coordinator.load();
  fill(editor);
  let time = "2026-11-01T10:00:00.000Z";
  const model = new ManagedValuationReassessment(
    editor,
    f.workspace.valuationAssumptions,
    { now: () => time },
  );
  closes.push(() => {
    model.retire();
    f.close();
  });
  const saved = f.workspace.valuationAssumptions.coordinator.getSnapshot();
  const confirmed = saved.saved!.payload.entries[0]!;
  const noteActions = {
    prepare: vi.fn().mockReturnValue({ preview: null, reason: null }),
    isCurrent: vi.fn().mockReturnValue(true),
    append: vi.fn(),
  };
  const focus = vi.fn();
  const render = (
    kind: "saved" | "workbench",
    pending = false,
    commit = true,
    connected = true,
  ) => {
    hooks.direct = true;
    hooks.index = 0;
    hooks.effects = [];
    const node =
      kind === "saved"
        ? ManagedValuationAssumptions({
            model: f.workspace.valuationAssumptions,
            workbench: editor,
            navigationPending: pending,
            reassessment: model,
          })
        : ManagedValuationWorkbench({
            model: editor,
            reassessment: model,
            selection: editor.getSnapshot().owner!,
            navigationPending: pending,
            noteActions,
            watchlist: {
              member: null,
              canAdd: false,
              canEdit: false,
              reason: null,
            },
          });
    const all = elements(node);
    hooks.direct = false;
    for (const element of all) {
      if (element.type === "h4" && element.props.ref)
        element.props.ref.current = {
          focus,
          isConnected: connected,
        } as unknown as HTMLHeadingElement;
    }
    if (commit) hooks.effects.forEach((effect) => effect());
    return {
      node,
      all,
      button: (text: string) => {
        const result = all.find(
          (item) => item.type === "button" && label(item) === text,
        );
        if (!result) throw new Error(text);
        return result;
      },
    };
  };
  return {
    ...f,
    editor,
    model,
    saved,
    confirmed,
    focus,
    render,
    noteActions,
    later: () => {
      time = "2026-11-01T11:00:00.000Z";
    },
  };
}
function click(button: React.ReactElement<Props>) {
  button.props.onClick!();
}
function unmount() {
  for (const item of hooks.slots)
    if (item && typeof item === "object" && "cleanup" in item)
      (item as ValuationTestEffectSlot).cleanup?.();
}
it("captures only the matching confirmed entry without changing drafts or calculating, then focuses its committed full baseline", async () => {
  const f = await fixture();
  const calculate = vi.spyOn(f.editor, "calculate");
  const before = f.editor.getSnapshot();
  const view = f.render("saved");
  const choices = view.all.filter(
    (item) =>
      item.type === "button" && label(item) === "Use as reassessment baseline",
  );
  expect(choices).toHaveLength(2);
  expect(choices[0]!.props.disabled).toBe(false);
  expect(choices[1]!.props.disabled).toBe(true);
  click(choices[1]!);
  expect(f.model.getSnapshot().baseline).toBeNull();
  click(choices[0]!);
  expect(f.editor.getSnapshot()).toBe(before);
  expect(f.workspace.valuationAssumptions.coordinator.getSnapshot()).toBe(
    f.saved,
  );
  expect(calculate).not.toHaveBeenCalled();
  expect(f.focus).not.toHaveBeenCalled();
  const captured = f.render("saved");
  expect(
    captured.all.some(
      (item) => item.props.id === "managed-valuation-reassessment-heading",
    ),
  ).toBe(true);
  expect(f.focus).toHaveBeenCalledTimes(1);
  f.render("saved");
  expect(f.focus).toHaveBeenCalledTimes(1);
  expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
});
it("uses one Calculate action for full saved/revised readings and keeps baseline outside current-result authority", async () => {
  const f = await fixture();
  f.model.capture(f.confirmed, f.saved);
  f.editor.setExitField("baseRevenue", "1200");
  f.later();
  const calculate = vi.spyOn(f.editor, "calculate");
  const initial = f.render("workbench");
  expect(
    initial.all.filter(
      (node) => node.type === "button" && label(node).startsWith("Calculate "),
    ),
  ).toHaveLength(1);
  click(initial.button("Calculate saved and revised scenarios"));
  expect(calculate).toHaveBeenCalledTimes(1);
  const state = f.model.getSnapshot();
  expect(state.reading).not.toBeNull();
  expect(
    captureValuationCalculationGuard(state.reading!.savedCalculation),
  ).toBeNull();
  expect(
    captureValuationCalculationGuard(state.reading!.revisedCalculation)?.(),
  ).toBe(true);
  expect(f.focus).not.toHaveBeenCalled();
  f.render("workbench");
  expect(f.focus).toHaveBeenCalledTimes(1);
  const html = renderToStaticMarkup(
    <ManagedValuationReassessmentReading
      baseline={state.baseline!}
      reading={state.reading!}
    />,
  );
  expect(html).toContain('aria-label="Saved inputs evaluated now"');
  expect(html).toContain('aria-label="Revised authored inputs"');
  expect(html).toContain("2026-11-01T10:00:00.000Z");
  expect(html).toContain("2026-11-01T11:00:00.000Z");
  expect(html).toContain("Saved resource version</dt><dd>7");
  expect(html).toContain("Price and Annual source context is not retained");
  expect(html.match(/<tbody>/gu)).toHaveLength(14);
  expect(html.match(/<tr>/gu)).toHaveLength(156);
  expect(
    html.match(/DCF sensitivity: 25 base-scenario combinations/gu),
  ).toHaveLength(2);
  expect(
    html.match(/Exit multiple sensitivity: 25 base-scenario combinations/gu),
  ).toHaveLength(2);
  for (const calculation of [
    state.reading!.savedCalculation,
    state.reading!.revisedCalculation,
  ]) {
    if (
      calculation.dcfResult.status !== "available" ||
      calculation.exitResult.status !== "available"
    )
      throw new Error("Fixture calculation unavailable");
    for (const scenario of ["conservative", "base", "expansion"] as const) {
      expect(html).toContain(
        calculation.dcfResult.scenarios[scenario].projection[4]!.cashFlowUsd,
      );
      expect(html).toContain(
        calculation.exitResult.scenarios[scenario].valuePerShare,
      );
    }
  }
  const ids = [...html.matchAll(/ id="([^"]+)"/gu)].map((row) => row[1]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<input");
});
it.each([false, true])(
  "keeps independent model refusals and escaped raw text on either side (saved invalid=%s)",
  async (savedInvalid) => {
    const f = await fixture(savedInvalid);
    f.model.capture(f.confirmed, f.saved);
    if (!savedInvalid)
      f.editor.setDcfField(
        "startingUnleveredCashFlowUsd",
        "<script>unfinished</script>",
      );
    f.model.calculate(f.model.getSnapshot(), f.editor.getSnapshot());
    const state = f.model.getSnapshot();
    const html = renderToStaticMarkup(
      <ManagedValuationReassessmentReading
        baseline={state.baseline!}
        reading={state.reading!}
      />,
    );
    expect(html.match(/Cash flow DCF unavailable\./gu)).toHaveLength(1);
    expect(html).not.toContain("Exit multiple unavailable.");
    expect(html).toContain("Cash flow DCF inputs");
    expect(html).toContain("Exit EBITDA multiple inputs");
    expect(html).toContain(
      savedInvalid
        ? "&lt;img invalid&gt;"
        : "&lt;script&gt;unfinished&lt;/script&gt;",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  },
);
it("refuses stale, pending and unmounted capture handlers", async () => {
  const f = await fixture();
  const prior = f.render("saved").button("Use as reassessment baseline");
  const pending = f
    .render("saved", true)
    .button("Use as reassessment baseline");
  click(prior);
  click(pending);
  expect(f.model.getSnapshot().baseline).toBeNull();
  const current = f.render("saved").button("Use as reassessment baseline");
  unmount();
  click(current);
  expect(f.model.getSnapshot().baseline).toBeNull();
  expect(f.focus).not.toHaveBeenCalled();
});
it("refuses stale/pending/discarded Calculate handlers and over-limit rejected input", async () => {
  const f = await fixture();
  f.model.capture(f.confirmed, f.saved);
  const calculate = vi.spyOn(f.editor, "calculate");
  const prior = f
    .render("workbench")
    .button("Calculate saved and revised scenarios");
  const pending = f
    .render("workbench", true)
    .button("Calculate saved and revised scenarios");
  click(prior);
  click(pending);
  const discarded = f
    .render("workbench", false, false)
    .button("Calculate saved and revised scenarios");
  click(discarded);
  expect(calculate).not.toHaveBeenCalled();
  f.editor.setDcfField("startingUnleveredCashFlowUsd", "1".repeat(513));
  const rejected = f
    .render("workbench")
    .button("Calculate saved and revised scenarios");
  expect(rejected.props.disabled).toBe(true);
  click(rejected);
  expect(calculate).not.toHaveBeenCalled();
  expect(f.model.getSnapshot().reading).toBeNull();
});
it.each(["pending", "changed", "disconnected", "other-focus"] as const)(
  "does not move focus after a calculated action becomes %s",
  async (boundary) => {
    const f = await fixture();
    f.model.capture(f.confirmed, f.saved);
    const original = {} as Element;
    const doc = { activeElement: original, body: {} };
    if (boundary === "other-focus") vi.stubGlobal("document", doc);
    click(
      f.render("workbench").button("Calculate saved and revised scenarios"),
    );
    if (boundary === "changed") f.editor.setExitField("baseRevenue", "1300");
    if (boundary === "other-focus") doc.activeElement = {} as Element;
    f.render(
      "workbench",
      boundary === "pending",
      true,
      boundary !== "disconnected",
    );
    expect(f.focus).not.toHaveBeenCalled();
  },
);
it("cancel clears only reassessment and stale cancel cannot clear a later capture", async () => {
  const f = await fixture();
  f.model.capture(f.confirmed, f.saved);
  f.model.calculate(f.model.getSnapshot(), f.editor.getSnapshot());
  const before = f.editor.getSnapshot();
  const savedBefore =
    f.workspace.valuationAssumptions.coordinator.getSnapshot();
  const stale = f.render("saved").button("Cancel reassessment");
  f.model.capture(f.confirmed, f.saved);
  click(stale);
  expect(f.model.getSnapshot().baseline).not.toBeNull();
  click(f.render("saved").button("Cancel reassessment"));
  expect(f.model.getSnapshot().baseline).toBeNull();
  expect(f.model.getSnapshot().reading).toBeNull();
  expect(f.editor.getSnapshot()).toBe(before);
  expect(f.workspace.valuationAssumptions.coordinator.getSnapshot()).toBe(
    savedBefore,
  );
  expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("refuses an ordinary Calculate callback after a baseline was captured before rerender", async () => {
  const f = await fixture();
  const calculate = vi.spyOn(f.editor, "calculate");
  const stale = f.render("workbench").button("Calculate authored scenarios");
  f.model.capture(f.confirmed, f.saved);
  click(stale);
  expect(calculate).not.toHaveBeenCalled();
  expect(f.model.getSnapshot().reading).toBeNull();
});
