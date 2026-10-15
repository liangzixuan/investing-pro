import { describe, expect, it, vi } from "vitest";
import {
  parseManagedEodHistoryResponse,
  type ManagedEodIdentity,
  type MainWatchlistPayload,
} from "@research-cockpit/contracts";
import {
  changeManagedWatchlistComparisonInterval,
  createManagedWatchlistComparisonSelection,
  projectManagedWatchlistComparison,
  reconcileManagedWatchlistComparison,
  selectManagedWatchlistComparisonRow,
  type ManagedWatchlistComparisonSelection,
} from "./managed-watchlist-comparison";
import {
  ManagedWatchlistPrices,
  type ManagedWatchlistPriceRow,
  type ManagedWatchlistPricesState,
} from "./managed-watchlist-prices";
import { ManagedEodAccess } from "./managed-eod-access";
import type { ManagedApi } from "./managed-api";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { TrialApiError } from "./api";

const dates = ["2026-09-17", "2026-09-18", "2026-09-19"] as const;
const identity = (symbol: string): ManagedEodIdentity => ({
  ...eodSelection.listing,
  issuerId: `issuer-${symbol.toLowerCase()}`,
  issuerName: `${symbol} Company`,
  securityId: `security-${symbol.toLowerCase()}`,
  securityName: `${symbol} Class A`,
  shareClassId: `class-${symbol.toLowerCase()}`,
  listingId: `listing-${symbol.toLowerCase()}`,
  symbol,
});
function response(
  listing: ManagedEodIdentity,
  closes: readonly string[] = ["100", "110", "90"],
  observed: readonly string[] = dates,
) {
  const base = eodResponse();
  const parsed = parseManagedEodHistoryResponse(
    {
      ...base,
      security: listing,
      rows: observed.map((date, index) => ({ date, close: closes[index]! })),
    },
    {
      catalogSnapshotSha256: base.catalogSnapshotSha256,
      listingId: listing.listingId,
      range: "1m",
    },
  );
  if (!parsed) throw new Error("Invalid invented pair history");
  return parsed;
}
function row(
  symbol: string,
  closes: readonly string[] | null = ["100", "110", "90"],
): ManagedWatchlistPriceRow {
  const listing = identity(symbol);
  return Object.freeze({
    handle: Symbol(symbol),
    listing: Object.freeze(listing),
    history: Object.freeze({
      selection: Object.freeze({
        ...eodSelection,
        listing,
        origin: "watchlist" as const,
      }),
      available: true,
      selectedRange: "1m",
      response: closes ? response(listing, closes) : null,
      responseOrigin: closes ? ("watchlist" as const) : null,
      showingPrevious: false,
      running: false,
      catalogChanged: false,
      message: "",
      error: false,
    }),
  });
}
const state = (
  rows: readonly ManagedWatchlistPriceRow[] = [
    row("ALFA"),
    row("BETA", ["100", "95", "120"]),
    row("OTHER", null),
  ],
): ManagedWatchlistPricesState =>
  Object.freeze({
    active: true,
    canRead: true,
    rows: Object.freeze(rows),
    pending: null,
    catalogChanged: false,
  });
function pair(prices: ManagedWatchlistPricesState) {
  let selected = createManagedWatchlistComparisonSelection();
  selected = selectManagedWatchlistComparisonRow(
    selected,
    selected,
    prices,
    "left",
    prices.rows[0]!,
  );
  return selectManagedWatchlistComparisonRow(
    selected,
    selected,
    prices,
    "right",
    prices.rows[1]!,
  );
}
const dateChange = (
  selected: ManagedWatchlistComparisonSelection,
  prices: ManagedWatchlistPricesState,
  field: "startDate" | "endDate",
  date: string,
) =>
  changeManagedWatchlistComparisonInterval(
    selected,
    selected,
    prices,
    field,
    date,
  );
