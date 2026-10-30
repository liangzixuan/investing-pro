import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ManagedResearchDraftSetFiles,
  type ResearchDraftSetFilesProps,
} from "./ManagedResearchDraftSetFiles";
import type { ResearchDraftSetRecoveryState } from "./managed-research-draft-set-recovery";
import type { ManagedWorkspace } from "./managed-workspace";
import { draftSetContent } from "./test-research-draft-set-file-fixture";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";
const h = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
  state: null as ResearchDraftSetRecoveryState | null,
  model: {
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn<() => ResearchDraftSetRecoveryState>(),
    reconcile: vi.fn(),
    dispose: vi.fn(),
    selectResource: vi.fn(),
    captureDrafts: vi.fn(() => true),
    saveFile: vi.fn(() => Promise.resolve()),
    readFile: vi.fn<(f: File) => Promise<void>>(() => Promise.resolve()),
    compareResource: vi.fn(() => true),
    restoreResource: vi.fn(() => true),
    cancel: vi.fn(),
    closeFile: vi.fn(),
  },
}));
vi.mock("./managed-research-draft-set-recovery", () => ({
  ManagedResearchDraftSetRecovery: vi.fn(function () {
    return h.model;
  }),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  ...(
    await import("./valuation-draft-files-test-hooks")
  ).createValuationDraftTestHooks(h),
}));
const idle = (): ResearchDraftSetRecoveryState => ({
  phase: "idle",
  selected: [],
  eligibility: {
    watchlist: true,
    portfolio: true,
    followups: true,
    valuation: true,
  },
  file: null,
  comparison: null,
  canCapture: true,
  canImport: true,
  message: "",
});
const capture = (): ResearchDraftSetRecoveryState => ({
  ...idle(),
  phase: "capture",
  file: draftSetContent(),
  canCapture: false,
  canImport: false,
});
const inventory = (): ResearchDraftSetRecoveryState => ({
  ...capture(),
  phase: "inventory",
  canImport: true,
});
const comparison = (): ResearchDraftSetRecoveryState => {
  const state = inventory(),
    file = state.file!;
  return {
    ...state,
    phase: "comparison",
    comparison: {
      resource: "portfolio",
      fileContent: file.members.portfolio!,
      currentContent: {
        ...file.members.portfolio!,
        draft: {
          ...file.members.portfolio!.draft,
          identities: [],
          transactions: [],
        },
      },
      currentBase: 7,
    },
  };
};
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
  captureButton = { isConnected: true, focus: vi.fn() },
  compareButton = { isConnected: true, focus: vi.fn() };
