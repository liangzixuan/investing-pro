import type { ManagedEodCloseDto } from "@research-cockpit/contracts";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RawCloseComparison } from "./RawCloseComparison";

interface Selection {
  rows: readonly ManagedEodCloseDto[];
  symbol: string;
  date: string;
}

const hooks = vi.hoisted(() => ({
  direct: false,
  selection: null as Selection | null,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "comparison" : actual.useId()),
    useState: (initial: Selection) => {
      if (!hooks.direct) return actual.useState(initial);
      hooks.selection ??= initial;
      return [
        hooks.selection,
        (next: React.SetStateAction<Selection>) => {
          hooks.selection =
            typeof next === "function" ? next(hooks.selection!) : next;
        },
      ];
    },
  };
});
afterEach(() => {
  hooks.direct = false;
  hooks.selection = null;
});

const rows: readonly ManagedEodCloseDto[] = Object.freeze([
  Object.freeze({ date: "2026-09-17", close: "100.000000000000000001" }),
  Object.freeze({ date: "2026-09-18", close: "107.500000000000000002" }),
  Object.freeze({ date: "2026-09-19", close: "110.000000000000000003" }),
]);

type Element = React.ReactElement<{ children?: React.ReactNode }>;
type Select = React.ReactElement<React.ComponentProps<"select">>;
function render(history = rows, symbol = "ALFA") {
  hooks.direct = true;
  return RawCloseComparison({ rows: history, symbol });
}
function selectFrom(element: Element): Select {
  const select = React.Children.toArray(element.props.children).find(
    (child) => React.isValidElement(child) && child.type === "select",
  );
  if (!React.isValidElement(select)) throw new Error("Expected date select");
  return select as Select;
}
function choose(select: Select, value: string) {
  select.props.onChange?.({
    currentTarget: { value },
  } as React.ChangeEvent<HTMLSelectElement>);
}
function html(history = rows, symbol = "ALFA") {
  return renderToStaticMarkup(render(history, symbol));
}

