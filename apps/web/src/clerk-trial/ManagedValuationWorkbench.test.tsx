import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ManagedValuationWorkbench,
  ValuationInputs,
  ValuationInput,
  ValuationNotePreview,
  type ManagedValuationNoteActions,
  type ManagedValuationWorkbenchProps,
} from "./ManagedValuationWorkbench";
import { ManagedValuationWorkbench as WorkbenchModel } from "./managed-valuation-workbench";
import { eodSelection } from "./eod-history-fixture";
import type { PreparedValuationNote } from "./valuation-note";

const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  slots: [] as unknown[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "valuation-test" : actual.useId()),
    useRef: <T,>(initial: T) => {
      if (!hooks.direct) return actual.useRef(initial);
      const i = hooks.index++;
      if (!(i in hooks.slots)) hooks.slots[i] = { current: initial };
      return hooks.slots[i];
    },
    useLayoutEffect: (effect: () => void, deps: React.DependencyList) => {
      if (!hooks.direct) return actual.useLayoutEffect(effect, deps);
      effect();
    },
    useState: (initial: unknown) => {
      if (!hooks.direct) return actual.useState(initial);
      const i = hooks.index++;
      if (!(i in hooks.slots)) hooks.slots[i] = initial;
      return [
        hooks.slots[i],
        (value: unknown) => {
          hooks.slots[i] = value;
        },
      ];
    },
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
      snapshot(),
  };
});
function elements(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
beforeEach(() => {
  hooks.direct = false;
  hooks.index = 0;
  hooks.slots = [];
});
function setup() {
  const model = new WorkbenchModel();
  model.activate(eodSelection);
  const actions: ManagedValuationNoteActions = {
    prepare: vi.fn().mockReturnValue({ preview: null, reason: null }),
    isCurrent: vi.fn().mockReturnValue(true),
    append: vi
      .fn()
      .mockReturnValue({ appended: true, message: "Added to the note draft." }),
  };
  const props: ManagedValuationWorkbenchProps = {
    model,
    selection: eodSelection,
    navigationPending: false,
    noteActions: actions,
    watchlist: {
      member: { ...eodSelection.listing, note: "My note" },
      canAdd: false,
      canEdit: true,
      reason: null,
    },
  };
  const render = (next = props) => {
    hooks.direct = true;
    hooks.index = 0;
    const node = ManagedValuationWorkbench(next);
    hooks.direct = false;
    return node;
  };
  return { model, actions, props, render };
}
const button = (node: React.ReactNode, text: string) =>
  elements(node).find(
    (e) =>
      e.type === "button" &&
      React.Children.toArray(e.props.children as React.ReactNode)
        .filter((child): child is string => typeof child === "string")
        .join("") === text,
  )!;
const click = (node: React.ReactElement<Record<string, unknown>>) =>
  (node.props.onClick as () => void)();
function inputTree(node: React.ReactNode) {
  const part = elements(node).find((e) => e.type === ValuationInputs)!;
  return ValuationInputs(
    part.props as unknown as Parameters<typeof ValuationInputs>[0],
  );
}
function proposed(): PreparedValuationNote {
  return {
    note: "My note | Authored valuation <assumption>",
    excerpt: "Authored valuation <assumption>",
    model: "dcf",
    scenario: "base",
  };
}
describe("authored valuation workbench", () => {
  it("starts closed, labels authored full-USD assumptions and leaves financial operands empty", () => {
    const { props } = setup();
    const html = renderToStaticMarkup(<ManagedValuationWorkbench {...props} />);
    expect(html).toContain("Authored valuation workbench");
    expect(html).toContain("Starting unlevered cash flow (full USD)");
    expect(html).toContain("temporary until sign-out or reload");
    expect(html).toContain("A negative bridge adds net cash");
    expect(html).not.toContain("<details open");
    expect(html.match(/value=""/gu)).toHaveLength(22);
    expect(html.match(/value="5"/gu)).toHaveLength(2);
    expect(html).not.toContain('type="number"');
  });
  it("edits only its own model field, keeps invalid lexemes, and calculates only on explicit action", () => {
    const { model, render } = setup();
    const node = render();
    const field = elements(inputTree(node)).find(
      (e) =>
        e.type === ValuationInput &&
        String(e.props.id).endsWith("dcf-startingUnleveredCashFlowUsd"),
    )!;
    (field.props.onChange as (value: string) => void)("1e8");
    expect(model.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd).toBe(
      "1e8",
    );
    expect(model.getSnapshot().exitDraft.baseRevenue).toBe("");
    expect(model.getSnapshot().calculation).toBeNull();
    click(button(render(), "Calculate authored scenarios"));
    expect(model.getSnapshot().calculation?.dcfResult.status).toBe(
      "unavailable",
    );
  });
  it("retains exact input ownership and refuses stale edit, calculate and discard callbacks after a new owner", () => {
    const { model, props, render } = setup();
    model.setDcfField("startingUnleveredCashFlowUsd", "80");
    const node = render();
    const oldField = elements(inputTree(node)).find(
      (e) => e.type === ValuationInput,
    )!;
    const oldCalculate = button(node, "Calculate authored scenarios");
    const other = {
      ...eodSelection,
      listing: {
        ...eodSelection.listing,
        symbol: "OTHER",
        listingId: "listing-other",
      },
    };
    model.activate(other);
    const retained = render({ ...props, selection: other });
    const discard = button(retained, "Discard inputs and use OTHER");
    const html = renderToStaticMarkup(retained);
    expect(html).toContain("Inputs belong to ZERO");
    expect(html).toContain("retained for another company or catalog");
    model.discardAndUse(other);
    model.setDcfField("startingUnleveredCashFlowUsd", "900");
    (oldField.props.onChange as (value: string) => void)("100");
    click(oldCalculate);
    click(discard);
    expect(model.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd).toBe(
      "900",
    );
    expect(model.getSnapshot().calculation).toBeNull();
  });
  it("shows an oversized-entry refusal and disables Calculate until the affected field is corrected", () => {
    const { model, render } = setup();
    model.setDcfField("startingUnleveredCashFlowUsd", "100");
    const node = render();
    const field = elements(inputTree(node)).find(
      (e) =>
        e.type === ValuationInput &&
        String(e.props.id).endsWith("dcf-startingUnleveredCashFlowUsd"),
    )!;
    (field.props.onChange as (value: string) => void)("9".repeat(513));
    const refused = render();
    expect(renderToStaticMarkup(refused)).toContain(
      "exceeds 512 characters and was not accepted",
    );
    expect(button(refused, "Calculate authored scenarios").props.disabled).toBe(
      true,
    );
    expect(model.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd).toBe(
      "100",
    );
    model.setDcfField("startingUnleveredCashFlowUsd", "101");
    expect(
      button(render(), "Calculate authored scenarios").props.disabled,
    ).toBe(false);
  });
  it("blocks navigation and retired-session actions", () => {
    const { model, props, render } = setup();
    const node = render({ ...props, navigationPending: true });
    expect(button(node, "Calculate authored scenarios").props.disabled).toBe(
      true,
    );
    click(button(node, "Calculate authored scenarios"));
    expect(model.getSnapshot().calculation).toBeNull();
    model.retire();
    const html = renderToStaticMarkup(render());
    expect(html).toContain("This valuation session has ended");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("My note");
  });
  it("shows the full note before append and checks freshness again when an old append callback fires", () => {
    const { model, actions, render } = setup();
    model.calculate();
    vi.mocked(actions.prepare).mockReturnValue({
      preview: proposed(),
      reason: null,
    });
    click(button(render(), "Preview valuation note"));
    const previewNode = elements(render()).find(
      (e) => e.type === ValuationNotePreview,
    )!;
    const preview = ValuationNotePreview(
      previewNode.props as unknown as Parameters<
        typeof ValuationNotePreview
      >[0],
    );
    expect(renderToStaticMarkup(preview)).toContain(
      "My note | Authored valuation &lt;assumption&gt;",
    );
    expect(actions.append).not.toHaveBeenCalled();
    vi.mocked(actions.isCurrent).mockReturnValue(false);
    click(button(preview, "Add valuation to note draft"));
    expect(actions.append).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(render())).toContain(
      "Preview the valuation note again",
    );
  });
  it("displays whole-proposal refusal without a truncated note or append action", () => {
    const { model, actions, render } = setup();
    model.calculate();
    vi.mocked(actions.prepare).mockReturnValue({
      preview: null,
      reason:
        "The complete proposal exceeds 2,000 characters. Nothing was added.",
    });
    click(button(render(), "Preview valuation note"));
    const html = renderToStaticMarkup(render());
    expect(html).toContain(
      "The complete proposal exceeds 2,000 characters. Nothing was added.",
    );
    expect(html).not.toContain("Complete note preview");
    expect(html).not.toContain("Add valuation to note draft</button>");
    expect(actions.append).not.toHaveBeenCalled();
  });
  it("appends only the explicitly previewed note and reports the draft result", () => {
    const { model, actions, render } = setup();
    model.calculate();
    const preview = proposed();
    vi.mocked(actions.prepare).mockReturnValue({ preview, reason: null });
    click(button(render(), "Preview valuation note"));
    expect(actions.prepare).toHaveBeenCalledExactlyOnceWith("dcf", "base");
    const part = elements(render()).find(
      (e) => e.type === ValuationNotePreview,
    )!;
    const node = ValuationNotePreview(
      part.props as unknown as Parameters<typeof ValuationNotePreview>[0],
    );
    click(button(node, "Add valuation to note draft"));
    expect(actions.append).toHaveBeenCalledExactlyOnceWith(preview);
    const html = renderToStaticMarkup(render());
    expect(html).toContain("Added to the note draft.");
    expect(html).not.toContain("Complete note preview");
  });
  it("keeps assumptions editable while note editing is paused", () => {
    const { model, props, render, actions } = setup();
    model.calculate();
    const node = render({
      ...props,
      watchlist: {
        ...props.watchlist,
        canEdit: false,
        reason: "Resolve the watchlist conflict before editing notes.",
      },
    });
    expect(button(node, "Calculate authored scenarios").props.disabled).toBe(
      false,
    );
    expect(button(node, "Preview valuation note").props.disabled).toBe(true);
    click(button(node, "Preview valuation note"));
    expect(actions.prepare).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(node)).toContain(
      "Resolve the watchlist conflict before editing notes.",
    );
  });
  it("discards same-company temporary inputs and calculation, and fences the old reset callback", () => {
    const { model, props, render } = setup();
    model.setDcfField("startingUnleveredCashFlowUsd", "100");
    model.calculate();
    expect(model.hasDraft()).toBe(true);
    const oldDiscard = button(render(), "Discard valuation inputs");
    const paused = render({ ...props, navigationPending: true });
    expect(button(paused, "Discard valuation inputs").props.disabled).toBe(
      true,
    );
    click(button(paused, "Discard valuation inputs"));
    expect(model.hasDraft()).toBe(true);
    click(button(render(), "Discard valuation inputs"));
    expect(model.hasDraft()).toBe(false);
    expect(model.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd).toBe("");
    expect(model.getSnapshot().dcfDraft.forecastYears).toBe("5");
    expect(model.getSnapshot().calculation).toBeNull();
    model.setDcfField("startingUnleveredCashFlowUsd", "200");
    click(oldDiscard);
    expect(model.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd).toBe(
      "200",
    );
  });
});