function fixture() {
  const props: ResearchDraftSetFilesProps = {
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
      tree = ManagedResearchDraftSetFiles(next);
      for (const element of elements(tree)) {
        const ref = element.props.ref as { current: unknown } | undefined;
        if (ref)
          ref.current =
            element.props.id === "managed-research-draft-set-file"
              ? input
              : element.props.id === "managed-research-draft-set-capture"
                ? captureButton
                : String(element.props.id).includes("-compare-")
                  ? compareButton
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
  h.model.captureDrafts.mockImplementation(() => {
    h.state = capture();
    return true;
  });
  h.model.compareResource.mockImplementation(() => {
    h.state = comparison();
    return true;
  });
  h.model.restoreResource.mockImplementation(() => {
    h.state = inventory();
    return true;
  });
  h.model.cancel.mockImplementation(() => {
    h.state = h.state?.comparison ? inventory() : idle();
  });
  h.model.closeFile.mockImplementation(() => {
    h.state = idle();
  });
  vi.stubGlobal("document", { body, activeElement: body });
});
afterEach(() => {
  for (const slot of h.slots)
    (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  vi.unstubAllGlobals();
});
it("shows complete captured nested drafts, raw text and explicit omissions before separate file Save", () => {
  h.state = capture();
  const f = fixture(),
    tree = f.render(),
    markup = renderToStaticMarkup(tree);
  expect(markup).toContain('id="managed-research-draft-set-files"');
  expect(markup).not.toContain("<details open");
  for (const text of [
    "Captured research drafts",
    "Full note 東京 😀",
    "Whole authored result",
    " unfinished 1.. 😀 ",
    "Omitted resources: none.",
    "unapplied forms",
    "Catalog review, Review and each Save remain separate.",
  ])
    expect(markup).toContain(text);
  expect(h.model.saveFile).not.toHaveBeenCalled();
  click(tree, "managed-research-draft-set-save-file");
  expect(h.model.saveFile).toHaveBeenCalledOnce();
});
it("selects only through an explicit checkbox and captures without automatic delivery", () => {
  const f = fixture(),
    tree = f.render();
  (
    find(tree, "managed-research-draft-set-select-portfolio").props
      .onChange as (e: unknown) => void
  )({ currentTarget: { checked: true } });
  expect(h.model.selectResource).toHaveBeenCalledWith("portfolio", true);
  click(tree, "managed-research-draft-set-capture");
  expect(h.model.captureDrafts).toHaveBeenCalledOnce();
  expect(h.model.saveFile).not.toHaveBeenCalled();
});
it("clears input before local read, keeps comparison explicit and shows complete file/current resource with newer base", () => {
  const f = fixture(),
    tree = f.render(),
    source = { files: [{} as File], value: "selected" };
  h.model.readFile.mockImplementation(() => {
    expect(source.value).toBe("");
    return Promise.resolve();
  });
  (
    find(tree, "managed-research-draft-set-file").props.onChange as (
      e: unknown,
    ) => void
  )({ currentTarget: source });
  expect(h.model.restoreResource).not.toHaveBeenCalled();
  h.state = inventory();
  click(f.render(), "managed-research-draft-set-compare-portfolio");
  const markup = renderToStaticMarkup(f.render());
  expect(markup).toContain("Complete file resource draft");
  expect(markup).toContain("Complete current resource draft");
  expect(markup).toContain("Current online save base: 7");
});
it.each(["render", "snapshot", "route", "navigation"])(
  "refuses old committed callbacks after %s",
  (reason) => {
    const f = fixture(),
      old = f.render();
    if (reason === "snapshot") h.state = { ...h.state!, message: "new" };
    if (reason === "route") f.props.routeActive = () => false;
    if (reason === "navigation") f.props.navigationPending = true;
    f.render();
    click(old, "managed-research-draft-set-capture");
    expect(h.model.captureDrafts).not.toHaveBeenCalled();
  },
);
it.each(["workspace", "accountScope", "delivery"] as const)(
  "refuses old DOM action if %s changes before layout commit",
  (field) => {
    const f = fixture(),
      old = f.render(),
      next = { ...f.props };
    if (field === "workspace") next.workspace = {} as ManagedWorkspace;
    if (field === "accountScope") next.accountScope = Promise.resolve("other");
    if (field === "delivery")
      next.delivery = { deliver: () => Promise.resolve("written") };
    h.index = 0;
    ManagedResearchDraftSetFiles(next);
    click(old, "managed-research-draft-set-capture");
    expect(h.model.captureDrafts).not.toHaveBeenCalled();
  },
);
it("moves heading focus for an owned disabled-blur capture and does not steal unrelated or unowned focus", () => {
  const f = fixture(),
    tree = f.render(),
    source = { isConnected: true, disabled: false };
  Reflect.set(document, "activeElement", source);
  h.model.captureDrafts.mockImplementation(() => {
    h.state = capture();
    source.disabled = true;
    Reflect.set(document, "activeElement", body);
    return true;
  });
  click(tree, "managed-research-draft-set-capture", source);
  f.render();
  expect(heading.focus).toHaveBeenCalledOnce();
  heading.focus.mockClear();
  h.state = idle();
  const next = f.render();
  Reflect.set(document, "activeElement", body);
  click(next, "managed-research-draft-set-capture", source);
  f.render();
  expect(heading.focus).not.toHaveBeenCalled();
  h.state = idle();
  const last = f.render();
  Reflect.set(document, "activeElement", source);
  click(last, "managed-research-draft-set-capture", source);
  Reflect.set(document, "activeElement", {});
  f.render();
  expect(heading.focus).not.toHaveBeenCalled();
});
it("returns successful resource restore focus to its comparison button only for the exact committed state", () => {
  h.state = comparison();
  const f = fixture(),
    tree = f.render(),
    source = { isConnected: true };
  Reflect.set(document, "activeElement", source);
  click(tree, "managed-research-draft-set-restore", source);
  source.isConnected = false;
  Reflect.set(document, "activeElement", body);
  f.render();
  expect(compareButton.focus).toHaveBeenCalledOnce();
  compareButton.focus.mockClear();
  h.state = comparison();
  const next = f.render();
  source.isConnected = true;
  Reflect.set(document, "activeElement", source);
  click(next, "managed-research-draft-set-restore", source);
  source.isConnected = false;
  Reflect.set(document, "activeElement", body);
  h.state = { ...h.state, message: "intervening" };
  f.render();
  expect(compareButton.focus).not.toHaveBeenCalled();
});
it("keeps cancellation visible during a file read with no inventory", () => {
  h.state = {
    ...idle(),
    phase: "reading",
    canCapture: false,
    canImport: false,
  };
  const tree = fixture().render();
  expect(find(tree, "managed-research-draft-set-cancel")).toBeDefined();
  click(tree, "managed-research-draft-set-cancel");
  expect(h.model.cancel).toHaveBeenCalledOnce();
});
