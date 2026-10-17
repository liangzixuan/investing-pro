import { describe, expect, it, vi } from "vitest";
import { calculateAuthoredPriceComparison } from "@research-cockpit/personal-market-analytics";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import {
  ManagedEodHistory,
  type ManagedEodHistoryState,
} from "./managed-eod-history";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  ManagedValuationWorkbench,
  VALUATION_SCENARIOS,
  type DcfField,
  type ExitField,
} from "./managed-valuation-workbench";
import {
  managedValuationPriceContextIsOwned,
  resolveManagedValuationPrice,
} from "./managed-valuation-price";

function calculation(selection = eodSelection, bridge = "100") {
  const workbench = new ManagedValuationWorkbench();
  workbench.activate(selection);
  const dcf: Readonly<Partial<Record<DcfField, string>>> = {
    startingUnleveredCashFlowUsd: "100",
    enterpriseToEquityBridgeUsd: bridge,
    dilutedShares: "10",
    waccPercent: "10",
    terminalGrowthPercent: "0",
  };
  for (const [field, value] of Object.entries(dcf))
    workbench.setDcfField(field as DcfField, value);
  for (const [index, scenario] of VALUATION_SCENARIOS.entries())
    workbench.setDcfScenario(scenario, String(index * 10));
  const exit: Readonly<Partial<Record<ExitField, string>>> = {
    baseRevenue: "1900",
    cash: "0",
    debt: "0",
    dilutedShares: "10",
    discountRatePercent: "10",
  };
  for (const [field, value] of Object.entries(exit))
    workbench.setExitField(field as ExitField, value);
  for (const scenario of VALUATION_SCENARIOS) {
    workbench.setExitScenario(scenario, "annualRevenueGrowthPercent", "10");
    workbench.setExitScenario(scenario, "targetEbitdaMarginPercent", "10");
    workbench.setExitScenario(scenario, "exitMultiple", "1");
  }
  const capture = workbench.calculate();
  if (!capture) throw new Error("Missing authored test calculation");
  return { workbench, capture };
}

function price(
  overrides: Partial<ManagedEodHistoryState> = {},
): ManagedEodHistoryState {
  const response = structuredClone(eodResponse());
  const rows = [
    { date: "2026-09-18", close: "100.000000000000000001" },
    { date: "2026-09-19", close: "110.000000000000000003" },
  ];
  return {
    selection: eodSelection,
    available: true,
    selectedRange: "1m",
    response: { ...response, rows },
    responseOrigin: "company",
    showingPrevious: false,
    running: false,
    catalogChanged: false,
    message: "Loaded explicit Price source",
    error: false,
    ...overrides,
  };
}

