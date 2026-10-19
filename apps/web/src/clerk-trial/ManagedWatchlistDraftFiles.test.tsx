import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { WatchlistDraftRecoveryState } from "./managed-watchlist-draft-recovery";
import { ManagedWatchlistDraftFiles } from "./ManagedWatchlistDraftFiles";

// This controlled-hook harness checks component commands, full rendering and
// commit order. It does not establish actual browser focus or native file IO.
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  updates: 0,
  effects: [] as {
    deps: React.DependencyList | undefined;
    cleanup: (() => void) | void;
  }[],
  tasks: [] as (() => void)[],
}));
const recovery = vi.hoisted(() => ({
  state: null as WatchlistDraftRecoveryState | null,
  constructions: [] as unknown[],
  controller: {
    getSnapshot: vi.fn<() => WatchlistDraftRecoveryState>(),
    subscribe: vi.fn<() => () => void>(),
    reconcile: vi.fn(),
    dispose: vi.fn(),
    exportDraft: vi.fn<() => Promise<void>>(),
    readFile: vi.fn<(file: File) => Promise<void>>(),
    restoreDraft: vi.fn<() => boolean>(),
    cancel: vi.fn(),
  },
}));
vi.mock("./managed-watchlist-draft-recovery", () => ({
  ManagedWatchlistDraftRecovery: vi.fn(function (options: unknown) {
    recovery.constructions.push(options);
    return recovery.controller;
  }),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (value: unknown) => {
        hooks.states[index] = value;
        hooks.updates++;
      },
    ];
  },
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.refIndex++] ??= { current: initial }),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
  useLayoutEffect: (
    effect: () => (() => void) | void,
    deps?: React.DependencyList,
  ) => {
    const index = hooks.effectIndex++,
      previous = hooks.effects[index];
    if (previous) {
      if (deps) {
        if (
          !deps.some((value, position) => value !== previous.deps?.[position])
        )
          return;
      }
    }
    hooks.tasks.push(() => {
      previous?.cleanup?.();
      hooks.effects[index] = { deps, cleanup: effect() };
    });
  },
}));

function member(id: string, note: string): WatchlistMembership {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "invented-issuer",
    issuerName: "Invented Company",
    listingId: "listing-" + id,
    securityId: "security-" + id,
    securityName: "Invented security " + id,
    shareClassId: "class-" + id,
    shareClassName: "Class " + id,
    symbol: "SAME",
    note,
  };
}
function draft(
  memberships: readonly WatchlistMembership[],
): MainWatchlistPayload {
  return {
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: "sha256:" + "a".repeat(64),
    memberships,
  };
}
const unchanged = member("unchanged", "Unchanged exact note Café 😀");
const current = draft([
  unchanged,
  member("current-only", "Current-only raw note"),
]);
const raw =
  "  File-only note <script>invented()</script>\n" +
  "x".repeat(2001) +
  "\u0001  ";
