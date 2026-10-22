import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedValuationDraftRecovery } from "./managed-valuation-draft-recovery";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { ManagedValuationDraftFiles } from "./ManagedValuationDraftFiles";
import {
  ManagedValuationWorkbench,
  type ManagedValuationSnapshot,
} from "./managed-valuation-workbench";
import {
  dcfFields,
  exitFields,
  exitScenarioFields,
} from "./valuation-input-labels";
import { eodSelection } from "./eod-history-fixture";
import type { ValuationTestEffectSlot as EffectSlot } from "./valuation-draft-files-test-hooks";

type RecoveryState = ReturnType<ManagedValuationDraftRecovery["getSnapshot"]>;
// Direct command/render and observed focus checks; no browser or native IO.
const harness = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
  state: null as RecoveryState | null,
  options: null as {
    selection: () => ManagedResearchSelection;
    routeActive: () => boolean;
  } | null,
  controller: {
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn<() => RecoveryState>(),
    reconcile: vi.fn(),
    dispose: vi.fn(),
    exportInputs: vi.fn(async () => {}),
    readFile: vi
      .fn<(file: File) => Promise<void>>()
      .mockResolvedValue(undefined),
    restore: vi.fn(() => true),
    cancel: vi.fn(),
  },
}));
vi.mock("./managed-valuation-draft-recovery", () => ({
  ManagedValuationDraftRecovery: vi.fn(function (
    options: typeof harness.options,
  ) {
    harness.options = options;
    return harness.controller;
  }),
}));
vi.mock("react", async (original) => {
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return {
    ...(await original<typeof React>()),
    ...createValuationDraftTestHooks(harness),
  };
});

function editor(prefix: string) {
  const model = new ManagedValuationWorkbench();
  model.activate(eodSelection);
  for (const [key] of dcfFields)
    model.setDcfField(key, `${prefix} DCF ${key} 1e8`);
  for (const [key] of exitFields)
    model.setExitField(key, `${prefix} exit ${key} unfinished`);
  for (const scenario of ["conservative", "base", "expansion"] as const) {
    model.setDcfScenario(scenario, `${prefix} DCF ${scenario}`);
    for (const [key] of exitScenarioFields)
      model.setExitScenario(scenario, key, `${prefix} exit ${scenario} ${key}`);
  }
  return model;
}
function reviewState(): RecoveryState {
  const file = editor("File").captureInputs()!;
  return {
    ...harness.state!,
    phase: "review",
    canExport: false,
    canImport: false,
    preview: {
      format: "investment-valuation-inputs-draft",
      version: 1,
      accountScope: `sha256:${"b".repeat(64)}`,
      capturedAt: "2026-10-22T12:00:00.000Z",
      entry: file.entry,
    },
    currentEditor: editor("Current").getSnapshot(),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.index = 0;
  harness.slots = [];
  harness.effects = [];
  harness.options = null;
  harness.controller.restore.mockReturnValue(true);
  harness.state = {
    phase: "idle",
    preview: null,
    currentEditor: null,
    canExport: true,
    canImport: true,
    message: "",
  };
  harness.controller.getSnapshot.mockImplementation(() => harness.state!);
});
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const props: Parameters<typeof ManagedValuationDraftFiles>[0] = {
    workspace: {} as ManagedWorkspace,
    accountScope: Promise.resolve(`sha256:${"b".repeat(64)}`),
    delivery: undefined,
    selection: eodSelection,
    navigationPending: false,
    routeActive: () => true,
  };
  function render(next = props) {
    harness.index = 0;
    ManagedValuationDraftFiles(next);
    for (const effect of harness.effects.splice(0)) effect();
    harness.index = 0;
    const tree = ManagedValuationDraftFiles(next);
    for (const effect of harness.effects.splice(0)) effect();
    return tree;
  }
  return { props, render };
}
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
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return "";
  return content(node.props.children);
}
function button(tree: React.ReactNode, label: string) {
  return elements(tree).find(
    (node) => node.type === "button" && content(node) === label,
  )!;
}
function click(
  tree: React.ReactNode,
  label: string,
  source = {} as HTMLButtonElement,
) {
  (button(tree, label).props.onClick as (event: unknown) => void)({
    currentTarget: source,
  });
}
function change(
  tree: React.ReactNode,
  currentTarget: { files: File[]; value: string },
) {
  const input = elements(tree).find((node) => node.type === "input")!;
  (input.props.onChange as (event: unknown) => void)({ currentTarget });
}

