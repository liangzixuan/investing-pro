import { describe, expect, it } from "vitest";
import {
  changeManagedWatchlistComparisonInterval,
  projectManagedWatchlistComparison,
} from "./managed-watchlist-comparison";
import { projectManagedWatchlistPricePath } from "./managed-watchlist-price-path";
import {
  pathDates,
  pathFixture,
  pathRow,
} from "./watchlist-price-path-fixture";

describe("watchlist raw-price paths", () => {
  it("exposes the crossing paths, exact closes and original identities without changing endpoint evidence", () => {
    const { projection } = pathFixture();
    const before = JSON.stringify(projection);
    const path = projectManagedWatchlistPricePath(projection)!;
    expect(path.dates).toEqual(pathDates);
    expect(path.values).toEqual([
      [100, 110, 90],
      [100, 95, 120],
    ]);
    expect(path.series[0]!.points[1]).toEqual({
      close: "110",
      index: "110.0000",
      value: 110,
    });
    expect(path.series[0]!.listing).toBe(projection.left!.listing);
    expect(path.responses[0]).toBe(projection.left!.history.response);
    expect(JSON.stringify(projection)).toBe(before);
  });

  it("uses only intersected observations without filling a missing middle date", () => {
    const { projection } = pathFixture([
      pathRow("ALFA"),
      pathRow("BETA", ["100", "120"], [pathDates[0], pathDates[2]]),
    ]);
    const path = projectManagedWatchlistPricePath(projection)!;
    expect(path.dates).toEqual([pathDates[0], pathDates[2]]);
    expect(path.values).toEqual([
      [100, 90],
      [100, 120],
    ]);
  });

  it("rebases at the selected Start instead of the first loaded date", () => {
    const { prices, selection } = pathFixture();
    const selected = changeManagedWatchlistComparisonInterval(
      selection,
      selection,
      prices,
      "startDate",
      pathDates[1],
    );
    const projection = projectManagedWatchlistComparison(selected, prices);
    const path = projectManagedWatchlistPricePath(projection)!;
    expect(path.dates).toEqual([pathDates[1], pathDates[2]]);
    expect(path.values).toEqual([
      [100, 81.8182],
      [100, 126.3158],
    ]);
    expect(path.series[0]!.points[0]!.close).toBe("110");
    expect(projection.comparison).toMatchObject({
      firstDate: pathDates[1],
      lastDate: pathDates[2],
    });
  });

  it("uses the comparison reset on replacement while preserving retained-source intervals", () => {
    const { prices, selection } = pathFixture();
    const shortened = changeManagedWatchlistComparisonInterval(
      selection,
      selection,
      prices,
      "startDate",
      pathDates[1],
    );
    const retained = {
      ...prices,
      rows: prices.rows.map((row) => ({
        ...row,
        history: { ...row.history, showingPrevious: true },
      })),
    };
    const old = projectManagedWatchlistPricePath(
      projectManagedWatchlistComparison(shortened, retained),
    )!;
    expect(old.dates[0]).toBe(pathDates[1]);
    const replacement = {
      ...prices,
      rows: prices.rows.map((row) => ({
        ...row,
        history: {
          ...row.history,
          response: {
            ...row.history.response!,
            rows: [...row.history.response!.rows],
          },
        },
      })),
    };
    const next = projectManagedWatchlistPricePath(
      projectManagedWatchlistComparison(shortened, replacement),
    )!;
    expect(next.dates).toEqual(pathDates);
    expect(next.responses[0]).not.toBe(old.responses[0]);
    expect(next.contentKey).not.toBe(old.contentKey);
  });

  it("withholds removed/re-added rows, retired catalogs, inactive state and blank dates", () => {
    const { prices, selection } = pathFixture();
    for (const state of [
      { ...prices, active: false },
      { ...prices, catalogChanged: true },
      { ...prices, rows: [pathRow("ALFA"), prices.rows[1]!] },
    ]) {
      expect(
        projectManagedWatchlistPricePath(
          projectManagedWatchlistComparison(selection, state),
        ),
      ).toBeNull();
    }
    const blank = changeManagedWatchlistComparisonInterval(
      selection,
      selection,
      prices,
      "endDate",
      "",
    );
    expect(
      projectManagedWatchlistPricePath(
        projectManagedWatchlistComparison(blank, prices),
      ),
    ).toBeNull();
  });

  it("retains exact long and underflow data while refusing the entire unsafe plot", () => {
    const { projection } = pathFixture([
      pathRow("ALFA", ["100", "0.00000001", "9".repeat(64)]),
      pathRow("BETA"),
    ]);
    const path = projectManagedWatchlistPricePath(projection)!;
    expect(path.plottable).toBe(false);
    expect(path.values[0]).toEqual([100, null, null]);
    expect(path.series[0]!.points[1]!.index).toBe("0.0000");
    expect(path.series[0]!.points[2]!.close).toBe("9".repeat(64));
  });

  it("binds equal coordinates to full identity, source timing and retained status", () => {
    const { prices, selection, projection } = pathFixture();
    const old = projectManagedWatchlistPricePath(projection)!;
    const changed = {
      ...prices,
      rows: prices.rows.map((row) => ({
        ...row,
        history: { ...row.history, showingPrevious: true },
      })),
    };
    const retained = projectManagedWatchlistPricePath(
      projectManagedWatchlistComparison(selection, changed),
    )!;
    expect(retained.values).toEqual(old.values);
    expect(retained.contentKey).not.toBe(old.contentKey);
    expect(retained.responses[0]).toBe(old.responses[0]);
    expect(retained.handles).toEqual(old.handles);
  });
});