function state(
  patch: Partial<WatchlistDraftRecoveryState> = {},
): WatchlistDraftRecoveryState {
  return {
    phase: "idle",
    preview: null,
    currentDraft: null,
    currentSavedVersion: null,
    canExport: true,
    canImport: true,
    message: "",
    ...patch,
  };
}
function review(candidate = draft([unchanged, member("file-only", raw)])) {
  return state({
    phase: "review",
    canExport: false,
    canImport: false,
    currentDraft: current,
    currentSavedVersion: 9,
    preview: {
      format: "investment-watchlist-draft",
      version: 1,
      accountScope: "sha256:" + "b".repeat(64),
      capturedAt: "2026-10-18T18:00:00.000Z",
      baseVersion: 7,
      draft: candidate,
    },
  });
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
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return "";
  if (typeof node.type === "function")
    return text((node.type as (props: unknown) => React.ReactNode)(node.props));
  return text(node.props.children);
}
interface FocusNode {
  disabled: boolean;
  readonly attempts: boolean[];
  readonly focus: ReturnType<typeof vi.fn>;
}
function focusNode(dom: { activeElement: unknown }): FocusNode {
  const node: FocusNode = {
    disabled: false,
    attempts: [],
    focus: vi.fn(() => {
      node.attempts.push(node.disabled);
      if (!node.disabled) dom.activeElement = node;
    }),
  };
  return node;
}
function fixture() {
  const dom = { activeElement: null as unknown },
    input = focusNode(dom),
    heading = focusNode(dom);
  vi.stubGlobal("document", dom);
  const props: React.ComponentProps<typeof ManagedWatchlistDraftFiles> = {
    workspace: {} as ManagedWorkspace,
    accountScope: Promise.resolve("sha256:" + "b".repeat(64)),
    delivery: undefined,
    routeActive: () => true,
    onRestored: vi.fn(),
  };
  const attached = new Set<{ current: unknown }>();
  function renderOnce() {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    hooks.effectIndex = 0;
    const root = ManagedWatchlistDraftFiles(props),
      all = elements(root);
    for (const ref of attached) ref.current = null;
    attached.clear();
    for (const element of all) {
      const ref = element.props.ref as { current: unknown } | undefined;
      if (!ref) continue;
      ref.current = element.type === "input" ? input : heading;
      attached.add(ref);
    }
    input.disabled = Boolean(
      all.find((element) => element.type === "input")?.props.disabled,
    );
    hooks.tasks.splice(0).forEach((task) => task());
    return { root, all };
  }
  function render() {
    for (let commit = 0; commit < 4; commit++) {
      const updates = hooks.updates;
      const view = renderOnce();
      if (hooks.updates === updates) return view;
    }
    throw new Error("Controlled hook commits did not settle");
  }
  const button = (view: ReturnType<typeof render>, label: string) =>
    view.all.find(
      (entry) =>
        entry.type === "button" &&
        text(entry.props.children as React.ReactNode) === label,
    );
  const click = (view: ReturnType<typeof render>, label: string) => {
    const element = button(view, label);
    expect(element).toBeDefined();
    (element!.props.onClick as () => void)();
  };
  return { dom, input, heading, props, render, button, click };
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.states = [];
  hooks.refs = [];
  hooks.effects = [];
  hooks.tasks = [];
  hooks.updates = 0;
  recovery.state = state();
  recovery.constructions = [];
  recovery.controller.getSnapshot.mockImplementation(() => recovery.state!);
  recovery.controller.subscribe.mockReturnValue(() => {});
  recovery.controller.exportDraft.mockResolvedValue();
  recovery.controller.readFile.mockResolvedValue();
  recovery.controller.restoreDraft.mockReturnValue(false);
  recovery.controller.cancel.mockImplementation(() => {
    recovery.state = state();
  });
});
afterEach(() => {
  hooks.effects.splice(0).forEach((effect) => effect.cleanup?.());
  vi.unstubAllGlobals();
});

