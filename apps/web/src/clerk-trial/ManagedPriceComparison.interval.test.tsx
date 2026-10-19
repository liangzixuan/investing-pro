import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import {
  ManagedPriceComparison,
  type ManagedPriceComparisonView,
} from "./ManagedPriceComparison";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedEodHistoryError } from "./managed-api";
import {
  changeManagedPriceComparisonInterval,
  createManagedPriceComparisonSelection,
  deriveManagedPriceComparison,
  deriveManagedPriceComparisonHistory,
  orderManagedPriceComparison,
  sameManagedPriceComparisonSources,
  type ManagedPriceComparisonState,
} from "./managed-price-comparison";
import { MANAGED_PRICE_COVERAGE } from "./managed-price-coverage";
import { eodResponse } from "./eod-history-fixture";

// These hooks exercise presentation choices, not actual DOM focus.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (importActualReact) => {
  const actual = await importActualReact<typeof React>();
  return {
    ...actual,
    useId: () => "shared-interval",
    useState: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.values))
        hooks.values[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        hooks.values[index],
        (next: unknown) => {
          hooks.values[index] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(hooks.values[index])
              : next;
        },
      ];
    },
  };
});
afterEach(() => {
  hooks.values = [];
  hooks.cursor = 0;
  vi.restoreAllMocks();
});

const dates = ["2026-09-17", "2026-09-18", "2026-09-19"];
function state(
  prices = [
    ["100", "110", "90"],
    ["100", "95", "120"],
    ["100", "105", "108"],
  ],
): ManagedPriceComparisonState {
  return {
    active: true,
    catalogChanged: false,
    rows: prices.map((values, index) => {
      const listing = MANAGED_PRICE_COVERAGE[index]!;
      const initial = eodResponse();
      const response = parseManagedEodHistoryResponse(
        {
          ...initial,
          security: listing,
          rows: values.map((close, row) => ({ date: dates[row]!, close })),
        },
        {
          catalogSnapshotSha256: initial.catalogSnapshotSha256,
          listingId: listing.listingId,
          range: "1m",
        },
      );
      if (!response) throw new Error("Invalid invented interval packet");
      return {
        listing,
        response,
        showingPrevious: false,
        running: false,
        error: false,
        message: "Invented history",
      };
    }),
  };
}
function project(input: ManagedPriceComparisonState) {
  const history = deriveManagedPriceComparisonHistory(input);
  const selection = createManagedPriceComparisonSelection(input, history);
  return { history, selection };
}
function render(
  input: ManagedPriceComparisonState,
): React.ReactElement<React.ComponentProps<typeof ManagedPriceComparisonView>> {
  hooks.cursor = 0;
  return ManagedPriceComparison({ state: input });
}
function html(input: ManagedPriceComparisonState) {
  return renderToStaticMarkup(render(input));
}

async function workspaceFixture() {
  const invented = await createFixture();
  const { api, session, marketsCohort, priceCoverage } = invented;
  const workspace = new ManagedWorkspace(api, session, undefined, {
    researchCoverage: inventedManagedResearchCoverage,
    marketsCohort,
    priceCoverage,
  });
  const read = vi.spyOn(api, "eodHistory").mockImplementation((request) =>
    Promise.resolve({
      ...eodResponse(),
      catalogSnapshotSha256: request.catalogSnapshotSha256,
      security: marketsCohort.find(
        (row) => row.listingId === request.listingId,
      )!,
      rows: dates.map((date, index) => ({ date, close: String(100 + index) })),
    }),
  );
  const save = vi.spyOn(api, "save");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await vi.waitFor(() =>
    expect(workspace.markets.getSnapshot().rows).toHaveLength(3),
  );
  await workspace.markets.load();
  return { workspace, read, save };
}

