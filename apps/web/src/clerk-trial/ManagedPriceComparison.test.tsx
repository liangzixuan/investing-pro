import {
  parseManagedEodHistoryResponse,
  type ManagedEodCloseDto,
} from "@research-cockpit/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagedPriceComparison } from "./ManagedPriceComparison";
import {
  deriveManagedPriceComparison,
  type ManagedPriceComparisonState,
} from "./managed-price-comparison";
import {
  MANAGED_MARKETS_COHORT,
  type ManagedMarketsRow,
} from "./managed-markets";
import { eodResponse } from "./eod-history-fixture";

const close = (date: string, value: string): ManagedEodCloseDto => ({
  date,
  close: value,
});
const histories = [
  [
    close("2026-09-10", "100"),
    close("2026-09-11", "10"),
    close("2026-09-14", "12"),
    close("2026-09-15", "1000"),
    close("2026-09-18", "20"),
    close("2026-09-19", "0.5"),
  ],
  [
    close("2026-09-09", "10"),
    close("2026-09-11", "20"),
    close("2026-09-14", "20"),
    close("2026-09-18", "10"),
    close("2026-09-20", "100"),
  ],
  [
    close("2026-09-11", "30.5"),
    close("2026-09-13", "55"),
    close("2026-09-14", "30"),
    close("2026-09-18", "30.5"),
  ],
];