function firstInterval(prices: ManagedWatchlistPricesState) {
  return dateChange(pair(prices), prices, "endDate", dates[1]);
}
const replaceRow = (
  prices: ManagedWatchlistPricesState,
  index: number,
  next: ManagedWatchlistPriceRow,
) => state(prices.rows.map((existing, at) => (at === index ? next : existing)));
function replaceResponse(
  prices: ManagedWatchlistPricesState,
  index: number,
  value: ReturnType<typeof response> | null,
) {
  const previous = prices.rows[index]!;
  return replaceRow(prices, index, {
    ...previous,
    history: { ...previous.history, response: value },
  });
}

describe("chosen watchlist pair projection", () => {
  it("starts with no selected pair and does not infer a pair from available histories", () => {
    const prices = state();
    const empty = createManagedWatchlistComparisonSelection();
    expect(projectManagedWatchlistComparison(empty, prices)).toMatchObject({
      selection: empty,
      left: null,
      right: null,
      reason: "both_required",
      comparison: { status: "unavailable" },
    });
    const left = selectManagedWatchlistComparisonRow(
      empty,
      empty,
      prices,
      "left",
      prices.rows[0]!,
    );
    expect(projectManagedWatchlistComparison(left, prices).reason).toBe(
      "right_required",
    );
    const right = selectManagedWatchlistComparisonRow(
      empty,
      empty,
      prices,
      "right",
      prices.rows[1]!,
    );
    expect(projectManagedWatchlistComparison(right, prices).reason).toBe(
      "left_required",
    );
  });

  it("compares two histories while the unrelated third stays unloaded, preserving exact sources", () => {
    const prices = state();
    const before = JSON.stringify(prices);
    const selected = pair(prices);
    const projected = projectManagedWatchlistComparison(selected, prices);
    expect(projected.reason).toBeNull();
    expect(projected.left).toBe(prices.rows[0]);
    expect(projected.right).toBe(prices.rows[1]);
    expect(projected.comparison).toMatchObject({
      status: "available",
      firstDate: dates[0],
      lastDate: dates[2],
      sharedDateCount: 3,
      intervalDateCount: 3,
      rows: [
        {
          firstClose: "100",
          lastClose: "90",
          change: { changePercent: "-10.0000" },
        },
        {
          firstClose: "100",
          lastClose: "120",
          change: { changePercent: "20.0000" },
        },
      ],
    });
    if (projected.comparison?.status !== "available")
      throw new Error("Expected pair");
    projected.comparison.rows.forEach((item, index) => {
      expect(item.response).toBe(prices.rows[index]!.history.response);
      expect(item.listing).toBe(prices.rows[index]!.listing);
      expect(item.response.window).toEqual({
        startDate: "2026-08-20",
        endDate: "2026-09-20",
      });
    });
    const changed = firstInterval(prices);
    expect(
      projectManagedWatchlistComparison(changed, prices).comparison,
    ).toMatchObject({
      intervalDateCount: 2,
      rows: [
        { change: { changePercent: "10.0000" } },
        { change: { changePercent: "-5.0000" } },
      ],
    });
    expect(JSON.stringify(prices)).toBe(before);
  });

  it("allows covered unloaded rows while keeping their missing history explicit", () => {
    const prices = state([row("ALFA"), row("BETA", null)]);
    const selected = pair(prices);
    expect(selected.right?.handle).toBe(prices.rows[1]!.handle);
    expect(projectManagedWatchlistComparison(selected, prices)).toMatchObject({
      reason: "history_unavailable",
      comparison: { status: "unavailable" },
    });
    const loaded = replaceResponse(
      prices,
      1,
      response(prices.rows[1]!.listing),
    );
    const next = reconcileManagedWatchlistComparison(selected, loaded);
    expect(next).toMatchObject({
      startDate: dates[0],
      endDate: dates[2],
      resetNotice: false,
    });
  });

  it("refuses duplicate or unknown candidates without changing the accepted pair or interval", () => {
    const prices = state();
    const selected = firstInterval(prices);
    const duplicate = selectManagedWatchlistComparisonRow(
      selected,
      selected,
      prices,
      "left",
      prices.rows[1]!,
    );
    expect(duplicate).toMatchObject({
      left: selected.left,
      right: selected.right,
      startDate: selected.startDate,
      endDate: selected.endDate,
      refusal: "duplicate",
    });
    expect(projectManagedWatchlistComparison(duplicate, prices).reason).toBe(
      "duplicate",
    );
    const unknown = selectManagedWatchlistComparisonRow(
      selected,
      selected,
      prices,
      "left",
      row("ALFA"),
    );
    expect(unknown.refusal).toBe("selection_unavailable");
    expect(unknown.left).toBe(selected.left);
    const confirmed = selectManagedWatchlistComparisonRow(
      duplicate,
      duplicate,
      prices,
      "left",
      prices.rows[0]!,
    );
    expect(confirmed).toMatchObject({
      refusal: null,
      startDate: selected.startDate,
      endDate: selected.endDate,
    });
  });

  it("keeps same-issuer share classes distinct by complete listing identity", () => {
    const first = row("ALFA");
    const listing = {
      ...first.listing,
      symbol: "ALFC",
      listingId: "listing-class-c",
      securityId: "security-class-c",
      securityName: "ALFA Class C",
      shareClassId: "class-c",
      shareClassName: "Class C",
    };
    const second = {
      ...first,
      handle: Symbol("class-c"),
      listing,
      history: {
        ...first.history,
        selection: { ...first.history.selection!, listing },
        response: response(listing, ["20", "22", "24"]),
      },
    };
    const prices = state([first, second]);
    expect(
      projectManagedWatchlistComparison(pair(prices), prices).comparison,
    ).toMatchObject({
      status: "available",
      rows: [
        { listing: { shareClassName: "Class A" } },
        { listing: { shareClassName: "Class C" } },
      ],
    });
  });

  it("clears duplicate feedback on an admitted interval change but keeps it for refused dates", () => {
    const prices = state();
    const selected = pair(prices);
    const duplicate = selectManagedWatchlistComparisonRow(
      selected,
      selected,
      prices,
      "right",
      prices.rows[0]!,
    );
    expect(duplicate.refusal).toBe("duplicate");
    expect(dateChange(duplicate, prices, "endDate", "2026-09-16")).toBe(
      duplicate,
    );
    const changed = dateChange(duplicate, prices, "endDate", dates[1]);
    expect(changed.refusal).toBeNull();
    expect(changed.left).toBe(duplicate.left);
    expect(changed.right).toBe(duplicate.right);
    expect(projectManagedWatchlistComparison(changed, prices)).toMatchObject({
      reason: null,
      comparison: { status: "available", lastDate: dates[1] },
    });
  });

  it.each([0, 1])("reports %i shared dates without interpolation", (count) => {
    const prices = state();
    const secondDates =
      count === 0 ? ["2026-09-15", "2026-09-16"] : ["2026-09-16", dates[1]];
    const updated = replaceResponse(
      prices,
      1,
      response(prices.rows[1]!.listing, ["1", "2"], secondDates),
    );
    const projected = projectManagedWatchlistComparison(pair(updated), updated);
    expect(projected.comparison).toMatchObject({
      status: "insufficient_history",
      sharedDateCount: count,
      firstDate: count ? dates[1] : null,
    });
    expect(projected.selection.startDate).toBe("");
    expect(projected.selection.endDate).toBe("");
  });

  it("uses only shared observations, preserving omitted history and tiny exact endpoints", () => {
    const prices = state();
    const longFirst = `1.${"2".repeat(62)}`;
    const longLast = `1.${"3".repeat(62)}`;
    let updated = replaceResponse(
      prices,
      0,
      response(prices.rows[0]!.listing, [longFirst, "99", longLast]),
    );
    updated = replaceResponse(
      updated,
      1,
      response(
        prices.rows[1]!.listing,
        ["100", "100.000000000000000001"],
        [dates[0], dates[2]],
      ),
    );
    const projected = projectManagedWatchlistComparison(pair(updated), updated);
    expect(projected.history).toMatchObject({
      sharedDates: [dates[0], dates[2]],
    });
    expect(projected.comparison).toMatchObject({
      status: "available",
      sharedDateCount: 2,
      intervalDateCount: 2,
      rows: [
        { firstClose: longFirst, lastClose: longLast },
        {
          firstClose: "100",
          lastClose: "100.000000000000000001",
          change: { direction: "up", changePercent: "0.0000" },
        },
      ],
    });
    expect(projected.left?.history.response?.rows).toHaveLength(3);
    expect(projected.right?.history.response?.rows).toHaveLength(2);
  });
});