describe("raw close comparison", () => {
  it("starts blank with a labelled native select containing only prior observed dates", () => {
    const element = render();
    const select = selectFrom(element);
    const markup = renderToStaticMarkup(element);
    expect(select.props.value).toBe("");
    expect(select.props.disabled).toBe(false);
    expect(select.props["aria-label"]).toBeUndefined();
    expect(markup).toContain(">ALFA comparison start date</label>");
    expect(markup).toContain(`for="${select.props.id}"`);
    expect(markup).toContain(`id="${select.props["aria-describedby"]}"`);
    expect(markup).toContain(
      "Compare an earlier observed date with the latest loaded close.",
    );
    expect(markup).toContain(
      '<option value="" selected="">Choose an observed date</option>',
    );
    expect(markup).toContain('<option value="2026-09-17">2026-09-17</option>');
    expect(markup).toContain('<option value="2026-09-18">2026-09-18</option>');
    expect(markup).not.toContain('<option value="2026-09-19">');
    expect(markup).not.toContain("Starting raw close (USD)");
    expect(markup).toContain(
      "Raw closes are not adjusted for splits or dividends.",
    );
  });

  it.each([{ history: [] }, { history: [rows[0]!] }])(
    "explains unavailable history and disables the select: %j",
    ({ history }) => {
      const element = render(history);
      expect(selectFrom(element).props.disabled).toBe(true);
      const markup = renderToStaticMarkup(element);
      expect(markup).toContain(
        "Comparison unavailable: two dated closes needed.",
      );
      expect(markup).not.toContain("Raw close change:");
    },
  );

  it("compares the chosen earlier row to the latest with exact endpoint decimals and dates", () => {
    const before = JSON.stringify(rows);
    choose(selectFrom(render()), rows[0]!.date);
    const markup = html();
    expect(markup).toMatch(/datetime="2026-09-17">2026-09-17<\/time>/iu);
    expect(markup).toMatch(/datetime="2026-09-19">2026-09-19<\/time>/iu);
    expect(markup).toContain("100.000000000000000001");
    expect(markup).toContain("110.000000000000000003");
    expect(markup).toContain("Latest loaded raw close (USD)");
    expect(markup).toContain(
      "Raw close change: +$10.000000000000000002 (+10.0000%)",
    );
    expect(markup).toContain('role="status" aria-live="polite"');
    expect(JSON.stringify(rows)).toBe(before);
    choose(selectFrom(render()), rows[1]!.date);
    expect(html()).toContain(
      "Raw close change: +$2.500000000000000001 (+2.3256%)",
    );
  });

  it.each([
    ["10.25", "10.5", "+$0.25 (+2.4390%)"],
    ["20.75", "20.5", "-$0.25 (-1.2048%)"],
    ["30.50", "30.500", "$0 (0.0000%)"],
    ["32", "32.000016", "+$0.000016 (+0.0001%)"],
    ["32", "31.999984", "-$0.000016 (-0.0001%)"],
    ["100", "100.00001", "+$0.00001 (less than 0.0001% higher)"],
    ["100", "99.99999", "-$0.00001 (less than 0.0001% lower)"],
  ])(
    "renders the exact signed raw change from %s to %s",
    (start, latest, expected) => {
      const history = [
        { date: "2026-09-18", close: start },
        { date: "2026-09-21", close: latest },
      ];
      choose(selectFrom(render(history)), history[0]!.date);
      const markup = html(history);
      expect(markup).toContain(`Raw close change: ${expected}`);
      expect(markup).toContain(`>${start}</span>`);
      expect(markup).toContain(`>${latest}</span>`);
    },
  );

  it("keeps 64-character admitted endpoint values complete", () => {
    const start = `100.${"0".repeat(59)}1`;
    const latest = `101.${"0".repeat(59)}1`;
    expect(start).toHaveLength(64);
    const history = [
      { date: "2026-09-18", close: start },
      { date: "2026-09-19", close: latest },
    ];
    choose(selectFrom(render(history)), history[0]!.date);
    expect(html(history)).toContain(`>${start}</span>`);
    expect(html(history)).toContain(`>${latest}</span>`);
    expect(html(history)).toContain("Raw close change: +$1 (+1.0000%)");
  });

  it.each(["", "2026-09-19", "2026-09-16", "not-a-date"])(
    "clears or refuses a value outside the earlier options: %s",
    (value) => {
      choose(selectFrom(render()), rows[0]!.date);
      choose(selectFrom(render()), value);
      expect(selectFrom(render()).props.value).toBe("");
      expect(html()).not.toContain("Raw close change:");
    },
  );

  it("keeps the choice while the same rows remain visible during a retained-history state", () => {
    choose(selectFrom(render()), rows[0]!.date);
    expect(selectFrom(render()).props.value).toBe(rows[0]!.date);
    expect(html()).toContain(
      "Raw close change: +$10.000000000000000002 (+10.0000%)",
    );
  });

  it("clears immediately for a replacement response even when every row value is equal", () => {
    choose(selectFrom(render()), rows[0]!.date);
    const replacement = rows.map((row) => ({ ...row }));
    const firstRender = render(replacement);
    expect(selectFrom(firstRender).props.value).toBe("");
    expect(renderToStaticMarkup(firstRender)).not.toContain(
      "Raw close change:",
    );
    expect(selectFrom(render(replacement)).props.value).toBe("");
    expect(selectFrom(render(rows)).props.value).toBe("");
  });

  it("clears on a symbol change even if the same rows object is reused", () => {
    choose(selectFrom(render()), rows[0]!.date);
    const firstRender = render(rows, "BETA");
    expect(selectFrom(firstRender).props.value).toBe("");
    expect(renderToStaticMarkup(firstRender)).not.toContain(
      "Raw close change:",
    );
    expect(selectFrom(render(rows, "ALFA")).props.value).toBe("");
  });

  it("drops a prior result when history becomes empty or a single row", () => {
    choose(selectFrom(render()), rows[0]!.date);
    expect(html([])).not.toContain("Raw close change:");
    expect(html([rows[0]!])).not.toContain("Raw close change:");
    expect(selectFrom(render()).props.value).toBe("");
  });

  it("ignores a retired select callback without altering the replacement history's choice", () => {
    const retired = selectFrom(render());
    const replacement = rows.map((row) => ({ ...row }));
    choose(selectFrom(render(replacement)), rows[1]!.date);
    choose(retired, rows[0]!.date);
    expect(selectFrom(render(replacement)).props.value).toBe(rows[1]!.date);
    expect(html(replacement)).toContain(
      "Raw close change: +$2.500000000000000001 (+2.3256%)",
    );
  });

  it("gives mounted instances distinct label and help associations", () => {
    const markup = renderToStaticMarkup(
      <>
        <RawCloseComparison rows={rows} symbol="ALFA" />
        <RawCloseComparison rows={rows} symbol="BETA" />
      </>,
    );
    const selectIds = [...markup.matchAll(/<select id="([^"]+)"/gu)].map(
      (match) => match[1],
    );
    expect(selectIds).toHaveLength(2);
    expect(new Set(selectIds).size).toBe(2);
    for (const id of selectIds) expect(markup).toContain(`for="${id}"`);
    expect(markup).not.toContain("Raw close change:");
  });
});
