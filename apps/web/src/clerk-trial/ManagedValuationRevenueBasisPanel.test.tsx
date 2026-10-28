import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ManagedValuationRevenueBasisPanel } from "./ManagedValuationRevenueBasisPanel";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { ManagedValuationRevenueBasis } from "./managed-valuation-revenue-basis";
import { ManagedAnnualReport } from "./managed-annual-report";
import { annualReportPacket } from "./test-annual-report-fixture";
import { eodSelection } from "./eod-history-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import {
  dcfFields,
  exitFields,
  exitScenarioFields,
} from "./valuation-input-labels";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";

// Direct command/render checks with retained hook slots and observed focus.
// Hosted Android instrumentation separately exercises mounted production controls.
const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return {
    ...(await original<typeof React>()),
    ...createValuationDraftTestHooks(hooks),
    useId: () => "annual-basis-test",
  };
});
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === "function")
    return elements(
      (node.type as (props: unknown) => React.ReactNode)(node.props),
    );
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function content(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(content).join("");
  return React.isValidElement<{ children?: React.ReactNode }>(node)
    ? content(node.props.children)
    : "";
}
function button(tree: React.ReactNode, label: string) {
  return elements(tree).find(
    (node) => node.type === "button" && content(node) === label,
  )!;
}
function click(tree: React.ReactNode, label: string) {
  (button(tree, label).props.onClick as () => void)();
}
function change(tree: React.ReactNode, value: string) {
  const select = elements(tree).find((node) => node.type === "select")!;
  (select.props.onChange as (event: unknown) => void)({
    currentTarget: { value },
  });
}
async function fixture(mode: "default" | "source-unavailable" = "default") {
  const model = new ManagedValuationWorkbench();
  model.activate(eodSelection);
  for (const [key] of dcfFields) model.setDcfField(key, `Raw DCF ${key} 東京`);
  for (const [key] of exitFields) model.setExitField(key, `Raw Exit ${key} 📈`);
  for (const scenario of ["conservative", "base", "expansion"] as const) {
    model.setDcfScenario(scenario, `DCF ${scenario}`);
    for (const [key] of exitScenarioFields)
      model.setExitScenario(scenario, key, `Exit ${scenario} ${key}`);
  }
  const read = vi
    .fn()
    .mockResolvedValue(await annualReportPacket("left", { mode }));
  const annual = new ManagedAnnualReport(read, vi.fn(), undefined, {
    coverage: inventedManagedResearchCoverage,
  });
  annual.open(eodSelection);
  await annual.load();
  const controller = new ManagedValuationRevenueBasis(model);
  const actions = {
    prepare: vi.fn((concept: string) => {
      const captured = annual.getSnapshot();
      return controller.prepare({
        selection: eodSelection,
        annual: captured,
        concept,
        isCurrent: () => annual.getSnapshot() === captured,
      });
    }),
    isCurrent: (preview: Parameters<typeof controller.isCurrent>[0]) =>
      controller.isCurrent(preview),
    apply: vi.fn((preview: Parameters<typeof controller.apply>[0]) =>
      controller.apply(preview),
    ),
    retirePreview: vi.fn(() => controller.retirePreview()),
    getApplied: () => controller.getApplied(eodSelection),
  };
  const focus = vi.fn();
  let disabled = false;
  function render() {
    const invoke = () => {
      hooks.index = 0;
      return ManagedValuationRevenueBasisPanel({
        model,
        annual,
        selection: eodSelection,
        actions,
        disabled,
      });
    };
    const commit = (tree: React.ReactNode) => {
      for (const node of elements(tree))
        if (node.props.ref && typeof node.props.ref === "object")
          (node.props.ref as { current: unknown }).current = { focus };
      for (const effect of hooks.effects.splice(0)) effect();
    };
    commit(invoke());
    const tree = invoke();
    commit(tree);
    return tree;
  }
  const unmount = () => {
    for (const slot of hooks.slots)
      (slot as ValuationTestEffectSlot | null)?.cleanup?.();
  };
  return {
    model,
    annual,
    read,
    actions,
    focus,
    render,
    unmount,
    disable: () => {
      disabled = true;
    },
  };
}