it("clears a selection before reading, exports only explicitly and never restores on selection", () => {
  const { render } = fixture();
  const tree = render();
  const currentTarget = { files: [{} as File], value: "selected" };
  harness.controller.readFile.mockImplementation(() => {
    expect(currentTarget.value).toBe("");
    return Promise.resolve();
  });
  change(tree, currentTarget);
  expect(currentTarget.value).toBe("");
  expect(harness.controller.readFile).toHaveBeenCalledWith(
    currentTarget.files[0],
  );
  expect(harness.controller.restore).not.toHaveBeenCalled();
  click(tree, "Save inputs file");
  expect(harness.controller.exportInputs).toHaveBeenCalledOnce();
  expect(renderToStaticMarkup(tree)).not.toContain("<details open");
  expect(renderToStaticMarkup(tree)).toContain(
    "Loading saved inputs is not required",
  );
});
function assertScenarioInputs(
  markup: string,
  expected: ManagedValuationSnapshot,
  scenario: keyof ManagedValuationSnapshot["dcfDraft"]["scenarios"],
) {
  expect(markup).toContain(
    expected.dcfDraft.scenarios[scenario].annualCashFlowGrowthPercent,
  );
  for (const [key] of exitScenarioFields)
    expect(markup).toContain(expected.exitDraft.scenarios[scenario][key]);
}
function assertRawModelInputs(
  markup: string,
  expected: ManagedValuationSnapshot,
) {
  for (const [key] of dcfFields)
    expect(markup).toContain(expected.dcfDraft[key]);
  for (const [key] of exitFields)
    expect(markup).toContain(expected.exitDraft[key]);
  for (const scenario of ["conservative", "base", "expansion"] as const)
    assertScenarioInputs(markup, expected, scenario);
}
function assertFullIdentity(markup: string) {
  for (const value of Object.values(eodSelection.listing))
    expect(markup).toContain(value);
  expect(markup).toContain(eodSelection.catalogSnapshotSha256);
  expect(markup).toContain(eodSelection.cik!);
}
it("shows every raw field and full identity for both models before explicit replacement", () => {
  harness.state = reviewState();
  const { render } = fixture();
  const tree = render();
  const markup = renderToStaticMarkup(tree);
  assertRawModelInputs(markup, editor("File").getSnapshot());
  assertRawModelInputs(markup, editor("Current").getSnapshot());
  assertFullIdentity(markup);
  expect(markup).toContain("2026-10-22T12:00:00.000Z");
  expect(markup).toContain("does not verify");
  expect(markup).toContain("clears calculated results");
  expect(markup).toContain("Calculate, Stage, Review and Save remain separate");
  expect(markup).not.toContain("<details open");
  expect(harness.controller.restore).not.toHaveBeenCalled();
  click(tree, "Restore file to current editor");
  expect(harness.controller.restore).toHaveBeenCalledOnce();
  click(tree, "Keep current editor");
  expect(harness.controller.cancel).toHaveBeenCalledOnce();
  expect(harness.controller.exportInputs).not.toHaveBeenCalled();
});
it("preserves the displayed oversized-editor refusal and never exports the last accepted values", () => {
  const model = editor("Current");
  model.setDcfField("startingUnleveredCashFlowUsd", "x".repeat(513));
  harness.state = { ...reviewState(), currentEditor: model.getSnapshot() };
  const { render } = fixture();
  const tree = render();
  const markup = renderToStaticMarkup(tree);
  expect(markup).toContain(model.getSnapshot().inputIssue!);
  expect(markup).toContain("The last accepted text is shown below");
  expect(button(tree, "Save inputs file").props.disabled).toBe(true);
  click(tree, "Save inputs file");
  expect(harness.controller.exportInputs).not.toHaveBeenCalled();
  expect(model.getSnapshot().inputIssue).not.toBeNull();
});
it.each(["availability", "navigation", "route"])(
  "refuses stale commands while blocked by %s",
  (reason) => {
    const { props, render } = fixture();
    const oldTree = render();
    if (reason === "availability")
      harness.state = { ...harness.state!, canExport: false, canImport: false };
    if (reason === "navigation") props.navigationPending = true;
    if (reason === "route") props.routeActive = () => false;
    const tree = render();
    expect(button(tree, "Save inputs file").props.disabled).toBe(true);
    expect(
      elements(tree).find((node) => node.type === "input")!.props.disabled,
    ).toBe(true);
    click(oldTree, "Save inputs file");
    const currentTarget = { files: [{} as File], value: "selected" };
    change(oldTree, currentTarget);
    expect(currentTarget.value).toBe("");
    expect(harness.controller.exportInputs).not.toHaveBeenCalled();
    expect(harness.controller.readFile).not.toHaveBeenCalled();
  },
);
it("retains the latest selection and navigation guards without creating another controller", () => {
  const { props, render } = fixture();
  render();
  const options = harness.options!;
  const next = {
    ...props,
    selection: { ...eodSelection, origin: "route" as const },
    navigationPending: true,
  };
  render(next);
  expect(harness.options).toBe(options);
  expect(options.selection()).toBe(next.selection);
  expect(options.routeActive()).toBe(false);
  render({ ...next, navigationPending: false, routeActive: () => false });
  expect(options.routeActive()).toBe(false);
});
it("ignores an old review after the controller publishes another snapshot or is disposed", () => {
  harness.state = reviewState();
  const { render } = fixture();
  const oldTree = render();
  harness.state = { ...harness.state, message: "Editor changed" };
  click(oldTree, "Restore file to current editor");
  click(oldTree, "Keep current editor");
  expect(harness.controller.restore).not.toHaveBeenCalled();
  expect(harness.controller.cancel).not.toHaveBeenCalled();
  const current = render();
  for (const slot of harness.slots)
    (slot as EffectSlot | undefined)?.cleanup?.();
  click(current, "Restore file to current editor");
  expect(harness.controller.restore).not.toHaveBeenCalled();
  expect(harness.controller.dispose).toHaveBeenCalledOnce();
});
it.each([false, true])(
  "focuses a completed review only while the file input still owns focus (moved=%s)",
  (moved) => {
    harness.state = {
      ...harness.state!,
      phase: "reading",
      canImport: false,
      canExport: false,
    };
    const { props, render } = fixture();
    const tree = render();
    const input = { focus: vi.fn() };
    const inputRef = elements(tree).find((node) => node.type === "input")!.props
      .ref as React.RefObject<unknown>;
    inputRef.current = input;
    const heading = { focus: vi.fn() };
    const fakeDocument = { activeElement: moved ? {} : input, body: {} };
    vi.stubGlobal("document", fakeDocument);
    harness.state = reviewState();
    // Attach the future heading ref before the queued layout effects run.
    harness.index = 0;
    const review = ManagedValuationDraftFiles(props);
    const ref = elements(review).find((node) => node.type === "h3")!.props
      .ref as React.RefObject<unknown>;
    ref.current = heading;
    for (const effect of harness.effects.splice(0)) effect();
    expect(heading.focus).toHaveBeenCalledTimes(moved ? 0 : 1);
  },
);
it.each(["Restore file to current editor", "Keep current editor"])(
  "returns focus after %s only when the action still owns it",
  (action) => {
    harness.state = reviewState();
    const { render } = fixture();
    const tree = render();
    const input = { focus: vi.fn() };
    (
      elements(tree).find((node) => node.type === "input")!.props
        .ref as React.RefObject<unknown>
    ).current = input;
    const source = { isConnected: false } as HTMLButtonElement;
    const body = {};
    vi.stubGlobal("document", { activeElement: body, body });
    click(tree, action, source);
    harness.state = {
      ...harness.state,
      phase: "idle",
      canImport: true,
      preview: null,
      currentEditor: null,
    };
    render();
    expect(input.focus).toHaveBeenCalledOnce();
  },
);
it("does not steal focus after cancellation when the user moved to another control", () => {
  harness.state = reviewState();
  const { render } = fixture();
  const tree = render();
  const input = { focus: vi.fn() };
  (
    elements(tree).find((node) => node.type === "input")!.props
      .ref as React.RefObject<unknown>
  ).current = input;
  vi.stubGlobal("document", { activeElement: {}, body: {} });
  click(tree, "Keep current editor", {
    isConnected: false,
  } as HTMLButtonElement);
  harness.state = {
    ...harness.state,
    phase: "idle",
    canImport: true,
    preview: null,
    currentEditor: null,
  };
  render();
  expect(input.focus).not.toHaveBeenCalled();
});

it("rejects controls from a previous selection even when availability did not change", () => {
  const { props, render } = fixture();
  const previous = render();
  render({ ...props, selection: { ...eodSelection, origin: "route" } });
  click(previous, "Save inputs file");
  change(previous, { files: [{} as File], value: "selected" });
  expect(harness.controller.exportInputs).not.toHaveBeenCalled();
  expect(harness.controller.readFile).not.toHaveBeenCalled();
});
it.each(["reading", "exporting"] as const)(
  "exposes explicit cancellation during %s",
  (phase) => {
    harness.state = {
      ...harness.state!,
      phase,
      canImport: false,
      canExport: false,
    };
    const { render } = fixture();
    const tree = render();
    expect(button(tree, "Cancel file operation").props.disabled).toBe(false);
    click(tree, "Cancel file operation");
    expect(harness.controller.cancel).toHaveBeenCalledOnce();
  },
);
