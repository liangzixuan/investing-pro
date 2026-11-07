import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedPortfolioGroupEdits } from "./ManagedPortfolioGroupEdits";
import { PortfolioGroupComparison } from "./PortfolioGroupComparison";
import {
  PersonalPortfolioLedgerEditor,
  type PersonalPortfolioLedgerEditorProps,
} from "../features/research/PersonalPortfolioLedgerEditor";
import { portfolioScreenFixture } from "./test-portfolio-screen-selection-fixture";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as Array<() => void | (() => void)>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (initial: unknown) => {
      const index = hooks.index++;
      return (hooks.slots[index] ??= { current: initial });
    },
    useMemo: (create: () => unknown) => {
      const index = hooks.index++;
      return (hooks.slots[index] ??= create());
    },
    useSyncExternalStore: (_: unknown, read: () => unknown) => read(),
    useEffect: (effect: () => void | (() => void)) => {
      const index = hooks.index++;
      if (!hooks.slots[index]) {
        hooks.slots[index] = true;
        hooks.effects.push(effect);
      }
    },
    useLayoutEffect: () => undefined,
  };
});
let fixture: Awaited<ReturnType<typeof portfolioScreenFixture>>;
let cleanup: (() => void) | undefined;
beforeEach(async () => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
  fixture = await portfolioScreenFixture(true, false);
  fixture.workspace.setView("portfolio");
});
afterEach(async () => {
  cleanup?.();
  cleanup = undefined;
  await Promise.resolve();
  fixture.dispose();
  vi.useRealTimers();
});
type Node = React.ReactElement<
  Record<string, unknown> & { children?: React.ReactNode }
>;
function nodes(tree: React.ReactNode): Node[] {
  return React.Children.toArray(tree).flatMap((node) =>
    React.isValidElement(node)
      ? [node as Node, ...nodes((node.props as Node["props"]).children)]
      : [],
  );
}
function render() {
  hooks.index = 0;
  return ManagedPortfolioGroupEdits({
    workspace: fixture.workspace,
    active: () => fixture.workspace.getSnapshot().view === "portfolio",
    disabled: false,
  });
}
function button(tree: React.ReactNode, label: string) {
  const node = nodes(tree).find(
    (entry) => entry.type === "button" && entry.props.children === label,
  );
  if (!node) throw new Error(`Missing ${label}`);
  return node;
}
function click(node: Node) {
  const target = { ownerDocument: { activeElement: null } };
  (node.props.onClick as (event: unknown) => void)({ currentTarget: target });
}
function editor(tree: React.ReactNode) {
  return nodes(tree).find(
    (node) => node.type === PersonalPortfolioLedgerEditor,
  )!.props as unknown as PersonalPortfolioLedgerEditorProps;
}

it("routes several edits through review and one explicit Apply while Save stays separate", () => {
  let tree = render();
  cleanup = hooks.effects[0]!() || undefined;
  const original = fixture.workspace.portfolio.coordinator.getSnapshot();
  click(button(tree, "Start group of edits"));
  tree = render();
  let form = editor(tree);
  expect(form.destination).toBe("group");
  form.onPendingEditsChange!(true);
  expect(button(render(), "Review all changes").props.disabled).toBe(true);
  form.onChange({
    ...form.ledger,
    opening: { ...form.ledger.opening, cashUsd: "200" },
  });
  form = editor(render());
  form.onChange({
    ...form.ledger,
    transactions: [
      {
        id: "deposit",
        type: "deposit",
        date: "2026-11-05",
        listingId: null,
        shares: null,
        grossUsd: "25",
        feeUsd: "0",
      },
    ],
  });
  expect(fixture.workspace.portfolio.coordinator.getSnapshot()).toBe(original);
  click(button(render(), "Review all changes"));
  tree = render();
  expect(
    nodes(tree).some((node) => node.type === PortfolioGroupComparison),
  ).toBe(true);
  const apply = button(tree, "Apply all changes");
  click(apply);
  const installed = fixture.workspace.portfolio.coordinator.getSnapshot();
  expect(installed.draft?.ledger?.transactions).toHaveLength(1);
  click(apply);
  expect(fixture.workspace.portfolio.coordinator.getSnapshot()).toBe(installed);
  expect(fixture.api.savePortfolio).not.toHaveBeenCalled();
});

it("survives StrictMode effect replay and refuses callbacks immediately after unmount", async () => {
  const tree = render();
  const setup = hooks.effects[0]!;
  const firstCleanup = setup() as () => void;
  firstCleanup();
  cleanup = setup() as () => void;
  await Promise.resolve();
  click(button(tree, "Start group of edits"));
  const form = editor(render());
  const original = fixture.workspace.portfolio.coordinator.getSnapshot();
  cleanup();
  cleanup = undefined;
  form.onChange({
    ...form.ledger,
    opening: { ...form.ledger.opening, cashUsd: "999" },
  });
  expect(fixture.workspace.portfolio.coordinator.getSnapshot()).toBe(original);
  await Promise.resolve();
  expect(fixture.workspace.portfolio.getSnapshot().groupedEditing).toBe(false);
});

it("corrects settled group edits with Undo and Redo before separate review and Apply", () => {
  const initial = render();
  cleanup = hooks.effects[0]!() || undefined;
  const original = fixture.workspace.portfolio.coordinator.getSnapshot();
  click(button(initial, "Start group of edits"));
  expect(button(render(), "Undo group edit").props.disabled).toBe(true);
  expect(button(render(), "Redo group edit").props.disabled).toBe(true);
  const first = editor(render());
  first.onChange({
    ...first.ledger,
    opening: { ...first.ledger.opening, cashUsd: "200" },
  });
  const second = editor(render());
  second.onChange({
    ...second.ledger,
    opening: { ...second.ledger.opening, cashUsd: "300" },
  });
  const undo = button(render(), "Undo group edit");
  click(undo);
  expect(editor(render()).ledger.opening.cashUsd).toBe("200");
  click(undo); // A retained control cannot traverse a later state.
  expect(editor(render()).ledger.opening.cashUsd).toBe("200");
  expect(button(render(), "Redo group edit").props.disabled).toBe(false);
  const pending = editor(render());
  pending.onPendingEditsChange!(true);
  expect(button(render(), "Undo group edit").props.disabled).toBe(true);
  expect(button(render(), "Redo group edit").props.disabled).toBe(true);
  click(button(render(), "Redo group edit"));
  expect(editor(render()).ledger.opening.cashUsd).toBe("200");
  pending.onPendingEditsChange!(false);
  click(button(render(), "Redo group edit"));
  expect(editor(render()).ledger.opening.cashUsd).toBe("300");
  expect(button(render(), "Redo group edit").props.disabled).toBe(true);
  expect(fixture.workspace.portfolio.coordinator.getSnapshot()).toBe(original);
  click(button(render(), "Review all changes"));
  click(button(render(), "Continue editing group"));
  click(button(render(), "Undo group edit"));
  expect(editor(render()).ledger.opening.cashUsd).toBe("200");
  click(button(render(), "Review all changes"));
  const comparison = nodes(render()).find(
    (node) => node.type === PortfolioGroupComparison,
  )!;
  expect(comparison.props.after).toMatchObject({
    portfolio: { cashUsd: "200.00" },
  });
  click(button(render(), "Apply all changes"));
  expect(
    fixture.workspace.portfolio.coordinator.getSnapshot().draft?.ledger?.opening
      .cashUsd,
  ).toBe("200");
  expect(fixture.api.savePortfolio).not.toHaveBeenCalled();
  expect(
    nodes(render()).some((node) => node.props.children === "Undo group edit"),
  ).toBe(false);
});
