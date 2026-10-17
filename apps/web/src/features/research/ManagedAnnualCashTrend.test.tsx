import { viewOf } from "./test-canonical-annual-ui-fixture";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  annualCashHistoryRows,
  cashResponse,
} from "./test-canonical-annual-cash-ui-fixture";
import { parseSecAnnualCanonicalResponse } from "../../lib/sec-annual-canonical-response";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock("react", async (original) => ({
  ...(await original()),
  useId: () => "cash-trend-test",
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = value;
      },
    ];
  },
}));
import { SecAnnualCashHistory } from "./SecAnnualCashHistory";
import { ManagedAnnualTrendChart } from "./ManagedAnnualTrendChart";
import type { ManagedAnnualAmountChartInput } from "./managed-annual-amount-plot";

type Element = React.ReactElement<Record<string, unknown>>;
beforeEach(() => {
  hooks.values = [];
  hooks.index = 0;
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
async function packet(rows = annualCashHistoryRows(), cutoff?: string) {
  const raw = await cashResponse(rows, cutoff);
  const value = await parseSecAnnualCanonicalResponse(
    raw,
    {
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: raw.catalogSnapshotSha256,
      listingId: raw.security.listingId,
      symbol: raw.security.symbol,
    },
    new AbortController().signal,
  );
  if (!value) throw new Error("Invented cash packet refused");
  return value;
}
function render(response: Awaited<ReturnType<typeof packet>>) {
  hooks.index = 0;
  return expand(SecAnnualCashHistory({ response, view: viewOf(response) }));
}
function select(tree: React.ReactNode) {
  return elements(tree).find((e) => e.type === "select")!;
}
function choose(tree: React.ReactNode, value: string) {
  (select(tree).props.onChange as (event: unknown) => void)({
    currentTarget: { value },
  });
}
function toggle(tree: React.ReactNode, open: boolean, nested = false) {
  const target = { open };
  (elements(tree)[0]!.props.onToggle as (event: unknown) => void)({
    currentTarget: target,
    target: nested ? {} : target,
  });
}
function chartInput(tree: React.ReactNode) {
  return elements(tree).find((e) => e.type === ManagedAnnualTrendChart)?.props
    .input as ManagedAnnualAmountChartInput | undefined;
}

describe("cash trend within reported history", () => {
  it("keeps a closed native disclosure, all three choices and the exact newest-first table", async () => {
    const response = await packet();
    const before = JSON.stringify(response);
    const tree = render(response);
    expect(elements(tree)[0]!.props.open).toBeUndefined();
    expect(chartInput(tree)).toBeUndefined();
    expect(select(tree).props).toMatchObject({
      value: "operatingCashFlow",
      id: "cash-trend-test-metric",
      "aria-describedby": "cash-trend-test-selected-metric",
    });
    expect(
      elements(tree)
        .filter((e) => e.type === "option")
        .map((e) => [e.props.value, text(e)]),
    ).toEqual([
      ["operatingCashFlow", "Operating cash flow"],
      ["ppePurchases", "PP&E purchases"],
      [
        "operatingCashFlowLessPpePurchases",
        "Operating cash flow less PP&E purchases",
      ],
    ]);
    expect(text(tree)).toContain(
      "Selected metric: Operating cash flow · Reported",
    );
    expect(text(tree)).toContain("3 periods · newest first");
    expect(
      elements(tree)
        .filter((e) => e.type === "td")
        .map(text),
    ).toEqual([
      "120.125",
      "-50",
      "500",
      "20.025",
      "0",
      "750",
      "100.1",
      "-50",
      "-250",
    ]);
    expect(text(tree)).toContain(
      "Original load completed 2026-09-20T00:00:02.000Z",
    );
    expect(JSON.stringify(response)).toBe(before);
  });

  it("opens only its own chart and retains all selected series through closing and replacement", async () => {
    const response = await packet();
    let tree = render(response);
    toggle(tree, true, true);
    expect(chartInput(render(response))).toBeUndefined();
    toggle(tree, true);
    tree = render(response);
    expect(chartInput(tree)?.plot).toEqual({
      status: "ready",
      values: [500, -50, 120.125],
    });
    choose(tree, "ppePurchases");
    tree = render(response);
    expect(chartInput(tree)?.plot).toEqual({
      status: "ready",
      values: [750, 0, 20.025],
    });
    choose(tree, "operatingCashFlowLessPpePurchases");
    tree = render(response);
    expect(chartInput(tree)?.plot).toEqual({
      status: "ready",
      values: [-250, -50, 100.1],
    });
    expect(text(tree)).toContain(
      "Selected metric: Operating cash flow less PP&E purchases · App calculation",
    );
    const identity = select(tree).props.id;
    toggle(tree, false);
    tree = render(response);
    expect(chartInput(tree)).toBeUndefined();
    expect(select(tree).props.value).toBe("operatingCashFlowLessPpePurchases");
    toggle(tree, true);
    const replacement = await packet(
      annualCashHistoryRows().filter((r) => r.endDate !== "2023-12-31"),
      "2026-09-21T00:00:00.000Z",
    );
    tree = render(replacement);
    expect(select(tree).props.id).toBe(identity);
    expect(chartInput(tree)?.plot).toEqual({
      status: "ready",
      values: [-50, 100.1],
    });
    expect(text(tree)).toContain(
      "Original load completed 2026-09-21T00:00:02.000Z",
    );
  });

  it("retains the chosen metric across unavailable history and never selects a safe fallback", async () => {
    const response = await packet();
    let tree = render(response);
    toggle(tree, true);
    choose(tree, "operatingCashFlowLessPpePurchases");
    tree = render(await packet([]));
    expect(select(tree).props.value).toBe("operatingCashFlowLessPpePurchases");
    expect(select(tree).props.disabled).toBeUndefined();
    expect(chartInput(tree)).toBeUndefined();
    expect(text(tree)).toContain("Cash history unavailable.");
    tree = render(
      await packet(
        annualCashHistoryRows().filter((r) => r.endDate === "2025-12-31"),
      ),
    );
    expect(text(tree)).toContain("at least two adjacent annual periods");
    tree = render(await packet(undefined, "2028-09-20T00:00:00.000Z"));
    expect(text(tree)).toContain("outside the current-use limits");
    const unsafe = await packet(
      annualCashHistoryRows().map((r) => ({
        ...r,
        value:
          r.metric === "operating_cash_flow"
            ? "-9007199254740991"
            : "9007199254740991",
      })),
    );
    tree = render(unsafe);
    expect(chartInput(tree)?.plot).toEqual({
      status: "unavailable",
      reason: "unsafe_plot_value",
    });
    expect(text(tree)).toContain("-18014398509481982");
    choose(tree, "unknown");
    expect(select(render(unsafe)).props.value).toBe(
      "operatingCashFlowLessPpePurchases",
    );
    choose(tree, "ppePurchases");
    expect(chartInput(render(unsafe))?.plot.status).toBe("ready");
    hooks.values = [];
    tree = render(response);
    expect(select(tree).props.value).toBe("operatingCashFlow");
    expect(chartInput(tree)).toBeUndefined();
  });
});