describe("pair selection and response lifetimes", () => {
  it("resets on a pair change and clears an explicit side without changing source data", () => {
    const prices = state([row("ALFA"), row("BETA"), row("OTHER")]);
    const selected = firstInterval(prices);
    expect(
      selectManagedWatchlistComparisonRow(
        selected,
        selected,
        prices,
        "left",
        prices.rows[0]!,
      ),
    ).toBe(selected);
    const changed = selectManagedWatchlistComparisonRow(
      selected,
      selected,
      prices,
      "right",
      prices.rows[2]!,
    );
    expect(changed).toMatchObject({
      startDate: dates[0],
      endDate: dates[2],
      resetNotice: true,
    });
    const cleared = selectManagedWatchlistComparisonRow(
      changed,
      changed,
      prices,
      "left",
      null,
    );
    expect(cleared.left).toBeNull();
    expect(cleared.right).toBe(changed.right);
    expect(cleared.startDate).toBe("");
    expect(projectManagedWatchlistComparison(cleared, prices).reason).toBe(
      "left_required",
    );
  });

  it("preserves intervals through reordering, copied identities, flags and unrelated response replacement", () => {
    const prices = state();
    const selected = firstInterval(prices);
    const other = row("OTHER");
    const next = {
      ...state([
        other,
        { ...prices.rows[1]!, listing: { ...prices.rows[1]!.listing } },
        prices.rows[0]!,
      ]),
      canRead: false,
    };
    expect(reconcileManagedWatchlistComparison(selected, next)).toBe(selected);
    const retained = replaceRow(next, 2, {
      ...prices.rows[0]!,
      history: {
        ...prices.rows[0]!.history,
        showingPrevious: true,
        running: true,
        error: true,
        message: "Original response retained.",
      },
    });
    expect(reconcileManagedWatchlistComparison(selected, retained)).toBe(
      selected,
    );
    expect(
      projectManagedWatchlistComparison(selected, retained).comparison,
    ).toMatchObject({
      firstDate: dates[0],
      lastDate: dates[1],
      rows: [{ showingPrevious: true }, { showingPrevious: false }],
    });
  });

  it.each([0, 1])(
    "resets when selected response %i is replaced even by equal values",
    (index) => {
      const prices = state();
      const selected = firstInterval(prices);
      const original = prices.rows[index]!.history.response!;
      const equal = response(
        prices.rows[index]!.listing,
        original.rows.map((item) => item.close),
      );
      expect(equal).toEqual(original);
      expect(equal).not.toBe(original);
      const next = replaceResponse(prices, index, equal);
      const reconciled = reconcileManagedWatchlistComparison(selected, next);
      expect(reconciled).not.toBe(selected);
      expect(reconciled).toMatchObject({
        startDate: dates[0],
        endDate: dates[2],
        resetNotice: true,
      });
      expect(reconcileManagedWatchlistComparison(reconciled, next)).toBe(
        reconciled,
      );
      expect(
        changeManagedWatchlistComparisonInterval(
          selected,
          selected,
          next,
          "endDate",
          dates[1],
        ),
      ).toBe(selected);
    },
  );

  it("clears stale numeric output when a selected response is refused while retaining its current choice", () => {
    const prices = state();
    const selected = firstInterval(prices);
    const next = replaceResponse(prices, 0, null);
    const projection = projectManagedWatchlistComparison(selected, next);
    expect(projection.selection.left?.handle).toBe(selected.left?.handle);
    expect(projection.selection.left?.response).toBeNull();
    expect(projection.comparison).toEqual({ status: "unavailable" });
    expect(projection.reason).toBe("history_unavailable");
  });

  it.each(Object.keys(eodSelection.listing) as (keyof ManagedEodIdentity)[])(
    "retires a captured pair side if %s changes under a reused handle",
    (field) => {
      const prices = state();
      const selected = pair(prices);
      const original = prices.rows[0]!;
      const changed = {
        ...original,
        listing: { ...original.listing, [field]: "other" },
      };
      const next = replaceRow(prices, 0, changed);
      expect(
        reconcileManagedWatchlistComparison(selected, next).left,
      ).toBeNull();
      const empty = createManagedWatchlistComparisonSelection();
      expect(
        selectManagedWatchlistComparisonRow(
          empty,
          empty,
          next,
          "left",
          original,
        ),
      ).toMatchObject({ left: null, refusal: "selection_unavailable" });
    },
  );

  it("clears removed/re-added, replaced-catalog and retired identities without following the same listing ID", () => {
    const prices = state();
    const selected = firstInterval(prices);
    const readded = replaceRow(prices, 0, row("ALFA"));
    expect(
      reconcileManagedWatchlistComparison(selected, readded).left,
    ).toBeNull();
    const original = prices.rows[0]!;
    const catalog = replaceRow(prices, 0, {
      ...original,
      history: {
        ...original.history,
        selection: {
          ...original.history.selection!,
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        },
      },
    });
    expect(
      reconcileManagedWatchlistComparison(selected, catalog).left,
    ).toBeNull();
    for (const next of [
      { ...prices, active: false },
      { ...prices, catalogChanged: true },
      state([]),
    ]) {
      const projected = projectManagedWatchlistComparison(selected, next);
      expect(projected.selection.left).toBeNull();
      expect(projected.selection.right).toBeNull();
      expect(projected.comparison?.status).not.toBe("available");
    }
  });

  it("refuses stale event captures, including a candidate refreshed while it was outside the pair", () => {
    const prices = state([row("ALFA"), row("BETA"), row("OTHER")]);
    const captured = pair(prices);
    const current = dateChange(captured, prices, "endDate", dates[1]);
    expect(
      changeManagedWatchlistComparisonInterval(
        current,
        captured,
        prices,
        "startDate",
        dates[1],
      ),
    ).toBe(current);
    expect(
      selectManagedWatchlistComparisonRow(
        current,
        captured,
        prices,
        "right",
        prices.rows[2]!,
      ),
    ).toBe(current);
    const next = replaceResponse(prices, 2, response(prices.rows[2]!.listing));
    const refused = selectManagedWatchlistComparisonRow(
      current,
      current,
      next,
      "right",
      prices.rows[2]!,
    );
    expect(refused.refusal).toBe("selection_unavailable");
    expect(refused.right).toBe(current.right);
    const retired = { ...prices, active: false };
    expect(
      selectManagedWatchlistComparisonRow(
        current,
        current,
        retired,
        "right",
        null,
      ),
    ).toBe(current);
  });

  it("uses only valid observed endpoints and clears an End invalidated by a later Start", () => {
    const prices = state();
    const full = pair(prices);
    expect(dateChange(full, prices, "startDate", dates[2])).toBe(full);
    expect(dateChange(full, prices, "endDate", "2026-09-16")).toBe(full);
    const shortened = dateChange(full, prices, "endDate", dates[1]);
    const later = dateChange(shortened, prices, "startDate", dates[1]);
    expect(later).toMatchObject({
      startDate: dates[1],
      endDate: "",
      resetNotice: false,
    });
    expect(
      projectManagedWatchlistComparison(later, prices).comparison,
    ).toMatchObject({ status: "interval_required", reason: "end_required" });
  });

  it("refuses response identity/catalog mismatches while preserving each current row", () => {
    const prices = state();
    const foreign = replaceResponse(prices, 0, response(identity("FOREIGN")));
    expect(
      projectManagedWatchlistComparison(pair(foreign), foreign).comparison,
    ).toEqual({ status: "unavailable" });
    const changed = {
      ...prices.rows[0]!.history.response!,
      catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const,
    };
    const catalog = replaceResponse(prices, 0, changed);
    expect(
      projectManagedWatchlistComparison(pair(catalog), catalog).comparison,
    ).toEqual({ status: "unavailable" });
  });
});