describe("authored valuation against explicitly loaded raw Price", () => {
  it("reuses the exact comparison engine with rounded model values and the latest observed close", () => {
    const { capture } = calculation();
    const source = price();
    const before = JSON.stringify(source);
    const context = resolveManagedValuationPrice(
      eodSelection,
      capture,
      source,
    )!;
    expect(context.reason).toBeNull();
    expect(context.reference).toMatchObject({
      date: "2026-09-19",
      rawCloseUsd: "110.000000000000000003",
      showingPrevious: false,
      response: {
        provider: "Tiingo",
        currency: "USD",
        priceBasis: "raw_close",
        window: { startDate: "2026-08-20", endDate: "2026-09-20" },
        requestStartedAt: "2026-09-20T00:00:00.000Z",
        completedAt: "2026-09-20T00:00:01.000Z",
        security: eodSelection.listing,
        catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
      },
    });
    expect(context.rows.map((row) => row.modelValuePerShareUsd)).toEqual([
      "90.00",
      "140.00",
      "209.91",
      "19.00",
      "19.00",
      "19.00",
    ]);
    expect(context.rows.map((row) => row.result)).toEqual([
      { status: "available", differencePercent: "-18.18" },
      { status: "available", differencePercent: "27.27" },
      { status: "available", differencePercent: "90.83" },
      ...Array.from({ length: 3 }, () => ({
        status: "available",
        differencePercent: "-82.73",
      })),
    ]);
    for (const row of context.rows)
      expect(row.result).toEqual(
        calculateAuthoredPriceComparison(
          row.modelValuePerShareUsd,
          context.reference!.rawCloseUsd,
        ),
      );
    expect(JSON.stringify(source)).toBe(before);
    expect(context.reference!.response).not.toBe(source.response);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.rows[0])).toBe(true);
    expect(Object.isFrozen(context.reference!.response.rows)).toBe(true);
    expect(resolveManagedValuationPrice(eodSelection, capture, source)).toBe(
      context,
    );
    expect(
      managedValuationPriceContextIsOwned(
        context,
        eodSelection,
        capture,
        source,
      ),
    ).toBe(true);
  });

  it("keeps a nonpositive scenario and an invalid model independent from the other comparisons", () => {
    const { workbench, capture } = calculation(eodSelection, "1100");
    const source = price();
    const rows = resolveManagedValuationPrice(
      eodSelection,
      capture,
      source,
    )!.rows;
    expect(rows[0]).toMatchObject({
      model: "dcf",
      scenario: "conservative",
      modelValuePerShareUsd: null,
      result: { status: "unavailable", reason: "nonpositive_equity_value" },
    });
    expect(rows[1]).toMatchObject({
      modelValuePerShareUsd: "40.00",
      result: { status: "available", differencePercent: "-63.64" },
    });
    expect(rows[3]!.result.status).toBe("available");
    workbench.setExitField("cash", "");
    const invalidExit = workbench.calculate()!;
    const next = resolveManagedValuationPrice(
      eodSelection,
      invalidExit,
      source,
    )!;
    expect(next.rows[1]!.result.status).toBe("available");
    expect(next.rows.slice(3).map((row) => row.result)).toEqual(
      Array.from({ length: 3 }, () => ({
        status: "unavailable",
        reason: "invalid_input",
      })),
    );
    const missing = resolveManagedValuationPrice(
      eodSelection,
      invalidExit,
      null,
    )!;
    expect(missing.reason).toBe("price_not_loaded");
    expect(missing.rows[0]!.result).toEqual({
      status: "unavailable",
      reason: "nonpositive_equity_value",
    });
    expect(missing.rows[1]!.result).toEqual({
      status: "unavailable",
      reason: "price_not_loaded",
    });
    expect(missing.rows[3]!.result).toEqual({
      status: "unavailable",
      reason: "invalid_input",
    });
  });

  it.each([
    ["pending", { running: true, showingPrevious: true }, "price_pending"],
    ["staged", { selectedRange: "1y" }, "price_range_staged"],
    ["catalog changed", { catalogChanged: true }, "price_catalog_changed"],
    [
      "not loaded",
      { response: null, responseOrigin: null },
      "price_not_loaded",
    ],
    ["unavailable", { available: false }, "price_invalid"],
  ] as const)(
    "refuses %s Price context without treating the retained close as current",
    (_label, change, reason) => {
      const { capture } = calculation();
      const context = resolveManagedValuationPrice(
        eodSelection,
        capture,
        price(change),
      )!;
      expect(context.reason).toBe(reason);
      expect(context.reference).toBeNull();
      expect(context.rows).toHaveLength(6);
      expect(
        context.rows.every(
          (row) =>
            row.result.status === "unavailable" && row.result.reason === reason,
        ),
      ).toBe(true);
    },
  );

  it("preserves a completed retained source's dates and qualification", () => {
    const { capture } = calculation();
    const context = resolveManagedValuationPrice(
      eodSelection,
      capture,
      price({ showingPrevious: true, error: true }),
    )!;
    expect(context.reason).toBeNull();
    expect(context.reference).toMatchObject({
      date: "2026-09-19",
      showingPrevious: true,
    });
    expect(context.rows[1]!.result).toEqual({
      status: "available",
      differencePercent: "27.27",
    });
  });

  it.each(["origin", "cik", "catalog", "shareClass", "issuerName"] as const)(
    "refuses source selection %s changes even if symbol and listing ID match",
    (field) => {
      const { capture } = calculation();
      const selection: ManagedResearchSelection = {
        ...eodSelection,
        ...(field === "origin" ? { origin: "watchlist" } : {}),
        ...(field === "cik" ? { cik: "0000000002" } : {}),
        ...(field === "catalog"
          ? { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const }
          : {}),
        listing: {
          ...eodSelection.listing,
          ...(field === "shareClass" ? { shareClassId: "other-class" } : {}),
          ...(field === "issuerName" ? { issuerName: "Other issuer" } : {}),
        },
      };
      expect(
        resolveManagedValuationPrice(
          eodSelection,
          capture,
          price({ selection }),
        )!.reason,
      ).toBe("price_identity_mismatch");
    },
  );

  it("admits a live same-company calculation after returning through another origin, requiring the new Price origin", () => {
    const { workbench, capture } = calculation();
    const returned = { ...eodSelection, origin: "watchlist" as const };
    workbench.activate(returned);
    expect(workbench.getSnapshot().calculation).toBe(capture);
    const source = price({ selection: returned });
    const context = resolveManagedValuationPrice(returned, capture, source)!;
    expect(context.selection.origin).toBe("watchlist");
    expect(context.calculation.owner.origin).toBe("discover");
    expect(context.rows[1]!.result.status).toBe("available");
    expect(
      managedValuationPriceContextIsOwned(context, returned, capture, source),
    ).toBe(true);
    expect(
      resolveManagedValuationPrice(returned, capture, price())!.reason,
    ).toBe("price_identity_mismatch");
  });

  it.each([
    "currency",
    "adjusted",
    "lastZero",
    "lastNegative",
    "rowOrder",
    "sourceMembership",
    "window",
    "deadline",
    "extra",
  ] as const)(
    "refuses malformed %s without falling back to an older positive close",
    (fault) => {
      const { capture } = calculation();
      const original = price().response!;
      const bad = {
        ...original,
        ...(fault === "currency" ? { currency: "EUR" } : {}),
        ...(fault === "adjusted" ? { priceBasis: "adjusted_close" } : {}),
        ...(fault === "lastZero" || fault === "lastNegative"
          ? {
              rows: [
                original.rows[0],
                {
                  ...original.rows[1],
                  close: fault === "lastZero" ? "0" : "-1",
                },
              ],
            }
          : {}),
        ...(fault === "rowOrder" ? { rows: [...original.rows].reverse() } : {}),
        ...(fault === "sourceMembership"
          ? { security: { ...original.security, shareClassId: "other" } }
          : {}),
        ...(fault === "window"
          ? { window: { ...original.window, endDate: "2026-09-19" } }
          : {}),
        ...(fault === "deadline"
          ? { completedAt: "2026-09-20T00:00:10.000Z" }
          : {}),
        ...(fault === "extra" ? { quote: "111" } : {}),
      };
      const context = resolveManagedValuationPrice(
        eodSelection,
        capture,
        price({ response: bad as never }),
      )!;
      expect(context.reason).toBe(
        fault === "sourceMembership"
          ? "price_identity_mismatch"
          : "price_invalid",
      );
      expect(context.reference).toBeNull();
      expect(
        context.rows.every((row) => row.result.status === "unavailable"),
      ).toBe(true);
    },
  );

  it("refuses empty sources and preserves comparison operand limits", () => {
    const { capture } = calculation();
    const original = price().response!;
    expect(
      resolveManagedValuationPrice(
        eodSelection,
        capture,
        price({ response: { ...original, rows: [] } }),
      )!.reason,
    ).toBe("price_invalid");
    const source = price({
      response: {
        ...original,
        rows: [{ date: "2026-09-19", close: "0.0000000000000000001" }],
      },
    });
    const context = resolveManagedValuationPrice(
      eodSelection,
      capture,
      source,
    )!;
    expect(context.reason).toBeNull();
    expect(context.reference!.rawCloseUsd).toBe("0.0000000000000000001");
    expect(
      context.rows.every(
        (row) =>
          row.result.status === "unavailable" &&
          row.result.reason === "price_comparison_input_invalid",
      ),
    ).toBe(true);
  });

  it("rejects forged calculations/contexts and permanently invalidates an observed source mutation", () => {
    const { capture } = calculation();
    const source = price();
    const context = resolveManagedValuationPrice(
      eodSelection,
      capture,
      source,
    )!;
    expect(
      resolveManagedValuationPrice(eodSelection, { ...capture }, source),
    ).toBeNull();
    expect(
      managedValuationPriceContextIsOwned(
        { ...context },
        eodSelection,
        capture,
        source,
      ),
    ).toBe(false);
    expect(
      managedValuationPriceContextIsOwned(context, eodSelection, capture, {
        ...source,
      }),
    ).toBe(false);
    const mutable = source.response!.rows[1] as { close: string };
    mutable.close = "111";
    expect(
      managedValuationPriceContextIsOwned(
        context,
        eodSelection,
        capture,
        source,
      ),
    ).toBe(false);
    expect(context.reference!.rawCloseUsd).toBe("110.000000000000000003");
    mutable.close = "110.000000000000000003";
    expect(
      managedValuationPriceContextIsOwned(
        context,
        eodSelection,
        capture,
        source,
      ),
    ).toBe(false);
    expect(
      resolveManagedValuationPrice(eodSelection, capture, source),
    ).not.toBe(context);
  });

  it("requires a live calculation on resolution while allowing an immutable passive capture after retirement", () => {
    const { workbench, capture } = calculation();
    const source = price();
    const context = resolveManagedValuationPrice(
      eodSelection,
      capture,
      source,
    )!;
    workbench.setDcfField("waccPercent", "11");
    workbench.setDcfField("waccPercent", "10");
    expect(
      resolveManagedValuationPrice(eodSelection, capture, source),
    ).toBeNull();
    expect(
      managedValuationPriceContextIsOwned(
        context,
        eodSelection,
        capture,
        source,
      ),
    ).toBe(true);
    workbench.retire();
    expect(
      resolveManagedValuationPrice(eodSelection, capture, source),
    ).toBeNull();
    expect(
      managedValuationPriceContextIsOwned(
        context,
        eodSelection,
        capture,
        source,
      ),
    ).toBe(true);
    expect(resolveManagedValuationPrice(eodSelection, null, source)).toBeNull();
    expect(
      resolveManagedValuationPrice(
        { ...eodSelection, cik: "0000000002" },
        capture,
        source,
      ),
    ).toBeNull();
  });

  it("does not reuse a capture for a replaced response, changed source metadata or foreign calculation selection", () => {
    const { capture } = calculation();
    const source = price();
    const context = resolveManagedValuationPrice(
      eodSelection,
      capture,
      source,
    )!;
    expect(
      resolveManagedValuationPrice(
        {
          ...eodSelection,
          listing: { ...eodSelection.listing, securityId: "foreign-security" },
        },
        capture,
        source,
      ),
    ).toBeNull();
    const replaced = { ...source, response: structuredClone(source.response) };
    const replacement = resolveManagedValuationPrice(
      eodSelection,
      capture,
      replaced,
    )!;
    expect(replacement).not.toBe(context);
    expect(resolveManagedValuationPrice(eodSelection, capture, replaced)).toBe(
      replacement,
    );
    expect(
      managedValuationPriceContextIsOwned(
        context,
        eodSelection,
        capture,
        replaced,
      ),
    ).toBe(false);
    const mutable = replaced as { message: string };
    mutable.message = "A changed source status";
    expect(
      managedValuationPriceContextIsOwned(
        replacement,
        eodSelection,
        capture,
        replaced,
      ),
    ).toBe(false);
    mutable.message = source.message;
    expect(
      managedValuationPriceContextIsOwned(
        replacement,
        eodSelection,
        capture,
        replaced,
      ),
    ).toBe(false);
  });

  it("retains an available rounded zero model value and the comparison engine's positive-operand refusal", () => {
    const { capture, workbench } = calculation(eodSelection, "0");
    workbench.setDcfField(
      "startingUnleveredCashFlowUsd",
      "0.000000000000000001",
    );
    const tiny = workbench.calculate()!;
    const context = resolveManagedValuationPrice(eodSelection, tiny, price())!;
    expect(context.rows[0]).toMatchObject({
      modelValuePerShareUsd: "0.00",
      result: {
        status: "unavailable",
        reason: "price_comparison_input_invalid",
      },
    });
    expect(context.rows[3]!.result.status).toBe("available");
    expect(
      resolveManagedValuationPrice(eodSelection, capture, price()),
    ).toBeNull();
  });

  it("does not invoke accessors or initiate source reads during calculation, capture or ownership checks", () => {
    const { capture, workbench } = calculation();
    const source = price();
    const getter = vi.fn(() => "1m");
    const invalid = { ...source };
    Object.defineProperty(invalid, "selectedRange", {
      enumerable: true,
      get: getter,
    });
    expect(
      resolveManagedValuationPrice(eodSelection, capture, invalid)!.reason,
    ).toBe("price_invalid");
    const response = { ...source.response! };
    Object.defineProperty(response, "range", { enumerable: true, get: getter });
    expect(
      resolveManagedValuationPrice(eodSelection, capture, price({ response }))!
        .reason,
    ).toBe("price_invalid");
    expect(getter).not.toHaveBeenCalled();
    const exotic = new Proxy(source, {
      getPrototypeOf() {
        throw new Error("Refuse exotic state");
      },
    });
    expect(
      resolveManagedValuationPrice(eodSelection, capture, exotic)!.reason,
    ).toBe("price_invalid");
    const read = vi.fn();
    const model = new ManagedEodHistory(read, vi.fn(), undefined, [
      eodSelection.listing,
    ]);
    const visit = { ...eodSelection, origin: "watchlist" as const };
    workbench.activate(visit);
    model.open(visit, {
      response: source.response!,
      showingPrevious: true,
    });
    const snapshot = model.getSnapshot();
    const context = resolveManagedValuationPrice(visit, capture, snapshot)!;
    expect(context.reference!.showingPrevious).toBe(true);
    expect(
      managedValuationPriceContextIsOwned(context, visit, capture, snapshot),
    ).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });
});
