import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseManagedEodHistoryResponse,
  type ManagedEodCloseDto,
} from "@research-cockpit/contracts";
import {
  ManagedWatchlistComparison,
  ManagedWatchlistComparisonView,
} from "./ManagedWatchlistComparison";
import { ManagedWatchlistComparisonNoteAction } from "./ManagedWatchlistComparisonNoteAction";
import {
  changeManagedWatchlistComparisonInterval,
  createManagedWatchlistComparisonSelection,
  projectManagedWatchlistComparison,
  selectManagedWatchlistComparisonRow,
  type ManagedWatchlistComparisonSelection,
} from "./managed-watchlist-comparison";
import { ManagedEodHistory } from "./managed-eod-history";
import type {
  ManagedWatchlistPriceRow,
  ManagedWatchlistPricesState,
} from "./managed-watchlist-prices";
import { eodResponse, eodSelection } from "./eod-history-fixture";

const hooks = vi.hoisted(() => ({
  enabled: false,
  initialized: false,
  state: undefined as ManagedWatchlistComparisonSelection | undefined,
  changed: false,
  ref: undefined as undefined | { current: unknown },
  effect: undefined as undefined | (() => void),
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useState: (
      initial:
        | ManagedWatchlistComparisonSelection
        | (() => ManagedWatchlistComparisonSelection),
    ) => {
      if (!hooks.enabled) return actual.useState(initial);
      if (!hooks.initialized) {
        hooks.initialized = true;
        hooks.state = typeof initial === "function" ? initial() : initial;
      }
      return [
        hooks.state,
        (
          update:
            | ManagedWatchlistComparisonSelection
            | ((
                previous: ManagedWatchlistComparisonSelection,
              ) => ManagedWatchlistComparisonSelection),
        ) => {
          const next =
            typeof update === "function" ? update(hooks.state!) : update;
          hooks.changed = next !== hooks.state;
          hooks.state = next;
        },
      ];
    },
    useRef: (initial: unknown) =>
      hooks.enabled
        ? (hooks.ref ??= { current: initial })
        : actual.useRef(initial),
    useLayoutEffect: (
      effect: () => void,
      dependencies: React.DependencyList,
    ) => {
      if (hooks.enabled) hooks.effect = effect;
      else actual.useLayoutEffect(effect, dependencies);
    },
  };
});
afterEach(() => {
  hooks.enabled = false;
  hooks.initialized = false;
  hooks.state = undefined;
  hooks.ref = undefined;
  hooks.effect = undefined;
  hooks.changed = false;
});

const dates = ["2026-09-17", "2026-09-18", "2026-09-19"];
const noteActions = () => ({
  getAction: vi.fn(() => ({ canAppend: false, reason: "Choose a note." })),
  append: vi.fn(() => ({ appended: false, message: "Choose a note." })),
});
const closes = (values: readonly string[]): ManagedEodCloseDto[] =>
  values.map((close, index) => ({ date: dates[index]!, close }));
function priceRow(
  symbol: string,
  values: readonly ManagedEodCloseDto[] | null = closes(["100", "110", "90"]),
  shareClassName = "Class A",
  identity = symbol,
): ManagedWatchlistPriceRow {
  const listing = {
    ...eodSelection.listing,
    symbol,
    listingId: `listing-${identity.toLowerCase()}`,
    securityId: `security-${identity.toLowerCase()}`,
    shareClassId: `class-${identity.toLowerCase()}`,
    shareClassName,
    securityName: `Shared Company ${shareClassName}`,
    issuerName: "Shared Company",
  };
  const request = { ...eodSelection, listing, origin: "watchlist" as const };
  const raw = eodResponse();
  const response =
    values &&
    parseManagedEodHistoryResponse(
      { ...raw, security: listing, rows: values },
      {
        catalogSnapshotSha256: raw.catalogSnapshotSha256,
        listingId: listing.listingId,
        range: "1m",
      },
    );
  if (values && !response)
    throw new Error("Invalid invented comparison packet");
  const model = new ManagedEodHistory(vi.fn(), vi.fn(), undefined, [listing]);
  model.open(
    request,
    response ? { response, showingPrevious: false } : undefined,
  );
  return { handle: Symbol(symbol), listing, history: model.getSnapshot() };
}
const state = (
  rows: readonly ManagedWatchlistPriceRow[],
): ManagedWatchlistPricesState => ({
  active: true,
  canRead: true,
  catalogChanged: false,
  pending: null,
  rows,
});
function fixture() {
  const left = priceRow("ALFA");
  const right = priceRow("BETA", closes(["100", "95", "120"]), "Class C");
  const third = priceRow("UNLOADED", null);
  const unsupported = priceRow("UNSUPPORTED", null);
  const prices = state([left, right, third]);
  const memberships = [left, right, third, unsupported].map((row) => ({
    ...row.listing,
    note: "Exact unsaved café note",
  }));
  return { left, right, third, prices, memberships };
}
type ViewProps = React.ComponentProps<typeof ManagedWatchlistComparisonView>;
function selectedProjection(prices: ManagedWatchlistPricesState) {
  const empty = createManagedWatchlistComparisonSelection();
  const left = selectManagedWatchlistComparisonRow(
    empty,
    empty,
    prices,
    "left",
    prices.rows[0]!,
  );
  const pair = selectManagedWatchlistComparisonRow(
    left,
    left,
    prices,
    "right",
    prices.rows[1]!,
  );
  return projectManagedWatchlistComparison(pair, prices);
}
const text = (html: string) =>
  html.replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ");
