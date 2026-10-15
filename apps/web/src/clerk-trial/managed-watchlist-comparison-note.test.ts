import { describe, expect, it, vi } from "vitest";
import {
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryResponseDto,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import {
  changeManagedWatchlistComparisonInterval,
  createManagedWatchlistComparisonSelection,
  selectManagedWatchlistComparisonRow,
  type ManagedWatchlistComparisonSelection,
} from "./managed-watchlist-comparison";
import type {
  ManagedWatchlistPriceRow,
  ManagedWatchlistPricesState,
} from "./managed-watchlist-prices";
import { getManagedWatchlistComparisonNoteEvidence as evidence } from "./managed-watchlist-comparison-note";

const dates = ["2026-09-17", "2026-09-18", "2026-09-19"] as const;
function row(
  symbol: string,
  closes: readonly string[] = ["100", "110", "90"],
  observed: readonly string[] = dates,
  capturedDay = "20",
): ManagedWatchlistPriceRow {
  const listing: ManagedEodIdentity = {
    ...eodSelection.listing,
    issuerName: "Café Group",
    listingId: `listing-${symbol.toLowerCase()}`,
    securityId: `security-${symbol.toLowerCase()}`,
    securityName: `Café ${symbol} shares`,
    shareClassId: `class-${symbol.toLowerCase()}`,
    shareClassName: symbol === "ALFA" ? "Class A" : "Class C",
    symbol,
  };
  const response = parseManagedEodHistoryResponse(
    {
      ...eodResponse(),
      security: listing,
      window: {
        startDate: `2026-08-${capturedDay}`,
        endDate: `2026-09-${capturedDay}`,
      },
      requestStartedAt: `2026-09-${capturedDay}T00:00:00.000Z`,
      completedAt: `2026-09-${capturedDay}T00:00:01.000Z`,
      rows: observed.map((date, index) => ({ date, close: closes[index]! })),
    },
    {
      catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
      listingId: listing.listingId,
      range: "1m",
    },
  );
  if (!response) throw new Error("Invalid invented comparison-note packet");
  return Object.freeze({
    handle: Symbol(symbol),
    listing: Object.freeze(listing),
    history: Object.freeze({
      selection: Object.freeze({
        ...eodSelection,
        origin: "watchlist" as const,
        listing,
      }),
      available: true,
      selectedRange: "1m",
      response,
      responseOrigin: "watchlist" as const,
      showingPrevious: false,
      running: false,
      catalogChanged: false,
      message: "",
      error: false,
    }),
  });
}
function state(
  rows: readonly ManagedWatchlistPriceRow[] = [
    row("ALFA"),
    row("BETA", ["100", "95", "120"], dates, "21"),
  ],
): ManagedWatchlistPricesState {
  return Object.freeze({
    active: true,
    canRead: true,
    rows: Object.freeze(rows),
    pending: null,
    catalogChanged: false,
  });
}
function pair(prices: ManagedWatchlistPricesState) {
  let selected = createManagedWatchlistComparisonSelection();
  for (const [index, side] of (["left", "right"] as const).entries())
    selected = selectManagedWatchlistComparisonRow(
      selected,
      selected,
      prices,
      side,
      prices.rows[index]!,
    );
  return selected;
}
function replace(
  prices: ManagedWatchlistPricesState,
  index: number,
  replacement: ManagedWatchlistPriceRow,
) {
  return state(
    prices.rows.map((value, at) => (at === index ? replacement : value)),
  );
}
function historyChange(
  prices: ManagedWatchlistPricesState,
  index: number,
  history: Partial<ManagedWatchlistPriceRow["history"]>,
) {
  const prior = prices.rows[index]!;
  return replace(prices, index, {
    ...prior,
    history: { ...prior.history, ...history },
  });
}
function expectRefused(
  selected: ManagedWatchlistComparisonSelection,
  prices: ManagedWatchlistPricesState,
) {
  const result = evidence(selected, prices);
  expect(result.excerpt).toBeNull();
  expect(result.reason).toBeTypeOf("string");
  expect(result.reason?.length).toBeGreaterThan(0);
}

describe("watchlist comparison note evidence", () => {
  it("keeps both identities, exact shorter endpoints and each original source window", () => {
    const prices = state();
    const initial = pair(prices);
    const selected = changeManagedWatchlistComparisonInterval(
      initial,
      initial,
      prices,
      "endDate",
      dates[1],
    );
    const before = JSON.stringify({ prices, selected });
    expect(evidence(selected, prices)).toEqual({
      excerpt:
        "Observed raw-close watchlist comparison: 2026-09-17 to 2026-09-18; 2 shared observed dates in this interval, 3 across the loaded histories. " +
        "ALFA (Café Group; Café ALFA shares; Class A; XNAS, US): 2026-09-17 USD 100 to 2026-09-18 USD 110; raw close change +$10 (+10.0000%). " +
        "Source: Tiingo; requested window 2026-08-20 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. " +
        "BETA (Café Group; Café BETA shares; Class C; XNAS, US): 2026-09-17 USD 100 to 2026-09-18 USD 95; raw close change -$5 (-5.0000%). " +
        "Source: Tiingo; requested window 2026-08-21 to 2026-09-21; original request started 2026-09-21T00:00:00.000Z; completed 2026-09-21T00:00:01.000Z. " +
        "Raw closes are not adjusted for splits or dividends and are not live quotes. Missing dates are not filled. " +
        "Evidence dates are unchanged; this action does not refresh sources.",
      reason: null,
    });
    expect(JSON.stringify({ prices, selected })).toBe(before);
    expect(evidence(selected, prices).excerpt).not.toContain("USD 90");
    expect(evidence(selected, prices).excerpt).not.toMatch(/[\r\n]/u);
  });

  it.each([
    ["100", "110", "+$10 (+10.0000%)"],
    ["100", "90", "-$10 (-10.0000%)"],
    ["100", "100", "$0 (0.0000%)"],
    [
      "100",
      "100.000000000000000001",
      "+$0.000000000000000001 (less than 0.0001% higher)",
    ],
    [
      "100",
      "99.999999999999999999",
      "-$0.000000000000000001 (less than 0.0001% lower)",
    ],
    ["3", "4", "+$1 (+33.3333%)"],
  ])(
    "formats %s to %s using the existing exact change rules",
    (start, end, change) => {
      const prices = state([
        row("ALFA", [start, end], [dates[0], dates[2]]),
        row("BETA"),
      ]);
      const text = evidence(pair(prices), prices).excerpt!;
      expect(text).toContain(
        `2026-09-17 USD ${start} to 2026-09-19 USD ${end}; raw close change ${change}.`,
      );
      expect(text).toContain(
        "2 shared observed dates in this interval, 2 across the loaded histories",
      );
    },
  );

  it("preserves the entire admitted 64-character decimals and Unicode identity", () => {
    const first = `1.${"2".repeat(62)}`;
    const last = `1.${"3".repeat(62)}`;
    const prices = state([row("ALFA", [first, "99", last]), row("BETA")]);
    const text = evidence(pair(prices), prices).excerpt!;
    expect(text).toContain(`USD ${first} to 2026-09-19 USD ${last}`);
    expect(text).toContain(`+$0.${"1".repeat(62)}`);
    expect(text).toContain("Café Group; Café ALFA shares; Class A");
    expect(text).not.toContain("USD 99");
  });

  it.each([0, 1])(
    "rejects an equal-valued replacement of selected response %i",
    (index) => {
      const prices = state();
      const selected = pair(prices);
      const original = prices.rows[index]!.history.response!;
      const replacement = parseManagedEodHistoryResponse(original, {
        catalogSnapshotSha256: original.catalogSnapshotSha256,
        listingId: original.security.listingId,
        range: "1m",
      })!;
      expect(replacement).toEqual(original);
      expect(replacement).not.toBe(original);
      expectRefused(
        selected,
        historyChange(prices, index, { response: replacement }),
      );
    },
  );

  it.each([0, 1])(
    "rejects selected refresh %i, then qualifies its retained failure or Cancel",
    (index) => {
      const prices = state();
      const selected = pair(prices);
      const cancel = vi.fn();
      const refreshing = {
        ...historyChange(prices, index, {
          running: true,
          showingPrevious: true,
        }),
        pending: { listing: prices.rows[index]!.listing, cancel },
      };
      expectRefused(selected, refreshing);
      const retained = historyChange(prices, index, {
        showingPrevious: true,
        error: true,
        message: "The refresh failed. Previous history remains available.",
      });
      const text = evidence(selected, retained).excerpt!;
      const marker =
        "Retained previous history for this listing; newer prices were not confirmed.";
      expect(text.split(marker)).toHaveLength(2);
      const first = text.indexOf("ALFA (");
      const second = text.indexOf("BETA (");
      expect(text.indexOf(marker)).toBeGreaterThan(
        index === 0 ? first : second,
      );
      if (index === 0) expect(text.indexOf(marker)).toBeLessThan(second);
      expect(text).toContain(
        `completed ${prices.rows[index]!.history.response!.completedAt}`,
      );
      expect(
        evidence(
          selected,
          historyChange(retained, index, {
            error: false,
            message: "Refresh cancelled.",
          }),
        ).excerpt,
      ).toBe(text);
      expect(cancel).not.toHaveBeenCalled();
    },
  );

  it("leaves unrelated running histories, row order and read admission outside its evidence lifetime", () => {
    const prices = state();
    const selected = pair(prices);
    const other = row("OTHER");
    const cancel = vi.fn();
    const changed = {
      ...state([
        prices.rows[1]!,
        { ...other, history: { ...other.history, running: true } },
        prices.rows[0]!,
      ]),
      canRead: false,
      pending: { listing: other.listing, cancel },
    };
    expect(evidence(selected, changed)).toEqual(evidence(selected, prices));
    expect(cancel).not.toHaveBeenCalled();
  });

  it.each([
    "inactive",
    "catalog",
    "row catalog",
    "missing",
    "re-added",
    "digest",
    "unloaded",
    "foreign response",
  ])(
    "refuses %s source ownership without using the old evidence",
    (boundary) => {
      const prices = state();
      const selected = pair(prices);
      const first = prices.rows[0]!;
      const changed =
        boundary === "inactive"
          ? { ...prices, active: false }
          : boundary === "catalog"
            ? { ...prices, catalogChanged: true }
            : boundary === "missing"
              ? state([prices.rows[1]!])
              : boundary === "re-added"
                ? replace(prices, 0, { ...first, handle: Symbol("re-added") })
                : boundary === "row catalog"
                  ? historyChange(prices, 0, { catalogChanged: true })
                  : boundary === "digest"
                    ? historyChange(prices, 0, {
                        selection: {
                          ...first.history.selection!,
                          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
                        },
                      })
                    : boundary === "unloaded"
                      ? historyChange(prices, 0, { response: null })
                      : historyChange(prices, 0, {
                          response: prices.rows[1]!.history.response,
                        });
      expectRefused(selected, changed);
    },
  );

  it.each(Object.keys(eodSelection.listing) as (keyof ManagedEodIdentity)[])(
    "refuses a changed %s field even with the same handle and response",
    (field) => {
      const prices = state();
      const selected = pair(prices);
      const first = prices.rows[0]!;
      const listing = {
        ...first.listing,
        [field]: `${first.listing[field]}-changed`,
      };
      expectRefused(selected, replace(prices, 0, { ...first, listing }));
    },
  );

  it.each(["duplicate", "selection_unavailable"] as const)(
    "withholds a comparison after a %s refusal",
    (refusal) => {
      const prices = state();
      expectRefused({ ...pair(prices), refusal }, prices);
    },
  );

  it("refuses a duplicated pair even if a caller constructs it without a refusal flag", () => {
    const prices = state();
    const selected = pair(prices);
    expectRefused({ ...selected, right: selected.left }, prices);
  });

  it.each([
    "missing pair",
    "missing start",
    "missing end",
    "same dates",
    "reversed",
    "foreign date",
  ])("does not silently format another interval for %s", (boundary) => {
    const prices = state();
    const selected = pair(prices);
    const next =
      boundary === "missing pair"
        ? createManagedWatchlistComparisonSelection()
        : boundary === "missing start"
          ? { ...selected, startDate: "" }
          : boundary === "missing end"
            ? { ...selected, endDate: "" }
            : boundary === "same dates"
              ? { ...selected, endDate: selected.startDate }
              : boundary === "reversed"
                ? {
                    ...selected,
                    startDate: selected.endDate,
                    endDate: selected.startDate,
                  }
                : { ...selected, endDate: "2026-09-20" };
    expectRefused(next, prices);
  });

  it.each([0, 1])(
    "refuses only %i shared dates without filling a gap",
    (count) => {
      const prices = state([
        row("ALFA"),
        row(
          "BETA",
          ["10", "20"],
          count ? ["2026-09-16", dates[0]] : ["2026-09-15", "2026-09-16"],
        ),
      ]);
      expectRefused(pair(prices), prices);
    },
  );

  it("refuses a response whose full identity mismatches its admitted selection", () => {
    const prices = state();
    const first = prices.rows[0]!;
    const response: ManagedEodHistoryResponseDto = {
      ...first.history.response!,
      security: { ...first.listing, shareClassName: "Class C" },
    };
    const changed = historyChange(prices, 0, { response });
    expectRefused(pair(changed), changed);
  });
});