describe("explicit Watchlist draft file component", () => {
  it("renders private-file scope and performs no file action before an explicit choice", () => {
    const f = fixture(),
      view = f.render(),
      output = text(view.root);
    expect(output).toContain(
      "contains your notes in plain text. Store it privately.",
    );
    expect(output).toContain("Restoring it replaces only this screen's draft.");
    expect(f.button(view, "Restore file to current draft")).toBeUndefined();
    expect(recovery.controller.exportDraft).not.toHaveBeenCalled();
    expect(recovery.controller.readFile).not.toHaveBeenCalled();
    expect(recovery.controller.restoreDraft).not.toHaveBeenCalled();
    expect(f.props.onRestored).not.toHaveBeenCalled();
  });
  it("starts export only from its button and resets the file input after a selection", () => {
    const f = fixture(),
      view = f.render();
    f.click(view, "Save draft file");
    expect(recovery.controller.exportDraft).toHaveBeenCalledOnce();
    const file = new File(["invented JSON"], "invented.json", {
      type: "application/json",
    });
    const target = { files: [file], value: "invented selected path" };
    const input = view.all.find((element) => element.type === "input")!;
    expect(input.props.accept).toBe("application/json,.json");
    expect(input.props.multiple).toBeUndefined();
    (input.props.onChange as (event: { currentTarget: typeof target }) => void)(
      { currentTarget: target },
    );
    expect(target.value).toBe("");
    expect(recovery.controller.readFile).toHaveBeenCalledExactlyOnceWith(file);
    expect(recovery.controller.restoreDraft).not.toHaveBeenCalled();
    expect(f.props.onRestored).not.toHaveBeenCalled();
  });
  it("retains all raw candidate/current entries, unchanged entries and invalid notes in full review", () => {
    recovery.state = review();
    const f = fixture(),
      view = f.render(),
      output = text(view.root),
      html = renderToStaticMarkup(view.root);
    expect(output).toContain("File draft · 2 listings");
    expect(output).toContain(
      "Current draft that will be replaced · 2 listings",
    );
    expect(output.split(unchanged.note)).toHaveLength(3);
    expect(output).toContain(raw);
    expect(output).toContain("Current-only raw note");
    expect(output.indexOf(unchanged.note)).toBeLessThan(output.indexOf(raw));
    expect(output).toContain("listing-file-only");
    expect(output).toContain("class-file-only");
    expect(output).toContain(
      "Correct this note before Save watchlist can accept it.",
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;invented()&lt;/script&gt;");
    expect(recovery.controller.restoreDraft).not.toHaveBeenCalled();
  });
  it("treats file date/catalog metadata as unverified even when its catalog equals the current draft", () => {
    recovery.state = review();
    const f = fixture(),
      output = text(f.render().root);
    expect(output).toContain(
      "File reports capture time 2026-10-18T18:00:00.000Z and base version 7",
    );
    expect(output).toContain("Loaded saved version 9 will remain unchanged.");
    expect(output).toContain(
      "File metadata does not verify its contents or capture time.",
    );
    expect(output).toContain(
      "use Review catalog changes to check every listing against the current catalog before Save.",
    );
  });
  it("renders an empty file draft as an explicit whole-draft replacement", () => {
    recovery.state = review(draft([]));
    const f = fixture(),
      output = text(f.render().root);
    expect(output).toContain(
      "File draft · 0 listingsNo listings in this draft.",
    );
    expect(output).toContain("Current-only raw note");
    expect(output).toContain(
      "Restoring replaces all current draft listings, notes and order.",
    );
  });
  it("notifies restoration only after the explicit restore command succeeds", () => {
    recovery.state = review();
    const f = fixture(),
      view = f.render();
    f.click(view, "Restore file to current draft");
    expect(recovery.controller.restoreDraft).toHaveBeenCalledOnce();
    expect(f.props.onRestored).not.toHaveBeenCalled();
    recovery.controller.restoreDraft.mockReturnValueOnce(true);
    f.click(view, "Restore file to current draft");
    expect(f.props.onRestored).toHaveBeenCalledOnce();
    expect(recovery.controller.exportDraft).not.toHaveBeenCalled();
  });
  it("keeps the current draft on explicit cancellation without issuing restore", () => {
    recovery.state = review();
    const f = fixture(),
      view = f.render();
    f.click(view, "Keep current draft");
    expect(recovery.controller.cancel).toHaveBeenCalledOnce();
    expect(recovery.controller.restoreDraft).not.toHaveBeenCalled();
    expect(f.props.onRestored).not.toHaveBeenCalled();
    expect(
      f.button(f.render(), "Restore file to current draft"),
    ).toBeUndefined();
  });
  it.each(["reading", "exporting"] as const)(
    "waits for an enabled idle input commit before returning focus after %s cancellation",
    (phase) => {
      recovery.state = state({ phase, canImport: false, canExport: false });
      const f = fixture(),
        view = f.render();
      expect(f.input.disabled).toBe(true);
      f.click(view, "Cancel file operation");
      expect(f.input.focus).not.toHaveBeenCalled();
      f.render();
      expect(f.input.disabled).toBe(false);
      expect(f.input.attempts).toEqual([false]);
      expect(f.dom.activeElement).toBe(f.input);
    },
  );
  it("does not try to focus an idle input while import remains disabled", () => {
    recovery.state = state({
      phase: "reading",
      canImport: false,
      canExport: false,
    });
    const f = fixture(),
      view = f.render();
    recovery.controller.cancel.mockImplementationOnce(() => {
      recovery.state = state({ canImport: false });
    });
    f.click(view, "Cancel file operation");
    f.render();
    expect(f.input.disabled).toBe(true);
    expect(f.input.focus).not.toHaveBeenCalled();
    recovery.state = state();
    f.render();
    expect(f.input.focus).not.toHaveBeenCalled();
  });
  it("withdraws pending cancel focus when the session retires", () => {
    recovery.state = state({
      phase: "reading",
      canImport: false,
      canExport: false,
    });
    const f = fixture(),
      view = f.render();
    recovery.controller.cancel.mockImplementationOnce(() => {
      recovery.state = state({ phase: "retired", canImport: false });
    });
    f.click(view, "Cancel file operation");
    f.render();
    recovery.state = state();
    f.render();
    expect(f.input.focus).not.toHaveBeenCalled();
  });
  it("moves focus to review only while the file input still owns it", () => {
    recovery.state = state({ phase: "reading", canImport: false });
    const f = fixture();
    f.render();
    f.dom.activeElement = f.input;
    recovery.state = review();
    f.render();
    expect(f.heading.focus).toHaveBeenCalledOnce();
    expect(f.dom.activeElement).toBe(f.heading);
  });
  it("does not steal another control's focus when file review arrives", () => {
    recovery.state = state({ phase: "reading", canImport: false });
    const f = fixture();
    f.render();
    const other = {};
    f.dom.activeElement = other;
    recovery.state = review();
    f.render();
    expect(f.heading.focus).not.toHaveBeenCalled();
    expect(f.dom.activeElement).toBe(other);
  });
});