function markup(f = fixture(), projection = selectedProjection(f.prices)) {
  return renderToStaticMarkup(
    <ManagedWatchlistComparisonView
      memberships={f.memberships}
      prices={f.prices}
      projection={projection}
      onPair={vi.fn()}
      onDate={vi.fn()}
    />,
  );
}

describe("watchlist pair presentation", () => {
  it("starts empty, lists the complete draft and labels unsupported versus unloaded", () => {
    const f = fixture();
    const html = renderToStaticMarkup(
      <ManagedWatchlistComparison
        memberships={f.memberships}
        prices={f.prices}
        editable
        comparisonNoteActions={noteActions()}
      />,
    );
    expect(text(html)).toContain("Choose two distinct watchlist listings");
    expect(html).not.toContain("<table");
    expect(html.match(/value="listing-alfa"/gu) ?? []).toHaveLength(2);
    expect(
      html.match(/value="listing-unsupported" disabled=""/gu) ?? [],
    ).toHaveLength(2);
    expect(text(html)).toContain(
      "UNLOADED · Shared Company · Class A · XNAS — not loaded",
    );
    expect(html).toContain(
      'aria-label="Watchlist raw price comparison results"',
    );
    expect(html.match(/<select /gu) ?? []).toHaveLength(5);
    expect(html.match(/<summary>/gu) ?? []).toHaveLength(1);
  });

  it("shows exact endpoints, signed changes, share classes and original dated provenance", () => {
    const html = markup();
    expect(text(html)).toContain("-$10 (-10.0000%)");
    expect(text(html)).toContain("+$20 (+20.0000%)");
    expect(text(html)).toContain("3 shared observed dates in this interval");
    expect(text(html)).toContain("Shared Company · Class A · XNAS");
    expect(text(html)).toContain("Shared Company · Class C · XNAS");
    expect(html).toContain("2026-09-20T00:00:01.000Z");
    expect(text(html)).toContain("2026-08-20 to 2026-09-20");
    expect(html).toContain('tabindex="0"');
    expect(text(html)).toContain("Loaded / omitted observations3 / 0");
  });

  it("keeps equal symbols on distinct share classes as separate exact rows", () => {
    const f = fixture();
    const otherClass = priceRow(
      "ALFA",
      closes(["100", "95", "120"]),
      "Class C",
      "alfa-c",
    );
    f.prices = state([f.left, otherClass]);
    f.memberships = [f.left, otherClass].map((row) => ({
      ...row.listing,
      note: "Different notes remain independent",
    }));
    const html = markup(f);
    expect(html.match(/<strong>ALFA<\/strong>/gu) ?? []).toHaveLength(2);
    expect(text(html)).toContain("Shared Company · Class A · XNAS");
    expect(text(html)).toContain("Shared Company · Class C · XNAS");
    expect(text(html)).toContain("-$10 (-10.0000%)");
    expect(text(html)).toContain("+$20 (+20.0000%)");
  });

  it.each([
    ["100", "100.000000000000000001", "less than 0.0001% higher"],
    ["100.000000000000000001", "100", "less than 0.0001% lower"],
    ["100", "100", "$0 (0.0000%)"],
    [`1.${"2".repeat(62)}`, `1.${"3".repeat(62)}`, "+9.0909%"],
  ])("preserves exact raw values %s to %s", (first, last, expected) => {
    const f = fixture();
    f.prices = state([priceRow("ALFA", closes([first, "110", last])), f.right]);
    const html = markup(f);
    expect(html).toContain(first);
    expect(html).toContain(last);
    expect(text(html)).toContain(expected);
  });

  it("uses shared observations only and explains one or zero common dates", () => {
    const f = fixture();
    const gap = priceRow("BETA", [
      { date: dates[0]!, close: "100" },
      { date: dates[2]!, close: "120" },
    ]);
    f.prices = state([f.left, gap]);
    expect(text(markup(f))).toContain(
      "2 shared observed dates in this interval",
    );
    expect(text(markup(f))).toContain("Loaded / omitted observations3 / 1");
    for (const date of [dates[1]!, "2026-09-16"]) {
      f.prices = state([f.left, priceRow("BETA", [{ date, close: "95" }])]);
      const html = markup(f);
      expect(html).not.toContain("<table");
      expect(text(html)).toContain(
        date === dates[1]
          ? "One shared observed date is loaded"
          : "No shared observed dates are loaded",
      );
    }
  });

  it("keeps retained-history qualifiers visible without a numeric comparison", () => {
    const f = fixture();
    for (const values of [closes(["100", "95", "120"]), closes(["100"])]) {
      const right = priceRow("BETA", values, "Class C");
      f.prices = state([
        f.left,
        { ...right, history: { ...right.history, showingPrevious: true } },
      ]);
      const initial = selectedProjection(f.prices);
      const selection = changeManagedWatchlistComparisonInterval(
        initial.selection,
        initial.selection,
        f.prices,
        "endDate",
        "",
      );
      const projection = projectManagedWatchlistComparison(selection, f.prices);
      const html = markup(f, projection);
      const visible = html.split("<details")[0]!;
      expect(visible).not.toContain("<table");
      expect(text(visible)).toContain(
        "Previous history retained for BETA · Class C · XNAS.",
      );
      expect(text(visible)).not.toContain("Previous history retained for ALFA");
      expect(visible).toContain('dateTime="2026-09-20T00:00:01.000Z"');
      expect(text(visible)).toContain("Newer prices have not been confirmed.");
      expect(text(visible)).toContain(
        values.length > 1
          ? "Choose an ending date after the starting date."
          : "One shared observed date is loaded",
      );
    }
  });

  it("keeps controls, result host and coverage summary mounted when values clear", () => {
    const f = fixture();
    const projection = selectedProjection(f.prices);
    for (const prices of [
      state([
        f.left,
        { ...f.right, history: { ...f.right.history, response: null } },
      ]),
      { ...f.prices, active: false },
      { ...f.prices, catalogChanged: true },
    ]) {
      const next = projectManagedWatchlistComparison(
        projection.selection,
        prices,
      );
      const html = markup({ ...f, prices }, next);
      expect(html.match(/<select /gu) ?? []).toHaveLength(4);
      expect(html).toContain(
        'aria-label="Watchlist raw price comparison results"',
      );
      expect(html).toContain('tabindex="-1"');
      expect(html).toContain(
        "<summary>Watchlist comparison coverage and request dates</summary>",
      );
      expect(html).not.toContain("<table");
      expect(html).not.toContain("2026-09-20T00:00:01.000Z");
    }
  });
});

