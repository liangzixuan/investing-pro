import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  annualHistoryRows,
  annualComparativeRows,
  response,
  viewOf,
  row,
} from "./test-canonical-annual-ui-fixture";

const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  begin() {
    this.index = 0;
  },
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useId: () => "annual-trend-test",
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values))
      hooks.values[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = value;
      },
    ];
  },
}));
import { ManagedAnnualTrend } from "./ManagedAnnualTrend";
import { ManagedAnnualTrendChart } from "./ManagedAnnualTrendChart";
type Element = React.ReactElement<Record<string, unknown>>;
type Wire = Awaited<ReturnType<typeof response>>;

beforeEach(() => {
  hooks.values = [];
  hooks.begin();
});

function expand(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) return node.map(expand);
  if (!React.isValidElement<Record<string, unknown>>(node)) return node;
  if (typeof node.type === "function" && node.type !== ManagedAnnualTrendChart)
    return expand(
      (node.type as (props: unknown) => React.ReactNode)(node.props),
    );
  return React.cloneElement(
    node,
    {},
    expand(node.props.children as React.ReactNode),
  );
}
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as React.ReactNode)];
}
function text(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement<Record<string, unknown>>(node))
    return text(node.props.children as React.ReactNode);
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}
function render(wire: Wire) {
  hooks.begin();
  return expand(ManagedAnnualTrend({ response: wire, view: viewOf(wire) }));
}
function select(tree: React.ReactNode, index: number) {
  return elements(tree).filter((e) => e.type === "select")[index]!;
}
function choose(tree: React.ReactNode, index: number, value: string) {
  (select(tree, index).props.onChange as (event: unknown) => void)({
    currentTarget: { value },
  });
}
function toggle(tree: React.ReactNode, open: boolean) {
  (elements(tree)[0]!.props.onToggle as (event: unknown) => void)({
    currentTarget: { open },
  });
}

