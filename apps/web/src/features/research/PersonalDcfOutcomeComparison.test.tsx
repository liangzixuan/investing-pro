import {
  calculatePersonalFcffDcfValuation,
  PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
  type PersonalFcffDcfAvailableResult,
} from "@research-cockpit/personal-market-analytics";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PersonalDcfOutcomeComparison,
  type PersonalDcfOutcomeComparisonProps,
  type PersonalDcfOutcomeSide,
} from "./PersonalDcfOutcomeComparison";

type Element = React.ReactElement<{
  children?: ReactNode;
  [key: string]: unknown;
}>;

const example = availableResult();
afterEach(() => vi.unstubAllGlobals());

describe("PersonalDcfOutcomeComparison", () => {
  it("renders three ordered scenarios with scoped headers and a named keyboard-scroll region outside a live region", () => {
    const view = PersonalDcfOutcomeComparison(props());
    const nodes = elements(view);
    expect(
      nodes
        .filter((node) => node.type === "th" && node.props.scope === "col")
        .map((node) => text(node)),
    ).toEqual(["Scenario", "Current assumptions", "Loaded saved assumptions"]);
    expect(
      nodes
        .filter((node) => node.type === "th" && node.props.scope === "row")
        .map((node) => text(node)),
    ).toEqual(["Conservative", "Base", "Expansion"]);
    const scroll = nodes.find((node) => node.props.role === "region")!;
    expect(scroll.props["aria-label"]).toBe("EXM DCF outcome comparison");
    expect(scroll.props.tabIndex).toBe(0);
    expect(scroll.props.className).toBe("dcf-outcome-comparison-scroll");
    expect(
      nodes.some((node) => node.props.id === scroll.props["aria-describedby"]),
    ).toBe(true);
    expect(nodes.filter((node) => node.type === "caption")).toHaveLength(1);
    expect(text(nodes.find((node) => node.type === "caption"))).toContain(
      "EXM: current and loaded saved DCF outcomes",
    );
    expect(nodes.some((node) => node.props["aria-live"] !== undefined)).toBe(
      false,
    );
  });

  it("displays provided money and signed percentages without converting long decimal amounts through Number", () => {
    const current = resultWithScenarios({
      conservative: {
        impliedPriceUsd: "123456789012345678901234.50",
        differencePercent: "12.34",
      },
      base: { impliedPriceUsd: "90.00", differencePercent: "0.00" },
      expansion: { impliedPriceUsd: "84.00", differencePercent: "-6.67" },
    });
    const view = PersonalDcfOutcomeComparison(
      props({ current: side(current) }),
    );
    const rows = outcomeRows(view);
    expect(text(rows[0]![0])).toContain("$123,456,789,012,345,678,901,234.50");
    expect(text(rows[0]![0])).toContain("+12.34% vs reference raw close");
    expect(text(rows[1]![0])).toContain("0.00% vs reference raw close");
    expect(text(rows[1]![0])).not.toContain("+0.00%");
    expect(text(rows[2]![0])).toContain("−6.67% vs reference raw close");
    const price = elements(rows[0]![0]).find((node) => node.type === "strong");
    expect(price?.props.title).toBe("123456789012345678901234.50 USD");
  });

  it("shows equal supplied outcomes independently without inventing a difference or equality signal", () => {
    const view = PersonalDcfOutcomeComparison(props());
    for (const row of outcomeRows(view))
      expect(text(row[0])).toBe(text(row[1]));
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain(
      "Equal displayed outcomes do not establish equal assumptions",
    );
    expect(markup).toContain("inspect the seven-input comparison");
    expect(markup).not.toContain("Better");
    expect(markup).not.toContain("Current minus saved");
  });

  it("keeps saved outcomes and validated provenance available while the current complete draft is invalid", () => {
    const view = PersonalDcfOutcomeComparison(
      props({
        current: {
          status: "unavailable",
          reason: "Complete a valid set of all seven current assumptions.",
        },
      }),
    );
    for (const row of outcomeRows(view)) {
      expect(text(row[0])).toBe(
        "UnavailableComplete a valid set of all seven current assumptions.",
      );
      expect(text(row[1])).toContain("vs reference raw close");
      expect(text(row[0])).not.toContain("$");
    }
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain("Shared source inputs and provenance");
    expect(markup).toContain('dateTime="2025-12-31"');
  });

  it("keeps the current side independent when the saved model has a nonpositive starting proxy", () => {
    const view = PersonalDcfOutcomeComparison(
      props({
        saved: {
          status: "unavailable",
          reason:
            "The saved assumptions produce a nonpositive starting FCF proxy.",
        },
      }),
    );
    for (const row of outcomeRows(view)) {
      expect(text(row[0])).toContain("vs reference raw close");
      expect(text(row[1])).toContain("nonpositive starting FCF proxy");
      expect(text(row[1])).not.toContain("$");
    }
    expect(renderToStaticMarkup(view)).toContain(
      "Shared source inputs and provenance",
    );
  });

  it("does not fabricate a reference or zero outcomes when both sides are globally unavailable", () => {
    const view = PersonalDcfOutcomeComparison(
      props({
        current: {
          status: "unavailable",
          reason: "Load matching price history.",
        },
        saved: {
          status: "unavailable",
          reason: "The loaded identity exceeds this model's input limits.",
        },
      }),
    );
    expect(outcomeRows(view)).toHaveLength(3);
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain("Load matching price history.");
    expect(markup).toContain("identity exceeds this model");
    expect(markup).toContain("No validated common reference is available.");
    expect(markup).not.toContain("Shared source inputs and provenance");
    expect(markup).not.toContain("<time");
    expect(markup).not.toContain("$0");
  });

  it("withholds only an unavailable scenario price while retaining its terminal concentration warning", () => {
    const base = example.scenarios.base;
    const current: PersonalFcffDcfAvailableResult = {
      ...example,
      scenarios: {
        ...example.scenarios,
        base: {
          ...base,
          status: "unavailable",
          reason: "nonpositive_equity_value",
          terminalValuePercentOfEnterpriseValue: "80.01",
        },
      },
    };
    const rows = outcomeRows(
      PersonalDcfOutcomeComparison(props({ current: side(current) })),
    );
    expect(text(rows[0]![0])).toContain("vs reference raw close");
    expect(text(rows[1]![0])).toContain(
      "UnavailableNo positive residual equity value.",
    );
    expect(text(rows[1]![0])).toContain("Terminal-value share: 80.01%");
    expect(text(rows[1]![0])).toContain("More than 80% of enterprise value");
    expect(text(rows[1]![0])).not.toContain("$");
    expect(text(rows[1]![1])).toContain("vs reference raw close");
    expect(text(rows[2]![0])).toContain("vs reference raw close");
  });

  it("uses the existing strict terminal threshold and labels small-rate-gap warnings by side", () => {
    const current = resultWithScenarios({
      conservative: { terminalValuePercentOfEnterpriseValue: "80.00" },
      base: { terminalValuePercentOfEnterpriseValue: "80.01" },
      expansion: { terminalValuePercentOfEnterpriseValue: "79.99" },
    });
    const view = PersonalDcfOutcomeComparison(
      props({
        current: side(current, true),
        saved: side(
          resultWithScenarios({
            conservative: { terminalValuePercentOfEnterpriseValue: "0.00" },
            base: { terminalValuePercentOfEnterpriseValue: "0.00" },
            expansion: { terminalValuePercentOfEnterpriseValue: "0.00" },
          }),
        ),
      }),
    );
    const warnings = elements(view).filter(
      (node) => node.props.className === "fcff-dcf-terminal-warning",
    );
    expect(warnings).toHaveLength(1);
    const gap = elements(view).filter(
      (node) => node.props.className === "fcff-dcf-rate-gap-warning",
    );
    expect(gap).toHaveLength(1);
    expect(text(gap[0])).toContain(
      "Current assumptions: WACC is less than 1.00 percentage point",
    );
    const savedGap = renderToStaticMarkup(
      PersonalDcfOutcomeComparison(props({ saved: side(example, true) })),
    );
    expect(savedGap).toContain("Loaded saved assumptions: ");
    expect(savedGap).toContain("highly sensitive to small rate changes");
  });

  it("exposes all exact raw operands and distinct source dates without presenting tax-derived amounts as shared", () => {
    const current = {
      ...example,
      reference: {
        ...example.reference,
        startingUnleveredFcfProxyUsd: "654321987.00",
        afterTaxInterestAddBackUsd: "654321988.00",
      },
    };
    const saved = {
      ...example,
      reference: {
        ...example.reference,
        startingUnleveredFcfProxyUsd: "654321989.00",
        afterTaxInterestAddBackUsd: "654321990.00",
      },
    };
    const markup = renderToStaticMarkup(
      PersonalDcfOutcomeComparison(
        props({ current: side(current), saved: side(saved) }),
      ),
    );
    for (const raw of [
      "90.000000",
      "900.0001",
      "1000.0002",
      "100.0003",
      "-10.0004",
    ])
      expect(markup).toContain(`<code>${raw}</code>`);
    for (const coordinate of [
      "2025-12-31",
      "2025-12-30",
      "2026-01-02T00:00:00.000Z",
      "2026-01-03T01:02:03.000Z",
    ])
      expect(markup).toContain(`dateTime="${coordinate}"`);
    expect(markup).toContain("Formula set 1.0.0");
    expect(markup).toContain("result schema 1.0.0");
    expect(markup).not.toContain("654321987");
    expect(markup).not.toContain("654321990");
    expect(markup).toContain(
      "Tax-shield assumptions can change each starting proxy",
    );
    expect(markup).toContain("not point-in-time or as-reported history");
  });

  it("escapes long labels and reasons and retains contained table/provenance structure", () => {
    const symbol = "<em>" + "長".repeat(100);
    const reason = "<script>" + "unavailable ".repeat(80);
    const view = PersonalDcfOutcomeComparison(
      props({ symbol, current: { status: "unavailable", reason } }),
    );
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain("&lt;em&gt;");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<em>");
    expect(
      elements(view).find((node) => node.type === "table")?.props.children,
    ).toBeDefined();
    expect(markup).toContain('class="dcf-outcome-comparison-scroll"');
    expect(markup).toContain(
      "<summary>Shared source inputs and provenance</summary>",
    );
  });

  it("is a pure view with no requests, writes, buttons or mutation of supplied results", () => {
    const fetch = vi.fn();
    const storageWrite = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", { setItem: storageWrite });
    const input = props();
    const before = structuredClone(input);
    const view = PersonalDcfOutcomeComparison(input);
    renderToStaticMarkup(view);
    expect(input).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
    expect(
      elements(view).filter(
        (node) => node.type === "button" || node.type === "form",
      ),
    ).toHaveLength(0);
  });
});