function harness() {
  hooks.enabled = true;
  const f = fixture();
  let props: React.ComponentProps<typeof ManagedWatchlistComparison> = {
    memberships: f.memberships,
    prices: f.prices,
    active: true,
    editable: true,
    comparisonNoteActions: noteActions(),
  };
  let view: ViewProps;
  const render = (changes: Partial<typeof props> = {}) => {
    props = { ...props, ...changes };
    for (let i = 0; i < 3; i++) {
      hooks.changed = false;
      view = ManagedWatchlistComparison(props).props as ViewProps;
      if (!hooks.changed) break;
    }
    hooks.effect?.();
    return view!;
  };
  const pair = () => {
    render().onPair("left", f.left);
    render().onPair("right", f.right);
    return render();
  };
  return { ...f, render, pair };
}

describe("watchlist comparison selection lifetime", () => {
  it("keeps the note action outside the scroll region with current capture and editability", () => {
    const h = harness();
    const view = h.pair();
    const action = view.noteAction as React.ReactElement<
      React.ComponentProps<typeof ManagedWatchlistComparisonNoteAction>
    >;
    expect(action.type).toBe(ManagedWatchlistComparisonNoteAction);
    expect(action.props.selection).toBe(view.projection.selection);
    expect(action.props.active).toBe(true);
    expect(action.props.editable).toBe(true);
    const rendered = renderToStaticMarkup(
      <ManagedWatchlistComparisonView
        {...view}
        noteAction={<div data-note-action />}
      />,
    );
    expect(rendered.indexOf("data-note-action")).toBeGreaterThan(
      rendered.indexOf("Raw closes are not adjusted"),
    );
    const locked = h.render({ editable: false, active: false });
    expect((locked.noteAction as typeof action).props).toMatchObject({
      active: false,
      editable: false,
    });
    expect((locked.noteAction as typeof action).type).toBe(action.type);
  });

  it("changes only local pair/dates, preserving the full draft and captured sources", () => {
    const h = harness();
    const before = JSON.stringify(h.memberships);
    let view = h.pair();
    view.onDate("endDate", dates[1]!);
    view = h.render();
    expect(view.projection.comparison).toMatchObject({
      status: "available",
      firstDate: dates[0],
      lastDate: dates[1],
    });
    expect(text(markup(h, view.projection))).toContain("+$10 (+10.0000%)");
    expect(text(markup(h, view.projection))).toContain("-$5 (-5.0000%)");
    expect(JSON.stringify(h.memberships)).toBe(before);
    expect(h.prices.rows[0]!.history.response!.rows).toEqual(
      closes(["100", "110", "90"]),
    );
  });

  it("preserves pair and interval through note/reorder/save copies and retained flags", () => {
    const h = harness();
    h.pair().onDate("endDate", dates[1]!);
    const selected = h.render().projection.selection;
    const prices = {
      ...h.prices,
      canRead: false,
      rows: h.prices.rows.map((row) => ({
        ...row,
        history: { ...row.history, showingPrevious: true, error: true },
      })),
    };
    const view = h.render({
      memberships: [...h.memberships]
        .reverse()
        .map((member) => ({ ...member, note: "Changed raw note" })),
      prices,
    });
    expect(view.projection.selection).toBe(selected);
    expect(view.projection.comparison).toMatchObject({ lastDate: dates[1] });
    expect(text(markup({ ...h, prices }, view.projection))).toContain(
      "Previous history retained",
    );
  });

  it("resets on equal-valued replacement but not an unrelated row; stale events cannot change it", () => {
    const h = harness();
    h.pair().onDate("endDate", dates[1]!);
    const old = h.render();
    const unrelated = {
      ...h.prices,
      rows: [h.left, h.right, priceRow("UNLOADED")],
    };
    expect(h.render({ prices: unrelated }).projection.selection).toBe(
      old.projection.selection,
    );
    const prices = {
      ...unrelated,
      rows: [
        {
          ...h.left,
          history: {
            ...h.left.history,
            response: structuredClone(h.left.history.response),
          },
        },
        h.right,
      ],
    };
    const fresh = h.render({ prices });
    expect(fresh.projection.selection.endDate).toBe(dates[2]);
    expect(fresh.projection.selection.resetNotice).toBe(true);
    old.onDate("endDate", dates[1]!);
    old.onPair("right", h.third);
    expect(h.render().projection.selection).toBe(fresh.projection.selection);
  });

  it("refuses duplicate choices and blocked stale callbacks, then clears only explicitly", () => {
    const h = harness();
    let view = h.pair();
    view.onPair("right", h.left);
    view = h.render();
    expect(view.projection.reason).toBe("duplicate");
    expect(view.projection.right?.handle).toBe(h.right.handle);
    const stale = view;
    view = h.render({ active: false });
    stale.onPair("left", null);
    expect(h.render().projection.selection).toBe(view.projection.selection);
    h.render({ active: true }).onPair("left", null);
    expect(h.render().projection.reason).toBe("left_required");
  });

  it("shows unavailable for selected unloaded rows and clears retired selections without revival", () => {
    const h = harness();
    h.pair().onPair("right", h.third);
    expect(h.render().projection.reason).toBe("history_unavailable");
    const old = h.render();
    const inactive = { ...h.prices, active: false, rows: [] };
    const retired = h.render({ prices: inactive });
    expect(retired.projection.left).toBeNull();
    expect(retired.projection.right).toBeNull();
    old.onPair("left", h.left);
    expect(h.render().projection.selection).toBe(retired.projection.selection);
    const reopened = h.render({
      prices: state([priceRow("ALFA"), priceRow("BETA")]),
    });
    expect(reopened.projection.left).toBeNull();
    expect(reopened.projection.right).toBeNull();
  });
});
