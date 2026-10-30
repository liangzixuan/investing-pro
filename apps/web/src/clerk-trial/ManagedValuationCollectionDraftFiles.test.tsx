import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ManagedValuationCollectionDraftFiles,
  type ValuationCollectionFilesProps,
} from "./ManagedValuationCollectionDraftFiles";
import type { ManagedValuationCollectionDraftRecovery } from "./managed-valuation-collection-recovery";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { eodSelection } from "./eod-history-fixture";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";
type State = ReturnType<ManagedValuationCollectionDraftRecovery["getSnapshot"]>;
const h = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
  state: null as State | null,
  model: {
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn<() => State>(),
    reconcile: vi.fn(),
    dispose: vi.fn(),
    captureDraft: vi.fn(() => true),
    saveFile: vi.fn(async () => {}),
    readFile: vi.fn<(file: File) => Promise<void>>(() => Promise.resolve()),
    restoreDraft: vi.fn(() => true),
    cancel: vi.fn(),
  },
}));
vi.mock("./managed-valuation-collection-recovery", () => ({
  ManagedValuationCollectionDraftRecovery: vi.fn(function () {
    return h.model;
  }),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  ...(
    await import("./valuation-draft-files-test-hooks")
  ).createValuationDraftTestHooks(h),
}));
const idle = (): State => ({
  phase: "idle",
  preview: null,
  currentDraft: null,
  currentSavedVersion: null,
  canExport: true,
  canImport: true,
  message: "",
});
function review(phase: "capture" | "review" = "review"): State {
  const model = new ManagedValuationWorkbench();
  model.activate(eodSelection);
  model.setDcfField("waccPercent", " file raw 😀 ");
  const entry = model.captureInputs()!.entry;
  const payload = {
    schemaVersion: 1 as const,
    entries: [
      entry,
      {
        ...entry,
        listing: {
          ...entry.listing,
          listingId: "second-identity",
          symbol: "TWO",
        },
      },
    ],
  };
  return {
    ...idle(),
    phase,
    preview: {
      format: "investment-valuation-collection-draft",
      version: 1,
      accountScope: `sha256:${"c".repeat(64)}`,
      capturedAt: "2026-10-30T00:00:00.000Z",
      payload,
    },
    currentDraft: { schemaVersion: 1, entries: [] },
    currentSavedVersion: 9,
    canExport: false,
    canImport: false,
  };
}
type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === "function")
    return elements((node.type as (p: unknown) => React.ReactNode)(node.props));
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function find(tree: React.ReactNode, id: string) {
  return elements(tree).find((n) => n.props.id === id)!;
}
function click(tree: React.ReactNode, id: string, source: object = {}) {
  (find(tree, id).props.onClick as (e: unknown) => void)({
    currentTarget: source,
  });
}
const body = {},
  input = { isConnected: true, focus: vi.fn() },
  heading = { isConnected: true, focus: vi.fn() },
  capture = { isConnected: true, focus: vi.fn() };