it("starts with no basis, previews full maps and original clocks, then applies once without calculating or reading again", async () => {
  const f = await fixture();
  const before = f.model.captureInputs()!.entry;
  const calculate = vi.spyOn(f.model, "calculate");
  let tree = f.render();
  expect(
    elements(tree).find((node) => node.type === "select")!.props.value,
  ).toBe("");
  expect(button(tree, "Preview starting revenue change").props.disabled).toBe(
    true,
  );
  expect(f.actions.prepare).not.toHaveBeenCalled();
  expect(renderToStaticMarkup(tree)).not.toContain("<details open");
  change(tree, "Revenues");
  tree = f.render();
  expect(f.model.captureInputs()!.entry).toEqual(before);
  click(tree, "Preview starting revenue change");
  tree = f.render();
  const prepared = f.actions.prepare.mock.results[0]!.value as ReturnType<
    ManagedValuationRevenueBasis["prepare"]
  >;
  const preview = prepared.preview!;
  expect(preview).not.toBeNull();
  const markup = renderToStaticMarkup(tree);
  for (const value of Object.values(eodSelection.listing))
    expect(markup).toContain(value);
  expect(markup).toContain(eodSelection.catalogSnapshotSha256);
  expect(markup).toContain("Explicit Annual load");
  const selectedSource = elements(tree).find(
    (node) => node.props["aria-label"] === "Selected reported revenue source",
  )!;
  expect(renderToStaticMarkup(selectedSource)).toContain(
    "SEC source CIK 0000000001.",
  );
  expect(markup).toContain(preview.source.companyFactsCapturedAt);
  expect(markup).toContain(preview.source.submissionsCapturedAt);
  for (const [key] of dcfFields)
    expect(markup).toContain(before.dcf.inputs[key]);
  for (const [key] of exitFields)
    expect(markup).toContain(before.exit.inputs[key]);
  for (const scenario of ["conservative", "base", "expansion"] as const) {
    expect(markup).toContain(
      before.dcf.inputs.scenarios[scenario].annualCashFlowGrowthPercent,
    );
    for (const [key] of exitScenarioFields)
      expect(markup).toContain(before.exit.inputs.scenarios[scenario][key]);
  }
  expect(f.focus).toHaveBeenCalledOnce();
  click(tree, "Apply reported revenue to authored inputs");
  click(tree, "Apply reported revenue to authored inputs");
  expect(f.actions.apply).toHaveBeenCalledOnce();
  expect(f.model.captureInputs()!.entry).toEqual(preview.after);
  expect(renderToStaticMarkup(f.render())).toContain(
    "Applied Annual revenue reference",
  );
  expect(calculate).not.toHaveBeenCalled();
  expect(f.read).toHaveBeenCalledOnce();
});

it.each([
  "choice round trip",
  "editor",
  "source",
  "disabled",
  "unmount",
] as const)("refuses a saved Apply handler after %s", async (boundary) => {
  const f = await fixture();
  change(f.render(), "Revenues");
  click(f.render(), "Preview starting revenue change");
  const tree = f.render();
  const before = f.model.captureInputs()!.entry;
  if (boundary === "choice round trip") {
    change(tree, "SalesRevenueNet");
    change(f.render(), "Revenues");
  }
  if (boundary === "editor") f.model.setExitField("cash", "changed");
  if (boundary === "source") await f.annual.load();
  if (boundary === "disabled") {
    f.disable();
    f.render();
  }
  if (boundary === "unmount") f.unmount();
  click(tree, "Apply reported revenue to authored inputs");
  expect(f.actions.apply).not.toHaveBeenCalled();
  expect(f.model.getSnapshot().exitDraft.baseRevenue).toBe(
    before.exit.inputs.baseRevenue,
  );
});

it("refuses a saved Preview handler after unmount", async () => {
  const f = await fixture();
  change(f.render(), "Revenues");
  const tree = f.render();
  f.unmount();
  click(tree, "Preview starting revenue change");
  expect(f.actions.prepare).not.toHaveBeenCalled();
  expect(f.read).toHaveBeenCalledOnce();
});

it("shows unavailable admitted revenue without permitting an input change, calculation or new source read", async () => {
  const f = await fixture("source-unavailable");
  const before = f.model.captureInputs()!.entry;
  const calculate = vi.spyOn(f.model, "calculate");
  change(f.render(), "Revenues");
  const tree = f.render();
  expect(button(tree, "Preview starting revenue change").props.disabled).toBe(
    true,
  );
  expect(renderToStaticMarkup(tree)).toContain(
    "Select an available positive Annual revenue basis",
  );
  click(tree, "Preview starting revenue change");
  expect(f.actions.prepare).toHaveBeenCalledOnce();
  expect(renderToStaticMarkup(f.render())).not.toContain(
    "Complete starting revenue change preview",
  );
  expect(f.model.captureInputs()!.entry).toEqual(before);
  expect(f.actions.apply).not.toHaveBeenCalled();
  expect(calculate).not.toHaveBeenCalled();
  expect(f.read).toHaveBeenCalledOnce();
});