describe("comparison over real watchlist row ownership", () => {
  it("adds no reads while draft changes, recovery gates, refresh failure, Cancel and retirement retain or retire exact sources", async () => {
    const alfa = identity("ALFA"),
      beta = identity("BETA");
    const read = vi.fn<ManagedApi["eodHistory"]>();
    read.mockImplementation((request) =>
      Promise.resolve(
        response(request.listingId === alfa.listingId ? alfa : beta),
      ),
    );
    const owner = new ManagedWatchlistPrices(
      read,
      vi.fn(),
      new ManagedEodAccess(read),
      [alfa, beta],
    );
    const draft: MainWatchlistPayload = {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: eodSelection.catalogSnapshotSha256,
      memberships: [
        { ...alfa, note: "  Original café 東京 note  " },
        { ...beta, note: "Other note" },
      ],
    };
    owner.enter(draft, eodSelection.catalogSnapshotSha256, true);
    for (const item of owner.getSnapshot().rows) await owner.load(item.handle);
    const loaded = owner.getSnapshot();
    let selected = firstInterval(loaded);
    const source = selected.left?.response;
    const edited = {
      ...draft,
      memberships: [...draft.memberships].reverse().map((member) => ({
        ...member,
        note: member.symbol === "ALFA" ? "Latest unsaved note" : member.note,
      })),
    };
    const before = JSON.stringify(edited);
    owner.reconcile(edited, eodSelection.catalogSnapshotSha256, false);
    expect(
      reconcileManagedWatchlistComparison(selected, owner.getSnapshot()),
    ).toBe(selected);
    selected = dateChange(selected, owner.getSnapshot(), "endDate", dates[2]);
    expect(
      projectManagedWatchlistComparison(selected, owner.getSnapshot())
        .comparison?.status,
    ).toBe("available");
    expect(read).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(edited)).toBe(before);
    owner.reconcile(edited, eodSelection.catalogSnapshotSha256, true);
    read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await owner.load(loaded.rows[0]!.handle);
    expect(
      reconcileManagedWatchlistComparison(selected, owner.getSnapshot()),
    ).toBe(selected);
    expect(
      projectManagedWatchlistComparison(selected, owner.getSnapshot()).left
        ?.history.showingPrevious,
    ).toBe(true);
    let complete!: (value: ReturnType<typeof response>) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const held = owner.load(loaded.rows[0]!.handle);
    owner.getSnapshot().pending!.cancel();
    complete(response(alfa, ["1", "2", "3"]));
    await held;
    expect(selected.left?.response).toBe(source);
    expect(
      reconcileManagedWatchlistComparison(selected, owner.getSnapshot()),
    ).toBe(selected);
    expect(read).toHaveBeenCalledTimes(4);
    owner.retire();
    const retired = reconcileManagedWatchlistComparison(
      selected,
      owner.getSnapshot(),
    );
    expect(retired.left).toBeNull();
    expect(retired.right).toBeNull();
  });
});