function fixture() {
  const props: ValuationCollectionFilesProps = {
    workspace: {} as ManagedWorkspace,
    accountScope: Promise.resolve(`sha256:${"c".repeat(64)}`),
    delivery: undefined,
    navigationPending: false,
    routeActive: () => true,
  };
  const render = (next = props) => {
    let tree = React.createElement(React.Fragment);
    for (let i = 0; i < 2; i++) {
      h.index = 0;
      tree = ManagedValuationCollectionDraftFiles(next);
      for (const e of elements(tree)) {
        const ref = e.props.ref as { current: unknown } | undefined;
        if (ref)
          ref.current =
            e.props.id === "managed-valuation-collection-file"
              ? input
              : e.props.id === "managed-valuation-collection-capture"
                ? capture
                : heading;
      }
      for (const effect of h.effects.splice(0)) effect();
    }
    return tree;
  };
  return { props, render };
}
beforeEach(() => {
  h.index = 0;
  h.slots = [];
  h.effects = [];
  h.state = idle();
  vi.clearAllMocks();
  h.model.getSnapshot.mockImplementation(() => h.state!);
  h.model.captureDraft.mockImplementation(() => {
    h.state = review("capture");
    return true;
  });
  h.model.cancel.mockImplementation(() => {
    h.state = idle();
  });
  h.model.restoreDraft.mockImplementation(() => {
    h.state = idle();
    return true;
  });
  vi.stubGlobal("document", { body, activeElement: body });
});
afterEach(() => {
  for (const slot of h.slots) {
    const effect = slot as ValuationTestEffectSlot | undefined;
    effect?.cleanup?.();
  }
  vi.unstubAllGlobals();
});
it("captures explicitly, shows all collection inputs and exclusions, then saves the captured file separately", () => {
  const f = fixture(),
    tree = f.render();
  expect(renderToStaticMarkup(tree)).not.toContain("<details open");
  click(tree, "managed-valuation-collection-capture");
  expect(h.model.captureDraft).toHaveBeenCalledOnce();
  expect(h.model.saveFile).not.toHaveBeenCalled();
  const captured = f.render(),
    markup = renderToStaticMarkup(captured);
  expect(markup).toContain("second-identity");
  expect(markup).toContain(" file raw 😀 ");
  expect(markup).toContain("excludes the current workbench editor");
  click(captured, "managed-valuation-collection-save-file");
  expect(h.model.saveFile).toHaveBeenCalledOnce();
});
it("reads locally after clearing file input and never restores on selection", () => {
  const f = fixture(),
    tree = f.render(),
    target = { files: [{} as File], value: "selected" };
  h.model.readFile.mockImplementation(() => {
    expect(target.value).toBe("");
    return Promise.resolve();
  });
  (
    find(tree, "managed-valuation-collection-file").props.onChange as (
      e: unknown,
    ) => void
  )({ currentTarget: target });
  expect(target.value).toBe("");
  expect(h.model.readFile).toHaveBeenCalledWith(target.files[0]);
  expect(h.model.restoreDraft).not.toHaveBeenCalled();
});
it("shows complete imported and current collections, retained base and separate Save", () => {
  h.state = review();
  const tree = fixture().render(),
    markup = renderToStaticMarkup(tree);
  expect(markup).toContain("Complete file collection");
  expect(markup).toContain("Complete current draft that will be replaced");
  expect(markup).toContain("Current online save base: 9");
  expect(markup).toContain("No saved input entries");
  click(tree, "managed-valuation-collection-restore");
  expect(h.model.restoreDraft).toHaveBeenCalledOnce();
});
it.each(["new-render", "navigation", "snapshot", "route"])(
  "rejects callbacks from an old committed view after %s",
  (reason) => {
    const f = fixture(),
      old = f.render();
    if (reason === "navigation") f.props.navigationPending = true;
    if (reason === "route") f.props.routeActive = () => false;
    if (reason === "snapshot") h.state = { ...h.state!, message: "new" };
    f.render();
    click(old, "managed-valuation-collection-capture");
    expect(h.model.captureDraft).not.toHaveBeenCalled();
  },
);
it("moves focus only for the exact committed capture transition and never steals unrelated focus", () => {
  const f = fixture(),
    tree = f.render(),
    source = { isConnected: true };
  Reflect.set(document, "activeElement", source);
  click(tree, "managed-valuation-collection-capture", source);
  f.render();
  expect(heading.focus).toHaveBeenCalledOnce();
  heading.focus.mockClear();
  h.state = idle();
  const next = f.render();
  Reflect.set(document, "activeElement", source);
  click(next, "managed-valuation-collection-capture", source);
  Reflect.set(document, "activeElement", {});
  f.render();
  expect(heading.focus).not.toHaveBeenCalled();
});
it("does not move focus after an intervening state or a refused restore", () => {
  h.state = review();
  const f = fixture(),
    tree = f.render(),
    source = { isConnected: false };
  Reflect.set(document, "activeElement", body);
  click(tree, "managed-valuation-collection-restore", source);
  h.state = { ...h.state, message: "intervening" };
  f.render();
  expect(input.focus).not.toHaveBeenCalled();
  h.state = review();
  h.model.restoreDraft.mockReturnValue(false);
  click(f.render(), "managed-valuation-collection-restore", source);
  f.render();
  expect(input.focus).not.toHaveBeenCalled();
});

it("returns cancellation focus to the still-present initiating capture control", () => {
  const f = fixture();
  click(f.render(), "managed-valuation-collection-capture");
  const tree = f.render(),
    source = { isConnected: false };
  Reflect.set(document, "activeElement", body);
  click(tree, "managed-valuation-collection-cancel", source);
  f.render();
  expect(capture.focus).toHaveBeenCalledOnce();
  expect(input.focus).not.toHaveBeenCalled();
});