describe("managed annual trend controls", () => {
  it("starts collapsed with exact native choices and the first available basis, without a chart", async () => {
    const tree = render(await response(annualHistoryRows()));
    expect(elements(tree)[0]!.props.open).toBe(false);
    expect(text(tree)).toContain("Reported annual trend");
    expect(select(tree, 0).props.value).toBe("Revenues");
    expect(select(tree, 1).props.value).toBe("revenue");
    expect(select(tree, 0).props.id).toBe("annual-trend-test-basis");
    expect(select(tree, 1).props.id).toBe("annual-trend-test-metric");
    expect(
      elements(tree)
        .filter((e) => e.type === "option")
        .map(text),
    ).toEqual([
      "Customer contract revenue, excluding assessed tax",
      "Revenue",
      "Net sales revenue",
      "Revenue",
      "Net income",
    ]);
    expect(
      elements(select(tree, 0))
        .filter((e) => e.type === "option")
        .map((e) => e.props.value),
    ).toEqual([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ]);
    expect(elements(tree).some((e) => e.type === ManagedAnnualTrendChart)).toBe(
      false,
    );
    expect(elements(tree).some((e) => e.type === "table")).toBe(false);
  });

  it("keeps the full selected label associated through replacement and retains exact source/chart inputs", async () => {
    const concept = "RevenueFromContractWithCustomerExcludingAssessedTax";
    const wire = await response(
      annualHistoryRows().map((item) =>
        item.concept === "Revenues"
          ? {
              ...item,
              concept,
              sourceLocator: item.sourceLocator.replace("Revenues", concept),
            }
          : item,
      ),
    );
    const before = JSON.stringify(wire);
    let tree = render(wire);
    toggle(tree, true);
    tree = render(wire);
    const descriptionId = select(tree, 0).props["aria-describedby"];
    const description = elements(tree).find(
      (e) => e.props.id === descriptionId,
    )!;
    expect(description.type).toBe("p");
    expect(description.props["data-annual-trend-selected-basis"]).toBe(true);
    expect(text(description)).toBe(
      "Selected basis: Customer contract revenue, excluding assessed tax",
    );
    const source = elements(tree).find(
      (e) => e.props.className === "managed-annual-trend-source",
    )!;
    expect(text(source)).toContain(
      `Customer contract revenue, excluding assessed tax · SEC concept ${concept}`,
    );
    const chart = elements(tree).find(
      (e) => e.type === ManagedAnnualTrendChart,
    )!;
    expect(chart.props.input).toMatchObject({
      periods: [{ amount: "640" }, { amount: "800" }, { amount: "1000" }],
    });
    expect((chart.props.input as { summary: string }).summary).toContain(
      concept,
    );
    tree = render(await response(annualHistoryRows()));
    expect(select(tree, 0).props.value).toBe(concept);
    expect(select(tree, 0).props["aria-describedby"]).toBe(descriptionId);
    expect(text(elements(tree).find((e) => e.props.id === descriptionId))).toBe(
      text(description),
    );
    expect(text(tree)).toContain("no valid current annual pair");
    expect(elements(tree).some((e) => e.type === ManagedAnnualTrendChart)).toBe(
      false,
    );
    expect(JSON.stringify(wire)).toBe(before);
  });

  it("keeps disclosure/basis/metric choices across missing history and restores only replacement data", async () => {
    const original = await response(annualHistoryRows());
    let tree = render(original);
    toggle(tree, true);
    choose(tree, 1, "net_income");
    tree = render(original);
    let chart = elements(tree).find((e) => e.type === ManagedAnnualTrendChart)!;
    expect(chart.props.input).toMatchObject({ label: "Net income" });
    expect(chart.props.input).toMatchObject({
      periods: [{ amount: "32" }, { amount: "80" }, { amount: "100" }],
    });
    tree = render(await response([row("NetIncomeLoss", "75")]));
    expect(elements(tree)[0]!.props.open).toBe(true);
    expect(select(tree, 0).props.value).toBe("Revenues");
    expect(select(tree, 1).props.value).toBe("net_income");
    expect(
      elements(tree)
        .filter((e) => e.type === "select")
        .every((e) => !e.props.disabled),
    ).toBe(true);
    expect(elements(tree).some((e) => e.type === ManagedAnnualTrendChart)).toBe(
      false,
    );
    expect(text(tree)).toContain("no valid current annual pair");
    const replacement = await response(
      annualComparativeRows().map((r) =>
        r.concept === "NetIncomeLoss" ? { ...r, value: "25" } : r,
      ),
    );
    tree = render(replacement);
    chart = elements(tree).find((e) => e.type === ManagedAnnualTrendChart)!;
    expect(chart.props.input).toMatchObject({
      periods: [{ amount: "25" }, { amount: "25" }],
    });
    expect(select(tree, 1).props.value).toBe("net_income");
  });

  it("initializes to a valid one-period basis when no basis can produce a trend", async () => {
    const tree = render(await response());
    expect(select(tree, 0).props.value).toBe("Revenues");
    expect(text(tree)).toContain("at least two adjacent annual periods");
    expect(elements(tree).some((e) => e.type === ManagedAnnualTrendChart)).toBe(
      false,
    );
  });

  it("uses the first declared basis when no current pair is available", async () => {
    const tree = render(await response([row("NetIncomeLoss", "75")]));
    expect(select(tree, 0).props.value).toBe(
      "RevenueFromContractWithCustomerExcludingAssessedTax",
    );
    expect(text(tree)).toContain("no valid current annual pair");
  });

  it("initializes to a valid historical pair while preserving its current-use refusal", async () => {
    const tree = render(
      await response(annualHistoryRows(), "2027-09-20T00:00:00.000Z"),
    );
    expect(select(tree, 0).props.value).toBe("Revenues");
    expect(text(tree)).toContain("current-use policy at this load");
    expect(elements(tree).some((e) => e.type === ManagedAnnualTrendChart)).toBe(
      false,
    );
  });

  it("never silently changes a chosen basis, even when another basis has history", async () => {
    const wire = await response(annualHistoryRows());
    let tree = render(wire);
    choose(tree, 0, "SalesRevenueNet");
    toggle(tree, true);
    tree = render(wire);
    expect(select(tree, 0).props.value).toBe("SalesRevenueNet");
    expect(text(tree)).toContain("no valid current annual pair");
    expect(elements(tree).some((e) => e.type === ManagedAnnualTrendChart)).toBe(
      false,
    );
    choose(tree, 0, "unknown");
    choose(tree, 1, "cash_flow");
    tree = render(wire);
    expect(select(tree, 0).props.value).toBe("SalesRevenueNet");
    expect(select(tree, 1).props.value).toBe("revenue");
  });

  it("keeps one-period and current-use refusals explicit while leaving controls mounted", async () => {
    let tree = render(await response(annualComparativeRows()));
    toggle(tree, true);
    tree = render(await response());
    expect(text(tree)).toContain("at least two adjacent annual periods");
    expect(elements(tree).some((e) => e.type === ManagedAnnualTrendChart)).toBe(
      false,
    );
    tree = render(
      await response(annualHistoryRows(), "2027-09-20T00:00:00.000Z"),
    );
    expect(text(tree)).toContain("current-use policy at this load");
    expect(select(tree, 0).props.value).toBe("Revenues");
    expect(elements(tree)[0]!.props.open).toBe(true);
  });

  it("closes only the chart and resets presentation after unmount", async () => {
    const wire = await response(annualHistoryRows());
    let tree = render(wire);
    toggle(tree, true);
    choose(tree, 1, "net_income");
    tree = render(wire);
    toggle(tree, false);
    tree = render(wire);
    expect(elements(tree).some((e) => e.type === ManagedAnnualTrendChart)).toBe(
      false,
    );
    expect(select(tree, 1).props.value).toBe("net_income");
    hooks.values = [];
    tree = render(wire);
    expect(select(tree, 1).props.value).toBe("revenue");
    expect(elements(tree)[0]!.props.open).toBe(false);
  });
});
