import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedCompanyReportComparisonCheck } from "./ManagedCompanyReportComparisonCheck";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";
import type { CompanyReportRevisit } from "./company-report-revisit";
import type { CompanyReportComparisonCheckTarget } from "./company-report-comparison-check-target";
import type { CompanyReportComparisonCheckPreview } from "./company-report-comparison-check";
import { eodSelection } from "./eod-history-fixture";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
const proposal = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock("react", async (original) => {
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return {
    ...(await original<typeof React>()),
    ...createValuationDraftTestHooks(hooks),
  };
});
vi.mock("./company-report-comparison-check", () => ({
  prepareCompanyReportComparisonCheck: proposal.prepare,
  staleComparisonCheck:
    "The comparison, check or company visit changed. Preview the current assessment again.",
}));
type Element = React.ReactElement<Record<string, unknown>>;
type FocusNode = { focus: ReturnType<typeof vi.fn>; isConnected: boolean };
const nodes = new Map<string, FocusNode>();
const doc: { activeElement: FocusNode | null; body: FocusNode } = {
  activeElement: null,
  body: { focus: vi.fn(), isConnected: true },
};
function elements(value: React.ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children as React.ReactNode)];
}
function attach(tree: React.ReactNode) {
  const present = new Set<string>();
  for (const element of elements(tree)) {
    const id = element.props.id;
    if (typeof id !== "string") continue;
    present.add(id);
    let node = nodes.get(id);
    if (!node) {
      node = { focus: vi.fn(), isConnected: true };
      node.focus.mockImplementation(() => {
        doc.activeElement = node!;
      });
      nodes.set(id, node);
    }
    node.isConnected = true;
    const ref = element.props.ref as { current: FocusNode | null } | undefined;
    if (ref) ref.current = node;
  }
  for (const [id, node] of nodes)
    if (!present.has(id)) {
      node.isConnected = false;
      if (doc.activeElement === node) doc.activeElement = doc.body;
    }
}
function click(tree: React.ReactNode, suffix: string) {
  const id = `managed-report-comparison-check-${suffix}`;
  const element = elements(tree).find((item) => item.props.id === id)!;
  expect(element).toBeDefined();
  doc.activeElement = nodes.get(id)!;
  (element.props.onClick as () => void)();
}
function cleanup() {
  for (const value of hooks.slots)
    (value as ValuationTestEffectSlot | undefined)?.cleanup?.();
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  nodes.clear();
  doc.activeElement = doc.body;
  proposal.prepare.mockReset();
  vi.stubGlobal("document", doc);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fixture() {
  let entry = {
    id: "00000000-0000-4000-8000-000000000001",
    listing: eodSelection.listing,
    catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
    check: "  Full question <script>alert(1)</script> 東京 😀  ",
    dueOn: "2026-11-01",
    status: "open" as const,
    completedOn: null,
    result: "  Original Cafe\u0301 📈  ",
  };
  const state = {
    active: true,
    available: true,
    editable: true,
    snapshot: {},
    observer: () => {},
  };
  const apply = vi.fn((result: string) => {
    entry = { ...entry, result };
    state.observer();
    return true;
  });
  const target = (): CompanyReportComparisonCheckTarget | null =>
    state.available
      ? {
          entry,
          editable: state.editable,
          dirty: true,
          reason: state.editable ? null : "Finish the pending action.",
          isCurrent: () => state.active,
          apply,
        }
      : null;
  const controller = {
    getSnapshot: () => state.snapshot,
    captureComparison: () => ({ isCurrent: () => state.active }),
  } as unknown as CompanyReportRevisit;
  const actions = { target, subscribe: () => () => {}, getSnapshot: () => [] };
  const result = entry.result + " Complete raw comparison · Ω";
  const prepared: CompanyReportComparisonCheckPreview[] = [];
  proposal.prepare.mockImplementation(
    (
      _capture,
      destination: CompanyReportComparisonCheckTarget,
      host: () => boolean,
    ) => {
      let retired = false;
      const preview: CompanyReportComparisonCheckPreview = {
        result,
        excerpt: "Complete raw comparison · Ω",
        target: destination,
        isCurrent: () => !retired && state.active && host(),
        cancel: () => {
          retired = true;
        },
        apply: () => {
          if (retired || !state.active || !host()) return false;
          retired = true;
          return destination.apply(result);
        },
      };
      prepared.push(preview);
      return { preview, reason: null };
    },
  );
  const render = (commit = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedCompanyReportComparisonCheck({ controller, actions });
    if (commit) {
      attach(tree);
      hooks.effects.splice(0).forEach((effect) => effect());
    }
    return tree;
  };
  const replaceTarget = () => {
    entry = { ...entry, id: "00000000-0000-4000-8000-000000000002" };
  };
  return { state, apply, render, result, prepared, controller, replaceTarget };
}
it("shows full escaped destination identity, question and raw assessment before preview", () => {
  const f = fixture();
  const tree = f.render();
  const $ = load(renderToStaticMarkup(tree));
  expect($("#managed-report-comparison-check-question").text()).toBe(
    "  Full question <script>alert(1)</script> 東京 😀  ",
  );
  expect($("#managed-report-comparison-check-current-result").text()).toBe(
    "  Original Cafe\u0301 📈  ",
  );
  expect($("script")).toHaveLength(0);
  expect($("#managed-report-comparison-check-prepare").text()).toBe(
    "Preview comparison for check",
  );
  expect($("#managed-report-comparison-check-result")).toHaveLength(0);
  expect(f.apply).not.toHaveBeenCalled();
});
it("previews the whole result, focuses only the owned action, cancels without editing and retires old apply", () => {
  const f = fixture();
  click(f.render(), "prepare");
  const preview = f.render();
  const $ = load(renderToStaticMarkup(preview));
  expect($("#managed-report-comparison-check-result").text()).toBe(f.result);
  expect(
    nodes.get("managed-report-comparison-check-preview")!.focus,
  ).toHaveBeenCalledOnce();
  click(preview, "cancel");
  f.render();
  expect(
    nodes.get("managed-report-comparison-check-prepare")!.focus,
  ).toHaveBeenCalledOnce();
  click(preview, "apply");
  expect(f.apply).not.toHaveBeenCalled();
  expect(f.prepared[0]!.isCurrent()).toBe(false);
});
it("applies once then focuses the exact resulting destination and retains separate completion/save copy", () => {
  const f = fixture();
  click(f.render(), "prepare");
  const preview = f.render();
  click(preview, "apply");
  click(preview, "apply");
  const after = f.render();
  const $ = load(renderToStaticMarkup(after));
  expect(f.apply).toHaveBeenCalledExactlyOnceWith(f.result);
  expect($("#managed-report-comparison-check-current-result").text()).toBe(
    f.result,
  );
  expect($("#managed-report-comparison-check-result")).toHaveLength(0);
  expect($("#managed-report-comparison-check-status").text()).toContain(
    "Save follow-ups separately",
  );
  expect(
    nodes.get("managed-report-comparison-check-heading")!.focus,
  ).toHaveBeenCalledOnce();
});
it("rejects abandoned and previous-render handlers and unmounted previews", () => {
  const f = fixture();
  const initial = f.render();
  const abandoned = f.render(false);
  click(abandoned, "prepare");
  expect(proposal.prepare).not.toHaveBeenCalled();
  const current = f.render();
  click(initial, "prepare");
  expect(proposal.prepare).not.toHaveBeenCalled();
  click(current, "prepare");
  f.render();
  cleanup();
  expect(f.prepared[0]!.apply()).toBe(false);
  expect(f.apply).not.toHaveBeenCalled();
});
it("does not publish success or move focus after a reentrant comparison or route change", () => {
  const f = fixture();
  click(f.render(), "prepare");
  const preview = f.render();
  f.state.observer = () => {
    f.state.active = false;
  };
  click(preview, "apply");
  const after = load(renderToStaticMarkup(f.render()));
  expect(after("#managed-report-comparison-check-status").text()).not.toContain(
    "Comparison applied",
  );
  expect(
    nodes.get("managed-report-comparison-check-heading")!.focus,
  ).not.toHaveBeenCalled();
});
it("does not steal focus after another control gains focus before commit", () => {
  const f = fixture();
  click(f.render(), "prepare");
  const other = { focus: vi.fn(), isConnected: true };
  doc.activeElement = other;
  f.render();
  expect(doc.activeElement).toBe(other);
  expect(
    nodes.get("managed-report-comparison-check-preview")!.focus,
  ).not.toHaveBeenCalled();
});
it("does not publish success for a replacement target during Apply", () => {
  const f = fixture();
  click(f.render(), "prepare");
  const preview = f.render();
  f.state.observer = f.replaceTarget;
  click(preview, "apply");
  const after = load(renderToStaticMarkup(f.render()));
  expect(after("#managed-report-comparison-check-status").text()).not.toContain(
    "Comparison applied",
  );
  expect(
    nodes.get("managed-report-comparison-check-heading")!.focus,
  ).not.toHaveBeenCalled();
});
it("does not restore cancellation focus to a replacement target", () => {
  const f = fixture();
  click(f.render(), "prepare");
  click(f.render(), "cancel");
  f.replaceTarget();
  f.render();
  expect(
    nodes.get("managed-report-comparison-check-prepare")!.focus,
  ).not.toHaveBeenCalled();
});
it("retires a rendered prepare handler when the comparison assessment changes before rerender", () => {
  const f = fixture();
  const tree = f.render();
  f.state.snapshot = {};
  click(tree, "prepare");
  expect(proposal.prepare).not.toHaveBeenCalled();
});
it("does not restore cancellation focus after the source or route changes before commit", () => {
  const f = fixture();
  click(f.render(), "prepare");
  click(f.render(), "cancel");
  f.state.active = false;
  f.render();
  expect(
    nodes.get("managed-report-comparison-check-prepare")!.focus,
  ).not.toHaveBeenCalled();
});
it("explains missing or blocked ownership without selecting, loading or focusing a target", () => {
  const f = fixture();
  f.state.available = false;
  let $ = load(renderToStaticMarkup(f.render()));
  expect($("#managed-report-comparison-check").text()).toContain(
    "use an existing check",
  );
  expect($("#managed-report-comparison-check-prepare")).toHaveLength(0);
  f.state.available = true;
  f.state.editable = false;
  $ = load(renderToStaticMarkup(f.render()));
  expect(
    $("#managed-report-comparison-check-prepare").attr("disabled"),
  ).toBeDefined();
  expect(
    nodes.get("managed-report-comparison-check-heading")!.focus,
  ).not.toHaveBeenCalled();
  expect(proposal.prepare).not.toHaveBeenCalled();
  expect(f.apply).not.toHaveBeenCalled();
});