function props(
  overrides: Partial<PersonalDcfOutcomeComparisonProps> = {},
): PersonalDcfOutcomeComparisonProps {
  return {
    symbol: "EXM",
    current: side(example),
    saved: side(example),
    ...overrides,
  };
}

function side(
  result: PersonalFcffDcfAvailableResult,
  smallRateGap = false,
): PersonalDcfOutcomeSide {
  return { status: "available", result, smallRateGap };
}

function resultWithScenarios(
  changes: Partial<
    Record<
      "conservative" | "base" | "expansion",
      Partial<{
        impliedPriceUsd: string;
        differencePercent: string;
        terminalValuePercentOfEnterpriseValue: string;
      }>
    >
  >,
): PersonalFcffDcfAvailableResult {
  const scenario = (name: "conservative" | "base" | "expansion") => {
    const original = example.scenarios[name];
    if (original.status !== "available")
      throw new Error("Expected available fixture scenario");
    return { ...original, ...changes[name] };
  };
  return {
    ...example,
    scenarios: {
      conservative: scenario("conservative"),
      base: scenario("base"),
      expansion: scenario("expansion"),
    },
  };
}

function availableResult(): PersonalFcffDcfAvailableResult {
  const identity = {
    country: "US" as const,
    exchangeMic: "XNYS",
    issuerName: "Example Corporation",
    listingId: "lst-example",
    securityName: "Example common stock",
    symbol: "EXM",
  };
  const result = calculatePersonalFcffDcfValuation({
    selection: identity,
    assumptions: PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
    annuals: {
      asOf: "2026-01-02T00:00:00.000Z",
      security: identity,
      valueCurrency: "USD",
      years: [
        {
          fiscalYear: 2025,
          statementDate: "2025-12-30",
          reported: {
            free_cash_flow: { status: "known", value: "100.0003" },
            interest_expense: { status: "known", value: "-10.0004" },
          },
        },
      ],
    },
    market: {
      security: identity,
      priceCurrency: "USD",
      range: "1y",
      bars: [{ date: "2025-12-31", raw: { close: "90.000000" } }],
    },
    valuation: {
      security: identity,
      asOf: "2026-01-03T01:02:03.000Z",
      range: "1y",
      points: [
        {
          date: "2025-12-31",
          enterpriseValue: { status: "known", unit: "USD", value: "1000.0002" },
          marketCapitalization: {
            status: "known",
            unit: "USD",
            value: "900.0001",
          },
        },
      ],
    },
  });
  if (result.status !== "available")
    throw new Error("Expected available fixture");
  return result;
}

function outcomeRows(view: ReactNode): Element[][] {
  return elements(view)
    .filter(
      (node) =>
        node.type === "tr" &&
        elements(node).some(
          (child) => child.type === "th" && child.props.scope === "row",
        ),
    )
    .map((row) => elements(row).filter((node) => node.type === "td"));
}

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (
    !React.isValidElement<{ children?: ReactNode; [key: string]: unknown }>(
      node,
    )
  )
    return [];
  return [node, ...elements(node.props.children)];
}

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<{ children?: ReactNode }>(node)
    ? text(node.props.children)
    : "";
}