// Real public listing identities; all prices and request records are invented.
function loadedRow(
  index: number,
  prices = histories[index]!,
): ManagedMarketsRow {
  const listing = MANAGED_MARKETS_COHORT[index]!;
  const initial = eodResponse();
  const response = parseManagedEodHistoryResponse(
    { ...initial, security: listing, rows: prices },
    {
      catalogSnapshotSha256: initial.catalogSnapshotSha256,
      listingId: listing.listingId,
      range: "1m",
    },
  );
  if (!response) throw new Error("Invalid comparison test history.");
  return Object.freeze({
    listing,
    response,
    showingPrevious: false,
    running: false,
    error: false,
    message: "Loaded invented history.",
  });
}
const state = (
  rows: readonly ManagedMarketsRow[] = [0, 1, 2].map((index) =>
    loadedRow(index),
  ),
): ManagedPriceComparisonState => ({
  active: true,
  catalogChanged: false,
  rows,
});
const text = (html: string) =>
  html
    .replace(/<[^>]*>/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

describe("managed complete-board raw price comparison", () => {
  it("uses the earliest and latest shared observations across shifted dates and gaps", () => {
    const input = state();
    const before = JSON.stringify(input);
    const result = deriveManagedPriceComparison(input);
    expect(result).toMatchObject({
      status: "available",
      firstDate: "2026-09-11",
      lastDate: "2026-09-18",
      sharedDateCount: 3,
    });
    if (result?.status !== "available") throw new Error("Expected comparison");
    expect(
      result.rows.map((row) => [
        row.listing.symbol,
        row.firstClose,
        row.lastClose,
        row.change.changePercent,
        row.change.direction,
      ]),
    ).toEqual([
      ["AAPL", "10", "20", "100.0000", "up"],
      ["GOOG", "20", "10", "-50.0000", "down"],
      ["GOOGL", "30.5", "30.5", "0.0000", "unchanged"],
    ]);
    expect(result.rows[1]!.listing.issuerId).toBe(
      result.rows[2]!.listing.issuerId,
    );
    expect(result.rows[1]!.listing.shareClassId).not.toBe(
      result.rows[2]!.listing.shareClassId,
    );
    expect(result.rows[1]!.listing.listingId).not.toBe(
      result.rows[2]!.listing.listingId,
    );
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([0, 1, 2])(
    "does not compare a subset when history %s is missing or cleared",
    (index) => {
      const rows = [0, 1, 2].map((item) => loadedRow(item));
      rows[index] = { ...rows[index]!, response: null };
      expect(deriveManagedPriceComparison(state(rows))).toEqual({
        status: "unavailable",
      });
      const html = renderToStaticMarkup(
        <ManagedPriceComparison state={state(rows)} />,
      );
      expect(text(html)).toContain(
        "Comparison unavailable. Load price histories for all three board listings.",
      );
      expect(html).not.toContain("<table");
      expect(html).not.toContain("100.0000%");
    },
  );

  it.each([0, 2, 4])(
    "requires exactly three current board rows, given %s",
    (count) => {
      const rows = Array.from({ length: count }, (_, index) =>
        loadedRow(index % 3),
      );
      expect(deriveManagedPriceComparison(state(rows))).toEqual({
        status: "unavailable",
      });
    },
  );

  it.each([0, 1])(
    "explains %s shared dates without producing numeric change results",
    (count) => {
      const rows = [0, 1, 2].map((index) =>
        loadedRow(index, [
          close(count ? "2026-09-18" : `2026-09-${16 + index}`, "10"),
        ]),
      );
      expect(deriveManagedPriceComparison(state(rows))).toMatchObject({
        status: "insufficient_history",
        sharedDateCount: count,
        firstDate: count ? "2026-09-18" : null,
      });
      const html = renderToStaticMarkup(
        <ManagedPriceComparison state={state(rows)} />,
      );
      expect(text(html)).toContain(
        count === 1
          ? "1 shared observed date is loaded."
          : "0 shared observed dates are loaded.",
      );
      expect(html).toContain("Comparison coverage and request dates</summary>");
      expect(html).not.toContain("<table");
      expect(html).not.toContain("0.0000%");
    },
  );

  it.each([
    [
      "9007199254740993.123456789012345678",
      "9007199254740994.123456789012345679",
      "up",
      "higher",
    ],
    ["100", "99.99999", "down", "lower"],
  ])(
    "preserves precise endpoints and tiny %s to %s changes",
    (first, last, direction, label) => {
      const rows = [0, 1, 2].map((index) =>
        loadedRow(index, [
          close("2026-09-11", first),
          close("2026-09-18", last),
        ]),
      );
      const result = deriveManagedPriceComparison(state(rows));
      if (result?.status !== "available")
        throw new Error("Expected comparison");
      expect(result.rows[0]).toMatchObject({
        firstClose: first,
        lastClose: last,
        change: { direction, changePercent: "0.0000" },
      });
      const html = renderToStaticMarkup(
        <ManagedPriceComparison state={state(rows)} />,
      );
      expect(html).toContain(`<td>${first}</td>`);
      expect(html).toContain(`<td>${last}</td>`);
      expect(html).toContain(`Less than 0.0001% ${label}`);
      expect(html).not.toContain("-0.0000%");
    },
  );

  it("uses original per-row request provenance through a mixed-vintage retained refresh", () => {
    const rows = [0, 1, 2].map((index) => loadedRow(index));
    rows[0] = { ...rows[0]!, showingPrevious: true, running: true };
    const newer = parseManagedEodHistoryResponse(
      {
        ...rows[2]!.response!,
        window: { startDate: "2026-08-21", endDate: "2026-09-21" },
        requestStartedAt: "2026-09-21T00:00:00.000Z",
        completedAt: "2026-09-21T00:00:01.000Z",
      },
      {
        catalogSnapshotSha256: rows[2]!.response!.catalogSnapshotSha256,
        listingId: rows[2]!.listing.listingId,
        range: "1m",
      },
    );
    expect(newer).not.toBeNull();
    rows[2] = { ...rows[2]!, response: newer };
    const html = renderToStaticMarkup(
      <ManagedPriceComparison state={state(rows)} />,
    );
    expect(text(html)).toContain("Previous history retained for AAPL.");
    expect(html).toContain("Previous history retained</span>");
    expect(text(html)).toContain("2026-08-20 to 2026-09-20");
    expect(text(html)).toContain("2026-08-21 to 2026-09-21");
    expect(html).toContain("2026-09-20T00:00:01.000Z");
    expect(html).toContain("2026-09-21T00:00:01.000Z");
    expect(html).toContain("Class C Capital Stock");
    expect(html).toContain("Class A Common Stock");
    expect(html).toContain(
      'role="region" aria-label="Raw price comparison results"',
    );
    expect(html).toMatch(/aria-describedby="[^"]+-scroll" tabindex="0"/u);
    expect(html.match(/scope="col"/gu)).toHaveLength(4);
    expect(html.match(/scope="row"/gu)).toHaveLength(3);
    expect(text(html)).toContain("6 / 3");
    expect(text(html)).toContain("not a full-month return");
  });

  it("keeps the maximum-length accepted endpoints as exact decimal text", () => {
    const first = "1".repeat(64);
    const last = "9".repeat(64);
    const rows = [0, 1, 2].map((index) =>
      loadedRow(index, [close("2026-09-11", first), close("2026-09-18", last)]),
    );
    const html = renderToStaticMarkup(
      <ManagedPriceComparison state={state(rows)} />,
    );
    expect(html).toContain(`<td>${first}</td>`);
    expect(html).toContain(`<td>${last}</td>`);
    expect(html).toContain("+800.0000%");
    expect(html).not.toMatch(/\d[eE]\+/u);
  });

  it("keeps the results region and coverage disclosure across unavailable output", () => {
    const complete = state();
    const missing = state([
      { ...complete.rows[0]!, response: null },
      ...complete.rows.slice(1),
    ]);
    const insufficient = state(
      [0, 1, 2].map((index) => loadedRow(index, [close("2026-09-18", "10")])),
    );
    for (const input of [complete, missing, insufficient]) {
      const html = renderToStaticMarkup(
        <ManagedPriceComparison state={input} />,
      );
      expect(
        html.match(/aria-label="Raw price comparison results"/gu),
      ).toHaveLength(1);
      expect(html).toContain(
        input === complete ? 'tabindex="0"' : 'tabindex="-1"',
      );
      expect(
        html.match(/<details class="managed-price-comparison-source">/gu),
      ).toHaveLength(1);
      expect(
        html.match(
          /<summary>Comparison coverage and request dates<\/summary>/gu,
        ),
      ).toHaveLength(1);
      if (input !== complete) {
        expect(html).toMatch(
          /<div class="managed-price-comparison-scroll"[^>]*><p role="status">/u,
        );
        expect(html).not.toContain("aria-describedby=");
        expect(html).not.toContain("<table");
      }
      if (input === missing) {
        expect(html).toMatch(
          /<details class="managed-price-comparison-source"><summary>Comparison coverage and request dates<\/summary><p>Load histories for all three listings to inspect their coverage and request dates\.<\/p><\/details>/u,
        );
        expect(html).not.toContain("managed-price-comparison-provenance");
        expect(html).not.toContain("2026-09-20T00:00:01.000Z");
        expect(html).not.toContain("100.0000%");
      } else {
        expect(html).toContain("managed-price-comparison-provenance");
        expect(html).toContain("2026-09-20T00:00:01.000Z");
      }
    }
  });

  it("immediately derives replacements and clearing without retaining old results", () => {
    const input = state();
    const initial = deriveManagedPriceComparison(input);
    const replacement = loadedRow(0, [
      close("2026-09-14", "10"),
      close("2026-09-18", "10.5"),
    ]);
    const rows = [replacement, ...input.rows.slice(1)];
    expect(deriveManagedPriceComparison(state(rows))).toMatchObject({
      status: "available",
      firstDate: "2026-09-14",
      sharedDateCount: 2,
      rows: [
        {
          firstClose: "10",
          lastClose: "10.5",
          change: { changePercent: "5.0000" },
        },
        {},
        {},
      ],
    });
    expect(initial).toMatchObject({
      firstDate: "2026-09-11",
      sharedDateCount: 3,
    });
    expect(
      deriveManagedPriceComparison(
        state([{ ...replacement, response: null }, ...rows.slice(1)]),
      ),
    ).toEqual({ status: "unavailable" });
  });

  it.each([
    { active: false, catalogChanged: false },
    { active: true, catalogChanged: true },
  ])(
    "hides the comparison on visit or catalog retirement: %j",
    (retirement) => {
      const input = { ...state(), ...retirement };
      expect(deriveManagedPriceComparison(input)).toBeNull();
      expect(
        renderToStaticMarkup(<ManagedPriceComparison state={input} />),
      ).toBe("");
    },
  );
});