describe("shared observed price intervals", () => {
  it("keeps an interval through real model Cancel, late completion and retained failure without saving or reading on date changes", async () => {
    const { workspace, read, save } = await workspaceFixture();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[1]!;
    workspace.note(member.listingId, "Invented unsaved interval note");
    workspace.move(member.listingId, -1);
    const draft = workspace.coordinator.getSnapshot().draft;
    const boardSelection = workspace.markets.getSnapshot().selectedListingId;
    render(workspace.markets.getSnapshot()).props.onDate("endDate", dates[1]!);
    render(workspace.markets.getSnapshot()).props.onOrder("highest");
    expect(read).toHaveBeenCalledTimes(3);
    expect(save).not.toHaveBeenCalled();
    const oldResponse = workspace.markets.getSnapshot().rows[0]!.response!;
    let finish!: (value: ReturnType<typeof eodResponse>) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = workspace.markets.loadSelected();
    expect(
      render(workspace.markets.getSnapshot()).props.selection.endDate,
    ).toBe(dates[1]);
    workspace.markets.cancel();
    expect(read.mock.calls[3]![1].aborted).toBe(true);
    finish({
      ...oldResponse,
      rows: oldResponse.rows.map((row) => ({ ...row, close: "500" })),
    });
    await pending;
    expect(workspace.markets.getSnapshot().rows[0]!.response).toBe(oldResponse);
    expect(
      render(workspace.markets.getSnapshot()).props.selection.endDate,
    ).toBe(dates[1]);
    read.mockRejectedValueOnce(new ManagedEodHistoryError("unavailable"));
    await workspace.markets.loadSelected();
    const retained = render(workspace.markets.getSnapshot());
    expect(retained.props.selection).toMatchObject({
      endDate: dates[1],
      resetNotice: false,
    });
    expect(retained.props.order).toBe("highest");
    expect(renderToStaticMarkup(retained)).toContain(
      "Previous history retained",
    );
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(workspace.markets.getSnapshot().selectedListingId).toBe(
      boardSelection,
    );
    expect(read).toHaveBeenCalledTimes(5);
    expect(save).not.toHaveBeenCalled();
  });

  it("changes the exact ranking over an earlier interval without mutating source or full coverage", () => {
    const input = state();
    const original = JSON.stringify(input);
    const { history, selection } = project(input);
    const full = orderManagedPriceComparison(
      deriveManagedPriceComparison(history, selection),
      "highest",
    );
    const first = changeManagedPriceComparisonInterval(
      selection,
      history,
      "endDate",
      dates[1]!,
    );
    const result = orderManagedPriceComparison(
      deriveManagedPriceComparison(history, first),
      "highest",
    );
    expect(full?.status).toBe("available");
    expect(result?.status).toBe("available");
    if (full?.status !== "available" || result?.status !== "available")
      throw new Error("Missing comparison");
    expect(full.rows.map((r) => r.listing.symbol)).toEqual([
      "GOOG",
      "GOOGL",
      "AAPL",
    ]);
    expect(
      result.rows.map((r) => [
        r.listing.symbol,
        r.firstClose,
        r.lastClose,
        r.change.changePercent,
      ]),
    ).toEqual([
      ["AAPL", "100", "110", "10.0000"],
      ["GOOGL", "100", "105", "5.0000"],
      ["GOOG", "100", "95", "-5.0000"],
    ]);
    expect(result.sharedDateCount).toBe(3);
    expect(result.intervalDateCount).toBe(2);
    expect(JSON.stringify(input)).toBe(original);
    expect(result.rows[0]!.response).toBe(input.rows[0]!.response);
  });

  it("clears End when Start reaches it and withholds figures until a later End is chosen", () => {
    const { history, selection } = project(state());
    const early = changeManagedPriceComparisonInterval(
      selection,
      history,
      "endDate",
      dates[1]!,
    );
    const later = changeManagedPriceComparisonInterval(
      early,
      history,
      "startDate",
      dates[1]!,
    );
    expect(later).toMatchObject({ startDate: dates[1], endDate: "" });
    expect(deriveManagedPriceComparison(history, later)?.status).toBe(
      "interval_required",
    );
    const valid = changeManagedPriceComparisonInterval(
      later,
      history,
      "endDate",
      dates[2]!,
    );
    expect(deriveManagedPriceComparison(history, valid)).toMatchObject({
      status: "available",
      firstDate: dates[1],
      lastDate: dates[2],
      intervalDateCount: 2,
    });
  });

  it.each(["2026-09-16", "2026-09-20", "invented"])(
    "refuses unobserved injected date %s",
    (date) => {
      const { history, selection } = project(state());
      for (const field of ["startDate", "endDate"] as const)
        expect(
          changeManagedPriceComparisonInterval(selection, history, field, date),
        ).toBe(selection);
      expect(
        deriveManagedPriceComparison(history, {
          startDate: date,
          endDate: dates[2]!,
        })?.status,
      ).toBe("interval_required");
    },
  );

  it("rejects equal/reversed endpoints even when bypassing the controls", () => {
    const { history, selection } = project(state());
    const later = changeManagedPriceComparisonInterval(
      selection,
      history,
      "startDate",
      dates[1]!,
    );
    for (const endDate of [dates[0]!, dates[1]!]) {
      expect(
        changeManagedPriceComparisonInterval(
          later,
          history,
          "endDate",
          endDate,
        ),
      ).toBe(later);
      expect(
        deriveManagedPriceComparison(history, { startDate: dates[1]!, endDate })
          ?.status,
      ).toBe("interval_required");
    }
  });

  it("keeps full-overlap omission counts and original provenance outside the selected interval", () => {
    const input = state();
    const view = render(input);
    view.props.onDate("endDate", dates[1]!);
    const output = html(input);
    expect(output).toContain("2 shared observed dates in this interval");
    expect(output).toContain("3 across the loaded histories");
    expect(output.match(/<dd>3 \/ 0<\/dd>/gu)).toHaveLength(3);
    expect(output).toContain("not dates outside the selected interval");
    expect(output).toContain(input.rows[0]!.response!.requestStartedAt);
    expect(output).toContain(input.rows[0]!.response!.completedAt);
    expect(output).toContain("2026-09-19"); // Full observed coverage retains its last date.
  });

  it("retains choices and order across status wrappers, retained failure and Cancel", () => {
    const input = state();
    const view = render(input);
    view.props.onDate("endDate", dates[1]!);
    view.props.onOrder("highest");
    for (const running of [true, false]) {
      const wrapped = {
        ...input,
        rows: input.rows.map((r) => ({
          ...r,
          listing: { ...r.listing },
          running,
          showingPrevious: true,
        })),
      };
      const next = render(wrapped);
      expect(next.props.selection.endDate).toBe(dates[1]);
      expect(next.props.order).toBe("highest");
      expect(next.props.selection.resetNotice).toBe(false);
      expect(renderToStaticMarkup(next)).toContain("Previous history retained");
    }
  });

  it.each([false, true])(
    "resets after a new response, including equal values=%s, and fences old handlers",
    (equal) => {
      const input = state();
      const old = render(input);
      old.props.onDate("endDate", dates[1]!);
      old.props.onOrder("lowest");
      const replacement = state(
        equal
          ? undefined
          : [
              ["100", "109", "91"],
              ["100", "95", "120"],
              ["100", "105", "108"],
            ],
      );
      const mixed = {
        ...input,
        rows: [replacement.rows[0]!, ...input.rows.slice(1)],
      };
      const next = render(mixed);
      expect(next.props.selection).toMatchObject({
        startDate: dates[0],
        endDate: dates[2],
        resetNotice: true,
      });
      expect(next.props.order).toBe("lowest");
      old.props.onDate("endDate", dates[1]!);
      expect(render(mixed).props.selection.endDate).toBe(dates[2]);
      expect(html(mixed)).toContain(
        "Loaded histories changed; showing the full shared span.",
      );
      render(mixed).props.onDate("endDate", dates[1]!);
      expect(render(mixed).props.selection.resetNotice).toBe(false);
    },
  );

  it("binds the full ordered listing identities rather than symbol or wrapper identity", () => {
    const input = state();
    const { selection } = project(input);
    expect(
      sameManagedPriceComparisonSources(selection, {
        ...input,
        rows: [...input.rows],
      }),
    ).toBe(true);
    const changed = {
      ...input,
      rows: [
        {
          ...input.rows[0]!,
          listing: { ...input.rows[0]!.listing, shareClassId: "other-class" },
        },
        ...input.rows.slice(1),
      ],
    };
    expect(sameManagedPriceComparisonSources(selection, changed)).toBe(false);
    expect(
      sameManagedPriceComparisonSources(selection, {
        ...input,
        rows: [...input.rows].reverse(),
      }),
    ).toBe(false);
  });

  it("clears unavailable figures and reinitializes after reload without retaining a custom interval", () => {
    const input = state();
    render(input).props.onDate("endDate", dates[1]!);
    const missing = {
      ...input,
      rows: [{ ...input.rows[0]!, response: null }, ...input.rows.slice(1)],
    };
    const output = html(missing);
    expect(output).not.toContain("<table");
    expect(output).not.toContain("<td>");
    expect(output).toContain("No shared dates available");
    expect(render(input).props.selection).toMatchObject({
      startDate: dates[0],
      endDate: dates[2],
      resetNotice: false,
    });
  });

  it.each([0, 1, 2])(
    "keeps controls and both focus hosts present with %s shared dates",
    (count) => {
      const input = state(
        Array.from({ length: 3 }, () =>
          ["100", "110", "90"].slice(0, Math.max(1, count)),
        ),
      );
      const actual =
        count === 0
          ? {
              ...input,
              rows: input.rows.map((r, i) => ({
                ...r,
                response: {
                  ...r.response!,
                  rows: [{ date: dates[i]!, close: "100" }],
                },
              })),
            }
          : input;
      const output = html(actual);
      expect(output.match(/<select /gu)).toHaveLength(3);
      expect(output).not.toContain("disabled");
      expect(output).toContain('aria-label="Raw price comparison results"');
      expect(output).toContain(
        "Comparison coverage and request dates</summary>",
      );
      expect(output.includes("<table")).toBe(count === 2);
    },
  );

  it("removes figures on retirement and gives a newly mounted view its full-span default", () => {
    const input = state();
    render(input).props.onDate("endDate", dates[1]!);
    expect(html({ ...input, active: false })).toBe("");
    expect(html({ ...input, catalogChanged: true })).toBe("");
    hooks.values = [];
    expect(render(input).props.selection).toMatchObject({
      startDate: dates[0],
      endDate: dates[2],
      resetNotice: false,
    });
  });
});
